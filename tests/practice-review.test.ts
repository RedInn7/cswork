// Review self-grades and load (lib/practice-review.ts): the replay of AC days by grade, leeches,
// the daily cap, a break and the 30-day forecast. Local days only: New York crosses the end of
// daylight saving on 2026-11-01, inside the forecast below.
process.env.TZ = 'America/New_York';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dueReviews,
  parseReviewPrefs,
  reviewPause,
  reviewState,
  scheduleReviews,
  type PracticeHistoryItem,
  type ReviewGrade,
} from '../lib/practice-review';

const day = (d: number, h = 12) => new Date(2026, 9, 1 + d, h).getTime();
const midnight = (d: number) => new Date(2026, 9, 1 + d).getTime();
const item = (
  problemId: string,
  acAt: number[],
  grades?: [number, ReviewGrade][],
  help: PracticeHistoryItem['help'] = 'none',
): PracticeHistoryItem => ({
  problemId,
  attempts: acAt.length,
  firstAt: acAt[0] ?? day(0),
  lastAt: acAt.at(-1) ?? day(0),
  firstAcAt: acAt[0] ?? null,
  failuresBeforeAc: 0,
  lastStatus: acAt.length ? 'accepted' : 'wrong_answer',
  languages: ['python'],
  acAt,
  stop: null,
  help,
  solveSeconds: null,
  whiteboard: null,
  brute: false,
  ...(grades && { grades }),
});
const state = (acAt: number[], grades?: [number, ReviewGrade][]) => {
  const { level, dueAt, leech, mastered } = reviewState(item('p', acAt, grades));
  return { level, dueAt, leech, mastered };
};

void test('a review day moves the problem by its grade: Again to 0, Hard stays, Good +1, Easy +2', () => {
  const review = (grade: ReviewGrade) => state([day(0), day(3)], [[day(3), grade]]);
  assert.deepEqual(review(1), { level: 0, dueAt: midnight(4), leech: false, mastered: false }, 'Again: back tomorrow');
  assert.deepEqual(review(2), { level: 1, dueAt: midnight(6), leech: false, mastered: false }, 'Hard: the same 3 days');
  assert.deepEqual(review(3), { level: 2, dueAt: midnight(10), leech: false, mastered: false });
  assert.deepEqual(review(4), { level: 3, dueAt: midnight(24), leech: false, mastered: false });
  // From 0, Good climbs back to step 1; Easy past the last step masters it.
  assert.deepEqual(state([day(0), day(3), day(4)], [[day(3), 1]]), { level: 1, dueAt: midnight(7), leech: false, mastered: false });
  const done = state([day(0), day(3), day(10)], [[day(3), 4], [day(10), 4]]);
  assert.deepEqual([done.level, done.mastered, done.dueAt], [5, true, Infinity]);
  // A grade on the first AC day changes nothing: that day only puts it on the ladder.
  assert.deepEqual(state([day(0, 9), day(0, 10)], [[day(0, 10), 1]]).level, 1);
});

void test("one day's last grade counts, and ungraded days count as Good, as the plain ladder", () => {
  // Graded twice on day 3 (two ACs): the later AC's grade wins, whatever the array order.
  const twice = state([day(0), day(3, 9), day(3, 15)], [[day(3, 15), 1], [day(3, 9), 4]]);
  assert.equal(twice.level, 0);
  assert.equal(state([day(0), day(3, 9), day(3, 15)], [[day(3, 9), 1], [day(3, 15), 4]]).level, 3);
  // No grades: the level is the count of distinct AC days and the waits are 3, 7, 21, 60.
  assert.deepEqual(state([day(0), day(3), day(3, 20), day(10)]), { level: 3, dueAt: midnight(31), leech: false, mastered: false });
  const helped = reviewState(item('h', [day(0)], undefined, 'hint'));
  assert.deepEqual([helped.level, helped.steps, helped.dueAt], [1, 5, midnight(1)]);
  assert.equal(state([0, 3, 10, 31, 91].map((d) => day(d))).mastered, true);
  assert.deepEqual(
    dueReviews([item('a', [day(0)]), item('b', [day(0), day(1)], [[day(1), 1]])], day(2)).map((r) => [r.item.problemId, r.level]),
    [['b', 0]],
    'Again brings it back the next day',
  );
});

void test('a leech: Again on two review days in a row, or on three in all', () => {
  const days = [0, 2, 4, 6, 8, 10].map((d) => day(d));
  const graded = (...grades: ReviewGrade[]) =>
    state(days.slice(0, grades.length + 1), grades.map((g, i) => [days[i + 1], g] as [number, ReviewGrade])).leech;
  assert.equal(graded(1), false);
  assert.equal(graded(1, 1), true, 'two in a row');
  assert.equal(graded(1, 3, 1), false, 'two apart');
  assert.equal(graded(1, 3, 1, 3), false);
  assert.equal(graded(1, 3, 1, 2, 1), true, 'three in all');
  // Two Agains on one day are one review day.
  assert.equal(state([day(0), day(2, 9), day(2, 15)], [[day(2, 9), 1], [day(2, 15), 1]]).leech, false);
  // A leech stays one once relearned.
  assert.equal(graded(1, 1, 4), true);
});

