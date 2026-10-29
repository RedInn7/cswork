import test from 'node:test';
import assert from 'node:assert/strict';
delete process.env.REDIS_URL;
delete process.env.OJ_EVENTS_URL;
const { submissionWaiter, wakeSubmission, pollMs, TICK_MS } = await import('../lib/server/oj-verdict-bus');
const { mergeWatch } = await import('../lib/oj-client');

test('a change wakes its waiter at once, even one published before wait()', async () => {
  const waiter = submissionWaiter('a');
  try {
    const signal = new AbortController().signal;
    let started = performance.now();
    setTimeout(() => wakeSubmission('a'), 5);
    await waiter.wait(5_000, signal);
    assert.ok(performance.now() - started < 1_000);
    // Committed between the caller's read and its wait: not lost.
    wakeSubmission('a');
    started = performance.now();
    await waiter.wait(5_000, signal);
    assert.ok(performance.now() - started < 50);
    // Another submission's change does not wake it; the timeout still does.
    wakeSubmission('b');
    started = performance.now();
    await waiter.wait(40, signal);
    assert.ok(performance.now() - started >= 35);
  } finally {
    waiter.close();
  }
});
test('abort ends a wait; without Redis waiters poll every tick', async () => {
  assert.equal(pollMs(), TICK_MS);
  const waiter = submissionWaiter('c');
  const controller = new AbortController();
  const waiting = waiter.wait(5_000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  waiter.close();
  wakeSubmission('c');
});
test('a light watch reply keeps the code shown and takes the new cases', () => {
  const base = { id: 's', problem_id: 'p', language: 'python', mode: 'judge', passed: 0, total: 1, created_at: 0 } as const;
  const shown = { ...base, status: 'queued', cases: [{ ordinal: 0, status: 'pending', hidden: true }], code: 'x' };
  const cases = [{ ordinal: 0, status: 'accepted', hidden: true }];
  const merged = mergeWatch(shown, { ...base, status: 'running', passed: 1, cases });
  assert.equal(merged.status, 'running');
  assert.equal(merged.passed, 1);
  assert.equal(merged.cases, cases);
  assert.equal(merged.code, 'x');
  const final = { ...base, status: 'accepted', cases, code: 'x' };
  assert.equal(mergeWatch(shown, final), final);
  const other = { ...base, id: 't', status: 'running' };
  assert.equal(mergeWatch(shown, other), other);
});
