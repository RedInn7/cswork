import assert from 'node:assert/strict';
import { test } from 'node:test';
import safe from '../lib/content/stress-safe.json';
import { leetcodeConstraints, leetcodeContract, leetcodeParams } from '../lib/server/leetcode-mode';
import { lingEditorial } from '../lib/server/ling-editorials';
import { SEMANTIC_IDS } from '../lib/oj-semantic-checkers';
import { STRING_STRUCTURE_IDS } from '../lib/oj-string-structures';
import {
  COMPLEXITY_BYTES,
  COMPLEXITY_RUNS,
  complexityCases,
  complexitySizes,
  firstMismatch,
  fitComplexity,
  sameOutput,
  STRESS_CASES,
  smallRange,
  stressCases,
  type StressRule,
} from '../lib/stress-gen';
import { checkConstraints, checkField, splitFields } from '../lib/testcase-fields';

const rules = safe as Record<string, Record<string, StressRule>>;
const fields = (text: string, n: number) => splitFields(text, n)!.map((f) => JSON.parse(f) as unknown);

test('the window stays inside the bounds, near zero, ten wide', () => {
  assert.deepEqual(smallRange([-1e9, 1e9]), [-4, 5]);
  assert.deepEqual(smallRange([1, 1e9]), [1, 10]);
  assert.deepEqual(smallRange([0, 3]), [0, 3]);
  assert.deepEqual(smallRange([30, 100]), [30, 39]);
  assert.deepEqual(smallRange([-100, -50]), [-59, -50]);
  assert.deepEqual(smallRange([1, 1e5], 12), [1, 12]);
});

test('cases are deterministic per seed, smallest first, and an unsupported parameter means no stress test', () => {
  const params = [
    { name: 'nums', type: 'integer[]' },
    { name: 'k', type: 'integer' },
  ];
  const bounds = { nums: { len: [1, 100000], val: [-1e9, 1e9] }, k: { val: [1, 100000] } };
  const a = stressCases(params, bounds, { k: { maxLen: 'nums' } }, 7)!;
  assert.equal(a.length, STRESS_CASES);
  assert.deepEqual(stressCases(params, bounds, { k: { maxLen: 'nums' } }, 7), a);
  assert.notDeepEqual(stressCases(params, bounds, { k: { maxLen: 'nums' } }, 8), a);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].length <= a[i].length, 'sorted by size');
  for (const text of a) {
    const [nums, k] = fields(text, 2) as [number[], number];
    assert.ok(nums.length >= 1 && nums.length <= 8);
    assert.ok(nums.every((v) => v >= -4 && v <= 5));
    assert.ok(k >= 1 && k <= nums.length, 'maxLen');
  }
  // Duplicates come up: that is what the narrow window is for.
  assert.ok(a.some((text) => new Set(fields(text, 2)[0] as number[]).size < (fields(text, 2)[0] as number[]).length));
  assert.equal(stressCases([{ name: 'root', type: 'TreeNode' }], null, {}, 1), null);
  assert.equal(stressCases([{ name: 's', type: 'string' }], { s: { len: [1, 5] } }, {}, 1), null, 'a string needs its alphabet');
  assert.equal(stressCases([{ name: 'x', type: 'integer' }], null, {}, 1), null, 'an integer needs its bounds');
  assert.equal(stressCases([{ name: 'g', type: 'integer[][]' }], { g: { len: [1, 5], val: [0, 1] } }, {}, 1), null, 'a grid needs its row length');
});

