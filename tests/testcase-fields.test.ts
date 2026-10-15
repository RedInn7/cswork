import assert from 'node:assert/strict';
import { test } from 'node:test';
import samples from '../lib/content/leetcode-public-samples.json';
import { englishMessage } from '../lib/messages-en';
import { leetcodeConstraints, leetcodeParams, leetcodeReturnType } from '../lib/server/leetcode-mode';
import { checkConstraints, checkField, diffLines, joinFields, levelOrderTree, splitFields } from '../lib/testcase-fields';

test('custom-case fields round-trip through the stored one-value-per-line text', () => {
  for (const fields of [['[2,7,11,15]', '9'], ['"abc"'], ['', ''], ['[1,2]', ''], ['', '[[1,2],[3]]', 'true']])
    assert.deepEqual(splitFields(joinFields(fields), fields.length), fields);
  assert.equal(joinFields(['[2,7,11,15]', '9']), '[2,7,11,15]\n9');
  // Stored text as typed before: a trailing newline or CRLF still splits per parameter.
  assert.deepEqual(splitFields('[2,7,11,15]\n9\n', 2), ['[2,7,11,15]', '9']);
  assert.deepEqual(splitFields('[1]\r\n2', 2), ['[1]', '2']);
  assert.deepEqual(splitFields('', 3), ['', '', '']);
  // A count that doesn't match falls back to raw text.
  assert.equal(splitFields('[1]\n2\n3', 2), null);
  assert.equal(splitFields('[1]', 2), null);
});

test('outputs differ line by line, past trailing spaces and blank lines', () => {
  assert.deepEqual([...diffLines('1 2\n3\n', '1 2  \r\n3')], []);
  assert.deepEqual([...diffLines('1\n5\n3\n', '1\n2\n3\n')], [1]);
  assert.deepEqual([...diffLines('1\n', '1\n2\n3')], [1, 2], 'missing lines differ');
  assert.deepEqual([...diffLines('', 'x')], [0]);
  assert.deepEqual([...diffLines(' a', 'a')], [0], 'leading spaces count');
});

test('checkField decodes each line the way the judge does', () => {
  const ok = (text: string, type: string) => assert.deepEqual(checkField(text, type), { ok: true }, `${type} ${text}`);
  const bad = (text: string, type: string, pattern: RegExp) => {
    const result = checkField(text, type);
    assert.equal(result.ok, false, `${type} ${text}`);
    if (!result.ok) assert.match(result.message[1], pattern);
  };
  ok('[2,7,11,15]', 'integer[]');
  ok('-2147483648', 'integer');
  bad('2147483648', 'integer', /type integer/);
  bad('1.0', 'integer', /type integer/);
  ok('1.5', 'double');
  ok('[1.5,2]', 'double[]');
  ok('9007199254740991', 'long');
  ok('true', 'boolean');
  bad('1', 'boolean', /boolean/);
  ok('"abc"', 'string');
  ok('["a","b"]', 'character[]');
  bad('["ab"]', 'character[]', /character/);
  ok('[["1","0"],["0","1"]]', 'character[][]');
  ok('[[1,2],[3]]', 'list<list<integer>>');
  ok('["x","y"]', 'list<String>');
  bad('[1,[2]]', 'integer[][]', /integer\[\]\[\]/);
  ok('[[1,4,5],[1,3,4],[]]', 'ListNode[]');
  bad('[1,null]', 'ListNode', /ListNode/);
  ok('[]', 'ListNode');
  // Unknown types pass; a blank line would be skipped by the judge and shift every later one.
  ok('{"x":1}', 'Interval');
  bad('  ', 'integer', /missing/);
  bad('[1,', 'integer[]', /JSON/);
});

