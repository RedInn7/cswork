import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

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

function setupDom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
setupDom();

test('a custom case reference output: pending, unavailable, and no line diff where answers vary', async () => {
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const submission = {
    id: 'r1',
    problem_id: 'lc-1',
    language: 'python',
    mode: 'run',
    status: 'finished',
    passed: 0,
    total: 1,
    created_at: 1,
    cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: '[3,3]\n6', stdout: '[1,0]\n', stderr: '' }],
  };
  const root = createRoot(document.getElementById('root'));
  const show = (props) =>
    act(async () => root.render(createElement(SubmissionResult, { submission, ranCase: 1, ...props })));
  try {
    await show({ reference: { status: 'pending' }, checker: 'tokens' });
    assert.match(document.body.textContent, /Working out the expected output/);
    await show({ reference: { status: 'failed' }, checker: 'tokens' });
    assert.match(document.body.textContent, /isn't available/);
    // An int-set checker accepts [1,0] for [0,1]: shown for comparison, never marked.
    await show({ reference: { status: 'done', output: '[0,1]\n' }, checker: 'int-set' });
    assert.match(document.body.textContent, /Expected output \(reference solution\)/);
    assert.match(document.body.textContent, /more than one answer/);
    assert.equal(document.querySelectorAll('.is-diff').length, 0);
    await show({ reference: { status: 'done', output: '[0,1]\n' }, checker: 'exact' });
    assert.equal(document.querySelectorAll('.is-diff').length, 2, 'both sides mark line 1');
    assert.equal(document.querySelectorAll('.cs-line').length, 2, 'the trailing newline adds no blank row');
    assert.match(document.querySelector('.is-diff .sr-only').textContent, /line 1 differs/);
    // No reference prop: the plain custom run, as before.
    await show({ checker: 'exact' });
    assert.doesNotMatch(document.body.textContent, /Expected output/);
  } finally {
    await act(async () => root.unmount());
  }
});

