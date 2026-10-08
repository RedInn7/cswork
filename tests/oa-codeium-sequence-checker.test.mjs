import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { codeiumSequence as check } from '../lib/oa-codeium-sequence-checker.mjs';
import { OJ_MAX_CASE_BYTES, OJ_MAX_EXPECTED_BYTES } from '../lib/oj-data-budgets.mjs';

const input = (p) => `${p.length}\n${p.join(' ')}\n`;
const counts = (a) => a.map((x) => a.filter((y) => x + y > 0).length);

function* permutations(a, start = 0) {
  if (start === a.length) { yield [...a]; return; }
  for (let i = start; i < a.length; i++) {
    [a[start], a[i]] = [a[i], a[start]];
    yield* permutations(a, start + 1);
    [a[start], a[i]] = [a[i], a[start]];
  }
}

test('exhaustive independent signed-permutation oracle and all degree vectors n<=5', () => {
  for (let n = 1; n <= 5; n++) {
    const possible = new Set();
    for (const order of permutations(Array.from({ length: n }, (_, i) => i + 1))) {
      for (let mask = 0; mask < 2 ** n; mask++) {
        const a = order.map((v, i) => mask & (1 << i) ? -v : v);
        const p = counts(a);
        possible.add(p.join(','));
        assert(check(a.join(' '), 'None', input(p)));
      }
    }
    for (let encoded = 0; encoded < (n + 1) ** n; encoded++) {
      let remainder = encoded;
      const p = Array.from({ length: n }, () => {
        const v = remainder % (n + 1);
        remainder = Math.floor(remainder / (n + 1));
        return v;
      });
      assert.equal(check('None', 'untrusted', input(p)), !possible.has(p.join(',')), p.join(','));
    }
  }
});

test('any optimal witness is accepted without trusting reference output', () => {
  assert(check('1 2 3', 'None', input([3, 3, 3])));
  assert(check('3 1 2', 'broken reference', input([3, 3, 3])));
  assert(check('None', '1 2', input([0, 2])));
  assert(!check('None', 'None', input([0, 1])));
  assert(check('-2 +01', undefined, input([0, 1])));
});

test('rejects zero, duplicates, opposites, nonoptimal scale and wrong self count', () => {
  for (const output of ['0 1', '1 1', '1 -1', '2 3', '1 2 3', '1', '1.0 2', '1e0 2', 'NaN 2', 'Infinity 2'])
    assert(!check(output, output, input([2, 2])), output);
  assert(!check('1', '1', input([0]))); // Self contributes to positive count.
  assert(check('-1', '1', input([0])));
  assert(check('1', '-1', input([1])));
  assert(!check('None extra', 'None', input([2])));
  assert(!check('none', 'None', input([2])));
});

test('unbounded decimal p is naturally infeasible, not a narrowed domain', () => {
  const huge = '9'.repeat(100000);
  assert(check('None', '', `1\n${huge}`));
  assert(!check('1', 'None', `1\n${huge}`));
  assert(check('1', '', `+0001\n+${'0'.repeat(100000)}1`));
  assert(check('-1', '', '1\n-0'));
  for (const p of ['-1', '-999999999999999999999', '1.0', '1e100', 'NaN', 'Infinity', '0x1'])
    assert(!check('None', '', `1\n${p}`), p);
  assert(!check('9'.repeat(100000), '', input([1])));
});

test('malformed counts and adversarial lengths fail closed under shared budgets', () => {
  for (const raw of ['', '0\n', '100001\n0', '1\n', '1\n0 0', '2\n0', '2\n999999999999999999 bad', '1\n０', '1\n0\u00a0'])
    assert(!check('None', '', raw), raw);
  assert(!check(null, '', input([0])));
  assert(!check('None', '', null));
  assert(!check('None', '', ' '.repeat(OJ_MAX_CASE_BYTES + 1)));
  assert(!check(' '.repeat(OJ_MAX_EXPECTED_BYTES + 1), '', input([0])));
  assert(!check('1 '.repeat(100001), '', input([1])));
});

test('full n=100000 valid witness and independent feasibility stay O(n log n)', () => {
  const n = 100000;
  const a = Array.from({ length: n }, (_, i) => n - i);
  const p = Array(n).fill(n);
  const started = performance.now();
  assert(check(a.join(' '), 'None', input(p)));
  assert(!check('None', 'None', input(p)));
  assert(check('None', '', input(Array(n).fill(1))));
  // Independently counted mixed signs, with a coprime permutation of magnitudes.
  const mixed = Array.from({ length: n }, (_, i) => {
    const k = (i * 7919) % n + 1;
    return k % 2 ? -k : k;
  });
  const mixedCounts = mixed.map((v) => v > 0
    ? n / 2 + v / 2
    : n / 2 - Math.floor(-v / 2));
  assert(check(mixed.join(' '), 'None', input(mixedCounts)));
  assert(!check('None', 'None', input(mixedCounts)));
  assert(performance.now() - started < 10000, 'full-domain checker unexpectedly slow');
});
