import assert from 'node:assert/strict';
import { test } from 'node:test';
import { companyTagIndex, lcIdBySource } from '../lib/company-tags';

const presets = [
  { slug: 'tiktok', name: 'TikTok / ByteDance', aliases: ['tiktok', 'bytedance'] },
  { slug: 'meta', name: 'Meta', aliases: ['meta'] },
];
const e = (id: string, round: string) => ({ id, round, source: `${id}-${round}` });

void test('aliases merge into one company, rounds dedupe, OA ranks first', () => {
  const index = companyTagIndex(
    new Set(),
    {
      bytedance: [e('lc-1', 'Onsite'), e('lc-2', 'Onsite')],
      tiktok: [e('lc-1', 'Online Assessment'), e('lc-1', 'Onsite')],
      meta: [e('lc-1', 'Technical Screen'), e('lc-1', 'Onsite'), e('lc-1', 'HR Screen'), e('oa-meta-1', 'Onsite')],
      zeta: [e('lc-1', 'Onsite')],
    },
    presets,
  );
  assert.deepEqual(index.get('lc-1'), [
    { slug: 'tiktok', name: 'TikTok / ByteDance', rounds: ['Onsite', 'Online Assessment'], oa: true },
    { slug: 'meta', name: 'Meta', rounds: ['Technical Screen', 'Onsite', 'HR Screen'], oa: false },
    // Unknown companies keep their slug as the name.
    { slug: 'zeta', name: 'zeta', rounds: ['Onsite'], oa: false },
  ]);
  assert.deepEqual(index.get('lc-2')?.map((c) => c.slug), ['tiktok']);
  assert.equal(index.has('oa-meta-1'), false, 'only lc ids are tagged');
});

void test('ties sort by name; hidden companies and hidden aliases drop out', () => {
  const map = { meta: [e('lc-9', 'Onsite')], bytedance: [e('lc-9', 'Onsite')], amazon: [e('lc-9', 'Onsite')] };
  const all = [...presets, { slug: 'amazon', name: 'Amazon', aliases: ['amazon'] }];
  assert.deepEqual(companyTagIndex(new Set(), map, all).get('lc-9')?.map((c) => c.name), ['Amazon', 'Meta', 'TikTok / ByteDance']);
  assert.deepEqual(companyTagIndex(new Set(['meta', 'tiktok']), map, all).get('lc-9')?.map((c) => c.slug), ['amazon']);
});

void test('the shipped map: LRU cache is widely asked, TikTok and ByteDance show once', () => {
  const lru = companyTagIndex().get('lc-146') ?? [];
  assert.ok(lru.length >= 5);
  assert.equal(new Set(lru.map((c) => c.slug)).size, lru.length);
  assert.equal(lru.filter((c) => /tiktok|bytedance/i.test(c.slug)).length, 1);
  for (let i = 1; i < lru.length; i++)
    assert.ok(Number(lru[i - 1].oa) >= Number(lru[i].oa), 'OA first');
  assert.equal(lcIdBySource.get('solve-decimal-coin-change'), 'lc-322');
});
