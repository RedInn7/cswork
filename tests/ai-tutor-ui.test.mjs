import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

test('the workspace shows the tutor only with AI on, signed in, and outside a mock OA', () => {
  const source = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('boot.services?.ai && !!boot.person && !examMode && ('), true);
  // The bootstrap flag follows the server key.
  const api = readFileSync(new URL('../lib/server/api.ts', import.meta.url), 'utf8');
  assert.equal(api.includes('ai: aiEnabled()'), true);
});

test('hints and reviews: quota counts, earlier hints sent back, errors, safe Markdown', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { useAiTutor, AiTutor } = await import('../components/ai-tutor.tsx');
  const calls = [];
  let answer = (kind, n) => Response.json({ kind, text: `Nudge ${n}: what if **two** values match?`, remaining: 10 - n, limit: 10 });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return answer(calls.at(-1).body && String(url).endsWith('/review') ? 'review' : 'hint', calls.length);
  };
  let props = { code: '', accepted: false };
  function Harness() {
    const tutor = useAiTutor('lc-1');
    return createElement(AiTutor, {
      tutor,
      language: 'python',
      codingMode: 'leetcode',
      english: true,
      ...props,
    });
  }
  const root = createRoot(document.getElementById('root'));
  const render = () => act(async () => root.render(createElement(Harness)));
  const buttons = () => [...document.querySelectorAll('.cs-ai-tutor-actions button')];
  const click = (el) =>
    act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
  try {
    await render();
    let [hint, review] = buttons();
    assert.equal(hint.textContent.includes('Give me a hint'), true);
    assert.equal(hint.textContent.includes('10 left today'), true);
    assert.equal(review.textContent.includes('5 left today'), true);
    // Nothing to review yet.
    assert.equal(review.disabled, true);

    await click(hint);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/oj/ai/hint');
    assert.deepEqual(calls[0].body, {
      problemId: 'lc-1',
      language: 'python',
      codingMode: 'leetcode',
      code: '',
      locale: 'en',
      previous: [],
    });
    const first = document.querySelector('.cs-ai-tutor-replies li');
    assert.equal(first.textContent.includes('Hint 1'), true);
    // Rendered through the statement Markdown renderer.
    assert.equal(first.querySelector('strong')?.textContent === 'two', true);
    assert.equal(buttons()[0].textContent.includes('Another hint'), true);
    assert.equal(buttons()[0].textContent.includes('9 left today'), true);

    // The next hint builds on the first; raw HTML in a reply stays text.
    answer = () => Response.json({ kind: 'hint', text: 'Look at <img src=x onerror="alert(1)"> the loop.', remaining: 8, limit: 10 });
    await click(buttons()[0]);
    assert.deepEqual(calls[1].body.previous, ['Nudge 1: what if **two** values match?']);
    assert.equal(document.querySelector('.cs-ai-tutor img') === null, true);
    assert.equal(document.querySelector('.cs-ai-tutor-replies').textContent.includes('Hint 2'), true);

    // Out of quota: the server's message, and the button closes for today.
    answer = () => Response.json({ error: "You've used today's AI hints. Come back tomorrow" }, { status: 429 });
    await click(buttons()[0]);
    assert.equal(document.querySelector('[role="alert"]').textContent.includes("today's AI hints"), true);
    assert.equal(buttons()[0].disabled, true);
    assert.equal(buttons()[0].textContent.includes('0 left today'), true);

    // After an AC the review is the primary action.
    props = { code: 'class Solution: pass', accepted: true };
    await render();
    review = buttons()[1];
    assert.equal(review.disabled, false);
    assert.equal(review.hasAttribute('data-primary'), true);
    assert.equal(review.textContent.includes('Review my accepted code'), true);
    assert.equal(document.querySelector('.cs-ai-tutor-nudge') !== null, true);
    answer = () => Response.json({ kind: 'review', text: '**Complexity** O(n).', remaining: 4, limit: 5 });
    await click(review);
    assert.equal(calls.at(-1).url, '/api/oj/ai/review');
    assert.equal(calls.at(-1).body.code, 'class Solution: pass');
    assert.equal(document.querySelector('[role="alert"]') === null, true);
    const last = [...document.querySelectorAll('.cs-ai-tutor-replies li')].at(-1);
    assert.equal(last.dataset.kind, 'review');
    assert.equal(last.textContent.includes('Code review'), true);
    assert.equal(buttons()[1].textContent.includes('4 left today'), true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
