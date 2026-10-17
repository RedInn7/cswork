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
  let server = { body: 'server copy', updatedAt: 1 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    assert.ok(String(url).includes('/api/oj/notes?target=problem%3Alc-1'));
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body).body);
      if (failPut) return Response.json({ error: 'Too many requests' }, { status: 429 });
      server = { body: JSON.parse(init.body).body, updatedAt: server.updatedAt + 1 };
    }
    return Response.json({ target: 'problem:lc-1', ...server });
  };
  const saved = () => JSON.parse(localStorage.getItem(draft) ?? 'null');
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
    assert.deepEqual(saved(), { body: 'abc', base: 1 }, 'a failed save keeps a draft');
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
    assert.equal(saved()?.body.length, 21 * 1024, 'but it is kept on this device');
    let again;
    const mount = async (stored) => {
      localStorage.setItem(draft, JSON.stringify(stored));
      again = createRoot(document.getElementById('root'));
      await act(async () => again.render(createElement(Harness)));
      await wait(5);
    };
    const click = (label) =>
      act(async () =>
        [...document.querySelectorAll('button')].find((b) => b.textContent === label).click(),
      );
    // A draft over an unchanged server copy wins and is sent again.
    await mount({ body: 'offline edit', base: server.updatedAt });
    assert.equal(area().value, 'offline edit');
    assert.equal(puts.at(-1), 'offline edit');
    assert.equal(localStorage.getItem(draft), null);
    await act(async () => again.unmount());
    // A draft whose save landed after the tab closed is dropped, not re-sent.
    const sends = puts.length;
    await mount({ body: 'offline edit', base: server.updatedAt - 1 });
    assert.equal(puts.length, sends);
    assert.equal(localStorage.getItem(draft), null, 'a draft equal to the server copy is cleared');
    await act(async () => again.unmount());
    // The note changed on another device since the draft: nothing is overwritten.
    server = { body: 'v2 written on laptop', updatedAt: 99 };
    await mount({ body: 'v1', base: 3 });
    assert.equal(area().value, 'v2 written on laptop');
    assert.equal(area().readOnly, true, 'locked until the learner picks a version');
    assert.equal(puts.length, sends, 'the stale draft is not sent');
    assert.match(document.querySelector('.cs-notes-conflict pre').textContent, /^v1$/);
    await click('Discard it');
    assert.equal(localStorage.getItem(draft), null);
    assert.equal(area().readOnly, false);
    assert.equal(server.body, 'v2 written on laptop');
    await act(async () => again.unmount());
    await mount({ body: 'v1', base: 3 });
    await click("Use this device's version");
    await wait(5);
    assert.equal(area().value, 'v1');
    assert.deepEqual([puts.at(-1), server.body], ['v1', 'v1']);
    assert.equal(localStorage.getItem(draft), null);
    assert.equal(!!document.querySelector('.cs-notes-conflict'), false);
    await act(async () => again.unmount());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the template goes in at the cursor and [[lc-42]] previews as a link, with backlinks below', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { useProblemNote, ProblemNotes } = await import('../components/problem-notes.tsx');
  const { PROBLEM_TEMPLATE } = await import('../lib/note-meta.ts');
  const notes = { 'problem:lc-1': 'first line\nsecond', 'pref:note-template': '' };
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url), 'https://cswork.test');
    requests.push(`${init.method ?? 'GET'} ${u.pathname}${u.search}`);
    if (u.pathname === '/api/oj/notes/backlinks')
      return Response.json({ items: [{ target: 'topic:two-pointers-windows', snippet: '相关 [[lc-1]]', updatedAt: 1 }] });
    const target = u.searchParams.get('target');
    if (init.method === 'PUT') notes[target] = JSON.parse(init.body).body;
    return Response.json({ target, body: notes[target] ?? '', updatedAt: 1 });
  };
  function Harness() {
    const note = useProblemNote('u1', 'lc-1', 20);
    return createElement(ProblemNotes, { note, english: true, problemId: 'lc-1' });
  }
  const root = createRoot(document.getElementById('root'));
  const wait = (ms) => act(async () => new Promise((r) => setTimeout(r, ms)));
  const area = () => document.querySelector('textarea[aria-label="Note"]');
  const click = (label) =>
    act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === label).click());
  try {
    await act(async () => root.render(createElement(Harness)));
    await wait(5);
    area().setSelectionRange(10, 10);
    await click('Insert template');
    await wait(5);
    assert.equal(area().value, `first line\n\n${PROBLEM_TEMPLATE.en}\nsecond`, 'at the cursor, on a line of its own');
    assert.equal(area().selectionStart, 12 + PROBLEM_TEMPLATE.en.length, 'the cursor lands after it');
    // The learner's own template, saved from a note, wins from then on.
    notes['pref:note-template'] = JSON.stringify({ problem: '## Mine' });
    area().setSelectionRange(0, 0);
    await click('Insert template');
    await wait(5);
    assert.ok(area().value.startsWith('## Minefirst line'));
    // A broken saved template falls back to the built-in one.
    notes['pref:note-template'] = '{"problem":7}';
    area().setSelectionRange(0, 0);
    await click('Insert template');
    await wait(5);
    assert.ok(area().value.startsWith(PROBLEM_TEMPLATE.en));
    await click('Set as my template');
    assert.equal(JSON.parse(notes['pref:note-template']).problem, area().value);
    assert.match(document.querySelector('.cs-notes-tools [role="status"]').textContent, /Saved as your template/);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(area(), 'see [[lc-42]] and `[[lc-7]]`');
      area().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(requests.filter((r) => r.includes('backlinks')).length, 0, 'backlinks wait for the preview');
    await click('Preview');
    await wait(5);
    const preview = document.querySelector('.cs-notes-preview');
    assert.equal(preview.querySelector('a').getAttribute('href'), '/?view=problem&problem=lc-42');
    assert.equal(preview.querySelector('code').textContent, '[[lc-7]]', 'a link in code stays text');
    assert.ok(requests.includes('GET /api/oj/notes/backlinks?problem=lc-1'));
    const backlink = document.querySelector('.cs-notes-links a');
    assert.equal(backlink.getAttribute('href'), '/topics/two-pointers-windows');
    assert.equal(backlink.textContent, 'Pattern notes · Two Pointers');
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a topic page notebook: nothing on the server, a sign-in line for guests, the stop note and its problems', async () => {
  const { renderToString } = await import('react-dom/server');
  const { TopicNotebook } = await import('../components/topic-notebook.tsx');
  assert.equal(renderToString(createElement(TopicNotebook, { slug: 'two-pointers-windows', zh: false })), '');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/topics/two-pointers-windows' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  let signedIn = false;
  const auth = [];
  dom.window.addEventListener('cswork:auth-required', () => auth.push(1));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url), 'https://cswork.test');
    if (u.pathname === '/api/oj/notes/stop') {
      assert.equal(u.searchParams.get('slug'), 'two-pointers-windows');
      return signedIn
        ? Response.json({ me: 'u1', items: [{ problemId: 'lc-15', snippet: 'sort, then two pointers', confidence: 2, tags: ['双指针'] }] })
        : Response.json({ error: 'Please sign in first' }, { status: 401 });
    }
    assert.equal(u.searchParams.get('target'), 'topic:two-pointers-windows');
    return Response.json({ target: 'topic:two-pointers-windows', body: 'shrink while the window is invalid', updatedAt: 1 });
  };
  const wait = (ms) => act(async () => new Promise((r) => setTimeout(r, ms)));
  try {
    let root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(TopicNotebook, { slug: 'two-pointers-windows', zh: false })));
    await wait(5);
    assert.match(document.querySelector('.topic-notebook').textContent, /Sign in to keep notes on this pattern/);
    assert.equal(auth.length, 0, 'no app sign-in prompt on a public page');
    await act(async () => root.unmount());
    signedIn = true;
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(TopicNotebook, { slug: 'two-pointers-windows', zh: false })));
    await wait(5);
    assert.equal(document.querySelector('textarea[aria-label="Note"]').value, 'shrink while the window is invalid');
    assert.equal(document.querySelector('.cs-notes-tools'), null, 'no problem template on a stop note');
    const item = document.querySelector('.topic-notebook-list li');
    assert.equal(item.querySelector('a').getAttribute('href'), '/?view=problem&problem=lc-15');
    assert.match(item.textContent, /LC 15Confidence 2 · #双指针sort, then two pointers/);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = originalFetch;
  }
});
