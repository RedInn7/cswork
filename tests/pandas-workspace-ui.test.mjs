import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The module stubs of tests/workspace-plus-ui.test.mjs: no Monaco, panels or portals.
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
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function resolve(s,c,n){if(s==='react-resizable-panels')return {url:'mock:panels',shortCircuit:true};return n(s,c);}export async function load(u,c,n){if(u==='mock:panels')return {format:'module',source:mocks.panels,shortCircuit:true};if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/lms-shared.tsx','markdown'],['/components/ui/dialog.tsx','dialog'],['/components/ui/alert-dialog.tsx','alert']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

// A pd- problem opens like a SQL track one: pandas only, no coding modes, playground,
// formatter, debugger or AI tutor; a wrong answer gets the SQL result-set diff.
test('the workspace opens a pandas problem with its starter and the result-set diff', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  localStorage.setItem('cswork:locale', 'en');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const { englishStarters } = await import('../lib/problems.ts');
  const statement = {
    title: 'Employees Without a Valid Manager (Pandas)',
    description: 'Find them.\n\n```python\ndef solve(tables): ...\n```',
    input: 'Tables as DataFrames.',
    output: 'Return a DataFrame.',
    explanation: '',
    hints: [],
  };
  const dataset = 'CREATE TABLE employees (id INTEGER, name TEXT);\n';
  const problem = {
    id: 'pd-01',
    courseId: 'gomall',
    lessonId: '00-overview',
    ...statement,
    difficulty: '简单',
    tags: ['Pandas'],
    sampleIn: dataset,
    sampleOut: 'columns: 2\n',
    languages: ['pandas'],
    translations: { en: statement },
    judgeAvailable: true,
    freeJudge: true,
  };
  const posts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.endsWith('/submissions') && init.method === 'POST') {
      posts.push(body);
      return Response.json({
        id: 's1',
        problem_id: 'pd-01',
        language: 'pandas',
        mode: body.mode,
        status: 'wrong_answer',
        passed: 0,
        total: 1,
        created_at: Date.now(),
        cases: [
          { ordinal: 0, status: 'wrong_answer', hidden: false, stdin: dataset, expected: 'columns: 2\n[1, "Ava"]\n[8, "Hugo"]\n', stdout: 'columns: 2\n[1, "Ava"]\n' },
        ],
      });
    }
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null, votes: { up: 0, down: 0 }, vote: null });
    if (url.includes('/oj/posts?')) return Response.json({ solved: false, items: [], more: false });
    if (url.includes('/oj/marks')) return Response.json({ items: [] });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: { pandas: 'pandas 2.2.3' } });
    if (url.includes('/oj/ai/usage')) return Response.json({});
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  const $ = (selector) => document.querySelector(selector);
  const byText = (text, scope = document) => [...scope.querySelectorAll('button')].find((n) => n.textContent.includes(text));
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'pd-01', title: statement.title, titleEn: statement.title, difficulty: '简单', tags: [], lessonId: '00-overview', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'student', verified: true }, courses: [], services: { ai: true, judge: true } },
          navigate() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.equal($('[aria-label="test editor"]').value, englishStarters.pandas);
    const language = $('[aria-label="Programming language"]');
    assert.deepEqual([...language.options].map((o) => o.value), ['pandas']);
    assert.match(language.options[0].textContent, /^Pandas \(Python\)/);
    assert.ok(document.body.textContent.includes('Pandas · solve(tables) returns a DataFrame'));
    for (const label of ['Submission mode', 'Open in Playground', 'Use an input template'])
      assert.equal(!!$(`[aria-label="${label}"]`), false, label);
    assert.equal(!!byText('Format'), false);
    assert.equal(!!$('.cs-ai-tutor-actions'), false);

    await act(async () => byText('Submit', $('.cs-code-caption')).click());
    await settle();
    assert.equal(posts.at(-1).language, 'pandas');
    assert.match($('.cs-sql-diff figcaption').textContent, /Expected 2 rows, got 1: 1 missing/);
    assert.equal(!!byText('Why did it fail?'), false);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
