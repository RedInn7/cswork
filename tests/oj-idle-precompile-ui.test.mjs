import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act, useEffect } from 'react';
import { useIdlePrecompile } from '../hooks/use-idle-precompile.ts';

void test('idle precompile remains optional, debounced, private to the draft and cancellable', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://cswork.test/',
    pretendToBeVisual: true,
  });
  const originalFetch = globalThis.fetch;
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let visible = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visible,
  });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const base = {
    enabled: true,
    userId: 'student-1',
    problemId: 'lc-1',
    language: 'cpp',
    codingMode: 'leetcode',
    code: 'class Solution { public: int solve() { return 1; } };',
    template: 'class Solution { public: int solve() {} };',
  };
  let props = base;
  let generation = 0;
  let cancel;
  let calls = [];
  let status = 'queued';
  let failure = false;
  let hold = false;
  const releases = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url,
      body: JSON.parse(init.body),
      signal: init.signal,
      at: Date.now(),
    });
    if (hold) await new Promise((resolve) => releases.push(resolve));
    return {
      ok: !failure,
      status: failure ? 429 : 200,
      json: async () => (failure ? { error: 'busy' } : { status }),
    };
  };
  function Probe(options) {
    const stop = useIdlePrecompile(options);
    useEffect(() => {
      cancel = stop;
    }, [stop]);
    return null;
  }
  const render = async (changes = {}) => {
    props = { ...props, ...changes };
    await act(async () =>
      root.render(createElement(Probe, { ...props, key: generation })),
    );
  };
  const tick = async (ms) => {
    await act(async () => t.mock.timers.tick(ms));
  };
  const visibility = async (value) => {
    visible = value;
    await act(async () =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
  };
  const reset = async (changes = {}) => {
    await act(async () => root.render(null));
    for (const resolve of releases.splice(0)) resolve();
    await tick(12000);
    generation++;
    props = base;
    calls = [];
    status = 'queued';
    failure = false;
    hold = false;
    visible = 'visible';
    await render(changes);
  };
  try {
    await t.test(
      'waits 2500 ms after the final edit and sends exact source without running it',
      async () => {
        await reset();
        await tick(2000);
        assert.equal(calls.length, 0);
        const code =
          'class Solution { public: int solve() {\n return 2;\n } };';
        await render({ code });
        await tick(2499);
        assert.equal(calls.length, 0);
        await tick(1);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/api/oj/precompile');
        assert.deepEqual(calls[0].body, {
          problemId: 'lc-1',
          language: 'cpp',
          code,
          codingMode: 'leetcode',
        });
        await tick(120000);
        assert.equal(
          calls.length,
          1,
          'no periodic work after the one response',
        );
      },
    );

    await t.test(
      'skips unavailable, guest, non-C++, blank and unchanged-template drafts',
      async () => {
        for (const changes of [
          { enabled: false },
          { userId: 'guest' },
          { userId: '' },
          { language: 'python' },
          { language: 'java' },
          { code: ' \n /* just a note */ // no code' },
          { code: base.template },
          {
            code: 'class Solution {\n public: int solve() { /* TODO */ } }; // comment',
          },
        ]) {
          await reset(changes);
          await tick(3000);
          assert.equal(calls.length, 0, JSON.stringify(changes));
        }
      },
    );

    await t.test(
      'hiding, editing, foreground submission and unmount cancel pending requests',
      async () => {
        await reset();
        await tick(2400);
        await visibility('hidden');
        await tick(5000);
        assert.equal(calls.length, 0);
        hold = true;
        await visibility('visible');
        await tick(2500);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].signal.aborted, false);
        await render({ code: base.code + '\n// changed' });
        assert.equal(calls[0].signal.aborted, true);
        await tick(12000);
        assert.equal(calls.length, 2);
        await render({ enabled: false });
        assert.equal(calls[1].signal.aborted, true);
        await tick(5000);
        assert.equal(calls.length, 2);
        await render({ enabled: true });
        cancel();
        await tick(12000);
        assert.equal(
          calls.length,
          2,
          'explicit submit cancels before React pending-state rendering',
        );
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(calls.length, 3);
        await act(async () => root.render(null));
        assert.equal(calls[2].signal.aborted, true);
      },
    );

    await t.test(
      'deduplicates exact drafts by user, problem, language and mode, with bounded expiry',
      async () => {
        await reset();
        status = 'cached';
        await tick(2500);
        await visibility('hidden');
        await visibility('visible');
        await tick(3000);
        assert.equal(calls.length, 1);
        await render({ code: base.code + ' ' });
        await tick(12000);
        assert.equal(
          calls.length,
          2,
          'exact source is the backend cache identity',
        );
        await render({ code: base.code });
        await tick(3000);
        assert.equal(calls.length, 2);
        await render({ problemId: 'lc-2' });
        await tick(12000);
        await render({ codingMode: 'acm' });
        await tick(12000);
        await render({ userId: 'student-2' });
        await tick(2500);
        assert.equal(calls.length, 5);
        await tick(240000);
        assert.equal(calls.length, 5, 'expiry alone does not loop');
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(
          calls.length,
          6,
          'returning after expiry can warm the same draft again',
        );
      },
    );

    await t.test(
      'remembers at most eight successful draft versions',
      async () => {
        await reset();
        status = 'cached';
        for (let i = 0; i < 9; i++) {
          await render({ code: base.code + `\n// version ${i}` });
          await tick(12000);
        }
        assert.equal(calls.length, 9);
        await render({ code: base.code + '\n// version 8' });
        await tick(3000);
        assert.equal(calls.length, 9);
        await render({ code: base.code + '\n// version 0' });
        await tick(12000);
        assert.equal(calls.length, 10, 'oldest entry was evicted');
      },
    );

    await t.test(
      'rapid edits retain the latest draft without exceeding six requests per minute',
      async () => {
        await reset();
        for (let i = 0; i < 16; i++) {
          await render({ code: base.code + `\n// edit ${i}` });
          await tick(3000);
        }
        await tick(12000);
        assert.ok(calls.length <= 6);
        for (let i = 1; i < calls.length; i++) {
          assert.ok(calls[i].at - calls[i - 1].at >= 12000);
        }
        assert.equal(
          calls.at(-1).body.code,
          base.code + '\n// edit 15',
          'tail sends the latest draft, not an intermediate version',
        );
      },
    );

    await t.test(
      'queued receipts expire after thirty seconds rather than claiming a warm cache',
      async () => {
        await reset();
        await tick(2500);
        await visibility('hidden');
        await visibility('visible');
        await tick(15000);
        assert.equal(calls.length, 1);
        await tick(16000);
        assert.equal(calls.length, 1, 'no autonomous retry at expiry');
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(
          calls.length,
          2,
          'a later visit can retry an expired or preempted queued draft',
        );
      },
    );

    await t.test(
      'changing problem workspaces preserves the same-user throttle',
      async () => {
        await reset();
        await tick(2500);
        await act(async () => root.render(null));
        generation++;
        await render({ problemId: 'lc-2' });
        await tick(2500);
        assert.equal(calls.length, 1);
        await tick(9500);
        assert.equal(calls.length, 2);
        assert.equal(calls[1].body.problemId, 'lc-2');
      },
    );

    await t.test(
      '429/errors and skipped work remain silent and never retry in a loop',
      async () => {
        await reset();
        failure = true;
        await tick(2500);
        await tick(240000);
        assert.equal(calls.length, 1);
        failure = false;
        status = 'skipped';
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(calls.length, 2);
        await tick(240000);
        assert.equal(calls.length, 2);
        status = 'cached';
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(calls.length, 3);
        await visibility('hidden');
        await visibility('visible');
        await tick(2500);
        assert.equal(
          calls.length,
          3,
          'cached responses are compatible and deduplicated',
        );
      },
    );
  } finally {
    await act(async () => root.unmount());
    for (const resolve of releases.splice(0)) resolve();
    t.mock.timers.reset();
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
