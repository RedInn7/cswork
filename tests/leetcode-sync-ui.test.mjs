import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return {format:'module',source:'export default {}',shortCircuit:true}; return next(url,context); }")}`,
  import.meta.url,
);

test('sync UI isolates round, paginates, clears secrets and aborts on close', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'localStorage',
    'sessionStorage',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { LeetcodeSyncPanel } =
    await import('../components/leetcode-sync-panel.tsx');
  const calls = [];
  let changed = 0;
  let phase = 'complete';
  const run = {
    id: 'r-sync',
    region: 'cn',
    username: 'owner',
    roundId: 'one',
    status: 'running',
    scanned: 20,
    accepted: 3,
    matched: 2,
    unmatched: 1,
    pages: 1,
    error: null,
    createdAt: 1,
    updatedAt: 1,
  };
  globalThis.fetch = async (_url, init = {}) => {
    if (!init.body)
      return {
        ok: true,
        json: async () => ({
          runs: [],
          records: [],
          page: 1,
          pageSize: 30,
          total: 0,
          hasMore: false,
          summary: { accepted: 0, matched: 0, unmatched: 0 },
        }),
      };
    const body = JSON.parse(init.body);
    calls.push({ body, at: Date.now(), signal: init.signal });
    if (body.action === 'continue')
      return {
        ok: true,
        json: async () => ({
          run: { ...run, status: 'complete', scanned: 40 },
        }),
      };
    if (body.action === 'cancel')
      return {
        ok: true,
        json: async () => ({ run: { ...run, status: 'cancelled' } }),
      };
    if (phase === 'hold')
      return new Promise((_resolve, reject) =>
        init.signal.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        ),
      );
    return { ok: true, json: async () => ({ run }) };
  };
  const root = createRoot(document.querySelector('#root'));
  let closed = false;
  const render = async (currentRoundId = 'one') =>
    act(async () =>
      root.render(
        createElement(LeetcodeSyncPanel, {
          rounds: [
            { id: 'one', number: 1 },
            { id: 'two', number: 2 },
          ],
          currentRoundId,
          onChanged: () => changed++,
          onClose: () => {
            closed = true;
          },
        }),
      ),
    );
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (item) => item.textContent === text,
    );
  const fill = async () =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value',
      ).set;
      for (const [index, input] of [
        ...document.querySelectorAll('input'),
      ].entries()) {
        setter.call(input, index ? 'csrf-secret' : 'session-secret');
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      }
    });
  try {
    await render();
    await settle();
    assert.match(document.body.textContent, /不保存凭据/);
    assert.equal(document.querySelectorAll('input[type="password"]').length, 2);
    await fill();
    await act(async () =>
      document
        .querySelector('form')
        .dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true }),
        ),
    );
    await settle();
    assert.equal(calls[0].body.roundId, 'one');
    assert.equal(
      [...document.querySelectorAll('input')].every(
        (input) => input.value === '',
      ),
      true,
    );
    await render('two');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600));
    });
    assert.equal(calls[1].body.action, 'continue');
    assert.ok(calls[1].at - calls[0].at >= 1450);
    assert.match(document.body.textContent, /同步完成/);
    assert.match(document.body.textContent, /已扫描 40/);
    assert.equal(localStorage.length, 0);
    assert.equal(sessionStorage.length, 0);
    assert.ok(changed > 0);
    await fill();
    await act(async () =>
      document
        .querySelector('form')
        .dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true }),
        ),
    );
    await settle();
    await act(async () => button('停止同步').click());
    const stoppedCalls = calls.length;
    assert.equal(calls.at(-1).body.action, 'cancel');
    assert.equal(calls.at(-1).body.runId, 'r-sync');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1600));
    });
    assert.equal(
      calls.length,
      stoppedCalls,
      'cancel prevents another page request',
    );
    assert.match(document.body.textContent, /已停止，已导入记录保留/);
    phase = 'hold';
    await fill();
    await act(async () =>
      document
        .querySelector('form')
        .dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true }),
        ),
    );
    await act(async () => button('关闭').click());
    assert.equal(closed, true);
    assert.equal(calls.at(-1).signal.aborted, true);
    assert.equal(
      [...document.querySelectorAll('input')].every(
        (input) => input.value === '',
      ),
      true,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
