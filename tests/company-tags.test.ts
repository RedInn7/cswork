import assert from 'node:assert/strict';
import { test } from 'node:test';
import lcMapFile from '../lib/content/company-lc-map.json';
import presetsFile from '../lib/content/mock-oa-presets.json';
import { companyLcProblems, companyTagIndex, inWindow, lcIdBySource, reportWindow, windowCounts } from '../lib/company-tags';
import { employerSlug } from '../lib/oa-company-brands';

const presets = [
  { slug: 'tiktok', name: 'TikTok / ByteDance', aliases: ['tiktok', 'bytedance'] },
  { slug: 'meta', name: 'Meta', aliases: ['meta'] },
];
// A v2 map entry: every round, every source, distinct reports and the latest report date.
const e = (id: string, rounds: string[], count = 1, last = '2026-01-01') => ({
  id,
  round: rounds[0],
  rounds,
  source: `${id}-${rounds[0]}`,
  sources: Array.from({ length: count }, (_, i) => `${id}-${rounds[0]}-${i}`),
  count,
  last,
});

void test('aliases merge into one company: rounds dedupe, counts add up, the latest date wins', () => {
  const index = companyTagIndex(
    new Set(),
    {
      bytedance: [e('lc-1', ['Onsite'], 2, '2026-09-10'), e('lc-2', ['Onsite'])],
      tiktok: [e('lc-1', ['Online Assessment', 'Onsite'], 1, '2025-09-29')],
      meta: [e('lc-1', ['Technical Screen', 'Onsite', 'HR Screen'], 4, '2026-03-01'), e('oa-meta-1', ['Onsite'])],
      zeta: [e('lc-1', ['Onsite'], 1, '2026-10-01')],
    },
    presets,
    { zeta: 'Zeta Corp' },
  );
  assert.deepEqual(index.get('lc-1')?.map(({ sources, ...tag }) => ({ ...tag, sources: sources.length })), [
    // OA first, then report count, then the latest report; every report's source is kept.
    { slug: 'tiktok', name: 'TikTok / ByteDance', rounds: ['Onsite', 'Online Assessment'], oa: true, count: 3, last: '2026-09-10', sources: 3 },
    { slug: 'meta', name: 'Meta', rounds: ['Technical Screen', 'Onsite', 'HR Screen'], oa: false, count: 4, last: '2026-03-01', sources: 4 },
    { slug: 'zeta', name: 'Zeta Corp', rounds: ['Onsite'], oa: false, count: 1, last: '2026-10-01', sources: 1 },
  ]);
  assert.deepEqual(index.get('lc-2')?.map((c) => c.slug), ['tiktok']);
  assert.equal(index.has('oa-meta-1'), false, 'only lc ids are tagged');
  // Unknown companies without a display name keep their slug.
  assert.equal(companyTagIndex(new Set(), { zeta: [e('lc-1', ['Onsite'])] }, [], {}).get('lc-1')?.[0].name, 'zeta');
});

void test('ties sort by recency then name; hidden companies and hidden aliases drop out', () => {
  const map = {
    meta: [e('lc-9', ['Onsite'])],
    bytedance: [e('lc-9', ['Onsite'])],
    amazon: [e('lc-9', ['Onsite'], 1, '2026-02-01')],
  };
  const all = [...presets, { slug: 'amazon', name: 'Amazon', aliases: ['amazon'] }];
  assert.deepEqual(companyTagIndex(new Set(), map, all).get('lc-9')?.map((c) => c.name), ['Amazon', 'Meta', 'TikTok / ByteDance']);
  assert.deepEqual(companyTagIndex(new Set(['meta', 'tiktok']), map, all).get('lc-9')?.map((c) => c.slug), ['amazon']);
  // Hiding the spelling alone also hides it.
  assert.equal(companyLcProblems(new Set(['bytedance']), map).has('tiktok'), false);
});

