import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinFields, splitFields } from '../lib/testcase-fields';

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
