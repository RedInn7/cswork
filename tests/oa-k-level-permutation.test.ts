import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOaSemantic, OA_SEMANTIC_IDS } from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

const checker = 'oa-k-level-permutation';
const input = '7 4\n';
const reference = '1 7 3 5 2 6 4\n';
const alternate = '1 6 3 7 2 5 4\n';

test('K-level checker accepts any valid permutation and sample sums differ by one', () => {
  assert.equal(OA_SEMANTIC_IDS[checker], 'oa-amazon-151');
  const permutation = [1, 7, 3, 5, 2, 6, 4];
  const sums = permutation.slice(0, 4).map((_, i) =>
    permutation.slice(i, i + 4).reduce((total, value) => total + value, 0),
  );
  assert.deepEqual(sums, [16, 17, 16, 17]);
  assert(matchesOaSemantic(checker, reference, reference, input));
  assert(matchesOaSemantic(checker, alternate, reference, input));
  for (const check of [matchesOutput, matchesOaOutput]) {
    assert(check(reference, reference, checker, input));
    assert(check(alternate, reference, checker, input));
  }
});

test('K-level checker rejects bad permutations, wrong sums and invalid input bounds', () => {
  for (const output of [
    '1 7 3 5 2 6 6\n',
    '0 7 3 5 2 6 4\n',
    '1 2 3 4 5 6 7\n',
    '1 7 3 5 2 6\n',
    '1 7 3 5 2 6 4 extra\n',
    '1 7 3 5 2 6 4.0\n',
  ])
    assert(!matchesOaSemantic(checker, output, reference, input), output);
  for (const invalidInput of ['7 3', '7 0', '7 8', '1 2', '200001 2'])
    assert(!matchesOaSemantic(checker, reference, reference, invalidInput));
  assert(!matchesOaSemantic(checker, reference, '1 2 3', input));
  assert(!matchesOaSemantic('unknown', reference, reference, input));
});

test('K-level checker handles a 200000-value valid output', () => {
  const n = 200_000,
    k = 2;
  const permutation = new Array<number>(n);
  let low = 1,
    high = n;
  for (let residue = 0; residue < k; residue++)
    for (let index = residue; index < n; index += k)
      permutation[index] = residue % 2 === 0 ? low++ : high--;
  const output = permutation.join(' ') + '\n';
  assert(matchesOaSemantic(checker, output, output, `${n} ${k}\n`));
});