void test('company problems: library spellings fold into the employer, most reported first', () => {
  const problems = companyLcProblems(new Set(), {
    'j-p-morgan': [e('lc-1', ['Onsite'], 1, '2026-05-01'), e('lc-2', ['Onsite'], 3, '2025-01-01')],
    jpmorganchase: [e('lc-1', ['Technical Screen'], 1, '2026-06-01')],
    acme: [e('lc-3', ['Onsite'], 1, '2026-01-01'), e('lc-4', ['Onsite'], 1, '2026-08-01')],
  });
  assert.deepEqual([...problems.keys()].sort(), ['acme', 'jpmorgan-chase']);
  assert.deepEqual(problems.get('jpmorgan-chase'), [
    { id: 'lc-2', rounds: ['Onsite'], count: 3, last: '2025-01-01', sources: ['lc-2-Onsite-0', 'lc-2-Onsite-1', 'lc-2-Onsite-2'] },
    { id: 'lc-1', rounds: ['Onsite', 'Technical Screen'], count: 2, last: '2026-06-01', sources: ['lc-1-Onsite-0', 'lc-1-Technical Screen-0'] },
  ]);
  assert.deepEqual(problems.get('acme')?.map((p) => p.id), ['lc-4', 'lc-3'], 'equal counts: latest first');
});

void test('the shipped v2 map: counts, dates, names and every source slug', () => {
  assert.equal(lcMapFile.version, 2);
  for (const [slug, entries] of Object.entries(lcMapFile.companies)) {
    assert.ok(Object.hasOwn(lcMapFile.names, slug), `${slug} has a display name`);
    for (const entry of entries) {
      assert.equal(entry.count, entry.sources.length, `${slug} ${entry.id}`);
      assert.match(entry.last, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(entry.rounds.includes(entry.round) && entry.sources.includes(entry.source));
    }
  }
  // Presets and the alias table agree on who an alias belongs to.
  for (const preset of presetsFile.companies)
    for (const alias of preset.aliases) assert.equal(employerSlug(alias), preset.slug, alias);
  const lru = companyTagIndex().get('lc-146') ?? [];
  assert.ok(lru.length >= 5);
  assert.equal(new Set(lru.map((c) => c.slug)).size, lru.length);
  assert.equal(lru.filter((c) => /tiktok|bytedance/i.test(c.slug)).length, 1);
  for (let i = 1; i < lru.length; i++)
    assert.ok(Number(lru[i - 1].oa) >= Number(lru[i].oa), 'OA first');
  const amazon = lru.find((c) => c.slug === 'amazon')!;
  assert.deepEqual([amazon.count, amazon.last], [2, '2026-03-12']);
  assert.ok(lru.every((c) => c.name !== c.slug), 'display names, not slugs');
  // Every report's slug resolves, not only the representative one.
  assert.equal(lcIdBySource.get('solve-decimal-coin-change'), 'lc-322');
  assert.equal(lcIdBySource.get('implement-lru-cache-with-o-1-ops'), 'lc-146');
  // J.P. Morgan reports tag under the JPMorgan Chase employer.
  const jpm = [...companyTagIndex().values()].flat().filter((c) => /morgan/.test(c.slug));
  assert.ok(jpm.some((c) => c.slug === 'jpmorgan-chase' && c.name === 'JPMorgan Chase'));
  assert.ok(!jpm.some((c) => c.slug === 'j-p-morgan'));
});

void test('merged spellings keep each source once', () => {
  const twice = e('lc-5', ['Onsite']);
  const merged = companyLcProblems(new Set(), { 'j-p-morgan': [twice], jpmorganchase: [twice] }).get('jpmorgan-chase')!;
  assert.deepEqual(merged[0].sources, ['lc-5-Onsite-0']);
});

void test('report windows: disjoint buckets by age, undated reports count as older', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  const day = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);
  const dated = new Map([
    ['ninety', { date: day(90) }],
    ['ninety-one', { date: day(91) }],
    ['half', { date: day(182) }],
    ['year', { date: day(365) }],
    ['two', { date: day(730) }],
    ['old', { date: day(731) }],
    ['undated', { date: null }],
  ]);
  // Whole days: 90 days back is still in at noon (90.5 days after that date's midnight).
  assert.deepEqual(windowCounts(['ninety'], dated, now), { m3: 1, m6: 0, y1: 0, y2: 0, older: 0 }, 'exactly 90 days is in the 3 months');
  const w = windowCounts([...dated.keys(), 'not-in-the-library'], dated, now);
  assert.deepEqual(w, { m3: 1, m6: 2, y1: 1, y2: 1, older: 3 });
  assert.deepEqual(['3m', '6m', '1y', '2y', 'all'].map((x) => inWindow(w, reportWindow(x))), [1, 3, 4, 5, 8]);
  assert.equal(reportWindow('5y'), 'all', 'unknown windows read as all');
  assert.equal(reportWindow(['3m']), 'all');
});
