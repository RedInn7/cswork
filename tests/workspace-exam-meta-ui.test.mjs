import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

test('in a mock OA the meta line shows only the time limit: no stats fetch, votes or share', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(url);
    return Response.json({ acceptance: { attempted: 40, accepted: 30 }, votes: { up: 3, down: 1 }, vote: null });
  };
  const { createRoot } = await import('react-dom/client');
  const { ProblemMeta } = await import('../components/problem-meta.tsx');
  const root = createRoot(document.getElementById('root'));
  const render = (props) =>
    act(async () => {
      root.render(createElement(ProblemMeta, { problemId: 'lc-1', title: 'A+B', english: true, signedIn: true, timeLimit: 2, ...props }));
      await new Promise((r) => setTimeout(r, 10));
    });
  try {
    await render({ limitOnly: true });
    assert.deepEqual([...document.querySelectorAll('.cs-problem-meta-rate')].map((n) => n.textContent), ['Time limit 2s']);
    assert.equal(document.querySelector('.cs-problem-share, .cs-problem-votes'), null);
    assert.equal(calls.length, 0);
    await render({ limitOnly: true, timeLimit: 0 });
    assert.equal(document.querySelector('.cs-problem-meta'), null);
    // Outside the exam the same line fetches stats and offers votes and sharing.
    await render({ limitOnly: false });
    assert.equal(calls.length, 1);
    assert.equal(!!document.querySelector('.cs-problem-share') && !!document.querySelector('.cs-problem-votes'), true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
  // The workspace mounts it in exam mode too, limited to the time limit.
  const workspace = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /<ProblemMeta[^>]*limitOnly=\{examMode\}/);
});
