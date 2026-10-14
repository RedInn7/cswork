import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceStats } from '../components/practice-calendar';

// Local noon `offset` days from a fixed Wednesday; DST-safe because Date normalises the day.
const day = (offset: number) => new Date(2026, 9, 14 + offset, 12).getTime();
const dayStamp = new Date(day(0)).toDateString();
const ac = (problem_id: string, offset: number) => ({
  problem_id,
  created_at: day(offset),
});

void test('a streak survives today until it ends, counting distinct problems per day', () => {
  const stats = practiceStats(
    [ac('a', -1), ac('b', -1), ac('c', -2)],
    dayStamp,
    true,
  );
  assert.equal(stats.streak, 2);
  assert.equal(stats.today, 0);
  assert.equal(stats.cells[stats.todayIndex - 1].count, 2);
  assert.equal(stats.total, 3);
});

void test('the same problem accepted twice today counts once', () => {
  const stats = practiceStats([ac('a', 0), ac('a', 0)], dayStamp, false);
  assert.equal(stats.today, 1);
  assert.equal(stats.streak, 1);
});

void test('best is the longest run inside the grid', () => {
  const stats = practiceStats(
    [-20, -19, -18, -10, -9].map((offset) => ac('a', offset)),
    dayStamp,
    true,
  );
  assert.equal(stats.best, 3);
  assert.equal(stats.streak, 0);
  assert.equal(stats.total, 1);
});

void test('a streak longer than the grid is also the best', () => {
  const stats = practiceStats(
    Array.from({ length: 183 }, (_, k) => ac(`p${k}`, -k)),
    dayStamp,
    true,
  );
  assert.equal(stats.streak, 183);
  assert.equal(stats.best, 183);
});

void test('a single gap between AC days spends a freeze and keeps the streak', () => {
  const stats = practiceStats([ac('a', 0), ac('b', -2), ac('c', -3)], dayStamp, true);
  assert.equal(stats.streak, 3, 'the frozen day bridges the gap but adds no day');
  assert.equal(stats.cells[stats.todayIndex - 1].frozen, true);
  assert.equal(stats.freezesLeft, 1);
  assert.equal(stats.best, 3);
  // Two missed days in a row are not a single gap.
  assert.equal(practiceStats([ac('a', 0), ac('b', -3)], dayStamp, true).streak, 1);
});

void test('each calendar month has two freezes, used oldest first', () => {
  // 2026-10-14 is day(0): gaps on Oct 12, 10 and 8 with AC days around them.
  const stats = practiceStats([0, -1, -3, -5, -7].map((k) => ac(`p${k}`, k)), dayStamp, true);
  assert.equal(stats.freezesLeft, 0);
  assert.deepEqual(
    stats.cells.flatMap((c) => (c.frozen ? [new Date(c.time).getDate()] : [])),
    [8, 10],
  );
  assert.equal(stats.streak, 2, 'Oct 12 found no freeze left, so the streak restarts after it');
});

void test('an empty yesterday counts on today’s AC to freeze it', () => {
  const stats = practiceStats([ac('a', -2), ac('b', -3)], dayStamp, false);
  assert.equal(stats.rescue, true);
  assert.equal(stats.streak, 2);
  const none = practiceStats([ac('a', -3)], dayStamp, false);
  assert.equal(none.rescue, false);
  assert.equal(none.streak, 0);
});

void test('daily problem days are starred and a longer grid finds an older best', () => {
  const stats = practiceStats([ac('a', -1)], dayStamp, true, [day(-1)]);
  assert.equal(stats.cells[stats.todayIndex - 1].daily, true);
  assert.equal(stats.cells.filter((c) => c.daily).length, 1);
  const old = Array.from({ length: 8 }, (_, k) => ac('a', -300 - k));
  assert.equal(practiceStats(old, dayStamp, true).best, 0);
  assert.equal(practiceStats(old, dayStamp, true, [], 52).best, 8);
});