void test('the daily cap takes the most overdue first and the forecast carries the rest', () => {
  // Five problems solved on day 0..4 (each due 3 days later), viewed on day 10: all overdue.
  const history = [4, 3, 2, 1, 0].map((d) => item(`p${d}`, [day(d)]));
  const now = day(10);
  const open = scheduleReviews(history, now);
  assert.equal(open.today.length, 5);
  assert.equal(open.deferred, 0);
  const capped = scheduleReviews(history, now, { dailyCap: 2 });
  assert.deepEqual(capped.today.map((r) => r.item.problemId), ['p0', 'p1'], 'oldest due first');
  assert.equal(capped.deferred, 3);
  assert.deepEqual(capped.forecast.slice(0, 4), [2, 2, 1, 0]);
  assert.equal(capped.forecast.length, 30);
  // Due later: day i counts its own, plus what the days before could not take.
  const later = [...history, item('n1', [day(9)]), item('n2', [day(9)]), item('n3', [day(9)])];
  // n1..n3 fall due on Oct 13 (index 2): 1 carried + 3 new, capped at 2, the rest on the next day.
  assert.deepEqual(scheduleReviews(later, now, { dailyCap: 2 }).forecast.slice(0, 6), [2, 2, 2, 2, 0, 0]);
  assert.deepEqual(scheduleReviews(later, now).forecast.slice(0, 4), [5, 0, 3, 0]);
  // Across the end of daylight saving (Nov 1 in New York): one problem per day, no day skipped.
  const fall = Array.from({ length: 10 }, (_, i) => item(`f${i}`, [day(25 + i)]));
  assert.deepEqual(scheduleReviews(fall, day(26)).forecast.slice(0, 12), [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

void test('a break shows nothing while it lasts and pushes back only reviews of problems solved before it', () => {
  // Break from Oct 11 for 7 days (11..17). "before" was solved Oct 9 (due Oct 12): moved to the 19th.
  // "during" was solved on the 12th, inside the break: it keeps its own day, the 15th.
  const prefs = { pausedFrom: '2026-10-11', pausedDays: 7 };
  const before = item('before', [day(8)]);
  const during = item('during', [day(11)]);
  const overdue = item('overdue', [day(3)]); // Due Oct 7, before the break: still due.
  const history = [before, during, overdue];
  assert.deepEqual(reviewPause(prefs), { from: '2026-10-11', to: '2026-10-17' });
  for (const d of [10, 13, 16]) {
    const s = scheduleReviews(history, day(d), prefs);
    assert.deepEqual(s.today, [], `nothing while it lasts (Oct ${d + 1})`);
  }
  const back = scheduleReviews(history, day(17), prefs);
  assert.deepEqual(back.today.map((r) => r.item.problemId), ['overdue', 'during'], 'the break is over on the 18th');
  const moved = scheduleReviews(history, day(18), prefs).today.find((r) => r.item.problemId === 'before');
  assert.equal(moved?.dueAt, midnight(18), 'Oct 12 + 7 days');
  assert.equal(scheduleReviews(history, day(17), prefs).today.some((r) => r.item.problemId === 'before'), false);
  // On its first day: zero today, then everything waits until the first day after.
  const first = scheduleReviews(history, day(10), prefs);
  assert.equal(first.deferred, 1);
  assert.deepEqual(first.forecast.slice(0, 9), [0, 0, 0, 0, 0, 0, 0, 2, 1]);
  // No break, the same problems are due on their own days.
  assert.equal(scheduleReviews(history, day(11)).today.length, 2);
});

void test('retention: review days of the last 30 with a grade, and those graded Good or Easy', () => {
  const history = [
    item('a', [day(0), day(10), day(20)], [[day(10), 1], [day(20), 3]]),
    item('b', [day(5), day(15)], [[day(15), 4]]),
    item('c', [day(0), day(12)]), // Ungraded: not counted.
    item('d', [day(-40), day(-35)], [[day(-35), 2]]), // Over 30 days ago.
  ];
  assert.deepEqual(scheduleReviews(history, day(25)).retention, { passed: 2, total: 3 });
});

void test('prefs: fields out of range are dropped, a break needs a real day and a length', () => {
  assert.deepEqual(parseReviewPrefs('{"dailyCap":20,"pausedFrom":"2026-10-11","pausedDays":7}'), {
    dailyCap: 20,
    pausedFrom: '2026-10-11',
    pausedDays: 7,
  });
  assert.deepEqual(parseReviewPrefs({ dailyCap: 200, extra: 1 }), { dailyCap: 200 });
  for (const bad of [
    { dailyCap: 0 },
    { dailyCap: 201 },
    { dailyCap: 1.5 },
    { dailyCap: '5' },
    { pausedFrom: '2026-02-30', pausedDays: 3 },
    { pausedFrom: '2026-10-11' },
    { pausedFrom: '2026-10-11', pausedDays: 61 },
    { pausedFrom: '2026-10-11', pausedDays: 0 },
    { pausedFrom: '10/11/2026', pausedDays: 3 },
  ])
    assert.deepEqual(parseReviewPrefs(bad), {}, JSON.stringify(bad));
  for (const junk of ['', 'not json', 'null', '[1]', '7', null, undefined]) assert.deepEqual(parseReviewPrefs(junk), {});
  assert.equal(reviewPause({}), null);
  assert.deepEqual(reviewPause({ pausedFrom: '2026-12-30', pausedDays: 3 }), { from: '2026-12-30', to: '2027-01-01' });
});
