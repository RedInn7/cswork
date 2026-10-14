import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_SECTIONS } from '../lib/route-stops';
import { seededRandom } from '../lib/mock-oa';
import {
  distractors,
  firstParagraph,
  groupIndex,
  speedrunRound,
  stopCode,
  type SpeedrunPoolItem,
} from '../lib/speedrun';

const slugs = ROUTE_SECTIONS.flatMap((g) => g.slugs);
const item = (n: number, section: string): SpeedrunPoolItem => ({
  id: `lc-${n}`,
  number: n,
  titleZh: `题 ${n}`,
  titleEn: `Problem ${n}`,
  section,
  reason: '理由',
  reasonEn: 'Reason',
});
// Three problems per stop, plus one with a stop the line does not know.
const pool = [
  ...slugs.flatMap((slug, i) => [item(i * 3, slug), item(i * 3 + 1, slug), item(i * 3 + 2, slug)]),
  item(9999, 'not-a-stop'),
];

test('a round has ten problems on ten different stops, each answer among four distinct choices', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const round = speedrunRound(pool, seededRandom(seed));
    assert.equal(round.length, 10);
    assert.equal(new Set(round.map((q) => q.id)).size, 10);
    assert.equal(new Set(round.map((q) => q.answer)).size, 10, 'distinct stops while they last');
    for (const q of round) {
      assert.ok(slugs.includes(q.answer), 'unknown stops never become questions');
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices.includes(q.answer));
      assert.ok(q.choices.every((c) => slugs.includes(c)));
      assert.equal('section' in q, false, 'the pool field is renamed, not duplicated');
    }
  }
});

test('the answer is not always in the same slot', () => {
  const slots = new Set<number>();
  for (let seed = 1; seed <= 20; seed++)
    for (const q of speedrunRound(pool, seededRandom(seed))) slots.add(q.choices.indexOf(q.answer));
  assert.deepEqual([...slots].sort(), [0, 1, 2, 3]);
});

test('a small pool repeats stops instead of coming up short, and an empty pool gives an empty round', () => {
  const tiny = [item(1, 'dp-stock'), item(2, 'dp-stock'), item(3, 'bits-math')];
  const round = speedrunRound(tiny, seededRandom(7));
  assert.equal(round.length, 3);
  assert.deepEqual(round.slice(0, 2).map((q) => q.answer).sort(), ['bits-math', 'dp-stock']);
  assert.deepEqual(speedrunRound([], seededRandom(1)), []);
});

test('distractors are the nearest stops in the same group, borrowing neighbours only when the group is small', () => {
  const dp = ROUTE_SECTIONS.find((g) => g.en === 'Dynamic Programming')!.slugs;
  for (let seed = 1; seed <= 20; seed++) {
    const near = distractors('dp-knapsack', seededRandom(seed));
    assert.ok(near.every((s) => dp.includes(s)));
    // Index 2 in DP: both stops at distance 1 always, then one at distance 2.
    assert.ok(near.includes('dp-grid') && near.includes('dp-subsequence'));
    assert.ok(near.includes('dp-foundations') || near.includes('dp-string'));
  }
  // Backtracking has three stops: both siblings plus the nearest stop outside it.
  const back = distractors('backtracking-strings', seededRandom(3));
  assert.ok(back.includes('backtracking-enumeration') && back.includes('backtracking-constraints'));
  assert.ok(['graph-spanning-tree', 'dp-foundations'].some((s) => back.includes(s)));
});

test('stop codes and groups follow the Line 500 order', () => {
  assert.equal(stopCode('array-foundations'), '01');
  assert.equal(stopCode('bits-math'), '35');
  assert.equal(stopCode('nope'), '--');
  assert.equal(groupIndex('linked-list'), 1);
  assert.equal(groupIndex('nope'), -1);
});

test('firstParagraph keeps the opening prose and trims long ones at a sentence end', () => {
  assert.equal(
    firstParagraph('![fig](https://x/y.png)\n\n给你一个数组 `nums` 。\n\n**示例 1：**'),
    '给你一个数组 `nums` 。',
  );
  assert.equal(firstParagraph('# Title\n\nGiven an array.\n\nExample'), 'Given an array.');
  assert.equal(firstParagraph(''), '');
  const long = 'First sentence is here. ' + 'x'.repeat(400);
  assert.equal(firstParagraph(long, 60), 'First sentence is here.');
  const noStop = 'y'.repeat(200);
  assert.equal(firstParagraph(noStop, 50), 'y'.repeat(50) + '…');
});
