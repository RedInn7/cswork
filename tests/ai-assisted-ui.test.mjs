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

const files = {
  'src/__init__.py': '',
  'src/inventory.py': 'class Inventory:\n    pass\n',
  'src/models.py': 'ITEM = 1\n',
  'tests/__init__.py': '',
  'tests/test_inventory.py': 'import unittest\n',
};
const props = { task: 'inventory-oversell', files, hiddenTotal: 11, signedIn: false, verified: false, ai: false, aiLimit: 15 };
const settle = (ms = 30) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

async function mount(overrides = {}, stored) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/ai-assisted/inventory-oversell' });
  if (stored) dom.window.localStorage.setItem('cswork:ai-round:inventory-oversell:v1', stored);
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'navigator', 'location', 'history'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProjectWorkspace } = await import('../components/project-workspace.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ProjectWorkspace, { ...props, ...overrides })));
  await settle();
  return { dom, root };
}
const code = () => document.querySelector('[aria-label="test editor"]');
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const typeInto = (node, value) =>
  act(async () => {
    const proto = node.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
const click = (node) => act(async () => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));

test('signed out: the tree opens files as tabs, edits stay in this browser, the AI pair is off', async () => {
  let { root } = await mount();
  try {
    assert.equal(code().value, files['src/inventory.py']);
    assert.equal(code().getAttribute('data-path'), 'cswork://ai-assisted/inventory-oversell/src/inventory.py');
    assert.ok(document.querySelector('a[href="/?view=account"]'));
    assert.equal(button('Run tests'), undefined);
    assert.match(document.body.textContent, /AI pair isn't available/);
    assert.match(document.body.textContent, /11 hidden tests|sign in to run the tests/);
    await click(button('test_inventory.py'));
    assert.equal(code().value, files['tests/test_inventory.py']);
    assert.equal(button('test_inventory.py').getAttribute('aria-current'), 'true');
    assert.ok(button('tests/test_inventory.py'), 'opened as a tab');
    await typeInto(code(), 'import unittest\n# mine\n');
    await settle(450);
  } finally {
    await act(async () => root.unmount());
  }
  const stored = localStorage.getItem('cswork:ai-round:inventory-oversell:v1');
  ({ root } = await mount({}, stored));
  try {
    assert.equal(code().value, 'import unittest\n# mine\n');
    assert.equal(button('tests/test_inventory.py').getAttribute('aria-pressed'), 'true');
    await click(document.querySelector('[aria-label="Close tests/test_inventory.py"]'));
    assert.equal(code().value, files['src/inventory.py']);
  } finally {
    await act(async () => root.unmount());
  }
});

test('new files: names are checked, added files can be deleted, starting files cannot', async () => {
  const { root } = await mount();
  try {
    const input = document.getElementById('ai-round-new-file');
    await typeInto(input, '../evil.py');
    assert.match(document.body.textContent, /Use a name like src\/name.py/);
    assert.equal(document.querySelector('[aria-label="Add file"]').disabled, true);
    await typeInto(input, 'src/models.py');
    assert.match(document.body.textContent, /That file already exists/);
    await typeInto(input, 'tests/test_extra.py');
    await act(async () => input.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(code().value, '');
    assert.ok(document.querySelector('[aria-label="Delete tests/test_extra.py"]'));
    assert.equal(document.querySelector('[aria-label="Delete src/models.py"]'), null);
    await click(document.querySelector('[aria-label="Delete tests/test_extra.py"]'));
    assert.equal(button('test_extra.py'), undefined);
  } finally {
    await act(async () => root.unmount());
  }
});

test('a run shows public failures and hidden counts; the AI pair sends the files and the conversation', async () => {
  const sent = [];
  const report = {
    visible: { passed: 3, total: 4, failures: [{ name: 'tests.test_inventory.T.test_oversell', message: 'AssertionError: OutOfStock not raised' }] },
    hidden: { passed: 2, total: 11 },
    output: 'debug print',
  };
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith('/ai-assisted/run'))
      return Response.json({ id: 's1', status: 'queued', mode: 'project', watchToken: 't1', passed: 0, total: 0 });
    if (String(url).includes('/submissions/s1'))
      return Response.json({ id: 's1', status: 'wrong_answer', mode: 'project', passed: 5, total: 15, project: report });
    return Response.json({ text: 'Check `reserve` against **available**.', remaining: 14, limit: 15, bonus: 0 });
  };
  const { root } = await mount({ signedIn: true, verified: true, ai: true });
  try {
    await click(button('Run tests'));
    await settle();
    assert.equal(sent[0].url, '/api/oj/ai-assisted/run');
    assert.equal(sent[0].body.task, 'inventory-oversell');
    assert.deepEqual(sent[0].body.files, files);
    assert.match(sent[1].url, /submissions\/s1\?wait=1&after=t1/);
    assert.match(document.querySelector('.ai-round-status').textContent, /Some tests fail/);
    assert.deepEqual([...document.querySelectorAll('.ai-round-counts dd')].map((n) => n.textContent), ['3 / 4', '2 / 11']);
    assert.equal(document.querySelector('.ai-round-failures summary').textContent, 'tests.test_inventory.T.test_oversell');
    assert.match(document.querySelector('.ai-round-output pre').textContent, /debug print/);

    const box = document.getElementById('ai-round-question');
    await typeInto(box, 'Why does test_oversell fail?');
    await act(async () => box.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    await settle();
    const pair = sent.at(-1);
    assert.equal(pair.url, '/api/oj/ai/pair');
    assert.deepEqual(
      { ...pair.body, files: undefined },
      { task: 'inventory-oversell', files: undefined, active: 'src/inventory.py', question: 'Why does test_oversell fail?', history: [], locale: 'en' },
    );
    assert.deepEqual(pair.body.files, files);
    assert.equal(document.querySelector('.ai-round-reply strong').textContent, 'available');
    assert.match(document.body.textContent, /14 left today/);
    assert.equal(box.value, '');
    await typeInto(box, 'And the second bug?');
    await act(async () => box.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    await settle();
    assert.deepEqual(sent.at(-1).body.history.map((t) => t.role), ['user', 'assistant']);
    assert.equal(document.querySelectorAll('.ai-round-turns li').length, 4);
  } finally {
    await act(async () => root.unmount());
  }
});
