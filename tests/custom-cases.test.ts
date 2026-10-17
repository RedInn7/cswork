import assert from 'node:assert/strict';
import { test } from 'node:test';
import { customVerdict, MAX_CASES, parseCases } from '../lib/custom-cases';

void test('stored cases: the old string list still reads, expected outputs line up, bad data reads as one blank case', () => {
  // Before expected outputs: only the cases key.
  assert.deepEqual(parseCases('["1 2\\n","3 4\\n"]', null), { cases: ['1 2\n', '3 4\n'], expect: ['', ''] });
  assert.deepEqual(parseCases('["1 2\\n","3 4\\n"]', '["3"]'), { cases: ['1 2\n', '3 4\n'], expect: ['3', ''] });
  // Extra expected outputs are dropped; non-strings are skipped.
  assert.deepEqual(parseCases('["a"]', '["x","y"]'), { cases: ['a'], expect: ['x'] });
  assert.deepEqual(parseCases('["a",7,null,"b"]', '[1,"z"]'), { cases: ['a', 'b'], expect: ['z', ''] });
  for (const raw of [null, '', '{oops', '{"a":1}', '[]', '[1,2]'])
    assert.deepEqual(parseCases(raw, '{oops'), { cases: [''], expect: [''] }, String(raw));
  const many = JSON.stringify(Array.from({ length: 9 }, (_, i) => String(i)));
  assert.equal(parseCases(many, many).cases.length, MAX_CASES);
  assert.equal(parseCases(many, many).expect.length, MAX_CASES);
});

void test('a run against the expected output the learner typed', () => {
  const run = (stdout: string, status = 'finished') => ({ status, stdout });
  // No expected output (blank counts as none): no verdict.
  assert.equal(customVerdict(run('3\n'), ''), null);
  assert.equal(customVerdict(run('3\n'), ' \n\t'), null);
  // A run that did not finish never matches.
  assert.deepEqual(customVerdict(run('3\n', 'runtime_error'), '3', 'exact'), { pass: false, approx: false });
  assert.deepEqual(customVerdict({ status: 'compile_error' }, '3'), { pass: false, approx: false });
  // exact: spacing inside counts, final newlines do not (a text box hides them).
  assert.deepEqual(customVerdict(run('1 2\n'), '1 2', 'exact'), { pass: true, approx: false });
  assert.deepEqual(customVerdict(run('1 2\r\n\n'), '1 2\n', 'exact'), { pass: true, approx: false });
  assert.deepEqual(customVerdict(run('1  2\n'), '1 2', 'exact'), { pass: false, approx: false });
  assert.deepEqual(customVerdict(run('1 2 \n'), '1 2', 'exact'), { pass: false, approx: false });
  // tokens: whitespace between tokens does not matter.
  assert.deepEqual(customVerdict(run('1  2\n3\n'), '1 2 3', 'tokens'), { pass: true, approx: false });
  assert.deepEqual(customVerdict(run('1 2\n'), '1 3', 'tokens'), { pass: false, approx: false });
  // Any other checker compares tokens and says the ✗ may be wrong.
  assert.deepEqual(customVerdict(run('0.3333333\n'), '0.33333334', 'float-1e-6'), { pass: false, approx: true });
  assert.deepEqual(customVerdict(run('2 1\n'), '2 1', 'int-set'), { pass: true, approx: true });
  // LeetCode mode compares the returned value as JSON when both sides parse.
  assert.deepEqual(customVerdict(run('[1,2]\n'), '[1, 2]', 'exact', true), { pass: true, approx: false });
  assert.deepEqual(customVerdict(run('{"a":1}'), '{ "a": 1 }', 'tokens', true), { pass: true, approx: false });
  assert.deepEqual(customVerdict(run('[2,1]\n'), '[1,2]', 'tokens', true), { pass: false, approx: false });
  assert.deepEqual(customVerdict(run('[1,2]\n'), '[1, 2', 'tokens', true), { pass: false, approx: false }, 'not JSON: tokens');
  assert.deepEqual(customVerdict(run('"a b"\n'), '"a b"', 'exact', true), { pass: true, approx: false });
});
