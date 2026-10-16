import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../lib/mock-oa';
import { ROUTE_SECTIONS, ROUTE_SLUGS } from '../lib/route-stops';
import {
  groupResult,
  masteredStops,
  nextStep,
  openStart,
  PER_GROUP,
  placementResult,
  placementScore,
  placementTotal,
  type PlacementItem,
  type PlacementStep,
} from '../lib/placement';

const item = (n: number, section: string, score: number): PlacementItem => ({
  id: `lc-${n}`,
  number: n,
  titleZh: `题 ${n}`,
  titleEn: `Problem ${n}`,
  section,
  reason: '理由',
  reasonEn: 'Reason',
  score,
  rated: true,
});
// Every group: one problem per 100 points from 1000 to 2400, its stops in turn.
const pool = ROUTE_SECTIONS.flatMap((group, g) =>
  Array.from({ length: 15 }, (_, k) => item(g * 100 + k, group.slugs[k % group.slugs.length], 1000 + 100 * k)),
);
/** Answers every question until done: right while `right(step)` says so, else a wrong choice. */
function run(right: (step: PlacementStep, i: number) => boolean, from = pool, random = seededRandom(7)) {
  const steps: PlacementStep[] = [];
  for (let next = nextStep(from, steps, random); next; next = nextStep(from, steps, random)) {
    const { answer } = next;
    next.pick = right(next, steps.length) ? answer : next.choices.find((c) => c !== answer);
    steps.push(next);
  }
  return steps;
}

void test('scores: the contest rating, else a stand-in by difficulty', () => {
  assert.equal(placementScore(1832, '简单'), 1832);
  assert.equal(placementScore(null, '简单'), 1200);
  assert.equal(placementScore(undefined, 'Hard'), 2000);
  assert.equal(placementScore(null, '中等'), 1600);
  assert.equal(placementScore(null, 'constructor'), 1600, 'no prototype keys');
  assert.equal(placementScore(null, null), 1600);
});

void test('each group climbs a step per right answer and drops one per miss, from 1500', () => {
  const up = run(() => true);
  assert.equal(up.length, PER_GROUP * ROUTE_SECTIONS.length);
  assert.equal(placementTotal(pool), up.length);
  for (let g = 0; g < ROUTE_SECTIONS.length; g++) {
    const mine = up.filter((s) => s.group === g);
    assert.deepEqual(mine.map((s) => s.target), [1500, 1700, 1900]);
    assert.deepEqual(mine.map((s) => s.score), [1500, 1700, 1900], 'the nearest problem to each target');
  }
  // Groups come in line order, one finished before the next starts.
  assert.deepEqual(up.map((s) => s.group), ROUTE_SECTIONS.flatMap((_, g) => Array(PER_GROUP).fill(g)));
  const down = run(() => false);
  assert.deepEqual(down.filter((s) => s.group === 0).map((s) => s.target), [1500, 1300, 1100]);
  const mixed = run((_, i) => i % 3 !== 1);
  assert.deepEqual(mixed.filter((s) => s.group === 0).map((s) => s.target), [1500, 1700, 1500]);
  for (const step of up) {
    assert.equal(new Set(step.choices).size, 4);
    assert.ok(step.choices.includes(step.answer));
    assert.equal(ROUTE_SECTIONS[step.group].slugs.includes(step.answer), true);
  }
  // A problem is never asked twice, even when the ladder comes back to a score.
  assert.equal(new Set(mixed.map((s) => s.id)).size, mixed.length);
});

void test('a short group asks what it has; problems off the line never come up', () => {
  const short = [
    ...pool.filter((p) => ROUTE_SECTIONS.findIndex((g) => g.slugs.includes(p.section)) !== 3),
    item(9001, 'backtracking-strings', 1500),
    item(9002, 'backtracking-enumeration', 1300),
    item(9999, 'not-a-stop', 1500),
  ];
  const steps = run(() => true, short);
  assert.equal(steps.filter((s) => s.group === 3).length, 2);
  assert.equal(placementTotal(short), steps.length);
  assert.equal(steps.some((s) => s.id === 'lc-9999'), false);
  assert.equal(nextStep([], []), null);
});

