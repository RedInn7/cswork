import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { morganBricks as check } from '../lib/oa-morgan-bricks-checker.mjs';
import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
} from '../lib/oj-data-budgets.mjs';

const input = (a, k) => `${a.length} ${k}\n${a.join(' ')}\n`;
const output = (total, big, small) =>
  `${total}\n${big.length ? big.join(' ') : '-1'}\n${small.length ? small.join(' ') : '-1'}\n`;

function partition(a, mask) {
  let cost = 0;
  const big = [],
    small = [];
  for (let i = 0; i < a.length; i++) {
    if (mask & (1 << i)) {
      big.push(i + 1);
      cost++;
    } else {
      small.push(i + 1);
      cost += a[i];
    }
  }
  return { cost, big, small };
}

test('all four immutable raw examples', () => {
  const cases = [
    [[2], 0, 2, [], [1]],
    [[3, 2, 5, 4, 6, 7, 9], 4, 13, [3, 5, 6, 7], [1, 2, 4]],
    [[7, 9, 3, 2, 5, 8, 4, 6], 9, 8, [1, 2, 3, 4, 5, 6, 7, 8], []],
    [[10000000, 100000000, 1000000000], 0, 1110000000, [], [1, 2, 3]],
  ];
  for (const [a, k, total, big, small] of cases)
    assert(check(output(total, big, small), 'untrusted', input(a, k)));
});

test('independent subset oracle checks every partition of small distinct arrays', () => {
  // Each ordered subset of {1,...,7} is sampled in both index directions;
  // every hammer subset, including suboptimal subsets, is checked.
  for (let selection = 1; selection < 128; selection++) {
    const ascending = Array.from({ length: 7 }, (_, i) => i + 1).filter(
      (_, i) => selection & (1 << i),
    );
    for (const a of [ascending, [...ascending].reverse()]) {
      const partitions = Array.from({ length: 2 ** a.length }, (_, mask) =>
        partition(a, mask),
      );
      for (let k = 0; k <= a.length + 1; k++) {
        const optimum = Math.min(
          ...partitions.filter((p) => p.big.length <= k).map((p) => p.cost),
        );
        for (const p of partitions) {
          assert.equal(
            check(output(p.cost, p.big, p.small), '', input(a, k)),
            p.big.length <= k && p.cost === optimum,
            JSON.stringify({ a, k, p, optimum }),
          );
        }
      }
    }
  }
});

test('strength one permits either hammer and expected never dictates the witness', () => {
  assert(check('1\n1\n-1', 'broken', input([1], 1)));
  assert(check('1\n-1\n1', undefined, input([1], 1)));
  assert(check('2\n2\n1', '2\n1 2\n-1', input([1, 8], 2)));
  assert(check('2\n1 2\n-1', '2\n2\n1', input([1, 8], 2)));
  assert(check(' +02 \r\n +01 02 \r\n -01 \r\n', null, input([1, 8], 2)));
  assert(check('8\n1\n2', '', input([9, 7], 1)));
  assert(!check('10\n2\n1', '', input([9, 7], 1)));
});

test('rejects malformed rows, incomplete partitions, false totals and nonoptimal partitions', () => {
  const raw = input([3, 7, 1], 1);
  for (const text of [
    '',
    '5 2 1 3',
    '5\n2\n1 3\n4',
    '5\n\n1 2 3',
    '5 5\n2\n1 3',
    '5\n2\n3 1',
    '5\n2 2\n1 3',
    '5\n2\n1 2 3',
    '5\n2\n1',
    '5\n0\n1 3',
    '5\n4\n1 3',
    '5\n-2\n1 3',
    '5\n-1 2\n1 3',
    '5\n2\n-1 1 3',
    '5\n1 2\n3',
    '4\n2\n1 3',
    '5.0\n2\n1 3',
    '5e0\n2\n1 3',
    '5\n2.0\n1 3',
    '5\n2\n1 ３',
    '5\n2\n1\u00a03',
    'NaN\n2\n1 3',
    'Infinity\n2\n1 3',
    '0x5\n2\n1 3',
  ])
    assert(!check(text, text, raw), JSON.stringify(text));
  assert(check('5\n2\n1 3', 'invalid expected', raw));
  assert(!check('3\n1 2 3\n-1', '', raw));
});

test('rejects bad input domains, duplicates and oversized decimal tokens safely', () => {
  for (const raw of [
    '',
    '0 0',
    '200001 0\n1',
    '1 -1\n1',
    '1 200001\n1',
    '1 0',
    '1 0\n1 2',
    '2 0\n1 1',
    '1 0\n0',
    '1 0\n-1',
    '1 0\n1000000001',
    '1 0\n1e0',
    '1 0\n1.0',
    '1 0\nNaN',
    '1 0\n１',
  ])
    assert(!check('1\n-1\n1', '', raw), raw);
  const huge = '9'.repeat(100000);
  for (const raw of [`${huge} 0\n1`, `1 ${huge}\n1`, `1 0\n${huge}`])
    assert(!check('1\n-1\n1', '', raw));
  assert(!check(`${huge}\n-1\n1`, '', input([1], 0)));
  assert(!check(`1\n-1\n${huge}`, '', input([1], 0)));
  assert(check('1\n-1\n1', '', `+0001 -0\n+${'0'.repeat(100000)}1`));
  assert(!check(null, '', input([1], 0)));
  assert(!check('1\n-1\n1', '', null));
  assert(!check('1\n-1\n1', '', ' '.repeat(OJ_MAX_CASE_BYTES + 1)));
  assert(!check(' '.repeat(OJ_MAX_EXPECTED_BYTES + 1), '', input([1], 0)));
  assert(!check(`1\n-1\n${'1 '.repeat(200001)}`, '', input([1], 0)));
  assert(!check(`1\n-1\n1\n${'\n'.repeat(200000)}extra`, '', input([1], 0)));
});

test('full n=200000 domain handles totals exceeding 32 bits and all hammer regimes', () => {
  const n = 200000;
  const strengths = Array.from({ length: n }, (_, i) => 1000000000 - i);
  const indices = Array.from({ length: n }, (_, i) => i + 1);
  const sum = (n * (2000000000 - n + 1)) / 2;
  assert(sum > 2 ** 32 && Number.isSafeInteger(sum));
  const started = performance.now();
  assert(check(output(sum, [], indices), '', input(strengths, 0)));
  assert(!check(output(sum - 1, [], indices), '', input(strengths, 0)));
  assert(check(output(n, indices, []), '', input(strengths, n)));
  const k = n / 2;
  const smallTotal = ((n - k) * (1000000000 - k + (1000000000 - n + 1))) / 2;
  assert(
    check(
      output(k + smallTotal, indices.slice(0, k), indices.slice(k)),
      '',
      input(strengths, k),
    ),
  );
  assert(
    performance.now() - started < 10000,
    'full-domain checker unexpectedly slow',
  );
});
