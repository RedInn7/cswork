import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSnapshotBudget,
  workerConcurrency,
  exclusiveSubmission,
  SubmissionAdmission,
  stopJudging,
  maintenanceDelayMs,
  OJ_RETRY_BACKOFF_MS,
} from '../lib/server/oj-worker-policy';

void test('worker defaults to four slots, accepts one to four and rejects unbounded overrides', () => {
  assert.equal(workerConcurrency(undefined), 4);
  for (const n of [1, 2, 3, 4]) assert.equal(workerConcurrency(String(n)), n);
  for (const value of ['0', '5', '32', 'NaN', '', '2.5'])
    assert.throws(() => workerConcurrency(value));
  for (const capacity of [0, 5, 2.5]) assert.throws(() => new SubmissionAdmission(capacity));
});
void test('a large submission takes two of four slots: two ordinary ones still run beside it', async () => {
  const gate = new SubmissionAdmission(4);
  const signal = new AbortController().signal;
  const releases = await Promise.all([1, 2, 3, 4].map(() => gate.acquire(false, signal)));
  let large = false;
  const exclusive = gate.acquire(true, signal).then((release) => ((large = true), release));
  await new Promise((r) => setTimeout(r, 5));
  releases[0]();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(large, false, 'one free slot is not enough');
  releases[1]();
  const releaseLarge = await exclusive;
  assert.equal(large, true);
  releases[2]();
  releases[3]();
  const beside = await Promise.all([gate.acquire(false, signal), gate.acquire(false, signal)]);
  let third = false;
  const blocked = gate.acquire(false, signal).then((release) => ((third = true), release));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(third, false, 'the large one still holds two slots');
  releaseLarge();
  (await blocked)();
  for (const release of beside) release();
});
void test('at most one large submission runs; the second waits in FIFO order', async () => {
  const gate = new SubmissionAdmission(4);
  const signal = new AbortController().signal;
  const first = await gate.acquire(true, signal);
  let second = false,
    small = false;
  const large = gate.acquire(true, signal).then((release) => ((second = true), release));
  const next = gate.acquire(false, signal).then((release) => ((small = true), release));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(second, false, 'two free slots, but one large is already running');
  assert.equal(small, false, 'FIFO: no overtaking the waiting large one');
  first();
  (await large)();
  (await next)();
  assert.equal(second && small, true);
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
        { input: 'é'.repeat(16 * 1024 * 1024 + 1), expectedOutput: '' },
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

void test('judging stops at the first formal failure, a run on resource failures, all_cases at 3 resource failures', () => {
  const judge = { formal: true, runAll: false, heavy: 0 };
  assert.equal(stopJudging('accepted', judge), false);
  for (const status of ['wrong_answer', 'runtime_error', 'time_limit'])
    assert.equal(stopJudging(status, { ...judge, heavy: Number(status === 'time_limit') }), true);
  const run = { formal: false, runAll: false, heavy: 0 };
  assert.equal(stopJudging('wrong_answer', run), false);
  assert.equal(stopJudging('runtime_error', run), true);
  assert.equal(stopJudging('memory_limit', { ...run, heavy: 1 }), true);
  const all = { formal: true, runAll: true };
  assert.equal(stopJudging('wrong_answer', { ...all, heavy: 0 }), false);
  assert.equal(stopJudging('runtime_error', { ...all, heavy: 2 }), false);
  assert.equal(stopJudging('time_limit', { ...all, heavy: 2 }), false);
  assert.equal(stopJudging('output_limit', { ...all, heavy: 3 }), true);
  assert.equal(stopJudging('accepted', { ...all, heavy: 3 }), false);
});

void test('a failed maintenance round retries after 1s, a healthy one waits 5s; job retries back off from 1s', () => {
  assert.equal(maintenanceDelayMs(true), 5000);
  assert.equal(maintenanceDelayMs(false), 1000);
  assert.equal(OJ_RETRY_BACKOFF_MS, 1000);
});
