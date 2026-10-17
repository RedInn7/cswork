import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The module stubs of tests/workspace-plus-ui.test.mjs; the editor stub exposes its props.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){globalThis.editorProps=p;return React.createElement('textarea',{'aria-label':'test editor','data-bare':String(!!p.bare),'data-path':p.path,value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
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

test('whiteboard mode: plain editor, no run or help, one submission recorded once judged', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'A+B', description: 'Add.', input: 'Two numbers.', output: 'Their sum.', explanation: '', hints: ['Add them.'] };
  const problem = {
    id: 'lc-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: [],
    sampleIn: '1 2\n',
    sampleOut: '3\n',
    languages: ['python'],
    translations: { en: statement },
    codingModes: ['acm'],
    judgeAvailable: true,
    lingEditorialVerified: true,
    leetcodeParams: [{ name: 'a', type: 'integer' }],
  };
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, body });
    if (url.endsWith('/submissions') && init.method === 'POST')
      return Response.json({
        id: '6f1c2a3b-0000-4000-8000-000000000001',
        problem_id: 'lc-1',
        language: 'python',
        codingMode: 'acm',
        mode: body.mode,
        total: 1,
        created_at: Date.now(),
        status: 'wrong_answer',
        passed: 0,
        cases: [{ ordinal: 0, status: 'wrong_answer', hidden: true }],
      });
    if (url.includes('/aids')) return Response.json({ recorded: true });
    if (url.includes('/oj/notes'))
      return Response.json(init.method === 'PUT' ? { ...body, updatedAt: 1 } : { body: '', updatedAt: null });
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: { attempted: 0, accepted: 0 }, votes: { up: 0, down: 0 }, vote: null });
    if (url.endsWith('/oj/ai/usage')) return Response.json({ hint: 10, review: 5, chat: 20, tests: 5, debug: 5, complexity: 10, explain: 20 });
    if (url.includes('/oj/marks')) return Response.json({ items: [] });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = (ms = 10) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
  const $ = (selector) => document.querySelector(selector);
  const labelled = (label) => $(`[aria-label="${label}"]`);
  const byText = (text, scope = document) => [...scope.querySelectorAll('button')].find((n) => n.textContent.includes(text));
  const click = async (node) => {
    assert.equal(!!node, true);
    await act(async () => node.click());
    await settle();
  };
  const run = () => byText('Run', $('.cs-code-caption'));
  const editor = () => labelled('test editor');
  const type = async (node, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'lc-1', title: 'A+B', titleEn: 'A+B', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher', verified: true }, courses: [], services: { ai: true, judge: true } },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    // Before: running, the editorial tab, hints, the AI tutor and custom input are all there.
    assert.equal(run().hidden, false);
    assert.equal(!!byText('Editorial'), true);
    assert.equal(!!byText('Hint'), true);
    assert.equal(!!labelled('Ask the AI tutor'), true);
    assert.equal(!!byText('Custom input'), true);
    assert.equal(!!$('.cs-clarify'), true);
    assert.equal(editor().dataset.bare, 'false');
    // A draft written (and run) with the usual help: no whiteboard attempt.
    const template = editor().value;
    const draft = 'print(sum(map(int, input().split())))\n';
    await type(editor(), draft);

    // Entering asks first; cancelling changes nothing.
    await click(labelled('Whiteboard mode'));
    assert.match($('[role="alertdialog"]').textContent, /one submission/);
    assert.match($('[role="alertdialog"]').textContent, /starts over from this language's template/);
    await click(byText('Cancel', $('[role="alertdialog"]')));
    assert.equal(editor().dataset.bare, 'false');
    assert.equal(editor().value, draft);

    // Leaving without submitting offers the draft back.
    await click(labelled('Whiteboard mode'));
    await click(byText('Start', $('[role="alertdialog"]')));
    assert.equal(editor().value, template, 'the mode starts from the template');
    assert.equal(labelled('Programming language').disabled, true, "another language's draft can't come in");
    await type(editor(), 'abandoned');
    await click(labelled('Whiteboard mode'));
    assert.equal(labelled('Programming language').disabled, false);
    assert.match(document.body.textContent, /Whiteboard mode is off/);
    await click(byText('Restore the code from before'));
    await click(byText('Replace', $('[role="alertdialog"]')));
    assert.equal(editor().value, draft);
    assert.equal(!!byText('Restore the code from before'), false);

    await click(labelled('Whiteboard mode'));
    await click(byText('Start', $('[role="alertdialog"]')));
    assert.equal(editor().value, template);

    assert.equal(labelled('Whiteboard mode').getAttribute('aria-pressed'), 'true');
    assert.equal(editor().dataset.bare, 'true');
    assert.equal(editor().dataset.path.endsWith('/solution.py/wb'), true, 'a model of its own');
    assert.equal(run().hidden, true);
    assert.equal(byText('Autocomplete').hidden, true);
    assert.equal(!!byText('Editorial'), false);
    assert.equal(!!byText('Hint'), false);
    assert.equal(!!labelled('Ask the AI tutor'), false);
    assert.equal(!!byText('Custom input'), false, 'custom cases and the stress test are gone');
    assert.equal($('.cs-clarify'), null, 'so are the edge-case checklist and its add buttons');
    assert.match($('.cs-intelligence-status').textContent, /Whiteboard: plain text/);
    // Ctrl / ⌘ + Enter goes through onRun: nothing is sent.
    await act(async () => globalThis.editorProps.onRun());
    await settle();
    assert.equal(calls.some((c) => c.url.endsWith('/submissions') && c.method === 'POST'), false);

    // The dry-run pad saves to the account as note wb:lc-1.
    const pad = document.getElementById('whiteboard-dry-run');
    assert.equal($('label[for="whiteboard-dry-run"]').textContent, 'Manual dry run');
    await type(pad, 'i=0: seen={}');
    await settle(900);
    const put = calls.find((c) => c.method === 'PUT' && c.url.includes('/oj/notes'));
    assert.equal(decodeURIComponent(put.url.split('target=')[1]), 'wb:lc-1');
    assert.deepEqual(put.body, { body: 'i=0: seen={}' });

    // One submission ends the mode; once judged, the attempt is recorded and the bar shows.
    const written = 'a, b = map(int, input().split())\nprint(a + b)\n';
    await type(editor(), written);
    await click(byText('Submit', $('.cs-code-caption')));
    await settle();
    const sent = calls.filter((c) => c.url.endsWith('/submissions') && c.method === 'POST')[0].body;
    assert.equal(sent.mode, 'judge');
    assert.equal(sent.code, written, 'the code written in the mode');
    assert.equal(editor().dataset.bare, 'false');
    assert.equal(run().hidden, false);
    assert.equal(labelled('Whiteboard mode').getAttribute('aria-pressed'), 'false');
    const aids = calls.filter((c) => c.url === '/api/oj/problems/lc-1/aids');
    assert.deepEqual(aids.map((c) => c.body), [{ kind: 'whiteboard', submissionId: '6f1c2a3b-0000-4000-8000-000000000001' }]);
    assert.match(document.body.textContent, /Whiteboard attempt failed/);
    // The draft from before the mode can still come back.
    assert.equal(!!byText('Restore the code from before'), true);
    // A normal submission afterwards records nothing more.
    await click(byText('Submit', $('.cs-code-caption')));
    await settle();
    assert.equal(calls.filter((c) => c.url === '/api/oj/problems/lc-1/aids').length, 1);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
