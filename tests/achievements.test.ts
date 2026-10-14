import assert from 'node:assert/strict';
import { test } from 'node:test';
import { achievements, bestYearDays, newlyEarned, type AchievementInput } from '../lib/achievements';

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
