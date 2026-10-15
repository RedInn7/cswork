import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { leetcodeSource, leetcodeTemplates } from '../lib/server/leetcode-mode';

const source = (id: string, code: string) =>
  leetcodeSource(id, 'java', code, 262144).source;
const skip =
  spawnSync('javac', ['-version']).status !== 0 && 'javac unavailable';

void test('only the types the official signature uses are provided', () => {
  const twoSum =
    'class Solution { public int[] twoSum(int[] nums, int target) { return nums; } }';
  assert.doesNotMatch(
    source('lc-1', twoSum),
    /class (?:TreeNode|ListNode|Node|Interval|MountainArray)\b/,
  );
  const leetcode =
    'class Solution { public ListNode addTwoNumbers(ListNode l1, ListNode l2) { return l1; } }';
  assert.match(source('lc-2', leetcode), /^class ListNode \{/m);
  assert.doesNotMatch(source('lc-2', leetcode), /class Node\b/);
  const template = leetcodeTemplates('lc-2')!.java;
  assert.equal(
    source('lc-2', template).match(/^class ListNode \{/gm)?.length,
    1,
    'the template ships its own ListNode',
  );
});

void test(
  'a learner record or enum may take an unused platform name',
  { skip },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'cswork-java-platform-'));
    try {
      writeFileSync(
        join(dir, 'Main.java'),
        source(
          'lc-1',
          `record Node(int value, int index) {}
enum Interval { OPEN }
class Solution { public int[] twoSum(int[] nums, int target) { Node n = new Node(nums[0], Interval.OPEN.ordinal()); return new int[] { n.index(), 1 }; } }`,
        ),
      );
      const result = spawnSync('javac', ['-d', dir, join(dir, 'Main.java')], {
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