test('trees follow tree_codec.py after custom_args drops trailing nulls', () => {
  const ok = (text: string) => assert.deepEqual(checkField(text, 'TreeNode'), { ok: true }, text);
  const bad = (text: string, pattern: RegExp) => {
    const result = checkField(text, 'TreeNode');
    assert.equal(result.ok, false, text);
    if (!result.ok) assert.match(result.message[1], pattern);
  };
  ok('[]');
  ok('[1,null,2,3]');
  ok('[1,null,2,null,null]'); // trailing nulls: canonicalised, not refused, in custom input
  ok('[null]'); // [] once canonicalised: the empty tree
  bad('[null,1]', /null root/);
  bad('[1,null,null,2]', /no parent/);
  bad('[1,"2"]', /32-bit/);
  bad('[1,2.0]', /32-bit/);
  bad('[1,2147483648]', /32-bit/);
  assert.deepEqual(levelOrderTree([1, null, 2, 3]), [
    { val: 1, left: -1, right: 1 },
    { val: 2, left: 2, right: -1 },
    { val: 3, left: -1, right: -1 },
  ]);
});

test('constraints: lengths, node counts and values, per field', () => {
  const params = [
    { name: 'nums', type: 'integer[]' },
    { name: 'root', type: 'TreeNode' },
    { name: 's', type: 'string' },
    { name: 'k', type: 'integer' },
  ];
  const c = { nums: { len: [2, 3], val: [-5, 5] }, root: { len: [0, 2] }, s: { len: [1, 2] }, k: { val: [1, 9] } };
  const check = (fields: string[]) => checkConstraints(fields, params, c).map((m) => m?.[0] ?? null);
  assert.deepEqual(check(['[1,2]', '[1,null,2]', '"ab"', '9']), [null, null, null, null]);
  assert.deepEqual(check(['[1,2,3,4]', '[1,2,3]', '"🙂🙂🙂"', '0']), [
    '超出题目约束：nums 长度 4 > 3',
    '超出题目约束：root 节点数 3 > 2',
    '超出题目约束：s 长度 3 > 2',
    '超出题目约束：k 的值 0 < 1',
  ]);
  assert.deepEqual(check(['[1,-6]', 'oops', '', '1']), ['超出题目约束：nums 的值 -6 < -5', null, null, null]);
  assert.equal(checkConstraints(['[1]'], [{ name: 'nums', type: 'integer[]' }], c)[0]?.[1], "Outside the problem's constraints: nums length 1 < 2");
  // The expected endpoint answers 422 with the Chinese text; the English UI maps it back.
  for (const m of checkConstraints(['[1,2,3,4]', '[1,2,3]', '"abc"', '0'], params, c))
    if (m) assert.equal(englishMessage(m[0]), m[1]);
});

test('every public example passes its own field types and the extracted constraints', () => {
  let checked = 0;
  for (const [id, rows] of Object.entries(samples as Record<string, { input?: string }[]>)) {
    const params = leetcodeParams(id);
    if (!params) continue;
    for (const row of rows) {
      if (!row.input) continue;
      const fields = splitFields(row.input.replace(/^[A-Za-z_]\w*\s*=\s*/gm, ''), params.length);
      assert.ok(fields, `${id}: ${row.input}`);
      params.forEach((p, i) => assert.deepEqual(checkField(fields[i], p.type), { ok: true }, `${id} ${p.name} ${fields[i]}`));
      const c = leetcodeConstraints(id);
      if (c) assert.deepEqual(checkConstraints(fields, params, c), params.map(() => null), id);
      checked++;
    }
  }
  assert.ok(checked > 400, `${checked} examples`);
});

test('the printed result type: void in-place problems print their parameter; node-id protocols draw nothing', () => {
  assert.equal(leetcodeReturnType('lc-226'), 'TreeNode');
  assert.equal(leetcodeReturnType('lc-206'), 'ListNode');
  assert.equal(leetcodeReturnType('lc-114'), 'TreeNode');
  assert.equal(leetcodeReturnType('lc-48'), 'integer[][]');
  assert.equal(leetcodeReturnType('lc-1'), 'integer[]');
  assert.equal(leetcodeReturnType('lc-236'), null);
  assert.equal(leetcodeReturnType('lc-nope'), null);
});
