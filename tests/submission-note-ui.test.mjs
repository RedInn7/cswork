import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

test('a submission note opens when it has text and saves under sub:<id>', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SubmissionNote } = await import('../components/submission-note.tsx');
  const bodies = { 's-1': 'WA: off by one', 's-2': '' };
  const puts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const target = decodeURIComponent(/target=([^&]+)/.exec(String(url))[1]);
    if (init.method === 'PUT') puts.push([target, JSON.parse(init.body).body]);
    const id = target.slice('sub:'.length);
    return Response.json({ target, body: bodies[id], updatedAt: bodies[id] ? 1 : null });
  };
  const root = createRoot(document.getElementById('root'));
  const wait = (ms) => act(async () => new Promise((r) => setTimeout(r, ms)));
  const render = (id) =>
    act(async () => root.render(createElement(SubmissionNote, { key: id, userId: 'u1', submissionId: id })));
  try {
    await render('s-2');
    await wait(5);
    assert.equal(document.querySelector('details').open, false, 'an empty note stays folded');
    await render('s-1');
    await wait(5);
    const area = document.querySelector('details textarea');
    assert.equal(document.querySelector('details').open, true);
    assert.equal(area.value, 'WA: off by one');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(area, 'fixed: i <= n');
      area.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(document.querySelector('details').open, true, 'typing keeps it open');
    await wait(850);
    assert.deepEqual(puts, [['sub:s-1', 'fixed: i <= n']]);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
