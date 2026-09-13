import assert from 'node:assert/strict';
import test from 'node:test';
import {
  optimalLoads,
  optimalDistinct,
} from '../lib/oa-allocation-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

function vectors(n: number, low: number, high: number): number[][] {
  if (!n) return [[]];
  return vectors(n - 1, low, high).flatMap((prefix) =>
    Array.from({ length: high - low + 1 }, (_, i) => [...prefix, low + i]),
  );
}
function distribute(n: number, amount: number): number[][] {
  if (n === 1) return [[amount]];
  return Array.from({ length: amount + 1 }, (_, i) =>
    distribute(n - 1, amount - i).map((tail) => [i, ...tail]),
  ).flat();
}
test('loads: exhaustive assignments independently establish every optimum', () => {
  for (let n = 1; n <= 3; n++)
    for (const a of vectors(n, 0, 3))
      for (let extra = 0; extra <= 6; extra++) {
        const choices = distribute(n, extra).map((d) =>
          d.map((x, i) => x + a[i]),
        );
        const optimum = Math.min(...choices.map((b) => Math.max(...b)));
        const reference = choices
          .find((b) => Math.max(...b) === optimum)!
          .join(' ');
        const input = `${n} ${extra}\n${a.join(' ')}`;
        for (const b of choices) {
          const correct = Math.max(...b) === optimum;
          assert.equal(optimalLoads(b.join(' '), reference, input), correct);
          assert.equal(optimalLoads(reference, b.join(' '), input), correct);
        }
      }
});
test('distinct heights: exhaustive feasible and infeasible inputs; all optimal mappings accepted', () => {
  for (let n = 1; n <= 4; n++) {
    const candidates = vectors(n, 1, 4);
    for (const limits of candidates) {
      const legal = candidates.filter(
        (b) => new Set(b).size === n && b.every((x, i) => x <= limits[i]),
      );
      const input = `${n}\n${limits.join(' ')}`;
      if (!legal.length) {
        assert.equal(optimalDistinct('1', '1', input), false);
        continue;
      }
      const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
      const best = Math.max(...legal.map(sum));
      const reference = legal.find((b) => sum(b) === best)!.join(' ');
      for (const b of candidates) {
        const valid =
          new Set(b).size === n &&
          b.every((x, i) => x <= limits[i]) &&
          sum(b) === best;
        assert.equal(optimalDistinct(b.join(' '), reference, input), valid);
        assert.equal(optimalDistinct(reference, b.join(' '), input), valid);
      }
    }
  }
});
test('fixed production and verifier dispatch, invalid outputs, maximal arithmetic', () => {
  for (const [checker, input, actual, expected] of [
    ['oa-optimal-loads', '2 1\n0 0', '1 0', '0 1'],
    ['oa-optimal-distinct', '2\n3 3', '3 2', '2 3'],
  ] as const) {
    assert(matchesOutput(actual, expected, checker, input));
    assert(matchesOaOutput(actual, expected, checker, input));
    for (const invalid of [
      '',
      '0',
      '1 1',
      '1.0 2',
      'NaN 2',
      '1e0 2',
      '1 2 3',
      '９ 2',
      '1\u00a02',
      '9'.repeat(4194305),
    ]) {
      assert.equal(matchesOutput(invalid, expected, checker, input), false);
      assert.equal(matchesOaOutput(actual, invalid, checker, input), false);
    }
  }
  const loads = Array(100000).fill(1e9).join(' ');
  const final = Array(100000).fill(1010000000).join(' ');
  assert(optimalLoads(final, final, `100000 1000000000000\n${loads}`));
  assert(
    optimalLoads(
      '1001000000000',
      '1001000000000',
      '1 1000000000000\n1000000000',
    ),
  );
  const limits = Array(50000).fill(1e9).join(' ');
  const heights = Array.from({ length: 50000 }, (_, i) => 1e9 - i);
  assert(
    optimalDistinct(
      heights.join(' '),
      heights.reverse().join(' '),
      `50000\n${limits}`,
    ),
  );
  assert.equal(optimalLoads('0', '0', '1 -1\n1'), false);
  assert.equal(optimalDistinct('1', '1', '1\n1000000001'), false);
});