test('LeetCode cases edit per parameter, run with the editorial beside them, and a failed example joins the cases', async () => {
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'Two Sum', description: 'Sum.', input: 'In.', output: 'Out.', explanation: '', hints: [] };
  const problem = {
    id: 'lc-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: [],
    sampleIn: '4\n2 7 11 15\n9\n',
    sampleOut: '2\n0 1\n',
    samples: [{ name: '样例 1', input: '4\n2 7 11 15\n9\n', expectedOutput: '2\n0 1\n' }],
    languages: ['python'],
    translations: { en: statement },
    codingModes: ['leetcode', 'acm'],
    leetcodeTemplates: { python: 'class Solution:\n    pass\n' },
    leetcodeParams: [
      { name: 'nums', type: 'integer[]' },
      { name: 'target', type: 'integer' },
    ],
    leetcodeConstraints: { nums: { len: [2, 10000] } },
    lingEditorialVerified: true,
    checker: 'tokens',
  };
  const posts = [];
  const expectedPosts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/problems/lc-1/expected')) {
      expectedPosts.push(JSON.parse(init.body));
      return Response.json({
        id: 'ref-1',
        status: 'queued',
        watchToken: 'queued:0',
        cases: [],
      });
    }
    // A plain poll, not a long poll: those slots belong to the learner's own run watch.
    if (url.includes('/submissions/ref-1?')) throw new Error('reference took a long-poll slot');
    if (url.endsWith('/submissions/ref-1'))
      return Response.json({ id: 'ref-1', status: 'finished', cases: [{ ordinal: 0, status: 'finished', stdout: '[0, 1]\n' }] });
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      const base = { id: `s${posts.length}`, problem_id: 'lc-1', language: 'python', codingMode: 'leetcode', mode: 'run', passed: 0, total: 1, created_at: Date.now() };
      return Response.json(
        body.stdin !== undefined
          ? { ...base, status: 'finished', cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: body.stdin, stdout: '[0,1]\n' }] }
          : {
              ...base,
              status: 'wrong_answer',
              cases: [{ ordinal: 0, status: 'wrong_answer', hidden: false, stdin: problem.samples[0].input, expected: '2\n0 1\n', stdout: '2\n1 0\n' }],
            },
      );
    }
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({});
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
  const click = async (node) => {
    assert.ok(node);
    await act(async () => node.click());
    await settle();
  };
  const type = async (node, value) => {
    const proto = node.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const stored = () => JSON.parse(localStorage.getItem('cswork:cases:student:lc-1:leetcode') || 'null');
  // Full screen exists here (not on iPhone Safari): the button follows fullscreenchange.
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null });
  document.documentElement.requestFullscreen = async () => {
    document.fullscreenElement = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'lc-1', title: 'Two Sum', titleEn: 'Two Sum', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher', verified: true }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    const full = document.querySelector('[aria-label="Full screen"]');
    assert.equal(full.getAttribute('aria-pressed'), 'false');
    await click(full);
    assert.equal(full.getAttribute('aria-pressed'), 'true');
    await click(button('Custom input'));
    const fields = () => [...document.querySelectorAll('.cs-case-fields input')];
    assert.deepEqual(
      [...document.querySelectorAll('.cs-case-fields label > span')].map((n) => n.textContent),
      ['nums · integer[]', 'target · integer'],
    );
    await type(fields()[0], '[3,3]');
    await type(fields()[1], '6');
    assert.deepEqual(stored(), ['[3,3]\n6'], 'stored as one JSON value per line, as before');
    await click(button('Raw text'));
    assert.equal(document.getElementById('custom-case-input').value, '[3,3]\n6');
    await type(document.getElementById('custom-case-input'), '[1]\n2\n3');
    await click(button('Raw text'));
    assert.equal(fields().length, 0, "three lines for two parameters stay raw text");
    assert.match(document.body.textContent, /don't match the 2 parameters/);
    await type(document.getElementById('custom-case-input'), '[3,3]\n6');
    assert.equal(fields().length, 2);
    // Hints under the field, never a gate: the type as the judge reads it, then the statement's bounds.
    const issues = () => [...document.querySelectorAll('.cs-field-issue')].map((n) => n.textContent);
    assert.deepEqual(issues(), []);
    await type(fields()[0], '[3]');
    assert.deepEqual(issues(), ["Outside the problem's constraints: nums length 1 < 2"]);
    assert.equal(fields()[0].getAttribute('aria-invalid'), 'true');
    assert.equal(document.getElementById(fields()[0].getAttribute('aria-describedby')).textContent, issues()[0]);
    await type(fields()[1], '6.5');
    assert.deepEqual(issues(), ["Outside the problem's constraints: nums length 1 < 2", 'Expected a value of type integer']);
    await type(fields()[0], '[3,3]');
    await type(fields()[1], '6');
    assert.deepEqual(issues(), []);
    assert.equal(button('Diagram'), undefined, 'no picture for flat arrays and numbers');
    // Run: the learner's run and the editorial's run on the same case.
    await click(button('Run'));
    await act(async () => new Promise((r) => setTimeout(r, 800)));
    assert.deepEqual(posts.at(-1).stdin, '[3,3]\n6');
    assert.equal(expectedPosts.length, 1);
    assert.equal(expectedPosts[0].stdin, '[3,3]\n6');
    assert.equal(expectedPosts[0].codingMode, 'leetcode');
    assert.match(document.body.textContent, /Expected output \(reference solution\)/);
    // tokens checker: "[0,1]" against "[0, 1]" differs on line 1.
    assert.equal(document.querySelectorAll('.is-diff').length, 2);
    // A sample run's failed example joins the custom cases, converted to LeetCode lines.
    await click(button('Test cases'));
    await click(button('Examples'));
    await click(button('Run'));
    await settle();
    assert.equal(expectedPosts.length, 1, 'example runs need no reference');
    assert.deepEqual(stored(), ['[3,3]\n6', '[2,7,11,15]\n9']);
    assert.match(document.querySelector('.cs-result-message[role="status"]').textContent, /Added failed example 1/);
    assert.equal(document.querySelectorAll('.is-diff').length, 2, 'the wrong line is marked');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});