void test('a group can be skipped only with every question right; the level is the best right score', () => {
  const steps = run((s) => s.group !== 1 && !(s.group === 2 && s.target === 1900));
  const result = placementResult(pool, steps, new Set(['lc-100']), 42);
  assert.equal(result.at, 42);
  const [g0, g1, g2] = result.groups;
  assert.deepEqual({ ...g0, picks: g0.picks.length }, { group: 0, right: 3, total: 3, level: 1900, skip: true, picks: 0 });
  assert.deepEqual({ ...g1, picks: undefined }, { group: 1, right: 0, total: 3, level: null, skip: false, picks: undefined });
  assert.deepEqual([g2.right, g2.level, g2.skip], [2, 1700, false], 'a miss at the top keeps the group');
  // Two unasked, unsolved problems nearest the level (the floor, 1100, without one).
  const asked = new Set(steps.map((s) => s.id));
  assert.equal(g1.picks.length, 2);
  for (const pick of g1.picks) assert.ok(!asked.has(pick.id) && pick.id !== 'lc-100');
  assert.deepEqual(g1.picks.map((p) => p.score).sort((a, b) => a - b), [1200, 1400], '1000 is solved; 1100 and 1300 were asked');
  assert.deepEqual(g2.picks.map((p) => p.score).sort((a, b) => a - b), [1600, 1800]);
  assert.equal(groupResult([]).skip, false);
  assert.equal(groupResult(steps.filter((s) => s.group === 0).slice(0, 2)).skip, false, 'two of three is not enough');
});

void test('the plan skips mastered stops and starts at the first open one', () => {
  const steps = run((s) => s.group === 0 || s.group === 4);
  const mastered = masteredStops(placementResult(pool, steps, new Set(), 1));
  assert.deepEqual([...mastered], [...ROUTE_SECTIONS[0].slugs, ...ROUTE_SECTIONS[4].slugs]);
  assert.equal(openStart(0, mastered), ROUTE_SECTIONS[0].slugs.length, 'past the whole first group');
  assert.equal(openStart(10, mastered), 10);
  assert.equal(openStart(0, new Set(ROUTE_SLUGS)), 0, 'all mastered: the given start');
  assert.equal(masteredStops(null).size, 0);
});

void test('questions are drawn within half a step of the nearest, and a retake skips the last quiz’s', () => {
  // Four more problems near 1500 in the first group: five within half a step of the target.
  const dense = [...pool, ...[1450, 1480, 1520, 1550].map((score, k) => item(9100 + k, ROUTE_SECTIONS[0].slugs[k], score))];
  const score = (id: string) => dense.find((p) => p.id === id)!.score;
  const firsts = new Set(Array.from({ length: 40 }, (_, k) => nextStep(dense, [], seededRandom(k))!.id));
  assert.ok(firsts.size >= 3, 'learners don’t all get the same first question');
  for (const id of firsts) assert.ok(Math.abs(score(id) - 1500) < 100, id);
  // Far from every problem, the band sits half a step past the nearest one.
  const sparse = [item(1, ROUTE_SECTIONS[0].slugs[0], 1000), item(2, ROUTE_SECTIONS[0].slugs[1], 1080), item(3, ROUTE_SECTIONS[0].slugs[2], 2400)];
  for (let k = 0; k < 20; k++) assert.notEqual(nextStep(sparse, [], seededRandom(k))!.id, 'lc-3');

  const last = run(() => true, dense);
  const seen = new Set(last.map((s) => s.id));
  for (let k = 0; k < 20; k++) assert.equal(seen.has(nextStep(dense, [], seededRandom(k), seen)!.id), false);
  // A group with nothing unseen left asks the seen ones again.
  const small = sparse.slice(0, 2);
  assert.ok(nextStep(small, [], seededRandom(1), new Set(small.map((p) => p.id))));
});
