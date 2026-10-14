import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievements, bestYearDays, newlyEarned, type AchievementInput } from '../lib/achievements';
import { classicListProgress } from '../lib/classic-lists';

const base: AchievementInput = {
  stops: [],
  bestStreak: 0,
  acTimes: [],
  companies: [],
  perfectMock: false,
};
const earned = (input: Partial<AchievementInput>) =>
  achievements({ ...base, ...input }).flatMap((b) => (b.earned ? [b.id] : []));

void test('a stop badge per cleared stop, and the line once all are cleared', () => {
  const stops = [
    { slug: 'array-foundations', solved: 12, total: 12 },
    { slug: 'hash-counting', solved: 3, total: 9 },
  ];
  assert.deepEqual(earned({ stops }), ['stop:array-foundations']);
  const all = achievements({ ...base, stops: stops.map((s) => ({ ...s, solved: s.total })) });
  assert.equal(all.find((b) => b.id === 'line')?.earned, true);
  assert.equal(all[0].zh, '原地数组站');
  assert.deepEqual(all.find((b) => b.id === 'stop:hash-counting')?.progress, [9, 9]);
  // An empty stop is never "cleared".
  assert.deepEqual(earned({ stops: [{ slug: 'linked-list', solved: 0, total: 0 }] }), []);
});

void test('streak and active-day milestones', () => {
  assert.deepEqual(earned({ bestStreak: 30 }), ['streak:7', 'streak:30']);
  const day = (y: number, d: number) => new Date(y, 0, d, 12).getTime();
  // 50 days in 2025 and 49 in 2026: the best single year counts, repeats on a day count once.
  const times = [
    ...Array.from({ length: 50 }, (_, k) => day(2025, k + 1)),
    ...Array.from({ length: 49 }, (_, k) => day(2026, k + 1)),
    day(2026, 1),
  ];
  assert.equal(bestYearDays(times), 50);
  assert.deepEqual(earned({ acTimes: times }), ['days:50']);
  assert.equal(bestYearDays([]), 0);
});

void test('company badges need three judgeable OAs; a perfect mock earns its badge', () => {
  const ids = earned({
    companies: [
      { slug: 'acme', name: 'Acme', solved: 3, total: 3 },
      { slug: 'tiny', name: 'Tiny', solved: 2, total: 2 },
      { slug: 'big', name: 'Big', solved: 4, total: 5 },
    ],
    perfectMock: true,
  });
  assert.deepEqual(ids, ['company:acme', 'mock:perfect']);
});

void test('newly earned compares two snapshots', () => {
  const before = achievements({ ...base, bestStreak: 6 });
  const after = achievements({ ...base, bestStreak: 7 });
  assert.deepEqual(newlyEarned(before, after).map((b) => b.id), ['streak:7']);
  assert.deepEqual(newlyEarned(after, after), []);
});

void test('a daily problem every day of a month earns it, leap Februaries included; old unearned months drop off', () => {
  const month = (m: string, n: number) => Array.from({ length: n }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
  const badges = achievements({
    ...base,
    // 2028-02 has 29 days, 2027-02 only 28; a repeated day counts once.
    dailyDays: [...month('2028-02', 28), '2028-02-28', ...month('2027-02', 28), ...month('2026-01', 31)],
  }).filter((b) => b.group === 'daily');
  assert.deepEqual(
    badges.map((b) => [b.id, b.earned, b.progress]),
    [
      ['daily:2028-02', false, [28, 29]],
      ['daily:2027-02', true, [28, 28]],
      ['daily:2026-01', true, [31, 31]],
    ],
  );
  assert.equal(badges[1].en, 'Daily problem every day, Feb 2027');
  // Thirteen months tried: the oldest unearned one is no longer shown, an earned one always is.
  const tried = Array.from({ length: 13 }, (_, i) => `${2030 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`);
  const shown = achievements({ ...base, dailyDays: [...tried, ...month('2029-03', 31)] })
    .filter((b) => b.group === 'daily')
    .map((b) => b.id);
  assert.equal(shown.length, 13);
  assert.ok(!shown.includes('daily:2030-01') && shown.includes('daily:2029-03') && shown[0] === 'daily:2031-01');
  // Without the ledger (the client's quick checks) there are no month badges at all.
  assert.ok(!achievements(base).some((b) => b.group === 'daily'));
});

void test('domain stars: one badge each, earned at the first threshold, progress toward the next', () => {
  const at = (line: number, sql = 0, oa = 0) =>
    Object.fromEntries(
      achievements({ ...base, domains: { line, sql, oa } })
        .filter((b) => b.group === 'domain')
        .map((b) => [b.id, [b.zh, b.earned, b.progress]]),
    );
  assert.deepEqual(at(9)['domain:line'], ['算法星级', false, [9, 10]]);
  assert.deepEqual(at(10)['domain:line'], ['算法 1 星', true, [10, 50]]);
  assert.deepEqual(at(149)['domain:line'], ['算法 2 星', true, [149, 150]]);
  assert.deepEqual(at(500)['domain:line'], ['算法 5 星', true, [500, 500]]);
  assert.deepEqual(at(900)['domain:line'], ['算法 5 星', true, [500, 500]]);
  assert.deepEqual(at(0, 40)['domain:sql'], ['SQL 4 星', true, [40, 50]]);
  assert.deepEqual(at(0, 0, 4)['domain:oa'], ['公司 OA星级', false, [4, 5]]);
  assert.deepEqual(at(0, 0, 200)['domain:oa'], ['公司 OA 5 星', true, [200, 200]]);
  assert.equal(achievements({ ...base, domains: { line: 1, sql: 0, oa: 0 } }).find((b) => b.id === 'domain:line')?.en, 'Algorithms stars');
});

void test('a list badge per classic list with judgeable problems', () => {
  const lists = [
    { slug: 'blind-75', zh: 'Blind 75', en: 'Blind 75', solved: 70, total: 70 },
    { slug: 'grind-75', zh: 'Grind 75', en: 'Grind 75', solved: 3, total: 75 },
    { slug: 'empty', zh: '空', en: 'Empty', solved: 0, total: 0 },
  ];
  assert.deepEqual(earned({ lists }), ['list:blind-75']);
  // Only judgeable problems count, and the book lists (mostly unjudgeable here) are left out.
  const progress = classicListProgress(new Set(['lc-1']), (id) => id === 'lc-1' || id === 'lc-2');
  assert.ok(progress.length > 0 && progress.every((l) => l.total <= 2 && l.solved <= 1));
  assert.ok(!progress.some((l) => l.slug === 'sword-offer' || l.slug === 'cracking-the-coding-interview'));
  assert.deepEqual(progress.find((l) => l.slug === 'leetcode-hot-100'), {
    slug: 'leetcode-hot-100',
    zh: 'LeetCode 热题 100',
    en: 'LeetCode Top 100 Liked',
    total: 2,
    solved: 1,
  });
  assert.deepEqual(
    achievements({ ...base, lists }).filter((b) => b.group === 'list').map((b) => b.id),
    ['list:blind-75', 'list:grind-75'],
  );
});