test('trees, lists and grids are drawn from a custom case and from printed tree results', async () => {
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const { treeGraph, listGraph, printedValues } = await import('../components/structure-view.tsx');
  // x by in-order rank, y by depth: 1 -> right 2 -> left 3.
  const tree = treeGraph([1, null, 2, 3]);
  assert.deepEqual(
    tree.nodes.map((n) => [n.label, n.x, n.y]),
    [['1', 6, 6], ['2', 26, 19], ['3', 16, 32]],
  );
  assert.deepEqual(tree.edges, [{ from: '0', to: '1' }, { from: '1', to: '2' }]);
  assert.equal(treeGraph([null, 1]), null);
  assert.equal(treeGraph(Array.from({ length: 256 }, (_, i) => i)), null, 'over 255 nodes');
  assert.deepEqual(listGraph([4, 5]).edges, [{ from: '0', to: '1', directed: true }]);
  assert.deepEqual(printedValues('4\n1 null 2 3\n'), [1, null, 2, 3]);
  assert.deepEqual(printedValues('0\n'), []);
  assert.equal(printedValues('5\n'), null, 'an integer result is no tree');
  const submission = {
    id: 't1',
    problem_id: 'lc-226',
    language: 'python',
    codingMode: 'leetcode',
    mode: 'run',
    status: 'finished',
    passed: 0,
    total: 1,
    created_at: 1,
    cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: '[1,null,2,3]\n[[1,0],[0,1]]', stdout: '3\n1 2 3\n', stderr: '' }],
  };
  const params = [
    { name: 'root', type: 'TreeNode' },
    { name: 'grid', type: 'integer[][]' },
  ];
  const root = createRoot(document.getElementById('root'));
  const show = (props) => act(async () => root.render(createElement(SubmissionResult, { submission, ranCase: 1, checker: 'exact', ...props })));
  const captions = () => [...document.querySelectorAll('figcaption')].map((n) => n.textContent);
  try {
    await show({ params, returnType: 'TreeNode', reference: { status: 'done', output: '4\n1 null 2 3\n' } });
    assert.deepEqual(captions(), ['root', 'grid', 'Expected output', 'Your output']);
    const graphs = [...document.querySelectorAll('svg.algorithm-demo-graph')];
    assert.equal(graphs.length, 3);
    assert.equal(graphs[0].getAttribute('aria-label'), 'Graph: 1; 2; 3');
    assert.equal(document.querySelectorAll('.cs-structure-grid td').length, 4);
    // Without parameters (ACM mode, the playground) nothing is drawn.
    await show({ reference: { status: 'done', output: '4\n1 null 2 3\n' } });
    assert.equal(document.querySelectorAll('figure').length, 0);
    // A 41-row grid only says so; a 422 from the expected endpoint says why.
    const tall = { ...submission, cases: [{ ...submission.cases[0], stdin: `[1]\n${JSON.stringify(Array.from({ length: 41 }, () => [0]))}` }] };
    await act(async () =>
      root.render(
        createElement(SubmissionResult, {
          submission: tall,
          ranCase: 1,
          params,
          returnType: 'TreeNode',
          reference: { status: 'failed', message: "Outside the problem's constraints: root node count 1 < 2" },
        }),
      ),
    );
    assert.match(document.body.textContent, /41 × 1 grid is over 40 rows or columns/);
    assert.match(document.body.textContent, /root node count 1 < 2/);
  } finally {
    await act(async () => root.unmount());
  }
});

test('a tree parameter checks as the judge decodes it and draws on request', async () => {
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const statement = { title: 'Depth', description: 'Depth.', input: 'In.', output: 'Out.', explanation: '', hints: [] };
  const problem = {
    id: 'lc-104',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: [],
    sampleIn: '1\n1\n',
    sampleOut: '1\n',
    samples: [{ name: '样例 1', input: '1\n1\n', expectedOutput: '1\n' }],
    languages: ['python'],
    translations: { en: statement },
    codingModes: ['leetcode', 'acm'],
    leetcodeTemplates: { python: 'class Solution:\n    pass\n' },
    leetcodeParams: [{ name: 'root', type: 'TreeNode' }],
    leetcodeReturnType: 'integer',
    checker: 'exact',
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({});
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
  const type = async (node, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'lc-104', title: 'Depth', titleEn: 'Depth', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student2', role: 'teacher', verified: true }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    await act(async () => button('Custom input').click());
    await settle();
    const input = () => document.querySelector('.cs-case-fields input');
    const toggle = button('Diagram');
    assert.equal(toggle.getAttribute('aria-label'), 'Diagram of root');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    await type(input(), '[1,null,2,null,null]');
    await act(async () => toggle.click());
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelector('.cs-case-field svg').getAttribute('aria-label'), 'Graph: 1; 2', 'trailing nulls are dropped, as the judge does');
    await type(input(), '[null,1]');
    assert.match(document.querySelector('.cs-field-issue').textContent, /null root/);
    assert.equal(document.querySelector('.cs-case-field svg'), null, 'nothing drawn for a broken tree');
    await type(input(), '[]');
    assert.match(document.querySelector('.cs-case-field').textContent, /Empty tree/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
