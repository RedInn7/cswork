import assert from 'node:assert/strict';
import { test } from 'node:test';
import safe from '../lib/content/stress-safe.json';
import { leetcodeConstraints, leetcodeContract, leetcodeParams } from '../lib/server/leetcode-mode';
import { lingEditorial } from '../lib/server/ling-editorials';
import { SEMANTIC_IDS } from '../lib/oj-semantic-checkers';
import { STRING_STRUCTURE_IDS } from '../lib/oj-string-structures';
import { firstMismatch, sameOutput, STRESS_CASES, smallRange, stressCases, type StressRule } from '../lib/stress-gen';
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
        const split = splitFields(text, params.length)!;
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