test('modifiers hold on every case', () => {
  const params = [
    { name: 'a', type: 'integer[]' },
    { name: 'b', type: 'integer[]' },
    { name: 's', type: 'string' },
    { name: 'g', type: 'integer[][]' },
    { name: 'iv', type: 'integer[][]' },
    { name: 't', type: 'string' },
    { name: 'flag', type: 'boolean' },
  ];
  const cases = stressCases(
    params,
    { a: { len: [3, 50], val: [0, 1e9] }, s: { len: [0, 100] } },
    {
      a: { sorted: true, distinct: true },
      b: { lenOf: 'a', val: [0, 1] },
      s: { chars: '()' },
      g: { len: [1, 300], val: [-5, 5], square: true },
      iv: { len: [1, 10], val: [-1e9, 1e9], cols: [2, 2], interval: true },
      t: { lenOf: 's', chars: 'xy' },
    },
    3,
  )!;
  for (const text of cases) {
    const [a, b, s, g, iv, t, flag] = fields(text, params.length) as [number[], number[], string, number[][], number[][], string, boolean];
    assert.ok(a.length >= 3 && a.every((v, i) => i === 0 || a[i - 1] < v), 'sorted and distinct');
    assert.ok(b.length === a.length && b.every((v) => v === 0 || v === 1), 'lenOf and val');
    assert.match(s, /^[()]*$/);
    assert.ok(s.length <= 8);
    assert.ok(g.length >= 1 && g.length <= 8 && g.every((row) => row.length === g.length), 'square');
    assert.ok(iv.every((row) => row.length === 2 && row[0] < row[1]), 'interval');
    assert.ok(t.length === s.length && /^[xy]*$/.test(t));
    assert.equal(typeof flag, 'boolean');
  }
});

test('outputs compare the way the checker does; the first disagreeing case is found', () => {
  assert.ok(sameOutput('1 2\r\n', '1 2\n', 'exact'));
  assert.ok(!sameOutput('1 2 \n', '1 2\n', 'exact'));
  assert.ok(sameOutput(' 1  2\n3', '1 2 3\n', 'tokens'));
  assert.ok(!sameOutput('1 2', '1 23', 'tokens'));
  const ref = [{ stdout: '1\n' }, { stdout: '2\n' }, { stdout: '3\n' }];
  const ok = (stdout: string) => ({ status: 'finished', stdout });
  assert.equal(firstMismatch([ok('1'), ok('2'), ok('3')], ref, 'tokens'), -1);
  assert.equal(firstMismatch([ok('1'), ok('5'), ok('9')], ref, 'tokens'), 1);
  assert.equal(firstMismatch([ok('1'), { status: 'runtime_error' }, { status: 'skipped' }], ref, 'tokens'), 1);
  assert.equal(firstMismatch([ok('1')], ref, 'tokens'), 1, 'a missing case disagrees');
});

/** The judge's checker for a Line 500 problem (scripts/publish-validated-library.ts): only exact and tokens compare by text. */
function checker(id: string) {
  const spec = leetcodeContract(id)!.spec as unknown as Record<string, unknown>;
  const n = Number(id.slice(3));
  if (n === 166 || (SEMANTIC_IDS as readonly number[]).includes(n) || (STRING_STRUCTURE_IDS as readonly number[]).includes(n))
    return 'special';
  if (spec.complexDesignId !== undefined || spec.specialId !== undefined) return 'special';
  return (
    { integer: 'tokens', string: 'exact', 'integer-array': 'tokens', 'nullable-integer-array': 'tokens', 'integer-rows': 'tokens' } as Record<
      string,
      string
    >
  )[spec.resultKind as string];
}

