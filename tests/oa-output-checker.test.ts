import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

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
