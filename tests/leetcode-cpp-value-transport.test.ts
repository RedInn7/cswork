import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLeetCodeCpp } from '../lib/server/leetcode-cpp';

const contracts = JSON.parse(
  readFileSync('lib/content/leetcode-contracts.json', 'utf8'),
).problems;
const light = (id: number, source?: string, snippet?: string) => {
  const template = snippet ?? contracts[`lc-${id}`].templates.cpp;
  return buildLeetCodeCpp(id, source ?? template, template);
};
const isLight = (value: string) =>
  value.includes('Unexpected graph for value-only interface');

void test('ordinary official scalar, string, nested vector and mutating interfaces use value transport', () => {
  for (const id of [1, 35, 53, 48, 344, 5, 39])
    assert.ok(isLight(light(id)), `lc-${id}`);
  const source = light(53);
  assert.ok(
    source.includes('struct TreeNode {'),
    'platform types remain available',
  );
  assert.ok(
    source.includes('Unexpected graph result'),
    'unexpected node output fails closed',
  );
  assert.ok(
    !source.includes('Nonsequential graph ids'),
    'unused graph traversal is omitted',
  );
});

void test('all platform node types, nested graph arrays, design and codecs keep full transport', () => {
  for (const id of [94, 142, 138, 759, 1095, 146, 297, 449]) {
    const source = light(id);
    assert.ok(!isLight(source), `lc-${id}`);
    assert.ok(source.includes('Nonsequential graph ids'));
  }
  for (const type of [
    'TreeNode*',
    'ListNode*',
    'Node*',
    'Interval',
    'MountainArray&',
    'vector<vector<TreeNode*>>',
  ]) {
    const template = `class Solution { public: int solve(${type} nodes) {} };`;
    assert.ok(!isLight(light(1, template, template)), type);
  }
});

void test('unrecognized or additional interface constructs fall back to the general transport', () => {
  for (const template of [
    'class Solution { public: auto solve(vector<int>& a) {} };',
    'class Solution { public: Custom solve(int a) {} };',
    'class Solution { public: int solve(int* a) {} };',
    'class Solution { public: int solve(int a=1) {} };',
    'class Solution { public: int solve(int a) {} int other() {} };',
    'class Solution { public: int solve(int a) const {} };',
  ])
    assert.ok(!isLight(light(1, template, template)), template);
});

void test('user-defined internal nodes remain valid and explicit platform nodes preserve full transport', () => {
  const ordinary =
    'struct LocalNode { int val; }; class Solution { public: int maxSubArray(vector<int>& nums) { LocalNode n{nums[0]}; return n.val; } };';
  assert.ok(isLight(light(53, ordinary)));
  const platform =
    'struct TreeNode { int val; }; class Solution { public: int maxSubArray(vector<int>& nums) { TreeNode n{nums[0]}; return n.val; } };';
  const built = light(53, platform);
  assert.ok(!isLight(built));
  assert.equal(
    (built.match(/struct TreeNode \{/g) ?? []).length,
    1,
    'custom definition is not duplicated',
  );
});
