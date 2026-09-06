import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  matchesComplexDesign,
  COMPLEX_DESIGN_IDS,
} from '../lib/oj-complex-design-checkers';
const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/oj-complex-design-checkers.json', import.meta.url),
    'utf8',
  ),
) as {
  cases: Array<{
    name: string;
    id: number;
    input: string;
    actual: string;
    accept: boolean;
  }>;
};
for (const row of fixture.cases)
  void test(row.name, () =>
    assert.equal(
      matchesComplexDesign(row.id, row.actual, '', row.input),
      row.accept,
    ),
  );
void test('fixed whitelist and strict constructor result', () => {
  assert.equal(COMPLEX_DESIGN_IDS.length, 11);
  assert.equal(matchesComplexDesign(1, '[]', '', '[]'), false);
  assert.equal(
    matchesComplexDesign(
      380,
      '[false]',
      '',
      JSON.stringify([['RandomizedSet'], [[]]]),
    ),
    false,
  );
});
void test('random choices and tied extreme keys are not fixed sequences', () => {
  const args = [
    ['RandomizedSet', 'insert', 'insert', 'getRandom'],
    [[], [1], [2], []],
  ];
  assert.equal(
    matchesComplexDesign(380, '[null,1,1,2]', '', JSON.stringify(args)),
    true,
  );
  assert.equal(
    matchesComplexDesign(380, '[null,1,1,3]', '', JSON.stringify(args)),
    false,
  );
  const counts = [
    ['AllOne', 'inc', 'inc', 'getMaxKey'],
    [[], ['a'], ['b'], []],
  ];
  assert.equal(
    matchesComplexDesign(
      432,
      '[null,null,null,"b"]',
      '',
      JSON.stringify(counts),
    ),
    true,
  );
});
void test('median tolerance, numeric JSON equivalence, and boolean rejection', () => {
  const input = JSON.stringify([
    ['MedianFinder', 'addNum', 'addNum', 'findMedian'],
    [[], [1], [2], []],
  ]);
  assert.equal(
    matchesComplexDesign(295, '[null,null,null,1.500001]', '', input),
    true,
  );
  assert.equal(
    matchesComplexDesign(295, '[null,null,null,1.501]', '', input),
    false,
  );
  const insert = JSON.stringify([
    ['RandomizedSet', 'insert'],
    [[], [1]],
  ]);
  assert.equal(matchesComplexDesign(380, '[null,1.0]', '', insert), true);
  assert.equal(matchesComplexDesign(380, '[null,true]', '', insert), false);
});
void test('serialization text is never prescribed, restored tree must match', () => {
  const input = JSON.stringify([
    ['Codec', 'roundTrip'],
    [[], [[1, null, 2]]],
  ]);
  assert.equal(matchesComplexDesign(297, '[null,[1,null,2]]', '', input), true);
  assert.equal(matchesComplexDesign(297, '[null,[1,2]]', '', input), false);
});
