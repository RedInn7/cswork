import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSnapshotBudget,
  workerConcurrency,
  exclusiveSubmission,
  SubmissionAdmission,
} from '../lib/server/oj-worker-policy';

void test('worker supports one or two slots and rejects unbounded overrides', () => {
  assert.equal(workerConcurrency('1'), 1);
  assert.equal(workerConcurrency('2'), 2);
  for (const value of ['0', '3', '32', 'NaN', ''])
    assert.throws(() => workerConcurrency(value));
});
void test('large snapshots and high-memory problems require exclusive admission', () => {
  assert.equal(exclusiveSubmission(8 * 1024 * 1024, 512 * 1024, 8192), false);
  assert.equal(
    exclusiveSubmission(8 * 1024 * 1024 + 1, 512 * 1024, 8192),
    true,
  );
  assert.equal(exclusiveSubmission(1024, 513 * 1024, 8192), true);
  assert.equal(exclusiveSubmission(1024, 256 * 1024, 8193), true);
  assert.equal(exclusiveSubmission(NaN, 128 * 1024, 8192), true);
});
void test('two ordinary submissions overlap, large submission waits for both and blocks followers', async () => {
  const gate = new SubmissionAdmission(2);
  const signal = new AbortController().signal;
  const first = await gate.acquire(false, signal);
  const second = await gate.acquire(false, signal);
  let largeStarted = false,
    nextStarted = false;
  const large = gate.acquire(true, signal).then((release) => {
    largeStarted = true;
    return release;
  });
  const next = gate.acquire(false, signal).then((release) => {
    nextStarted = true;
    return release;
  });
  first();
  first();
  await Promise.resolve();
  assert.equal(largeStarted, false);
  assert.equal(nextStarted, false);
  second();
  const releaseLarge = await large;
  assert.equal(nextStarted, false);
  releaseLarge();
  (await next)();
});
void test('cancelled admission does not occupy capacity or starve the next submission', async () => {
  const gate = new SubmissionAdmission(2);
  const first = await gate.acquire(false, new AbortController().signal);
  const cancelled = new AbortController();
  const large = gate.acquire(true, cancelled.signal);
  const rejection = assert.rejects(large, /cancelled/);
  const next = gate.acquire(false, new AbortController().signal);
  cancelled.abort(new Error('cancelled'));
  await rejection;
  (await next)();
  first();
  (await gate.acquire(true, new AbortController().signal))();
  assert.throws(() => gate.acquire(false, cancelled.signal), /cancelled/);
});
void test('baseline capacity one never overlaps ordinary jobs', async () => {
  const gate = new SubmissionAdmission(1);
  const signal = new AbortController().signal;
  const first = await gate.acquire(false, signal);
  let started = false;
  const second = gate.acquire(false, signal).then((release) => {
    started = true;
    return release;
  });
  await Promise.resolve();
  assert.equal(started, false);
  first();
  (await second)();
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
