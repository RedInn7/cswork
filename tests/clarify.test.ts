import assert from 'node:assert/strict';
import { test } from 'node:test';
import safe from '../lib/content/stress-safe.json';
import { bound, clarifyItems } from '../lib/clarify';
import type { StressRule } from '../lib/stress-gen';
import { leetcodeConstraints, leetcodeParams } from '../lib/server/leetcode-mode';
import { checkConstraints, checkField, splitFields } from '../lib/testcase-fields';

const rules = safe as Record<string, Record<string, StressRule>>;
const keys = (items: { key: string }[]) => items.map((item) => item.key);

test('bounds read like the statement', () => {
  assert.equal(bound(-1e9), '−10^9');
  assert.equal(bound(2 ** 31 - 1), '2^31−1');
  assert.equal(bound(-(2 ** 31)), '−2^31');
  assert.equal(bound(3e9), '3×10^9');
  assert.equal(bound(5000), '5000');
});

test('a sum overflows 32 bits only when the longest length times the largest |value| exceeds 2^31−1', () => {
  const nums = [{ name: 'nums', type: 'integer[]' }];
  const big = clarifyItems(nums, { nums: { len: [1, 1e5], val: [-1e4, 1e5] } });
  const overflow = big.find((item) => item.key === 'overflow')!;
  assert.match(overflow.answer![0], /10\^5 × 10\^5 = 10\^10/);
  assert.match(overflow.answer![1], /long/);
  // 10^4 × 10^5 = 10^9 still fits.
  assert.ok(!keys(clarifyItems(nums, { nums: { len: [1, 1e4], val: [0, 1e5] } })).includes('overflow'));
  // Strings carry no sum; a scalar has no length.
  assert.ok(!keys(clarifyItems([{ name: 'k', type: 'integer' }], { k: { val: [1, 2 ** 31 - 1] } })).includes('overflow'));
});

test('an input that may be empty says so and comes with the empty case', () => {
  const [empty] = clarifyItems([{ name: 's', type: 'string' }], { s: { len: [0, 5e4] } });
  assert.equal(empty.key, 'empty');
  assert.match(empty.answer![0], /s 可以为空/);
  assert.deepEqual(empty.cases, ['""']);
  const [one] = clarifyItems([{ name: 'nums', type: 'integer[]' }], { nums: { len: [1, 100], val: [1, 100] } });
  assert.match(one.answer![1], /at least 1 element\./);
  // Not whitelisted and not empty: no guessed case.
  assert.deepEqual(one.cases, []);
  // Two parameters that may each be empty may not be empty together (two sorted arrays, total ≥ 1).
  const two = clarifyItems(
    [
      { name: 'nums1', type: 'integer[]' },
      { name: 'nums2', type: 'integer[]' },
    ],
    { nums1: { len: [0, 1000] }, nums2: { len: [0, 1000] } },
  );
  assert.deepEqual(two[0].cases, []);
});

test('a tree parameter asks about the empty tree and a single node', () => {
  const items = clarifyItems([{ name: 'root', type: 'TreeNode' }], { root: { len: [0, 100], val: [-100, 100] } });
  assert.deepEqual(items.find((item) => item.key === 'empty')!.cases, ['[]']);
  assert.deepEqual(items.find((item) => item.key === 'nodes')!.cases, ['[1]']);
  assert.match(items.find((item) => item.key === 'negative')!.answer![0], /root 最小 −100/);
  // A single node takes the lowest allowed value when 1 is out of range.
  const high = clarifyItems([{ name: 'head', type: 'ListNode' }], { head: { len: [1, 10], val: [5, 9] } });
  assert.deepEqual(high.find((item) => item.key === 'nodes')!.cases, ['[5]']);
  // Two lists: no single-node guess (their relation may matter).
  const pair = clarifyItems(
    [
      { name: 'l1', type: 'ListNode' },
      { name: 'l2', type: 'ListNode' },
    ],
    { l1: { len: [1, 100] }, l2: { len: [1, 100] } },
  );
  assert.deepEqual(pair.find((item) => item.key === 'nodes')!.cases, []);
});

test('the generic questions follow the parameter types', () => {
  assert.deepEqual(keys(clarifyItems([{ name: 'n', type: 'integer' }], null)), ['answers']);
  assert.deepEqual(keys(clarifyItems([{ name: 'words', type: 'string[]' }], null)), [
    'charset',
    'duplicates',
    'sorted',
    'answers',
    'mutate',
  ]);
});

test('every case built for a real problem fits its parameters and the statement bounds', () => {
  let built = 0;
  for (const id of Object.keys(rules).concat('lc-206', 'lc-104', 'lc-125')) {
    const params = leetcodeParams(id);
    const constraints = leetcodeConstraints(id);
    if (!params) continue;
    for (const item of clarifyItems(params, constraints, rules[id]))
      for (const input of item.cases) {
        built++;
        const fields = splitFields(input, params.length);
        assert.ok(fields, `${id} ${item.key}: ${input}`);
        params.forEach((p, i) => assert.equal(checkField(fields[i], p.type).ok, true, `${id} ${item.key} ${p.name}`));
        if (constraints) assert.deepEqual(checkConstraints(fields, params, constraints), params.map(() => null), `${id} ${input}`);
      }
  }
  assert.ok(built > 150, `built ${built}`);
});
