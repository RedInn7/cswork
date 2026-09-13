import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createOaLibrary, handleOaLibrary } from '../lib/server/oa-library';

const fixture = () => ({
  schemaVersion: 1,
  source: {
    repository: 'https://github.com/RedInn7/OA-Master',
    commit: 'a'.repeat(40),
    origin: 'https://oamaster.com',
  },
  companies: [{ slug: 'meta', name: 'Meta', count: 35 }],
  items: Array.from({ length: 35 }, (_, index) => ({
    id: `oa-meta-${index + 1}`,
    companySlug: 'meta',
    companyName: 'Meta',
    number: index + 1,
    title: `题目 ${index + 1}`,
    sourceUrl: `https://oamaster.com/docs/companies/meta#${index + 1}-title`,
    languages: ['python'],
    statement: 'STATEMENT-SENTINEL',
    explanation: 'SOLUTION-SENTINEL',
    solutions: [{ language: 'python', code: 'PRIVATE-CODE-SENTINEL' }],
    contentHash: 'b'.repeat(64),
  })),
});
void test('OA library paginates and searches metadata without leaking bodies or enabling judging', () => {
  const library = createOaLibrary(fixture());
  const list = library.list(new URLSearchParams());
  assert.equal(list.total, 35);
  assert.equal(list.items.length, 30);
  assert.equal(library.list(new URLSearchParams('page=2')).items.length, 5);
  assert.equal(
    library.list(new URLSearchParams('q=题目%2035&company=meta')).total,
    1,
  );
  assert.equal(library.list(new URLSearchParams('q=%25')).total, 0);
  assert.equal(library.list(new URLSearchParams('page=-1')).page, 1);
  assert.equal(library.list(new URLSearchParams('page=99999')).items.length, 0);
  assert.throws(() => library.list(new URLSearchParams('company=unknown')));
  assert(!JSON.stringify(list).includes('SENTINEL'));
  assert(
    list.items.every(
      (item) =>
        item.judgeStatus === 'reading_only' && !('judgeProblemId' in item),
    ),
  );
});
void test('statement never exposes imported reference solutions', () => {
  const library = createOaLibrary(fixture());
  const detail = library.detail('oa-meta-1');
  assert.equal(detail.statement, 'STATEMENT-SENTINEL');
  assert(!JSON.stringify(detail).includes('SOLUTION-SENTINEL'));
  assert(!JSON.stringify(detail).includes('PRIVATE-CODE-SENTINEL'));
  assert.throws(() => library.solution('oa-meta-1'), { status: 409 });
  for (const id of ['lc-1', '../catalog.json', 'oa-meta-999']) {
    assert.throws(() => library.detail(id));
    assert.throws(() => library.solution(id));
  }
});
void test('OA source identity rejects external URLs, credentials, duplicates and count drift', () => {
  for (const url of [
    'https://evil.test/docs/companies/meta',
    'https://user@oamaster.com/docs/companies/meta',
    'https://oamaster.com/docs/companies/google',
  ]) {
    const value = fixture();
    value.items[0].sourceUrl = url;
    assert.throws(() => createOaLibrary(value));
  }
  const duplicate = fixture();
  duplicate.items[1].id = duplicate.items[0].id;
  assert.throws(() => createOaLibrary(duplicate));
  const count = fixture();
  count.companies[0].count = 1;
  assert.throws(() => createOaLibrary(count));
});
void test('anonymous OA requests are denied before loading content or touching the database', async () => {
  for (const path of [[], ['oa-meta-1'], ['oa-meta-1', 'solution']])
    await assert.rejects(
      handleOaLibrary(
        new Request('https://cswork.test/api/oj/oa-library'),
        null,
        path,
      ),
      { status: 401 },
    );
});
void test('checked-in OA catalog is complete and valid', () => {
  const catalog = JSON.parse(
    readFileSync('content/oa-master/catalog.json', 'utf8'),
  );
  const library = createOaLibrary(catalog);
  assert(catalog.items.length > 1000);
  assert.equal(library.list(new URLSearchParams()).total, catalog.items.length);
});
