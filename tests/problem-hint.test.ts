import test from 'node:test';
import assert from 'node:assert/strict';
import { hintUnlocked, leetcodeSolutionsUrl } from '../lib/oj-client';
import { curatedHint } from '../lib/ling-curated';

test('only a failed formal submission unlocks the Line 500 hint', () => {
  assert.equal(hintUnlocked([]), false);
  for (const status of ['accepted', 'system_error', 'cancelled', 'queued'])
    assert.equal(hintUnlocked([{ mode: 'judge', status }]), false, status);
  assert.equal(hintUnlocked([{ mode: 'run', status: 'wrong_answer' }]), false);
  for (const status of ['wrong_answer', 'compile_error', 'time_limit', 'runtime_error'])
    assert.equal(
      hintUnlocked([
        { mode: 'judge', status: 'accepted' },
        { mode: 'judge', status },
      ]),
      true,
      status,
    );
});

test('solutions link follows the language, from either LeetCode source', () => {
  for (const source of [
    'https://leetcode.cn/problems/two-sum/',
    'https://leetcode.com/problems/two-sum/description/',
  ]) {
    assert.equal(
      leetcodeSolutionsUrl(source, false),
      'https://leetcode.cn/problems/two-sum/solutions/',
    );
    assert.equal(
      leetcodeSolutionsUrl(source, true),
      'https://leetcode.com/problems/two-sum/solutions/',
    );
  }
  for (const source of ['', undefined, 'https://evil.test/problems/two-sum/'])
    assert.equal(leetcodeSolutionsUrl(source, true), '');
});

test('curated hints exist only for Line 500 problems', () => {
  assert.deepEqual(Object.keys(curatedHint('lc-26') ?? {}), ['zh', 'en']);
  assert.ok(curatedHint('lc-26')?.en.includes('pointer'));
  assert.equal(curatedHint('lc-999999'), null);
  assert.equal(curatedHint('oa-26'), null);
});
