import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const folder = mkdtempSync(join(tmpdir(), 'cswork-content-'));
process.env.DATABASE_PATH = join(folder, 'app.sqlite');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });

// Parsed items as the import parsers write them.
const parsed = join(folder, 'prachub', 'parsed');
mkdirSync(parsed, { recursive: true });
const item = (o: Record<string, unknown>) => ({
  summary: null, company: null, role: null, category: null, difficulty: null, round: null,
  seniority: null, tags: [], publishedAt: '2026-09-01', updatedAt: null, relations: [],
  extra: {}, sourceUrl: 'https://example.test', partial: false, ...o,
});
const lines = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(join(parsed, 'coding-questions.jsonl'), lines([
  item({ id: 'cq-lru', type: 'coding_question', slug: 'lru', title: 'Implement an LRU cache', body: 'Design a **cache** with eviction.', company: { slug: 'google', name: 'Google' }, difficulty: 'medium', role: 'Software Engineer', extra: { samples: [{ input: '2', output: '1' }] } }),
  item({ id: 'cq-two-sum', type: 'coding_question', slug: 'two-sum', title: 'Two Sum', body: 'Find two numbers.', company: { slug: 'amazon', name: 'Amazon' }, difficulty: 'easy' }),
]));
writeFileSync(join(parsed, 'interview-questions.jsonl'), lines([
  item({ id: 'iq-topk', type: 'interview_question', slug: 'topk', title: 'Design a top-k ranking system', body: 'Ranking with heaps.', company: { slug: 'uber', name: 'Uber' }, difficulty: 'hard', round: 'Onsite', publishedAt: '2026-09-05' }),
  item({ id: 'iq-lru-again', type: 'interview_question', slug: 'lru-again', title: 'LRU cache again', body: 'Same as the OA one.' }),
  item({ id: 'iq-topk-copy', type: 'interview_question', slug: 'topk-copy', title: 'LRU cache, third copy', body: 'Same again.' }),
]));
writeFileSync(join(parsed, 'experiences.jsonl'), lines([
  item({ id: 'ex-amazon-oa', type: 'experience', slug: 'amazon-oa', title: 'Amazon SDE OA', body: 'Two questions: [LRU](https://prachub.com/coding-questions/lru), [plans](https://prachub.com/pricing). ![chart](https://ik.imagekit.io/x/a.png) ![gone](https://ik.imagekit.io/x/b.png) Code `arr[i](/x)` stays. [Guide](https://PracHub.com/interview-guide/google-swe "Google") https://prachub.com/companies/google/x ![v](https://ik.imagekit.io/x/a.png?tr=w-100) [same](/interview-questions/lru) [SWE](/positions/software-engineer) [all](https://prachub.com/questions)', company: { slug: 'amazon', name: 'Amazon' }, relations: [{ kind: 'question', slug: 'lru' }, { kind: 'question', slug: 'missing' }], extra: { result: 'Offer' } }),
]));
writeFileSync(join(parsed, 'courses.jsonl'), lines([
  item({ id: 'co-sd', type: 'course', slug: 'sd', title: 'System design basics', body: 'Course intro.' }),
]));
writeFileSync(join(parsed, 'guides.jsonl'), lines([
  item({ id: 'gd-acme-swe', type: 'guide', slug: 'acme-swe', title: 'Acme Software Engineer Interview Guide', body: 'Template text about idempotency.' }),
]));
writeFileSync(join(parsed, 'concepts.jsonl'), lines([
  // The source's summary is the body's opening cut mid-word.
  item({ id: 'cp-ab', type: 'concept', slug: 'ab', title: 'A/B testing', summary: 'Expect to demons', body: 'Expect to demonstrate depth in A/B testing: $p < 0.05$.', extra: { math: true } }),
]));
writeFileSync(join(parsed, 'algorithms-basics.jsonl'), lines([
  item({ id: 'al-binary-search', type: 'algorithm', slug: 'binary-search', title: 'Binary search', titleZh: '二分查找', summaryZh: '在有序区间里折半查找', body: 'Halve the range.', extra: { level: 'core', bodyZh: '每次把区间折半。', sourceTitle: '原站标题', sources: ['docs/basic/binary.md'] } }),
]));
writeFileSync(join(parsed, 'assets-map.json'), JSON.stringify({ 'https://ik.imagekit.io/x/a.png': '/content-assets/abc.png' }));
writeFileSync(join(folder, 'prachub', 'parsed', 'question-dupes.json'), JSON.stringify([
  { id: 'cq-two-sum', dupOf: { kind: 'library', id: 'lc-1', title: '两数之和' }, score: 0.97, method: 'title' },
  { id: 'cq-lru', dupOf: { kind: 'oa', id: 'oa-x', title: 'Wrong match' }, score: 0.5, method: 'text' },
]));
// A reviewer rejected the second automatic match and confirmed another one.
writeFileSync(join(parsed, 'question-dupes-reject.json'), JSON.stringify(['cq-lru']));
writeFileSync(join(parsed, 'question-dupes-manual.json'), JSON.stringify([
  { id: 'iq-lru-again', dupOf: { kind: 'oa', id: 'oa-lru', title: 'LRU', problem: 'oa-lru' }, score: 1, method: 'manual' },
  // A chain (topk -> lru-again -> OA) resolves to the end; a cycle keeps the item it returns to.
  { id: 'iq-topk-copy', dupOf: { kind: 'prachub', id: 'iq-lru-again' }, score: 1, method: 'manual' },
]));
const contentDb = join(folder, 'content.sqlite');
const built = execFileSync(process.execPath, ['scripts/content-import/prachub/build-content-db.mjs', contentDb], {
  env: { ...process.env, PRACHUB_DIR: join(folder, 'prachub') },
}).toString();
const coding = JSON.parse(built).counts.find((c: { type: string }) => c.type === 'coding_question');
assert.deepEqual([coding.n, coding.listed], [2, 1]); // two-sum is kept but not listed

