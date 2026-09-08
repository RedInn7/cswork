import test from 'node:test';
import assert from 'node:assert/strict';
import { submitOJ, type OJSubmission } from '../lib/oj-client';
import { FeedbackTiming } from '../lib/oj-feedback-timing';

const detail: OJSubmission = {
  id: 's1',
  problem_id: 'p1',
  language: 'cpp',
  mode: 'judge',
  status: 'accepted',
  passed: 2,
  total: 2,
  created_at: 1,
  cases: [],
};

test('full POST result skips redundant detail roundtrip, including terminal results', async () => {
  const original = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (path) => {
    paths.push(String(path));
    return Response.json(detail);
  };
  try {
    assert.deepEqual(await submitOJ({}, new AbortController().signal), detail);
    assert.deepEqual(paths, ['/api/oj/submissions']);
  } finally {
    globalThis.fetch = original;
  }
});

test('old compact receipt remains queryable and loads details exactly once', async () => {
  const original = globalThis.fetch;
  const paths: string[] = [];
  let received = false;
  globalThis.fetch = async (path) => {
    paths.push(String(path));
    if (paths.length === 2) assert.equal(received, true);
    return Response.json(
      paths.length === 1 ? { id: 's1', status: 'accepted' } : detail,
    );
  };
  try {
    assert.deepEqual(
      await submitOJ({}, new AbortController().signal, () => {
        received = true;
      }),
      detail,
    );
    assert.deepEqual(paths, ['/api/oj/submissions', '/api/oj/submissions/s1']);
  } finally {
    globalThis.fetch = original;
  }
});

test('active rich receipt preserves watch token for immediate long polling', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      ...detail,
      status: 'queued',
      watchToken: 'opaque-token',
    });
  };
  try {
    const result = await submitOJ({}, new AbortController().signal);
    assert.equal(result.watchToken, 'opaque-token');
    assert.equal(result.status, 'queued');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('legacy detail failure still publishes receipt for recovery without resubmission', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let recoveredId = '';
  globalThis.fetch = async () =>
    ++calls === 1
      ? Response.json({ id: 's1', status: 'accepted' })
      : Response.json({ error: 'temporary failure' }, { status: 503 });
  try {
    await assert.rejects(
      submitOJ({}, new AbortController().signal, (receipt) => {
        recoveredId = receipt.id;
      }),
      /temporary failure/,
    );
    assert.equal(recoveredId, 's1');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('aborted POST cannot publish a stale receipt or start a detail request', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async () => {
    controller.abort();
    return Response.json(detail);
  };
  try {
    await assert.rejects(
      submitOJ({}, controller.signal, () => assert.fail('stale receipt')),
      { name: 'AbortError' },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('timing measures full feedback once, ignores stale results and discarded attempts', () => {
  let now = 10;
  const measures: unknown[] = [];
  const timing = new FeedbackTiming({
    now: () => now,
    measure: (...args: unknown[]) => {
      measures.push(args);
    },
  });
  timing.start('judge');
  timing.bind('first');
  now = 20;
  timing.start('run');
  timing.bind('second');
  now = 120;
  assert.equal(timing.finish('first', 'accepted'), null);
  assert.equal(timing.finish('second', 'running'), null);
  assert.equal(timing.finish('second', 'accepted'), 100);
  assert.equal(timing.finish('second', 'accepted'), null);
  assert.equal(measures.length, 1);
  assert.deepEqual(measures[0], [
    'cswork:oj:click-to-feedback',
    { start: 20, end: 120, detail: { mode: 'run', status: 'accepted' } },
  ]);
  timing.start('judge');
  timing.bind('third');
  timing.cancel();
  assert.equal(timing.finish('third', 'cancelled'), null);
});
