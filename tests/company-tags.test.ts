import assert from 'node:assert/strict';
import { test } from 'node:test';
import lcMapFile from '../lib/content/company-lc-map.json';
import presetsFile from '../lib/content/mock-oa-presets.json';
import { companyLcProblems, companyTagIndex, lcIdBySource } from '../lib/company-tags';
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
  assert.deepEqual(index.get('lc-1'), [
    // OA first, then report count, then the latest report.
    { slug: 'tiktok', name: 'TikTok / ByteDance', rounds: ['Onsite', 'Online Assessment'], oa: true, count: 3, last: '2026-09-10' },
    { slug: 'meta', name: 'Meta', rounds: ['Technical Screen', 'Onsite', 'HR Screen'], oa: false, count: 4, last: '2026-03-01' },
    { slug: 'zeta', name: 'Zeta Corp', rounds: ['Onsite'], oa: false, count: 1, last: '2026-10-01' },
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
    { id: 'lc-2', rounds: ['Onsite'], count: 3, last: '2025-01-01' },
    { id: 'lc-1', rounds: ['Onsite', 'Technical Screen'], count: 2, last: '2026-06-01' },
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
