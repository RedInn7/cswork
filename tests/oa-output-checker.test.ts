import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

test('OA exact integer counts preserve all digits beyond floating and 64-bit ranges', () => {
  const counts = [
    '9007199254740993',
    '73786976294838206332',
    ((BigInt(1) << BigInt(100000)) - BigInt(1)).toString(),
  ];
  assert.equal(counts[2].length, 30103);
  for (const expected of counts) {
    const last = Number(expected.at(-1));
    const changed = expected.slice(0, -1) + ((last + 1) % 10);
    for (const check of [matchesOutput, matchesOaOutput]) {
      assert.equal(
        check(` \t${expected}\r\n`, `${expected}\n`, 'tokens'),
        true,
      );
      assert.equal(check(changed, expected, 'tokens'), false);
      assert.equal(check(`${expected} 0`, expected, 'tokens'), false);
      assert.equal(check('Infinity', expected, 'tokens'), false);
      assert.equal(check(expected.slice(0, -1), expected, 'tokens'), false);
    }
  }
});

test('OA sandbox verification follows production whitespace semantics', () => {
  const outputs = [
    '',
    ' ',
    '\n',
    'a',
    ' a ',
    'a\n',
    'a\r\n',
    'a\nb',
    'a b',
    'a  b',
    'a\tb',
    'a\u00a0b',
    '\u00a0a',
  ];
  for (const checker of ['tokens', 'exact'] as const)
    for (const a of outputs)
      for (const b of outputs)
        assert.equal(
          matchesOaOutput(a, b, checker),
          matchesOutput(a, b, checker),
          JSON.stringify({ a, b, checker }),
        );
  assert.equal(matchesOaOutput(' a  b \n', 'a b\n', 'exact'), false);
  assert.equal(matchesOaOutput('a\r\n', 'a\n', 'exact'), true);
  assert.equal(matchesOaOutput('a', 'a\n', 'exact'), false);
  assert.throws(() => matchesOaOutput('1', '1', 'unknown'));
});

test('OA floating output uses production tolerance, finite numbers and ASCII whitespace', () => {
  const values = [
    '',
    ' ',
    '0',
    '-0',
    '1',
    '1.000009',
    '1.000011',
    '1e6',
    '1000009',
    '1000011',
    '-1',
    '-1.000001',
    '+.5',
    '1.',
    'NaN',
    'Infinity',
    '1e999',
    '0x10',
    '1 2',
    ' 1\r\n',
    '\u00a01',
    '1\u00a0',
    '1'.repeat(1024 * 1024 + 1),
  ];
  for (const actual of values)
    for (const expected of values)
      assert.equal(
        matchesOaOutput(actual, expected, 'float'),
        matchesOutput(actual, expected, 'float'),
      );
  assert.equal(matchesOaOutput('1.2', '1.200000', 'float'), true);
});
