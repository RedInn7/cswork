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
