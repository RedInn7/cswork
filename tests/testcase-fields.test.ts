import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffLines, joinFields, splitFields } from '../lib/testcase-fields';

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
