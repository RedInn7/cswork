import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSnapshotBudget,
  OJ_WORKER_CONCURRENCY,
} from '../lib/server/oj-worker-policy';

void test('worker uses one bounded slot independently of environment overrides', () => {
  const original = process.env.OJ_WORKER_CONCURRENCY;
  process.env.OJ_WORKER_CONCURRENCY = '2';
  try {
    assert.equal(OJ_WORKER_CONCURRENCY, 1);
  } finally {
    if (original === undefined) delete process.env.OJ_WORKER_CONCURRENCY;
    else process.env.OJ_WORKER_CONCURRENCY = original;
  }
});
void test('snapshot limits count UTF-8 bytes and preserve the smaller input bound', () => {
  const output = '7'.repeat(64 * 1024 * 1024);
  assert.doesNotThrow(() =>
    assertSnapshotBudget([{ input: '', expectedOutput: output }]),
  );
  assert.throws(
    () => assertSnapshotBudget([{ input: '', expectedOutput: output + 'x' }]),
    /bounded data budget/,
  );
  assert.throws(
    () =>
      assertSnapshotBudget([
        { input: 'é'.repeat(2 * 1024 * 1024 + 1), expectedOutput: '' },
      ]),
    /bounded data budget/,
  );
});
void test('total snapshot budget stops multiple individually valid large cases', () => {
  const c = { input: '', expectedOutput: '1'.repeat(64 * 1024 * 1024) };
  assert.doesNotThrow(() => assertSnapshotBudget([c, c]));
  assert.throws(
    () =>
      assertSnapshotBudget([
        c,
        c,
        { input: 'private fixture', expectedOutput: '' },
      ]),
    (error: Error) => {
      assert.equal(
        error.message,
        'Judge snapshot exceeds its bounded data budget',
      );
      return true;
    },
  );
});
