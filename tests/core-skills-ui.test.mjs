import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The same module stubs as tests/workspace-cases-ui.test.mjs: no Monaco, panels or portals; CSS (modules too) is empty.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
  markdown: prefix + `export function LessonMarkdown({children,body}){return React.createElement('div',null,body||children);}`,
  panels:
    prefix +
    `export const Group=({children})=>React.createElement('div',null,children);export const Panel=Group;export const Separator=()=>null;export const useDefaultLayout=()=>({});export const usePanelRef=()=>React.useRef({expand(){},collapse(){},isCollapsed(){return false;}});`,
  dialog:
    prefix +
    `export const Dialog=({open,children})=>open?React.createElement('div',{role:'dialog'},children):null;export const DialogContent=({children})=>React.createElement('div',null,children);export const DialogDescription=DialogContent;export const DialogHeader=DialogContent;export const DialogTitle=DialogContent;`,
  alert:
    prefix +
    `export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;export const AlertDialogContent=({children})=>React.createElement('div',null,children);export const AlertDialogDescription=AlertDialogContent;export const AlertDialogHeader=AlertDialogContent;export const AlertDialogFooter=AlertDialogContent;export const AlertDialogTitle=AlertDialogContent;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function resolve(s,c,n){if(s==='react-resizable-panels')return {url:'mock:panels',shortCircuit:true};return n(s,c);}export async function load(u,c,n){if(u==='mock:panels')return {format:'module',source:mocks.panels,shortCircuit:true};if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/lms-shared.tsx','markdown'],['/components/ui/dialog.tsx','dialog'],['/components/ui/alert-dialog.tsx','alert']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
const click = async (node) => {
  assert.ok(node);
  await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await settle();
};

// The bank's Core Skills section: the SQL track's grouped list over the Core Skills manifest.
test('Core Skills lists published problems by group and opens them in track order', async () => {
  const { AlgorithmLibrary } = await import('../components/algorithm-library.tsx');
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  const published = ['core-dynamic-array', 'core-deque', 'core-dijkstra', 'core-fenwick-tree', 'sql-01'];
  try {
    await act(async () =>
      root.render(
        createElement(AlgorithmLibrary, {
          navigate: (...args) => navigations.push(args),
          availableProblemIds: published,
          collection: 'core',
          activity: [{ problem_id: 'core-dynamic-array', created_at: 1 }],
          signedIn: true,
        }),
      ),
    );
    const pressed = [...document.querySelectorAll('.algorithm-library-switch button')].find(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    assert.match(pressed.textContent, /Core Skills/);
    assert.match(document.querySelector('.classic-board h1').textContent, /Data Structures & Algorithms by Hand/);
    const headings = [...document.querySelectorAll('.classic-group h2')].map((h) => h.textContent.replace(/\d.*$/, ''));
    assert.deepEqual(headings, ['Linear structures', 'Graphs', 'Advanced structures']);
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 4);
    // Numbers follow the whole track, published or not: the deque is 3rd, the Fenwick tree 21st.
    assert.match(rows[1].textContent, /3\. Double-Ended Queue/);
    assert.match(rows[3].textContent, /21\. Fenwick Tree/);
    assert.equal(document.querySelector('progress').getAttribute('value'), '1');
    assert.ok(document.querySelector('a.study-row[data-next]').getAttribute('href').endsWith('core-deque'));
    await click([...document.querySelectorAll('button')].find((b) => b.textContent === 'Start next problem'));
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'core-deque' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-library'), 'core');
    assert.equal(
      sessionStorage.getItem('cswork:problem-sequence'),
      '["core-dynamic-array","core-deque","core-dijkstra","core-fenwick-tree"]',
    );
  } finally {
    await act(async () => root.unmount());
  }
});

// The workspace opens a package's own starters, per language, and resets to them.
test('a problem with its own starters opens, switches and resets to them', async () => {
  const [pkg] = JSON.parse(readFileSync('content/core-skills/packages.json', 'utf8'));
  const { starters } = pkg.problem;
  const problem = {
    ...pkg.problem,
    sampleIn: pkg.cases[0].input,
    sampleOut: pkg.cases[0].expectedOutput,
    samples: [{ name: '样例 1', input: pkg.cases[0].input, expectedOutput: pkg.cases[0].expectedOutput }],
    codingModes: ['acm'],
    freeJudge: true,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    return Response.json(problem);
  };
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const root = createRoot(document.getElementById('root'));
  const editor = () => document.querySelector('[aria-label="test editor"]');
  const select = async (label, value) => {
    const node = document.querySelector(`select[aria-label="${label}"]`);
    await act(async () => {
      node.value = value;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: pkg.problem.id, title: pkg.problem.title, difficulty: '简单', tags: [], courseId: 'gomall' },
          boot: { person: { id: 'learner', role: 'student' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.equal(editor().value, starters.python);
    // The fixed driver reads the input, so the generic input templates are not offered.
    assert.equal(document.querySelector('.cs-io-templates'), null);
    // The statement is Markdown: the method table renders as a table.
    assert.ok(document.querySelector('table'));
    await select('Programming language', 'go');
    assert.equal(editor().value, starters.go);
    // Edited code is a draft; the reset puts this problem's starter back, not the generic template.
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(editor(), 'package main');
      editor().dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(editor().value, 'package main');
    await click(document.querySelector('[aria-label="Reset to template"]'));
    await click([...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === 'Replace'));
    assert.equal(editor().value, starters.go);
    // An untouched starter is still a starter: switching away and back keeps it.
    await select('Programming language', 'java');
    assert.equal(editor().value, starters.java);
    await select('Programming language', 'go');
    assert.equal(editor().value, starters.go);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});

test.after(() => {
  dom.window.close();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
