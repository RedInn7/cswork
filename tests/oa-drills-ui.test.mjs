import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// tests/workspace-cases-ui.test.mjs's stubs: a textarea editor, flat panels, plain dialogs.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
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

const BUG = 'def solve(raw):\n    n = int(raw)\n    return n - 1\n\nprint(solve(input()))\n';
const settle = (ms = 20) => act(async () => new Promise((r) => setTimeout(r, ms)));

function dom() {
  const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' }).window;
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return window;
}

test('a fix drill opens on the buggy program with its own local draft, counts edits and submits as mode drill', async () => {
  const window = dom();
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'Minus one', description: 'n-1.', input: 'n.', output: 'n-1.', explanation: '', hints: [] };
  const problem = {
    id: 'oa-x-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: [],
    sampleIn: '3\n',
    sampleOut: '2\n',
    languages: ['python', 'cpp'],
    translations: { en: statement },
    codingModes: ['acm'],
  };
  const posts = [];
  const cloud = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.includes('/cloud/drafts')) {
      cloud.push(url);
      return Response.json({ draft: null });
    }
    if (url.endsWith('/oa-library/oa-x-1/drill')) return Response.json({ items: [{ n: 3, code: BUG, budget: 2 }] });
    if (url.endsWith('/oa-library/oa-x-1')) return Response.json({ id: 'oa-x-1', companySlug: 'x', companyName: 'X Corp' });
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      return Response.json({
        id: `d${posts.length}`,
        problem_id: 'oa-x-1',
        language: 'python',
        codingMode: 'acm',
        // The server shows a drill's run as a run.
        mode: body.mode === 'drill-run' ? 'run' : body.mode,
        code: body.code,
        status: 'accepted',
        passed: 2,
        total: 2,
        created_at: Date.now(),
        cases: [{ ordinal: 0, status: 'accepted', hidden: true }],
      });
    }
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null });
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const editor = () => document.querySelector('[aria-label="test editor"]');
  const banner = () => document.querySelector('.cs-draft-restored').textContent;
  const type = (value) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(editor(), value);
      editor().dispatchEvent(new window.Event('input', { bubbles: true }));
    });
  const submit = () => act(async () => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === 'Submit').click());
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'oa-x-1', title: 'Minus one', titleEn: 'Minus one', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
          drill: '3',
        }),
      ),
    );
    await settle();
    await settle();
    assert.equal(editor().value, BUG);
    assert.match(banner(), /Debugging drill: .*at most 2 lines\. Changed so far: 0\./);
    // Too many lines changed: the tests pass, the drill does not.
    await type('import sys\nprint(int(sys.stdin.read()) - 1)\n');
    assert.match(banner(), /over the limit/);
    await submit();
    await settle();
    assert.equal(posts[0].mode, 'drill');
    assert.match(banner(), /Every test passes, but you changed 5 lines, over the 2-line limit/);
    await type(BUG.replace('n - 1', 'n-1 if n else 0'));
    assert.match(banner(), /Changed so far: 1\./);
    await submit();
    await settle();
    assert.equal(posts[1].mode, 'drill');
    assert.match(banner(), /Fixed: every test passes and you changed 1 line\./);
    assert.ok(JSON.parse(localStorage.getItem('cswork:drills:v1'))['oa-x-1:3'].fix);
    // Its draft is its own, in this browser only: the problem's own draft and the server are untouched.
    await act(async () => window.dispatchEvent(new window.Event('pagehide')));
    assert.equal(JSON.parse(localStorage.getItem('cswork:editor:draft:student:oa-x-1:drill:3:python')).code, editor().value);
    assert.equal(localStorage.getItem('cswork:editor:draft:student:oa-x-1:python'), null);
    assert.deepEqual(cloud, []);
    // Reset puts the planted bug back after a confirm.
    await act(async () => [...document.querySelectorAll('button')].find((n) => n.textContent === 'Reset code').click());
    await act(async () => [...document.querySelectorAll('button')].find((n) => n.textContent === 'Replace').click());
    assert.equal(editor().value, BUG);
    // A run in a drill is a drill run: kept out of the history and the AI tutor.
    await act(async () => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === 'Run').click());
    await settle();
    assert.equal(posts[2].mode, 'drill-run');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('the code-review drill scores flagged lines, reveals the bug and records a clean review', async () => {
  const window = dom();
  const { createRoot } = await import('react-dom/client');
  const { CodeReviewDrill, DrillDone } = await import('../components/code-review-drill.tsx');
  const reviews = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/oa-library/oa-x-1/drill')) return Response.json({ items: [{ n: 3, code: BUG, budget: 2 }] });
    if (url.endsWith('/oa-library/oa-x-1/review')) {
      const { n, lines } = JSON.parse(init.body);
      reviews.push({ n, lines });
      return Response.json({
        hits: lines.filter((l) => l === 3),
        missed: lines.includes(3) ? [] : [3],
        falsePositives: lines.filter((l) => l !== 3),
        bugLines: [3],
        nameZh: '多减了一',
        nameEn: 'Off by one',
      });
    }
    throw new Error(url);
  };
  const root = createRoot(document.getElementById('root'));
  const line = (n) => document.querySelector(`.oa-review-code li:nth-child(${n})`);
  const press = (node) => act(async () => node.click());
  const byText = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.startsWith(text));
  try {
    await act(async () => root.render(createElement(CodeReviewDrill, { id: 'oa-x-1', drills: [3], first: 3, zh: false })));
    await settle();
    assert.equal(document.querySelectorAll('.oa-review-code li').length, 5);
    assert.equal(line(3).querySelector('button').getAttribute('aria-label'), 'Line 3: return n - 1');
    assert.equal(byText('Submit').getAttribute('aria-disabled'), 'true');
    await press(line(2).querySelector('button'));
    await press(line(3).querySelector('button'));
    assert.equal(line(3).querySelector('button').getAttribute('aria-pressed'), 'true');
    assert.ok(line(3).querySelector('input'), 'a flagged line takes a note');
    const submitButton = byText('Submit (2 flagged)');
    await press(submitButton);
    await settle();
    assert.deepEqual(reviews[0], { n: 3, lines: [2, 3] });
    assert.equal(line(3).dataset.state, 'hit');
    assert.equal(line(2).dataset.state, 'false');
    assert.match(document.querySelector('.oa-review-score').textContent, /Found 1 of 1 faulty lines, 1 flagged by mistake\. The planted bug: Off by one/);
    // The Submit button's node becomes "Review again" (React reuses it), so a focused Submit keeps focus.
    assert.ok(submitButton === byText('Review again') && submitButton.isConnected);
    assert.equal(localStorage.getItem('cswork:drills:v1'), null, 'a false flag is no clean review');
    await press(byText('Review again'));
    await press(line(3).querySelector('button'));
    await press(byText('Submit'));
    await settle();
    assert.ok(JSON.parse(localStorage.getItem('cswork:drills:v1'))['oa-x-1:3'].review);
    await act(async () => root.render(createElement(DrillDone, { id: 'oa-x-1', drills: [3, 5], zh: true })));
    assert.equal(document.querySelector('.oa-drills-done').textContent, '已完成 1/2');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('the review score stays a live region while empty, so its first result is announced', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../app/oa-drills.css', import.meta.url), 'utf8');
  for (const [, body] of css.matchAll(/\.oa-review-score:empty\s*\{([^}]*)\}/g)) assert.doesNotMatch(body, /display:\s*none|visibility:\s*hidden/);
});
