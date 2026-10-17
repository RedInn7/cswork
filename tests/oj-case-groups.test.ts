import test from 'node:test';
import assert from 'node:assert/strict';
import { caseGroups, groupScores } from '../lib/oj-case-groups';

const hidden = (sizes: number[], samples = 2) => [
  ...Array.from({ length: samples }, (_, ordinal) => ({ ordinal, hidden: false, size: 10_000 })),
  ...sizes.map((size, i) => ({ ordinal: samples + i, hidden: true, size })),
];

void test('a version is split only with 6+ hidden cases and an 8x size spread', () => {
  assert.equal(caseGroups(hidden([10, 10, 10, 10, 1000])), null);
  // Median 10, largest 79: under 8x.
  assert.equal(caseGroups(hidden([10, 10, 10, 10, 10, 79])), null);
  assert.equal(caseGroups(hidden([0, 0, 0, 0, 0, 0])), null);
  // 6 hidden: ceil(1.8) = 2, the two largest. Samples stay correctness even with large inputs.
  assert.deepEqual(caseGroups(hidden([10, 12, 11, 100, 10, 80])), [
    'correctness',
    'correctness',
    'correctness',
    'correctness',
    'correctness',
    'performance',
    'correctness',
    'performance',
  ]);
});

void test('hidden cases within 8x of the largest are performance, capped at ceil(30%), ties by ordinal', () => {
  // 9 hidden, median 100: ceil(2.7) = 3 of the four 5000s, the last by ordinal left out.
  const sizes = [100, 5000, 100, 5000, 100, 5000, 100, 5000, 100];
  const cases = hidden(sizes, 1);
  const groups = caseGroups(cases)!;
  assert.deepEqual(
    cases.filter((_, i) => groups[i] === 'performance').map((c) => c.ordinal),
    [2, 4, 6],
  );
  // Exactly 10 hidden: ceil(3) = 3, not 4.
  const ten = caseGroups(hidden([1, 1, 1, 1, 1, 1, 1, 9, 9, 9], 0))!;
  assert.equal(ten.filter((g) => g === 'performance').length, 3);
  // Real OA packages: 2 stress inputs among 24 tiny edge cases. The quota (8) is not padded with tiny ones.
  const tiny = (n: number) => Array.from({ length: n }, () => 14);
  const stress = hidden([...tiny(12), 200_002, ...tiny(12), 200_002], 0);
  const split = caseGroups(stress)!;
  assert.deepEqual(
    stress.filter((_, i) => split[i] === 'performance').map((c) => c.ordinal),
    [12, 25],
  );
});

void test('group scores are weighted and only 100 when every case passed', () => {
  assert.deepEqual(
    groupScores([
      { group: 'correctness', weight: 1, accepted: true },
      { group: 'correctness', weight: 3, accepted: true },
      { group: 'performance', weight: 2, accepted: true },
      { group: 'performance', weight: 1, accepted: false },
    ]),
    { correctness: 100, performance: 66 },
  );
  assert.deepEqual(
    groupScores([
      ...Array.from({ length: 199 }, () => ({ group: 'correctness' as const, weight: 1, accepted: true })),
      { group: 'correctness', weight: 1, accepted: false },
      { group: 'performance', weight: 5, accepted: false },
    ]),
    { correctness: 99, performance: 0 },
  );
});
