import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The same module stubs as tests/leetcode-workspace-ui.test.mjs: no Monaco, panels or portals.
const react = pathToFileURL(
  createRequire(import.meta.url).resolve('react'),
).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
  markdown:
    prefix +
    `export function LessonMarkdown({children,body}){return React.createElement('div',null,body||children);}`,
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
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function resolve(s,c,n){if(s==='react-resizable-panels')return {url:'mock:panels',shortCircuit:true};return n(s,c);}export async function load(u,c,n){if(u==='mock:panels')return {format:'module',source:mocks.panels,shortCircuit:true};if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/lms-shared.tsx','markdown'],['/components/ui/dialog.tsx','dialog'],['/components/ui/alert-dialog.tsx','alert']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

test('custom cases, the remembered topics toggle and AC standing', async () => {
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
    'MouseEvent',
    'localStorage',
    'sessionStorage',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } =
    await import('../components/problem-workspace.tsx');
  const statement = {
    title: 'A+B',
    description: 'Add.',
    input: 'Two numbers.',
    output: 'Their sum.',
    explanation: '',
    hints: [],
  };
  const problem = {
    id: 'acm-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: ['灵神题单', '数学'],
    sampleIn: '1 2\n',
    sampleOut: '3\n',
    languages: ['python'],
    translations: { en: statement },
    codingModes: ['acm'],
    companies: [
      { slug: 'amazon', name: 'Amazon', rounds: ['Onsite'], oa: false, count: 1, last: '2026-09-14' },
    ],
  };
  const posts = [];
  const statsUrls = [];
  let verdict = 'run';
  // The first statement load waits until the test releases it.
  let release;
  let held = new Promise((r) => (release = r));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      const base = {
        id: `r${posts.length}`,
        problem_id: 'acm-1',
        language: 'python',
        codingMode: 'acm',
        mode: body.mode,
        passed: 0,
        total: 1,
        created_at: Date.now(),
      };
      // Rich receipts: the POST answers with the finished result.
      if (verdict === 'run')
        return Response.json({
          ...base,
          status: 'finished',
          cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: body.stdin, stdout: '3\n' }],
        });
      if (verdict === 'wrong')
        return Response.json({
          ...base,
          status: 'wrong_answer',
          cases: [{ ordinal: 0, status: 'wrong_answer', hidden: true }],
          firstFailure: {
            ordinal: 0,
            status: 'wrong_answer',
            stdin: '40 2\n',
            expected: '42\n',
            stdout: '0\n',
            stderr: '',
            truncated: {},
          },
        });
      return Response.json({
        ...base,
        status: 'accepted',
        passed: 1,
        runtimeMs: 25.4,
        cases: [{ ordinal: 0, status: 'accepted', hidden: true }],
      });
    }
    if (url.includes('/problem-stats/')) {
      statsUrls.push(url);
      return Response.json({ acceptance: { attempted: 40, accepted: 30 }, beats: 87 });
    }
    if (url.includes('/submissions'))
      return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status'))
      return Response.json({ available: true, languageVersions: {} });
    if (held) {
      await held;
      held = null;
    }
    return Response.json(problem);
  };
  let root = createRoot(document.getElementById('root'));
  const mount = async () => {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'acm-1', title: 'A+B', titleEn: 'A+B', difficulty: '简单', tags: problem.tags, lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
  };
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (n) => n.textContent.trim() === text,
    );
  const labelled = (label) => document.querySelector(`[aria-label="${label}"]`);
  const click = async (node) => {
    assert.equal(!!node, true);
    await act(async () => node.click());
    await settle();
  };
  const tabs = () =>
    [...document.querySelectorAll('[aria-label="Custom cases"] [role="tab"]')].map(
      (n) => `${n.textContent}${n.getAttribute('aria-selected') === 'true' ? '*' : ''}`,
    );
  const input = () => document.getElementById('custom-case-input');
  const typeInto = async (node, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    ).set;
    await act(async () => {
      setter.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const type = (value) => typeInto(input(), value);
  const stored = () =>
    JSON.parse(localStorage.getItem('cswork:cases:student:acm-1') || 'null');
  const settingsKey = 'cswork:editor:settings:student';
  localStorage.setItem(settingsKey, JSON.stringify({ fontSize: 16, keymap: 'vim' }));
  try {
    await mount();
    // Topics: hidden by default; the toggle is remembered, and a click while the
    // statement still loads keeps the other saved editor settings.
    assert.equal(document.querySelector('#problem-topics') === null, true);
    await click(button('Topics'));
    assert.equal(document.querySelector('#problem-topics').textContent, '数学');
    const saved = JSON.parse(localStorage.getItem(settingsKey));
    assert.equal(saved.hideTags === false && saved.fontSize === 16 && saved.keymap === 'vim', true);
    release();
    await settle();
    // Loaded: company tags shown, topics still shown.
    assert.equal(document.querySelector('.cs-company-tags') !== null, true);
    assert.equal(document.querySelector('#problem-topics') !== null, true);

    // One blank case to start; type, copy the example into case 2, run case 2.
    await click(button('Custom input'));
    assert.deepEqual(tabs(), ['Case 1*']);
    await type('5 6\n');
    assert.deepEqual(stored(), ['5 6\n']);
    await click(button('Copy example'));
    assert.deepEqual(tabs(), ['Case 1', 'Case 2*']);
    assert.equal(input().value, '1 2\n');
    await click(button('Run'));
    assert.equal(posts.at(-1).stdin, '1 2\n');
    assert.match(document.querySelector('.cs-result-subtitle').textContent, /Test run · Custom case 2/);

    // Cases survive a remount; Run sends only the selected one.
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await mount();
    assert.equal(document.querySelector('#problem-topics') !== null, true, 'topics stay shown');
    await click(button('Custom input'));
    assert.deepEqual(tabs(), ['Case 1*', 'Case 2']);
    assert.equal(input().value, '5 6\n');
    await click(button('Run'));
    assert.equal(posts.at(-1).stdin, '5 6\n');

    // An expected output of your own: a run marks its case ✓ or ✗ (the run prints 3).
    const expectBox = () => document.querySelector('.cs-custom-expect textarea');
    const caseTab = (n) => document.querySelectorAll('[aria-label="Custom cases"] [role="tab"]')[n];
    await click(button('Test cases'));
    await typeInto(expectBox(), '11');
    await click(button('Run'));
    assert.match(document.body.textContent, /Expected output \(yours\)/);
    assert.match(document.body.textContent, /✗ Does not match your expected output\./);
    await click(button('Test cases'));
    assert.deepEqual(tabs(), ['Case 1✗, not as expected*', 'Case 2']);
    assert.deepEqual(stored(), ['5 6\n', '1 2\n'], 'the cases keep their format');
    assert.deepEqual(JSON.parse(localStorage.getItem('cswork:cases:student:acm-1:expect')), ['11', '']);
    await click(caseTab(1));
    assert.equal(expectBox().value, '');
    await typeInto(expectBox(), '3\n');
    await click(button('Run'));
    assert.match(document.body.textContent, /✓ Matches your expected output\./);
    await click(button('Test cases'));
    assert.deepEqual(tabs(), ['Case 1✗, not as expected', 'Case 2✓, as expected*']);
    // Editing a case clears its mark; clearing the expected output removes it from storage.
    await type('1 3\n');
    assert.deepEqual(tabs(), ['Case 1✗, not as expected', 'Case 2*']);
    await typeInto(expectBox(), '');
    await click(caseTab(0));
    await typeInto(expectBox(), '');
    assert.deepEqual(tabs(), ['Case 1*', 'Case 2']);
    assert.equal(localStorage.getItem('cswork:cases:student:acm-1:expect'), null);

    // A failing case joins as a new case; at 5 cases + stops and the next one asks for room.
    verdict = 'wrong';
    await click(button('Submit'));
    await click(button('Add as a custom case'));
    assert.deepEqual(tabs(), ['Case 1', 'Case 2', 'Case 3*']);
    assert.equal(input().value, '40 2\n');
    await click(labelled('Add a case'));
    await click(labelled('Add a case'));
    assert.deepEqual(tabs(), ['Case 1', 'Case 2', 'Case 3', 'Case 4*'], 'one blank case at a time');
    await type('7 7\n');
    await click(labelled('Add a case'));
    assert.equal(tabs().length, 5);
    assert.equal(labelled('Add a case').disabled, true);
    await click(labelled('Delete case 5'));
    assert.deepEqual(tabs(), ['Case 1', 'Case 2', 'Case 3', 'Case 4*']);
    assert.equal(stored().length, 4);

    // AC: aggregate standing for this language and runtime, from the server.
    verdict = 'accepted';
    await click(button('Submit'));
    const banner = document.querySelector('.cs-accepted-banner').textContent;
    assert.match(banner, /30 of 40 people solved it \(75%\)/);
    assert.match(banner, /Faster than 87% of people who solved it in Python 3/);
    // Unrounded, so sub-ms differences are compared on the server.
    assert.match(statsUrls.at(-1), /problem-stats\/acm-1\?language=python&runtimeMs=25\.4$/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('single-submit mock OA: one confirmed submission per question, its verdict sealed until the hand-in', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'A+B', description: 'Add.', input: 'Two numbers.', output: 'Their sum.', explanation: '', hints: [] };
  const problem = { id: 'acm-1', courseId: 'gomall', lessonId: 'lesson', ...statement, difficulty: '简单', tags: [], sampleIn: '1 2\n', sampleOut: '3\n', languages: ['python'], translations: { en: statement }, codingModes: ['acm'] };
  const start = Date.now() - 60_000;
  const session = { id: 's1', company: null, name: null, platform: null, preset: false, scoring: 'codility', source: 'mixed', slots: ['medium', 'hard'], ids: ['acm-1', 'lc-2'], minutes: 120, skew: 0, createdAt: start, startedAt: start };
  localStorage.setItem('cswork:mock:v1:student', JSON.stringify({ active: session, history: [] }));
  const posts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      return Response.json({
        id: `j${posts.length}`, problem_id: 'acm-1', language: 'python', codingMode: 'acm', mode: body.mode, created_at: Date.now(),
        status: 'accepted', passed: 1, total: 1, runtimeMs: 12, cases: [{ ordinal: 0, status: 'accepted', hidden: true }],
      });
    }
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    return Response.json(problem);
  };
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
  const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
  let root = createRoot(document.getElementById('root'));
  const mount = async (submissions = []) => {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'acm-1', title: 'A+B', titleEn: 'A+B', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher' }, courses: [], problems: [], submissions },
          mock: 's1',
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
  };
  try {
    await mount();
    assert.match(document.querySelector('.mock-exam-bar').textContent, /Custom mock/);
    // Submit asks first; keeping on checking sends nothing.
    await act(async () => button('Submit').click());
    assert.match(document.querySelector('[role="alertdialog"]').textContent, /Submit your final answer\?.*can't submit this question again/);
    await act(async () => button('Keep checking').click());
    assert.equal(posts.length, 0);
    await act(async () => button('Submit').click());
    await act(async () => button('Submit final answer').click());
    await settle();
    assert.equal(document.querySelector('[role="alertdialog"]'), null, 'the dialog closes');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].mode, 'judge');
    const result = document.querySelector('.cs-result-content').textContent;
    assert.match(result, /Submitted/);
    assert.match(result, /Results come after you hand in/);
    assert.doesNotMatch(result, /Accepted|passed|test case/i);
    assert.equal(document.querySelector('.cs-accepted-banner'), null, 'no AC modal');
    assert.equal(button('Final answer in').disabled, true);
    // Reopened later: the exam's judge row alone keeps it locked; a judge failure does not.
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await mount([{ id: 'j1', problem_id: 'acm-1', language: 'python', status: 'accepted', passed: 1, total: 1, created_at: Date.now() }]);
    assert.equal(button('Final answer in').disabled, true);
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await mount([{ id: 'j2', problem_id: 'acm-1', language: 'python', status: 'system_error', passed: 0, total: 1, created_at: Date.now() }]);
    assert.equal(button('Final answer in'), undefined);
    assert.ok(button('Submit'));
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
