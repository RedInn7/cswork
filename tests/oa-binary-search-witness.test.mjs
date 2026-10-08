import assert from 'node:assert/strict';
import test from 'node:test';
import { binarySearchWitness as check } from '../lib/oa-binary-search-witness.mjs';
import { OJ_MAX_EXPECTED_BYTES } from '../lib/oj-data-budgets.mjs';

const witness = (a, t) => `${a.length}\n${a.join(' ')}\n${t}\n`;

// Recursive interval elimination independently models the original branches;
// the correct answer is linear membership, never the expected-output argument.
function fails(a, target) {
  function eliminate(lo, hi) {
    if (lo >= hi) return hi;
    const pivot = lo + Math.ceil((hi - lo) / 2);
    return a[pivot] <= target
      ? eliminate(pivot + 1, hi)
      : eliminate(lo, pivot - 1);
  }
  return a.includes(target) !== (a[eliminate(0, a.length - 1)] === target);
}

test('all small nondecreasing arrays agree with independent interval elimination', () => {
  let cases = 0;
  let accepted = 0;
  function visit(a, minimum, remaining) {
    if (!remaining) {
      for (let target = -3; target <= 3; target++) {
        const expected = fails(a, target);
        assert.equal(check(witness(a, target), 'CORRECT', ''), expected);
        cases++;
        accepted += Number(expected);
      }
      return;
    }
    for (let x = minimum; x <= 2; x++) visit([...a, x], x, remaining - 1);
  }
  for (let n = 1; n <= 8; n++) visit([], -2, n);
  assert.equal(cases, 9002);
  assert(accepted > 100);
});

test('accepts alternative counterexamples and rejects correct search outcomes', () => {
  for (const [a, t] of [
    [[1, 2, 3], 2],
    [[-9, -7, -2, 0, 4], -2],
    [[1, 2, 2, 3, 4], 2],
    [[-2147483648, 0, 2147483647], 0],
  ]) {
    assert(fails(a, t));
    assert(check(witness(a, t), 'invalid expected', ' \t\r\n\v\f'));
  }
  for (const [a, t] of [
    [[1], 1],
    [[1, 2], 2],
    [[1, 2, 3], 4],
    [[2, 2, 2], 2],
    [[1, 2, 2], 2],
  ])
    assert(!check(witness(a, t), witness([1, 2, 3], 2), ''));
  assert(check(' +003\r\n+01\t0002 3\r\n+2\r\n', '', ''));
});

test('rejects malformed syntax, input, line count and int overflow', () => {
  for (const output of [
    'CORRECT',
    '',
    '0\n\n0',
    '-1\n1\n1',
    '3\n1 2\n2',
    '2\n1 2 3\n2',
    '3\n3 2 1\n2',
    '3\n1 2 3\n2\n\n',
    '\n3\n1 2 3\n2',
    '3\n1\n2 3\n2',
    '3\n[1,2,3]\n2',
    '3\n1 2 3\n2 3',
    '3\n1 2.0 3\n2',
    '3\n1 2e0 3\n2',
    '3\n1 0x2 3\n2',
    '3\n1 ２ 3\n2',
    '3\n1\u00a02 3\n2',
    '3\n1 2 3\n2\0',
    '3\r1 2 3\r2',
    '3\n-2147483649 0 1\n0',
    '3\n1 2 2147483648\n2',
    '3\n1 2 3\n9007199254740993',
    '3\n9007199254740992 9007199254740993 9007199254740994\n9007199254740993',
    '2147483647\n1\n1',
    `${'9'.repeat(100000)}\n1\n1`,
    `3\n1 ${'9'.repeat(100000)} 3\n2`,
  ])
    assert(!check(output, output, ''), output.slice(0, 80));
  for (const input of ['x', '0', '\u00a0', null, undefined])
    assert(!check(witness([1, 2, 3], 2), '', input));
  assert(!check(null, '', ''));
  assert(!check(' '.repeat(OJ_MAX_EXPECTED_BYTES + 1), '', ''));
});

test('large valid witnesses and zero-padded int tokens remain exact', () => {
  const a = Array.from({ length: 10001 }, (_, i) => i - 5000);
  assert(check(witness(a, 0), '', ''));
  assert(check(`3\n1 ${'0'.repeat(100000)}2 3\n2`, '', ''));
  assert(!check('3\n-2147483648 -2147483648 -2147483648\n-2147483648', '', ''));
});
