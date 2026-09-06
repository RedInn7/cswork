import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  draftStorageKey,
  readEditorDraft,
  writeEditorDraft,
} from '../lib/editor-settings';
import {
  leetcodeTemplates,
  leetcodeContract,
  leetcodeSource,
} from '../lib/server/leetcode-mode';
import selected from '../lib/content/ling-curated-500.json';

test('LeetCode drafts cannot restore or overwrite legacy ACM programs', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    const acm = draftStorageKey('u', 'lc-1', 'python');
    const lc = draftStorageKey('u', 'lc-1', 'python', 'leetcode');
    writeEditorDraft(acm, 'print("ACM draft")');
    assert.equal(
      readEditorDraft('u', 'lc-1', 'python', 'leetcode', 'class Solution: pass')
        .code,
      'class Solution: pass',
    );
    writeEditorDraft(lc, 'class Solution: # student draft\n    pass');
    assert.equal(
      readEditorDraft('u', 'lc-1', 'python').code,
      'print("ACM draft")',
    );
    assert.match(
      readEditorDraft('u', 'lc-1', 'python', 'leetcode').code,
      /student draft/,
    );
    assert.notEqual(draftStorageKey('other', 'lc-1', 'python', 'leetcode'), lc);
    assert.notEqual(draftStorageKey('u', 'lc-1', 'java', 'leetcode'), lc);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('every selected question has a public official-interface template in four languages', () => {
  for (const item of selected) {
    const id = `lc-${item.number}`;
    const templates = leetcodeTemplates(id)!;
    assert.ok(leetcodeContract(id));
    for (const lang of ['python', 'cpp', 'go', 'java'] as const) {
      assert.ok(templates[lang].trim(), `${id} ${lang}`);
      assert.doesNotMatch(
        templates[lang],
        /__CSWORK_USER_SOURCE__|_cswork_answer|sourceHashes|candidateCases/,
      );
    }
  }
  assert.equal(leetcodeTemplates('course-problem'), null);
  assert.match(leetcodeTemplates('lc-146')!.cpp, /LRUCache\(int capacity\)/);
  assert.match(
    leetcodeTemplates('lc-236')!.java,
    /lowestCommonAncestor\(TreeNode root, TreeNode p, TreeNode q\)/,
  );
});

test('Python wrapping retains future imports and literal replacement characters in user source', () => {
  const code =
    'from __future__ import annotations\nclass Solution:\n    def twoSum(self, nums, target):\n        text = "$& __CSWORK_USER_SOURCE__"\n        return [0,1]\n';
  const wrapped = leetcodeSource('lc-1', 'python', code, 262144);
  assert.ok(wrapped.source.startsWith('from __future__ import annotations\n'));
  assert.ok(wrapped.source.includes('text = "$& __CSWORK_USER_SOURCE__"'));
});
