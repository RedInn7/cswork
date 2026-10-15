import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const editor = `import React from ${JSON.stringify(react)};export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor','data-path':p.path,value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});}`;
register(
  `data:text/javascript,${encodeURIComponent(`const editor=${JSON.stringify(editor)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/editor.tsx'))return {format:'module',source:editor,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const starter = { 'src/__init__.py': '', 'src/ledger.py': 'class Ledger:\n    pass\n', 'tests/__init__.py': '' };
const level = (n, hiddenTotal) => ({
  level: n,
  statement: { zh: `第 ${n} 关说明`, en: `Brief of level ${n}` },
  tests: { [`tests/test_level${n}.py`]: `# level ${n}\n` },
  hiddenTotal,
});
const initial = { slug: 'bank-ledger', passed: [], unlocked: 1, levels: [level(1, 7)] };
const settle = (ms = 30) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

async function mount(stored = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/oa/ica/bank-ledger' });
  for (const [key, value] of Object.entries(stored)) dom.window.localStorage.setItem(key, value);
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'navigator', 'location', 'history'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { IcaWorkspace } = await import('../components/ica-workspace.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(IcaWorkspace, { slug: 'bank-ledger', minutes: 90, starter, initial, signedIn: true, verified: true })),
  );
  await settle();
  return root;
}
const levels = () => [...document.querySelectorAll('.ica-levels button')];
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const click = (node) => act(async () => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
const code = () => document.querySelector('[aria-label="test editor"]');
const typeInto = (node, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(node, value);
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
  });

test('levels unlock one by one, runs name their level, the score counts the current level share, no AI pair', async () => {
  const sent = [];
  let verdict = { status: 'accepted', hidden: { passed: 7, total: 7 } };
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith('/ai-assisted/run'))
      return Response.json({ id: 's1', status: 'queued', mode: 'project', watchToken: 't1', passed: 0, total: 0 });
    if (String(url).includes('/submissions/s1'))
      return Response.json({
        id: 's1',
        status: verdict.status,
        mode: 'project',
        passed: 0,
        total: 0,
        project: { visible: { passed: 1, total: 1, failures: [] }, hidden: verdict.hidden, output: '' },
      });
    if (String(url).endsWith('/api/oj/ica/bank-ledger'))
      return Response.json({ slug: 'bank-ledger', passed: [1], unlocked: 2, levels: [level(1, 7), level(2, 13)] });
    throw new Error(`unexpected ${url}`);
  };
  const root = await mount();
  try {
    assert.deepEqual(levels().map((b) => [b.textContent, b.disabled, b.getAttribute('aria-current')]), [
      ['Level 1', false, 'step'],
      ['Level 2 (locked)', true, null],
      ['Level 3 (locked)', true, null],
      ['Level 4 (locked)', true, null],
    ]);
    assert.match(document.querySelector('.ica-statement').textContent, /Brief of level 1/);
    assert.ok(button('test_level1.py'), 'level 1 public tests are in the tree');
    assert.equal(button('test_level2.py'), undefined);
    assert.equal(document.getElementById('ai-round-pair-title'), null, 'an ICA round has no AI pair');
    assert.match(document.querySelector('.ica-score').textContent, /Score 0 \/ 4/);

    // Typed just before the run, inside the 400 ms before this browser's copy is saved.
    const edited = 'class Ledger:\n    balance = 0\n';
    await typeInto(code(), edited);
    await click(button('Run tests'));
    await settle();
    assert.equal(sent[0].url, '/api/oj/ai-assisted/run');
    assert.deepEqual([sent[0].body.task, sent[0].body.level], ['ica:bank-ledger', 1]);
    assert.ok('tests/test_level1.py' in sent[0].body.files);
    assert.equal(sent.at(-1).url, '/api/oj/ica/bank-ledger');
    assert.equal(sent.at(-1).method, 'GET');
    // Passing level 1 opens level 2: its brief, its public tests, and runs on it.
    assert.deepEqual(levels().map((b) => [b.dataset.state, b.getAttribute('aria-current')]), [
      ['passed', null],
      ['open', 'step'],
      ['locked', null],
      ['locked', null],
    ]);
    assert.match(document.querySelector('.ica-statement').textContent, /Brief of level 2/);
    assert.ok(button('test_level2.py'));
    assert.equal(code().value, edited, 'opening a level keeps the edit the save has not written yet');
    assert.match(document.querySelector('.ica-score').textContent, /Score 1 \/ 4/);

    // Level 2's hidden suite holds level 1's 7 tests too: 10 of 13 is half of level 2's own 6.
    verdict = { status: 'wrong_answer', hidden: { passed: 10, total: 13 } };
    await click(button('Run tests'));
    await settle();
    assert.equal(sent.filter((s) => s.url.endsWith('/ai-assisted/run')).at(-1).body.level, 2);
    assert.match(document.querySelector('.ica-score').textContent, /Score 1\.5 \/ 4/);
    // Back to level 1: its brief and its runs.
    await click(levels()[0]);
    assert.match(document.querySelector('.ica-statement').textContent, /Brief of level 1/);
  } finally {
    await act(async () => root.unmount());
  }
});

test('the 90-minute timer starts on request and is kept in this browser', async () => {
  globalThis.fetch = async () => {
    throw new Error('no request expected');
  };
  const root = await mount();
  try {
    assert.equal(document.querySelector('.ica-timer [data-over]'), null);
    await click(button('Start the 90-minute timer'));
    await settle();
    assert.match(document.querySelector('.ica-timer').textContent, /(90:00|89:5\d)/);
    assert.ok(Number(localStorage.getItem('cswork:ica:bank-ledger:started')) > 0);
  } finally {
    await act(async () => root.unmount());
  }
  const again = await mount({ 'cswork:ica:bank-ledger:started': String(Date.now() - 91 * 60_000) });
  try {
    assert.match(document.querySelector('.ica-timer').textContent, /Time's up/);
  } finally {
    await act(async () => again.unmount());
  }
});
