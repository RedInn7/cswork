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

test('notes save once after typing pauses and keep a local draft when saving fails', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'localStorage',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { useProblemNote, ProblemNotes, NotesTab } = await import(
    '../components/problem-notes.tsx'
  );
  const draft = 'cswork:note-draft:u1:problem:lc-1';
  const puts = [];
  let failPut = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    assert.ok(String(url).includes('/api/oj/notes?target=problem%3Alc-1'));
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body).body);
      return failPut
        ? Response.json({ error: 'Too many requests' }, { status: 429 })
        : Response.json({ ok: true });
    }
    return Response.json({ target: 'problem:lc-1', body: 'server copy', updatedAt: 1 });
  };
  function Harness() {
    const note = useProblemNote('u1', 'lc-1', 20);
    return createElement(
      'div',
      null,
      createElement(NotesTab, { note, active: true, onSelect() {}, english: true }),
      createElement(ProblemNotes, { note, english: true }),
    );
  }
  const root = createRoot(document.getElementById('root'));
  const wait = (ms) =>
    act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  const area = () => document.querySelector('textarea[aria-label="Note"]');
  const type = (value) =>
    act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        'value',
      ).set;
      setter.call(area(), value);
      area().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  try {
    await act(async () => root.render(createElement(Harness)));
    await wait(5);
    assert.equal(area().value, 'server copy');
    assert.ok(document.querySelector('.cs-tab-dot'), 'a saved note shows the dot');
    await type('a');
    await type('ab');
    await type('abc');
    assert.equal(puts.length, 0, 'nothing is sent while typing');
    await wait(60);
    assert.deepEqual(puts, ['abc'], 'one save with the newest text');
    assert.equal(localStorage.getItem(draft), 'abc', 'a failed save keeps a draft');
    assert.match(document.querySelector('[role="alert"]').textContent, /Couldn't save/);
    failPut = false;
    await act(async () =>
      [...document.querySelectorAll('button')].find((b) => b.textContent === 'Retry').click(),
    );
    await wait(5);
    assert.deepEqual(puts, ['abc', 'abc']);
    assert.equal(localStorage.getItem(draft), null, 'the draft clears once saved');
    assert.match(document.querySelector('.cs-notes-foot').textContent, /Saved/);
    await type('x'.repeat(21 * 1024));
    await wait(60);
    assert.equal(puts.length, 2, 'an over-size note is never sent');
    assert.match(document.querySelector('[role="alert"]').textContent, /Over 20 KB/);
    await act(async () => root.unmount());
    assert.equal(localStorage.getItem(draft)?.length, 21 * 1024, 'but it is kept on this device');
    // A draft left by an earlier failure wins over the server copy and is sent again.
    localStorage.setItem(draft, 'offline edit');
    const again = createRoot(document.getElementById('root'));
    await act(async () => again.render(createElement(Harness)));
    await wait(5);
    assert.equal(area().value, 'offline edit');
    assert.equal(puts.at(-1), 'offline edit');
    assert.equal(localStorage.getItem(draft), null);
    await act(async () => again.unmount());
  } finally {
    globalThis.fetch = originalFetch;
  }
});
