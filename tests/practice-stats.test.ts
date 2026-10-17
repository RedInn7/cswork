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
  // Beijing Oct 13 08:00, twice, and Oct 14 04:00: one star per Beijing date in any time zone.
  const daily = [Date.UTC(2026, 9, 13, 0), Date.UTC(2026, 9, 13, 1), Date.UTC(2026, 9, 13, 20)];
  const stats = practiceStats([ac('a', -1)], dayStamp, true, daily);
  assert.equal(stats.cells[stats.todayIndex - 1].daily, true);
  assert.deepEqual(
    stats.cells.flatMap((c) => (c.daily ? [new Date(c.time).getDate()] : [])),
    [13, 14],
  );
  const old = Array.from({ length: 8 }, (_, k) => ac('a', -300 - k));
  assert.equal(practiceStats(old, dayStamp, true).best, 0);
  assert.equal(practiceStats(old, dayStamp, true, [], 52).best, 8);
});

void test('covered days (a met XP goal, a rest day) bridge the streak without adding to it', () => {
  const acs = [ac('a', 0), ac('b', -2), ac('c', -3)];
  const covered = (offset: number, rest = false) => ({ time: day(offset), rest });
  const plain = practiceStats(acs, dayStamp, true);
  const stats = practiceStats(acs, dayStamp, true, [], undefined, [], [covered(-1), covered(-3, true)]);
  assert.equal(stats.streak, plain.streak, 'the covered day adds no day, like a freeze');
  assert.equal(stats.freezesLeft, plain.freezesLeft + 1, 'and needs no freeze');
  assert.equal(stats.cells[stats.todayIndex - 1].covered, 'goal');
  assert.equal(stats.cells[stats.todayIndex - 1].frozen, undefined);
  assert.equal(stats.cells[stats.todayIndex - 3].covered, undefined, 'an AC day stays an AC day');
  // Today covered (a rest day): the streak holds through today with no AC, and no reminder is due.
  const rest = practiceStats([ac('a', -1)], dayStamp, true, [], undefined, [], [covered(0, true)]);
  assert.equal(rest.streak, 1);
  assert.equal(rest.cells[rest.todayIndex].covered, 'rest');
  // A gap between an AC day and a covered day still spends a freeze.
  const gap = practiceStats([ac('a', -3)], dayStamp, true, [], undefined, [], [covered(-1)]);
  assert.equal(gap.streak, 1);
  assert.equal(gap.cells[gap.todayIndex - 2].frozen, true);
  // Covered days alone make no streak, and no rescue.
  const alone = practiceStats([], dayStamp, true, [], undefined, [], [covered(-2), covered(-3)]);
  assert.deepEqual([alone.streak, alone.rescue, alone.best], [0, false, 0]);
  // Nor do they spend freezes on the gaps between them: rest Mondays and Wednesdays, no AC, one
  // bought freeze, leave every freeze in place.
  const restDays = Array.from({ length: 183 }, (_, i) => covered(-i, true)).filter(
    ({ time }) => [1, 3].includes(new Date(time).getDay()),
  );
  const resting = practiceStats([], dayStamp, true, [], undefined, [day(-5)], restDays);
  assert.equal(resting.freezesLeft, practiceStats([], dayStamp, true, [], undefined, [day(-5)]).freezesLeft);
  assert.equal(resting.freezesLeft, 3);
  assert.equal(resting.cells.filter((c) => c.frozen).length, 0);
  // After an AC the run is a streak again: its gap next to a rest day is frozen.
  const after = practiceStats([ac('a', -3)], dayStamp, true, [], undefined, [], restDays);
  assert.equal(after.cells[after.todayIndex - 1].frozen, true, 'Tuesday, between Monday and the rest Wednesday');
  // Nothing covered: the same as before.
  assert.deepEqual(practiceStats(acs, dayStamp, true, [], undefined, [], []), plain);
});
