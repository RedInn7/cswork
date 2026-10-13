import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUnsolved } from '../lib/problem-sequence';

const ids = ['a', 'b', 'c', 'd'];

void test('picks the first unsolved problem after the current one', () => {
  assert.equal(nextUnsolved(ids, 'b', new Set(['b', 'c'])), 'd');
});

void test('wraps to the start when everything after is solved', () => {
  assert.equal(nextUnsolved(ids, 'c', new Set(['b', 'c', 'd'])), 'a');
});

void test('never returns the current problem, even if it reads unsolved', () => {
  assert.equal(nextUnsolved(ids, 'b', new Set(['a', 'c', 'd'])), undefined);
});

void test('an unknown current problem starts from the top', () => {
  assert.equal(nextUnsolved(ids, 'x', new Set(['a'])), 'b');
  assert.equal(nextUnsolved([], 'x', new Set()), undefined);
});