process.env.CONTENT_DATABASE_PATH = join(folder, 'missing.sqlite');
const { handleContent } = await import('../lib/server/content-library');
const get = async (path: string) => {
  const url = new URL(`http://localhost/api/content/${path}`);
  const response = await handleContent(new Request(url), null, url.pathname.split('/').slice(3));
  return response.json();
};
const status = (code: number) => (e: unknown) =>
  !!e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === code;

after(() => rmSync(folder, { recursive: true, force: true }));

void test('an unpublished library answers empty lists instead of failing', async () => {
  assert.deepEqual((await get('list?type=questions')).items, []);
  await assert.rejects(get('item?type=questions&slug=lru'), status(404));
});

void test('lists, filters, search and facets; duplicates stay out of lists', async () => {
  process.env.CONTENT_DATABASE_PATH = contentDb;
  const all = await get('list?type=questions');
  assert.deepEqual(all.items.map((i: { slug: string }) => i.slug), ['topk', 'lru']); // newest first; two-sum is a duplicate
  assert.equal(all.total, 2);
  assert.deepEqual(all.facets.companies.map((c: { value: string }) => c.value).sort(), ['google', 'uber']);
  assert.equal(all.facets.companyTotal, 2);
  assert.equal((await get('list?type=questions&company=google')).items[0].slug, 'lru');
  assert.equal((await get('list?type=questions&difficulty=hard')).items[0].slug, 'topk');
  assert.equal((await get('list?type=questions&kind=coding_question')).total, 1);
  assert.equal((await get('item?type=questions&slug=lru-again')).dupOf.problem, 'oa-lru');
  assert.equal((await get('item?type=questions&slug=topk-copy')).dupOf.id, 'oa-lru');
  assert.equal((await get('list?type=questions&q=eviction')).items[0].slug, 'lru');
  // Guides match by title, not by their (shared, templated) body text.
  assert.equal((await get('list?type=guide&q=acme')).total, 1);
  assert.equal((await get('list?type=guide&q=idempotency')).total, 0);
  assert.equal((await get('list?type=experience')).items[0].company.name, 'Amazon');
  await assert.rejects(get('list?type=secret'), status(400));
  await assert.rejects(get('list?type=constructor'), status(400));
  assert.equal((await get('list?type=questions&page=1.5')).page, 1);
  // Short words match whole words only; longer ones also match as a prefix.
  assert.equal((await get('list?type=questions&q=ca')).total, 0);
  assert.equal((await get('list?type=questions&q=cac')).items[0].slug, 'lru');
});

void test('detail resolves relations and points duplicates at our own problem', async () => {
  const exp = await get('item?type=experience&slug=amazon-oa');
  assert.equal(exp.extra.result, 'Offer');
  // Links point inside CSWORK, images at our own copies; unknown pages keep only their text.
  assert.equal(
    exp.body,
    // Images without a published copy are left out (cover art, logos); links point only at pages
    // that exist, under their real type, and list pages map to filtered lists.
    'Two questions: [LRU](/?view=content&type=coding_question&slug=lru), [plans](#). ![chart](/content-assets/abc.png) ' +
      ' Code `arr[i](/x)` stays. [Guide](#) [link](/?view=questions&company=google)  [same](/?view=content&type=coding_question&slug=lru)' +
      ' [SWE](/?view=questions&role=Software%20Engineer) [all](/?view=questions)',
  );
  assert.deepEqual(exp.relations.map((r: { slug: string }) => r.slug), ['lru']); // the missing one is dropped
  const dup = await get('item?type=questions&slug=two-sum');
  assert.deepEqual(dup.dupOf, { kind: 'library', id: 'lc-1', title: '两数之和' });
  // PracHub courses are not published; bilingual tutorials are.
  await assert.rejects(get('item?type=course&slug=sd'), status(400));
  const tutorial = await get('item?type=algorithm&slug=binary-search');
  assert.equal(tutorial.titleZh, '二分查找');
  assert.equal(tutorial.extra.bodyZh, '每次把区间折半。');
  assert.equal((await get('list?type=algorithm')).items[0].summaryZh, '在有序区间里折半查找');
  assert.equal(tutorial.level, 'core');
  assert.deepEqual(Object.keys(tutorial.extra).sort(), ['bodyZh', 'level']); // no provenance
  assert.equal((await get(`list?type=algorithm&q=${encodeURIComponent('原站')}`)).total, 0);
  const concept = await get('item?type=concept&slug=ab');
  assert.equal(concept.summary, 'Expect to…');
  assert.equal(concept.extra.math, true);
  // Chinese search matches Chinese titles and tutorial text by substring.
  assert.equal((await get(`list?type=algorithm&q=${encodeURIComponent('二分')}`)).items[0].slug, 'binary-search');
  assert.equal((await get(`list?type=algorithm&q=${encodeURIComponent('折半')}`)).total, 1);
  assert.equal((await get(`list?type=algorithm&q=${encodeURIComponent('二%')}`)).total, 0); // % is literal
  await assert.rejects(get('item?type=questions&slug=nope'), status(404));
  const stats = await get('stats');
  assert.equal(stats.counts.coding_question, 1);
  assert.equal(stats.companies, 3);
});
