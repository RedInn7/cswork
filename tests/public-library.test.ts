import assert from 'node:assert/strict';
import { after, test, mock } from 'node:test';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  copyFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicLibraryMarkdown } from '../app/library/markdown';
import {
  parsePublicLibraryQuery,
  publicLibraryList,
  publicLibraryItem,
  publicLibraryEntries,
  publicLibraryCount,
  publicLibraryPath,
  publicLibraryListPath,
  publicLibraryDescription,
} from '../lib/server/public-library';

const folder = mkdtempSync(join(tmpdir(), 'cswork-public-library-'));
const previousPath = process.env.CONTENT_DATABASE_PATH;
const previousHidden = process.env.HIDDEN_COMPANIES;
const previousUserPath = process.env.DATABASE_PATH;
process.env.DATABASE_PATH = join(
  folder,
  'must-not-create-user-database.sqlite',
);
process.env.CONTENT_DATABASE_PATH = join(folder, 'missing.sqlite');
delete process.env.HIDDEN_COMPANIES;
after(() => {
  if (previousPath === undefined) delete process.env.CONTENT_DATABASE_PATH;
  else process.env.CONTENT_DATABASE_PATH = previousPath;
  if (previousHidden === undefined) delete process.env.HIDDEN_COMPANIES;
  else process.env.HIDDEN_COMPANIES = previousHidden;
  if (previousUserPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousUserPath;
  rmSync(folder, { recursive: true, force: true });
});

void test('missing public library is empty and never creates application or content databases', () => {
  assert.deepEqual(publicLibraryList({ page: 1 }), {
    items: [],
    total: 0,
    pages: 1,
  });
  assert.equal(publicLibraryList({ page: 2 }), null);
  assert.equal(publicLibraryItem('algorithm', 'binary-search'), null);
  assert.deepEqual(publicLibraryEntries(), []);
  assert.equal(publicLibraryCount(), 0);
  assert.equal(existsSync(process.env.DATABASE_PATH!), false);
  assert.equal(existsSync(process.env.CONTENT_DATABASE_PATH!), false);
});

void test('query validation rejects malformed types, repeated params, invalid and excessive pages', () => {
  assert.deepEqual(parsePublicLibraryQuery({}), { type: undefined, page: 1 });
  assert.deepEqual(parsePublicLibraryQuery({ type: 'algorithm', page: '2' }), {
    type: 'algorithm',
    page: 2,
  });
  for (const params of [
    { type: 'constructor' },
    { type: 'course' },
    { type: ['algorithm'] },
    { page: ['1'] },
    ...['0', '-1', '1.5', 'NaN', '01', '10000000', '1e2', ''].map((page) => ({
      page,
    })),
  ])
    assert.equal(parsePublicLibraryQuery(params), null);
  assert.equal(publicLibraryList({ page: -1 }), null);
  assert.equal(publicLibraryList({ page: Infinity }), null);
  assert.equal(
    publicLibraryListPath({ type: 'algorithm', page: 1 }),
    '/library?type=algorithm',
  );
  assert.equal(publicLibraryListPath({ page: 2 }), '/library?page=2');
  assert.equal(
    publicLibraryPath('algorithm', 'binary-search'),
    '/library/algorithm/binary-search',
  );
});

void test('only complete, listed, nonduplicate public material is reachable and included in sitemap batches', () => {
  const path = join(folder, 'content.sqlite');
  const db = new Database(path);
  db.exec(`CREATE TABLE items(type TEXT,slug TEXT,title TEXT,summary TEXT,company_slug TEXT,company_name TEXT,
    updated_at TEXT,published_at TEXT,listed INTEGER,partial INTEGER,dup_of TEXT,body TEXT,extra TEXT)`);
  const insert = db.prepare(
    'INSERT INTO items VALUES (@type,@slug,@title,@summary,@company_slug,@company_name,@updated_at,@published_at,@listed,@partial,@dup_of,@body,@extra)',
  );
  const add = (row: Record<string, unknown>) =>
    insert.run({
      type: 'algorithm',
      slug: 'binary-search',
      title: 'Binary search',
      summary: 'Halve the range.',
      company_slug: null,
      company_name: null,
      updated_at: null,
      published_at: '2026-10-01',
      listed: 1,
      partial: 0,
      dup_of: null,
      body: 'Search a **sorted** array.',
      extra: '{}',
      ...row,
    });
  for (let index = 0; index < 25; index++)
    add({ slug: `lesson-${String(index).padStart(2, '0')}` });
  add({ slug: 'hidden', listed: 0 });
  add({ slug: 'partial', partial: 1 });
  add({ slug: 'duplicate', dup_of: '{"kind":"library"}' });
  add({ slug: 'paid-course', type: 'course' });
  add({ slug: '../unsafe' });
  add({ slug: 'broken-title', title: ' ' });
  add({ slug: 'template-guide', type: 'guide' });
  add({
    slug: 'company-question',
    type: 'interview_question',
    company_slug: 'facebook',
    company_name: 'Facebook',
    extra: '{"math":true}',
    updated_at: '2026-10-02',
  });
  db.close();
  process.env.CONTENT_DATABASE_PATH = path;
  const first = publicLibraryList({ page: 1 })!;
  const second = publicLibraryList({ page: 2 })!;
  assert.equal(first.total, 27);
  assert.equal(first.pages, 2);
  assert.equal(first.items.length, 24);
  assert.equal(second.items.length, 3);
  assert.equal(
    new Set([...first.items, ...second.items].map((item) => item.slug)).size,
    27,
  );
  assert.equal(publicLibraryList({ page: 3 }), null);
  assert.equal(publicLibraryList({ type: 'algorithm', page: 1 })!.total, 25);
  for (const slug of [
    'hidden',
    'partial',
    'duplicate',
    '../unsafe',
    'missing',
    "' OR 1=1--",
  ])
    assert.equal(publicLibraryItem('algorithm', slug), null);
  assert.equal(publicLibraryItem('course', 'paid-course'), null);
  assert.equal(
    publicLibraryItem('guide', 'template-guide')!.title,
    'Binary search',
  );
  assert.equal(publicLibraryList({ type: 'guide', page: 1 })!.total, 1);
  assert.equal(
    publicLibraryItem('algorithm', 'lesson-00')!.body,
    'Search a **sorted** array.',
  );
  assert.equal(
    publicLibraryItem('interview_question', 'company-question')!.math,
    true,
  );
  const entries = [
    ...publicLibraryEntries(0, 20),
    ...publicLibraryEntries(20, 20),
  ];
  assert.equal(entries.length, 26);
  assert.equal(publicLibraryCount(), 26);
  assert.deepEqual(
    entries.map(({ type, slug }) => publicLibraryPath(type, slug)),
    [...first.items, ...second.items]
      .filter(({ type }) => type !== 'guide')
      .map(({ type, slug }) => publicLibraryPath(type, slug)),
  );
  assert.equal(entries[0].updatedAt, '2026-10-01');
  assert.equal(entries.at(-1)!.updatedAt, '2026-10-02');
  assert.throws(() => publicLibraryEntries(0, 50001), RangeError);
  assert.throws(() => publicLibraryEntries(-1), RangeError);
  assert.throws(() => publicLibraryEntries(0, 0), RangeError);
  // Hiding an employer hides its library spellings too (facebook under meta).
  process.env.HIDDEN_COMPANIES = ' META ,invalid!';
  assert.equal(
    publicLibraryItem('interview_question', 'company-question'),
    null,
  );
  assert.equal(publicLibraryCount(), 25);
  assert.equal(publicLibraryEntries().length, 25);
  assert.equal(publicLibraryList({ page: 1 })!.total, 26);
  assert.equal(existsSync(process.env.DATABASE_PATH!), false);
});

void test('count cache reuses warm counts and invalidates on library replacement, path, visibility and TTL', () => {
  const path = join(folder, 'cache.sqlite');
  copyFileSync(join(folder, 'content.sqlite'), path);
  process.env.CONTENT_DATABASE_PATH = path;
  delete process.env.HIDDEN_COMPANIES;
  // oxlint-disable-next-line typescript/unbound-method -- The spy calls this method with the original database receiver below.
  const originalPrepare = Database.prototype.prepare;
  let counts = 0;
  const prepare = mock.method(
    Database.prototype,
    'prepare',
    function (this: Database.Database, sql: string) {
      if (sql.includes('COUNT(*)')) counts++;
      return originalPrepare.call(this, sql);
    },
  );
  try {
    assert.equal(publicLibraryCount(), 26);
    assert.equal(publicLibraryCount(), 26);
    assert.equal(counts, 1);
    assert.equal(publicLibraryList({ page: 1 })!.total, 27);
    assert.equal(publicLibraryList({ page: 2 })!.total, 27);
    assert.equal(counts, 2);
    publicLibraryList({ type: 'guide', page: 1 });
    publicLibraryList({ type: 'guide', page: 1 });
    assert.equal(counts, 3);
    const originalNow = Date.now;
    const time = mock.method(Date, 'now', () => originalNow() + 16000);
    // Advancing time proves even an unchanged database gets a bounded freshness window.
    try {
      publicLibraryCount();
      assert.equal(counts, 4);
    } finally {
      time.mock.restore();
    }
    process.env.HIDDEN_COMPANIES = 'meta';
    assert.equal(publicLibraryCount(), 25);
    assert.equal(counts, 5);
    const replacement = join(folder, 'replacement.sqlite');
    copyFileSync(path, replacement);
    const db = new Database(replacement);
    db.prepare('DELETE FROM items WHERE slug=?').run('lesson-00');
    db.close();
    renameSync(replacement, path);
    assert.equal(publicLibraryCount(), 24);
    assert.equal(counts, 6);
    process.env.CONTENT_DATABASE_PATH = join(folder, 'content.sqlite');
    assert.equal(publicLibraryCount(), 25);
    assert.equal(counts, 7);
  } finally {
    prepare.mock.restore();
  }
});

void test('server Markdown preserves non-link notation and exposes only supported links and images', () => {
  const html = renderToStaticMarkup(
    createElement(PublicLibraryMarkdown, {
      body: '[q1,q2](A1,A2)->R [read](/?view=content&type=algorithm&slug=lesson-00) [external](https://example.test/read) [unsafe](javascript:alert) ![diagram](/content-assets/abc.png) ![remote](https://example.test/a.png)',
      math: false,
    }),
  );
  assert.match(html.replace(/<[^>]+>/g, ''), /\[q1,q2\]\(A1,A2\)-&gt;R/);
  assert.doesNotMatch(html, /href="A1,A2"/);
  assert.match(
    html,
    /href="\/\?view=content&amp;type=algorithm&amp;slug=lesson-00"/,
  );
  assert.match(html, /href="https:\/\/example.test\/read"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /src="\/content-assets\/abc.png"/);
  assert.doesNotMatch(html, /src="https:\/\/example.test\/a.png"/);
  assert.match(html, /\[Image: remote\]/);
});

void test('search descriptions are plain text, bounded and fall back to the body', () => {
  assert.equal(
    publicLibraryDescription({
      title: 'Title',
      summary: null,
      body: '## Learn **binary search** with [examples](/library).',
    }),
    'Learn binary search with examples.',
  );
  assert.ok(
    publicLibraryDescription({
      title: 'Title',
      summary: 'a'.repeat(400),
      body: '',
    }).length <= 170,
  );
  assert.equal(
    publicLibraryDescription({ title: 'Title', summary: null, body: '' }),
    'Title',
  );
});
