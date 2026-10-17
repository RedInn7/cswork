import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_MAX, LINE_MAX, parseListImport, parseListLine } from '../lib/list-import';

const kind = (line: string) => {
  const parsed = parseListLine(line);
  return parsed && [parsed.kind, parsed.value];
};

void test('LeetCode links on .com and .cn read as their slug, whatever follows the slug', () => {
  for (const link of [
    'https://leetcode.com/problems/two-sum/',
    'https://leetcode.com/problems/two-sum/description/',
    'https://leetcode.cn/problems/two-sum/solutions/123/abc/',
    'http://www.leetcode.cn/problems/two-sum',
    'leetcode.com/problems/two-sum?envType=study-plan-v2&envId=top-100-liked',
    'https://leetcode-cn.com/problems/two-sum/',
    'https://leetcode.com/contest/weekly-contest-1/problems/two-sum/',
    'HTTPS://LeetCode.com/problems/Two-Sum/',
  ])
    assert.deepEqual(kind(link), ['slug', 'two-sum'], link);
  assert.deepEqual(kind('https://leetcode.com/problemset/'), ['unknown', '']);
  assert.deepEqual(kind('https://leetcode.com.evil.test/problems/two-sum/'), ['unknown', '']);
});

void test('bare slugs, numbers and site ids', () => {
  assert.deepEqual(kind('two-sum'), ['slug', 'two-sum']);
  assert.deepEqual(kind('3sum'), ['slug', '3sum']);
  assert.deepEqual(kind('  Two-Sum  '), ['slug', 'two-sum']);
  assert.deepEqual(kind('1'), ['number', '1']);
  assert.deepEqual(kind('#15'), ['number', '15']);
  assert.deepEqual(kind('0042'), ['number', '42']);
  assert.deepEqual(kind('1. Two Sum'), ['number', '1']);
  assert.deepEqual(kind('LC 206'), ['number', '206']);
  assert.deepEqual(kind('- 70'), ['number', '70'], 'a list bullet is ignored');
  assert.deepEqual(kind('lc-1'), ['id', 'lc-1']);
  assert.deepEqual(kind('oa-amazon-3'), ['id', 'oa-amazon-3']);
  assert.deepEqual(kind('core-two-pointers-1'), ['id', 'core-two-pointers-1']);
  assert.deepEqual(kind('sql-top-earners'), ['id', 'sql-top-earners']);
  assert.deepEqual(kind('123456'), ['unknown', ''], 'too long for a number, no letter for a slug');
  assert.deepEqual(kind('Two Sum'), ['unknown', ''], 'titles are not guessed');
  assert.deepEqual(kind('two_sum'), ['unknown', '']);
});

void test('links to problems on this site: ?problem= or a path ending in the id', () => {
  assert.deepEqual(kind('https://cswork.dev/?view=problem&problem=lc-1'), ['id', 'lc-1']);
  assert.deepEqual(kind('/?problem=oa-amazon-1&view=problem'), ['id', 'oa-amazon-1']);
  assert.deepEqual(kind('https://cswork.dev/oa/amazon/oa-amazon-1/'), ['id', 'oa-amazon-1']);
  assert.deepEqual(kind('https://cswork.dev/?view=problem&problem=lc-1%27'), ['unknown', '']);
  assert.deepEqual(kind('https://cswork.dev/?view=problem&problem=%E0'), ['unknown', ''], 'bad escapes do not throw');
  assert.deepEqual(kind('https://cswork.dev/?view=lists&list=AbCdEfGhIjKl'), ['unknown', '']);
});

void test('blank lines drop, repeats stay in paste order, at most ITEM_MAX lines and LINE_MAX characters', () => {
  const lines = parseListImport('1\n\n   \r\ntwo-sum\r\n1\nnot a problem!\n');
  assert.deepEqual(
    lines.map((l) => [l.raw, l.kind, l.value]),
    [
      ['1', 'number', '1'],
      ['two-sum', 'slug', 'two-sum'],
      ['1', 'number', '1'],
      ['not a problem!', 'unknown', ''],
    ],
  );
  assert.deepEqual(parseListImport(''), []);
  const many = Array.from({ length: ITEM_MAX + 20 }, (_, i) => String(i + 1)).join('\n');
  assert.equal(parseListImport(many).length, ITEM_MAX);
  assert.equal(parseListImport(many, ITEM_MAX + 1).length, ITEM_MAX + 1, 'callers can ask for one more to see a cut');
  assert.equal(parseListLine(`https://leetcode.com/problems/${'a'.repeat(400)}`)!.raw.length, LINE_MAX);
});