test('every whitelisted problem has a verified reference, a text checker and valid generated cases', () => {
  assert.ok(Object.keys(rules).length >= 100);
  for (const [id, rule] of Object.entries(rules)) {
    const params = leetcodeParams(id);
    assert.ok(params, `${id}: function parameters`);
    assert.equal(lingEditorial(id)?.verified, true, `${id}: verified editorial`);
    assert.ok(['exact', 'tokens'].includes(checker(id)!), `${id}: checker`);
    for (const name of Object.keys(rule)) assert.ok(params.some((p) => p.name === name), `${id}: rule for unknown ${name}`);
    for (const p of params) if (p.type === 'string') assert.ok(rule[p.name]?.chars, `${id}: ${p.name} names its alphabet`);
    const bounds = leetcodeConstraints(id);
    for (const seed of [1, 2]) {
      const cases = stressCases(params, bounds, rule, seed);
      assert.ok(cases, `${id}: supported`);
      for (const text of cases) {
        const split: string[] = splitFields(text, params.length)!;
        params.forEach((p, i) => assert.ok(checkField(split[i], p.type).ok, `${id}: ${p.name} = ${split[i]}`));
        assert.deepEqual(checkConstraints(split, params, bounds ?? {}).filter(Boolean), [], `${id}: ${text}`);
        // The rules' own bounds (filling the statement's gaps) hold too.
        params.forEach((p, i) => {
          const r = rule[p.name];
          const value = JSON.parse(split[i]) as unknown;
          if (r?.val) for (const v of [value].flat(2)) if (typeof v === 'number') assert.ok(v >= r.val[0] && v <= r.val[1], `${id}: ${p.name}`);
          if (r?.len && Array.isArray(value)) assert.ok(value.length >= r.len[0] && value.length <= r.len[1], `${id}: ${p.name} length`);
        });
      }
    }
  }
});

const probe = (id: string, seed = 1) => complexityCases(leetcodeParams(id)!, leetcodeConstraints(id), rules[id], seed);
const levels = (sizes: number[]) => sizes.filter((_, i) => i % COMPLEXITY_RUNS === 0);

test('a complexity probe scales every length to n, a grid by its cells, inside the byte budget', () => {
  const a = probe('lc-72', 5)!;
  assert.deepEqual(probe('lc-72', 5), a, 'the same seed draws the same cases');
  assert.notDeepEqual(probe('lc-72', 6)!.cases, a.cases);
  assert.deepEqual(levels(a.sizes), [1, 62, 125, 250, 500], 'a baseline, then halving down from the top length');
  a.cases.forEach((text, i) => {
    const [word1, word2] = fields(text, 2) as [string, string];
    assert.equal(word1.length, a.sizes[i]);
    assert.equal(word2.length, a.sizes[i]);
    if (i % COMPLEXITY_RUNS) assert.equal(text, a.cases[i - 1], 'each size runs twice on the same input');
  });
  // lc-48: a square matrix of at most 20 × 20, so 400 cells at the top; sides are √n.
  const m = probe('lc-48')!;
  assert.deepEqual(levels(m.sizes), [1, 50, 100, 200, 400]);
  m.cases.forEach((text, i) => {
    const [matrix] = fields(text, 1) as [number[][]];
    assert.equal(matrix.length, Math.round(Math.sqrt(m.sizes[i])));
    assert.ok(matrix.every((row) => row.length === matrix.length));
  });
  // Intervals have a fixed row length of 2: the rows make up the cells.
  const iv = probe('lc-435')!;
  assert.equal((fields(iv.cases.at(-1)!, 1)[0] as number[][]).length, iv.sizes.at(-1)! / 2);
  // Values sit in an n-wide window: lc-53 reaches far past ±5 at n = 16384.
  const big = fields(probe('lc-53')!.cases.at(-1)!, 1)[0] as number[];
  assert.equal(big.length, 16384);
  assert.ok(Math.max(...big) > 1000);
  assert.equal(probe('lc-70'), null, 'no length to scale');
  // n ≤ 50 or 100 leaves one or two sizes past the baseline: too few to fit, so no probe.
  assert.equal(probe('lc-1039'), null);
  assert.equal(probe('lc-198'), null);
  assert.equal(complexitySizes(leetcodeParams('lc-70')!, leetcodeConstraints('lc-70'), rules['lc-70']), null);
});

