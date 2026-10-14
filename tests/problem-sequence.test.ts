import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextUnsolved,
  problemNeighbors,
  problemSequence,
  randomPickQuery,
  rememberLibraryQuery,
  rememberProblemSequence,
} from '../lib/problem-sequence';

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

void test('a classic list is remembered with its sequence and cleared by other lists', () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });
  assert.deepEqual(problemSequence(), []);
  rememberProblemSequence(ids, 'blind-75');
  assert.deepEqual(problemSequence(), ids);
  assert.deepEqual(problemNeighbors('b'), { prev: 'a', next: 'c', library: 'blind-75' });
  // A problem opened from elsewhere does not inherit the list.
  assert.deepEqual(problemNeighbors('x'), {});
  rememberProblemSequence(ids);
  assert.equal(problemNeighbors('b').library, undefined);
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});

void test("the shuffle draws under the bank's last filters, else unsolved problems", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
  });
  assert.equal(randomPickQuery(), 'status=todo&random=1');
  rememberLibraryQuery(new URLSearchParams({ q: '', difficulty: '中等', page: '3', status: 'redo' }));
  assert.equal(randomPickQuery(), new URLSearchParams({ q: '', difficulty: '中等', status: 'redo', random: '1' }).toString());
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  assert.equal(randomPickQuery(), 'status=todo&random=1');
});
