import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The module stubs of tests/workspace-cases-ui.test.mjs: no Monaco, panels or portals.
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

test('workspace extras: meta line, votes, share, maximize, shuffle, AI thread and cases, AC chart', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const copied = [];
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => void copied.push(text) },
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'A+B', description: 'Add.', input: 'Two numbers.', output: 'Their sum.', explanation: '', hints: [] };
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
  };
  const calls = [];
  let verdict = 'wrong';
  let draws = ['lc-1', 'lc-9'];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method, body });
    if (url.endsWith('/submissions') && init.method === 'POST') {
      const base = { id: `s${calls.length}`, problem_id: 'lc-1', language: 'python', codingMode: 'acm', mode: body.mode, total: 1, created_at: Date.now() };
      return verdict === 'wrong'
        ? Response.json({ ...base, status: 'wrong_answer', passed: 0, cases: [{ ordinal: 0, status: 'wrong_answer', hidden: true }] })
        : Response.json({ ...base, status: 'accepted', passed: 1, runtimeMs: 25.4, memoryKb: 15000, cases: [{ ordinal: 0, status: 'accepted', hidden: true }] });
    }
    if (url.includes('/problem-stats/'))
      return Response.json({
        acceptance: { attempted: 40, accepted: 30 },
        beats: 87,
        beatsMemory: 40,
        votes: { up: 3, down: 1 },
        vote: null,
        histogram: {
          runtime: { edges: [10, 20, 30, 40], counts: [10, 20, 5] },
          memory: { edges: [10000, 14000, 18000], counts: [12, 23] },
        },
      });
    if (url.includes('/oj/library?')) return Response.json({ random: draws.shift() ?? null, sequence: ['lc-9', 'lc-10'] });
    if (url.endsWith('/oj/ai/usage')) return Response.json({ hint: 10, review: 5, chat: 20, tests: 5, debug: 5, complexity: 10, explain: 20 });
    if (url.endsWith('/oj/ai/chat'))
      return Response.json({ kind: 'chat', text: `Answer ${body.history.length / 2 + 1}`, remaining: 19, limit: 20 });
    if (url.endsWith('/oj/ai/tests'))
      return Response.json({ kind: 'tests', cases: [{ input: '0 0\n', why: 'Zeros.' }, { input: '-1 1\n', why: 'Negatives.' }], remaining: 4, limit: 5 });
    if (url.endsWith('/oj/ai/complexity'))
      return Response.json({ kind: 'complexity', text: '**Time** O(1).', remaining: 9, limit: 10 });
    if (url.includes('/oj/posts?')) return Response.json({ solved: true, items: [], more: false });
    if (url.includes('/oj/marks')) return Response.json(init.method === 'POST' ? body : { items: [] });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    return Response.json(problem);
  };
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  const $ = (selector) => document.querySelector(selector);
  const labelled = (label) => $(`[aria-label="${label}"]`);
  const byText = (text, scope = document) => [...scope.querySelectorAll('button')].find((n) => n.textContent.includes(text));
  const click = async (node) => {
    assert.equal(!!node, true);
    await act(async () => node.click());
    await settle();
  };
  const type = async (node, value) => {
    const proto = node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const posted = (suffix) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(suffix));
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'lc-1', title: 'A+B', titleEn: 'A+B', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher', verified: true }, courses: [], services: { ai: true, judge: true } },
          navigate: (view, extra) => navigations.push([view, extra]),
          refresh: async () => {},
        }),
      ),
    );
    await settle();

    // Meta line: the site's acceptance rate and votes from problem-stats, without a language.
    assert.equal($('.cs-problem-meta-rate').textContent, '75% acceptance (40 tried)');
    assert.equal(calls.some((c) => c.url === '/api/oj/problem-stats/lc-1'), true);
    assert.equal(!!labelled('Like (3)') && !!labelled('Dislike (1)'), true);
    await click($('[data-vote="up"]'));
    assert.deepEqual(posted('/oj/marks').at(-1).body, { target: 'problem:lc-1', mark: 'up', on: true });
    assert.equal($('[data-vote="up"]').getAttribute('aria-pressed'), 'true');
    assert.equal(!!labelled('Like (4)'), true);
    // Down replaces up: one vote per learner.
    await click($('[data-vote="down"]'));
    assert.deepEqual(posted('/oj/marks').at(-1).body, { target: 'problem:lc-1', mark: 'down', on: true });
    assert.equal(!!labelled('Like (3)') && !!labelled('Dislike (2)'), true);
    assert.equal($('[data-vote="up"]').getAttribute('aria-pressed'), 'false');
    // Share without the Web Share API: the public URL, never this test host.
    await click(labelled('Share this problem'));
    assert.deepEqual(copied, ['https://cswork.org/?view=problem&problem=lc-1']);
    assert.equal($('.cs-problem-meta-note').textContent, 'Link copied');

    // Maximize: a button per title bar, double-click, Esc; the Submit button's double-click doesn't count.
    const body = () => $('.cs-workspace-body').getAttribute('data-maximized');
    await click(labelled('Maximize the code'));
    assert.equal(body(), 'code');
    assert.equal(!!labelled('Restore the panels'), true);
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(body(), null);
    await act(async () => $('.cs-console-header').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    assert.equal(body(), 'console');
    await click(labelled('Restore the panels'));
    assert.equal(body(), null);
    await act(async () => byText('Submit', $('.cs-code-caption')).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    assert.equal(body(), null);
    await click(labelled('Maximize the statement'));
    assert.equal(body(), 'statement');
    await click(labelled('Restore the panels'));

    // Shuffle: the bank's last filters, never this problem, then the problem it drew.
    sessionStorage.setItem('cswork:library-query', 'difficulty=Medium&page=2');
    await click(labelled('Random problem'));
    const draws_ = calls.filter((c) => c.url.includes('/oj/library?'));
    assert.equal(draws_.length, 2, 'the first draw was this problem');
    assert.equal(draws_[0].url, '/api/oj/library?difficulty=Medium&random=1');
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'lc-9' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-sequence'), '["lc-9","lc-10"]');

    // The tutor thread: questions go back with the conversation so far.
    const question = labelled('Ask the AI tutor');
    await type(question, 'Why two loops?');
    await click(labelled('Send question'));
    assert.deepEqual(posted('/oj/ai/chat')[0].body.question, 'Why two loops?');
    assert.deepEqual(posted('/oj/ai/chat')[0].body.history, []);
    assert.equal(question.value, '', 'sent questions clear the box');
    const thread = () => $('.cs-ai-tutor-replies').textContent;
    assert.equal(thread().includes('You asked') && thread().includes('Why two loops?') && thread().includes('Answer 1'), true);
    await type(question, 'And the space?');
    await click(labelled('Send question'));
    assert.deepEqual(posted('/oj/ai/chat')[1].body.history, [
      { role: 'user', text: 'Why two loops?' },
      { role: 'assistant', text: 'Answer 1' },
    ]);
    assert.equal(thread().includes('Answer 2'), true);

    // Edge-case ideas in the console, one click from a custom case.
    await click(byText('Custom input'));
    await click(byText('Suggest edge cases'));
    assert.equal(posted('/oj/ai/tests').length, 1);
    assert.equal([...document.querySelectorAll('.cs-ai-cases-list li')].length, 2);
    await click(byText('Add to my cases', $('.cs-ai-cases-list')));
    assert.equal(document.getElementById('custom-case-input').value, '0 0\n');
    assert.equal(byText('Added', $('.cs-ai-cases-list')).disabled, true);

    // A failed submission offers "why did it fail"; nothing before.
    assert.equal(!!byText('Why did it fail?', $('.cs-ai-tutor-actions')), false);
    await click(byText('Submit', $('.cs-code-caption')));
    assert.equal(!!byText('Why did it fail?', $('.cs-ai-tutor-actions')), true);

    // AC: the runtime chart with this run's bucket lit, memory on the toggle, complexity on request.
    verdict = 'accepted';
    await click(byText('Submit', $('.cs-code-caption')));
    const statsCall = calls.filter((c) => c.url.includes('/problem-stats/lc-1?')).at(-1).url;
    assert.equal(statsCall.endsWith('language=python&runtimeMs=25.4&memoryKb=15000'), true);
    const bars = () => [...document.querySelectorAll('.cs-perf-bars li')];
    assert.equal(bars().length, 3);
    assert.equal(bars().findIndex((li) => li.hasAttribute('data-mine')), 1);
    assert.equal($('.cs-perf-beats').textContent, 'Beats 87%');
    await click(byText('Memory', $('.cs-perf-toggle')));
    assert.equal(bars().length, 2);
    assert.equal(bars().findIndex((li) => li.hasAttribute('data-mine')), 1);
    assert.equal($('.cs-perf-beats').textContent, 'Beats 40%');
    assert.equal(bars()[0].querySelector('button').getAttribute('aria-label').startsWith('9.8 MB – 13.7 MB: 12 people'), true);
    await click(byText('Analyse complexity'));
    assert.equal($('.cs-ai-complexity').textContent.includes('O(1)'), true);
    // A bar opens the solutions in this language, never anyone's code.
    await click(bars()[0].querySelector('button'));
    assert.equal($('[role="dialog"]') === null, true);
    assert.equal(calls.some((c) => c.url.includes('/oj/posts?problem=lc-1&sort=votes&language=python')), true);
    assert.equal(!!labelled('Clear filter: Python only'), true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