test('every whitelisted probe has increasing sizes and valid cases under 512 KiB, or none at all', () => {
  let probes = 0;
  for (const [id, rule] of Object.entries(rules)) {
    const params = leetcodeParams(id)!;
    const bounds = leetcodeConstraints(id);
    const made = complexityCases(params, bounds, rule, 3);
    // The client shows the button from complexitySizes: it must agree with the server.
    assert.equal(made === null, complexitySizes(params, bounds, rule) === null, id);
    if (!made) continue;
    probes++;
    const sizes = levels(made.sizes);
    assert.ok(sizes.length >= 4 && sizes.every((n, i) => i === 0 || sizes[i - 1] < n), `${id}: ${sizes}`);
    assert.ok(sizes.at(-1)! <= 16384 && sizes.slice(1).every((n) => n >= 32), id);
    assert.equal(made.cases.length, made.sizes.length);
    assert.ok(made.cases.reduce((sum, c) => sum + Buffer.byteLength(c), 0) <= COMPLEXITY_BYTES, `${id}: bytes`);
    for (const text of new Set(made.cases)) {
      const split = splitFields(text, params.length)!;
      params.forEach((p, i) => assert.ok(checkField(split[i], p.type).ok, `${id}: ${p.name}`));
      assert.deepEqual(checkConstraints(split, params, bounds ?? {}).filter(Boolean), [], id);
    }
  }
  assert.ok(probes >= 150, `${probes} probes`);
});

test('a probe reads its slope off log time on log n, net of the baseline', () => {
  const sizes = [1, 256, 512, 1024, 2048, 4096, 8192, 16384];
  const runs = (ms: (n: number) => number) =>
    sizes.flatMap((n) => [
      { n, ms: ms(n) + 3, status: 'finished' },
      { n, ms: ms(n), status: 'finished' },
    ]);
  const square = fitComplexity(runs((n) => 30 + n * n * 1e-5));
  assert.equal(square.kind, 'fit');
  assert.ok(square.kind === 'fit' && Math.abs(square.slope - 2) < 0.05 && square.grade === 2 && !square.few);
  const nlogn = fitComplexity(runs((n) => 30 + n * Math.log2(n) * 0.005));
  assert.ok(nlogn.kind === 'fit' && nlogn.slope < 1.3 && nlogn.grade === 0, JSON.stringify(nlogn));
  // Start-up only: nothing grows past the noise floor.
  assert.deepEqual(fitComplexity(runs((n) => 30 + (n % 7))), { kind: 'fast', large: true });
  assert.deepEqual(fitComplexity(runs(() => 30).filter((p) => p.n <= 1024)), { kind: 'fast', large: false });
  // One size past the floor is no reading at all, however large n is.
  assert.deepEqual(fitComplexity(runs((n) => (n === 16384 ? 90 : 30))), { kind: 'one', n: 16384, ms: 60 });
  // A 150 ms start-up (Java) hides an n² at 100 ms net under the floor: too fast to tell, no bound claimed.
  assert.deepEqual(fitComplexity(runs((n) => 150 + (n / 16384) ** 2 * 100)), { kind: 'fast', large: false });
  assert.deepEqual(fitComplexity(runs(() => 150)), { kind: 'fast', large: true });
  // A timeout at 4096 keeps the slope of the sizes before it.
  const cubic = runs((n) => 30 + (n / 100) ** 3).map((p) => (p.n === 4096 ? { ...p, status: 'time_limit' } : p.n > 4096 ? { ...p, status: 'skipped' } : p));
  const timeout = fitComplexity(cubic);
  assert.ok(timeout.kind === 'timeout' && timeout.n === 4096 && Math.abs(timeout.slope! - 3) < 0.3, JSON.stringify(timeout));
  assert.deepEqual(fitComplexity(runs(() => 30).map((p) => (p.n > 1 ? { ...p, status: 'time_limit' } : p))), { kind: 'timeout', n: 256, slope: undefined });
  // Two sizes past the floor only: marked few.
  const two = fitComplexity(runs((n) => (n >= 8192 ? 30 + n / 10 : 30)));
  assert.ok(two.kind === 'fit' && two.few && Math.abs(two.slope - 1) < 0.01, JSON.stringify(two));
  assert.deepEqual(fitComplexity(runs(() => 30).map((p) => (p.n === 2048 ? { ...p, status: 'runtime_error' } : p))), {
    kind: 'error',
    n: 2048,
    status: 'runtime_error',
  });
});
