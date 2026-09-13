import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
test('OA uses production finite floats for scalar and count-prefixed vectors', () => {
  for (const [checker, actual, expected, valid] of [
    ['float-array', '3 1e0 0.50000001 0', '3 1 0.5 0', true],
    ['float-array', '2 1 2', '2 2 1', false],
    ['float-array', '2 1 NaN', '2 1 2', false],
    ['float-array', '2 1 Infinity', '2 1 2', false],
    ['float-array', '1 -0.99999999', '1 -1', false],
    ['float-array', '0', '0', true],
    ['float-array', '2 1', '2 1 2', false],
    ['float-array', '01 1', '1 1', false],
    ['float', '1e0', '1', true],
    ['float', 'NaN', '1', false],
    ['float', '1 1', '1', false],
  ] as const) {
    assert.equal(matchesOutput(actual, expected, checker), valid);
    assert.equal(matchesOaOutput(actual, expected, checker, ''), valid);
  }
  const vector = '10000 ' + Array(10000).fill('0.123456').join(' ');
  assert(
    matchesOaOutput(
      vector.replaceAll('0.123456', '1.23456e-1'),
      vector,
      'float-array',
      '',
    ),
  );
});
