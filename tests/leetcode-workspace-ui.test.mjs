import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
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

test('workspace uses official LeetCode defaults and preserves separate mode and language drafts', async (t) => {
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
  const { draftStorageKey } = await import('../lib/editor-settings.ts');
  const contract = JSON.parse(
    readFileSync(
      new URL('../lib/content/leetcode-contracts.json', import.meta.url),
      'utf8',
    ),
  ).problems['lc-1'];
  const templates = {
    python: contract.pythonTemplate,
    java: contract.templates.java,
  };
  const problem = {
    id: 'lc-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    title: '两数之和',
    difficulty: '简单',
    tags: ['灵神题单', '数组'],
    description: 'DUPLICATE SUMMARY',
    input: 'ACM INPUT',
    output: 'ACM OUTPUT',
    explanation: '',
    hints: [],
    sampleIn: '4\n2 7 11 15\n9\n',
    sampleOut: '2\n0 1\n',
    languages: ['python', 'java'],
    translations: {
      en: {
        title: 'Two Sum',
        description: 'DUPLICATE SUMMARY',
        input: 'ACM INPUT',
        output: 'ACM OUTPUT',
        explanation: '',
        hints: [],
      },
    },
    codingModes: ['leetcode', 'acm'],
    leetcodeTemplates: templates,
    sourceStatement: {
      descriptionZh: 'COMPLETE ORIGINAL DESCRIPTION',
      descriptionEn: 'COMPLETE ORIGINAL DESCRIPTION',
      attribution: 'ATTRIBUTION MUST NOT SHOW',
      sourceUrl: 'https://leetcode.cn/problems/two-sum/',
    },
  };
  const historical = {
    id: 'old-acm',
    problemId: 'lc-1',
    language: 'python',
    codingMode: 'acm',
    code: 'print("historic ACM")',
    mode: 'judge',
    status: 'accepted',
    passed: 2,
    total: 2,
    created_at: 1,
    results: [],
    compileOutput: '',
  };
  const originalFetch = globalThis.fetch;
  let outcome = 'accepted';
  let acknowledgement = 'queued';
  let pendingReads = 0;
  let terminalReads = 0;
  let freshSubmission;
  let holdPost = false;
  let releasePost;
  let failWatch = false;
  let watchReads = 0;
  let failDetailOnce = false;
  let submitted = 0;
  let progressEvents = 0;
  const navigations = [];
  window.addEventListener(
    'cswork:practice-progress-changed',
    () => progressEvents++,
  );
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      if (holdPost)
        await new Promise((resolve) => {
          releasePost = resolve;
        });
      const body = JSON.parse(init.body);
      freshSubmission = {
        ...historical,
        id: `fresh-${++submitted}`,
        mode: body.mode,
        status: outcome,
      };
      return Response.json({ id: freshSubmission.id, status: acknowledgement });
    }
    if (url.includes('/submissions/fresh-')) {
      if (failDetailOnce) {
        failDetailOnce = false;
        throw new TypeError('detail unavailable');
      }
      if (url.includes('?wait=1')) {
        watchReads++;
        if (failWatch) throw new TypeError('watch unavailable');
      }
      if (pendingReads-- > 0) {
        // The server finishes immediately after this in-flight snapshot.
        return Response.json({
          ...freshSubmission,
          status: 'judging',
          watchToken: 'pending-1',
        });
      }
      terminalReads++;
      return Response.json(freshSubmission);
    }
    if (url.includes('/submissions/old-acm')) return Response.json(historical);
    if (url.includes('/submissions'))
      return Response.json({ items: [historical], nextCursor: null });
    if (url.includes('/status'))
      return Response.json({ available: true, languageVersions: {} });
    return Response.json(problem);
  };
  localStorage.setItem(
    draftStorageKey('student', 'lc-1', 'python', 'acm'),
    'print("legacy ACM")',
  );
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (n) => n.textContent.trim() === text,
    );
  const editor = () => document.querySelector('[aria-label="test editor"]');
  const choose = async (label, value) => {
    const element = document.querySelector(`[aria-label="${label}"]`);
    assert.ok(element, label);
    await act(async () => {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
  };
  const edit = async (value) => {
    await act(async () => {
      editor().value = value;
      editor().dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const click = async (node) => {
    assert.ok(node);
    await act(async () => node.click());
    await settle();
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem,
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate(path) {
            navigations.push(path);
          },
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.ok(button('运行').closest('.cs-code-caption'));
    assert.ok(button('提交').closest('.cs-code-caption'));
    assert.equal(
      document.querySelector('.cs-workspace-header .cs-editor-run-actions'),
      null,
    );
    assert.equal(editor().value, templates.python);
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /nums = \[2,7,11,15\]/,
    );
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /target = 9/,
    );
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /\[0,1\]/,
    );
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. 两数之和',
    );
    assert.ok(document.querySelector('.cs-statement-solved'));
    assert.equal(document.querySelector('#problem-topics'), null);
    await click(button('主题'));
    assert.equal(document.querySelector('#problem-topics').textContent, '数组');
    await click(button('主题'));
    await choose('题面语言', 'en');
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. Two Sum',
    );
    await choose('题面语言', 'zh');
    assert.equal(
      document.querySelector('[aria-label="提交模式"]').value,
      'leetcode',
    );
    assert.match(document.body.textContent, /COMPLETE ORIGINAL DESCRIPTION/);
    assert.doesNotMatch(
      document.body.textContent,
      /DUPLICATE SUMMARY|ATTRIBUTION MUST NOT SHOW|返回课程|查看课程|展开提示/,
    );
    assert.doesNotMatch(document.body.textContent, /ACM INPUT|ACM OUTPUT/);
    await edit('# my LC draft');
    await choose('提交模式', 'acm');
    assert.equal(editor().value, 'print("legacy ACM")');
    await edit('print("new ACM")');
    await choose('提交模式', 'leetcode');
    assert.equal(editor().value, '# my LC draft');
    await choose('编程语言', 'java');
    assert.equal(editor().value, templates.java);
    await edit('// java LC draft');
    await choose('编程语言', 'python');
    assert.equal(editor().value, '# my LC draft');
    await click(document.querySelector('[aria-label="重置为语言模板"]'));
    await click(button('确认替换'));
    assert.equal(editor().value, templates.python);
    await choose('提交模式', 'acm');
    assert.equal(editor().value, 'print("new ACM")');
    await choose('提交模式', 'leetcode');
    await click(button('提交记录'));
    await click(button('代码'));
    await click(button('恢复到编辑器'));
    await click(button('确认替换'));
    assert.equal(
      document.querySelector('[aria-label="提交模式"]').value,
      'acm',
    );
    assert.equal(editor().value, historical.code);
    await choose('提交模式', 'leetcode');
    assert.equal(editor().value, templates.python);
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'history must not celebrate',
    );
    await click(button('运行'));
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'sample runs must not celebrate',
    );
    outcome = 'wrong_answer';
    holdPost = true;
    await act(async () => button('提交').click());
    assert.match(
      document.querySelector('.cs-submitting').textContent,
      /正在提交/,
    );
    assert.equal(
      document.querySelector('.cs-result-content'),
      null,
      'previous result is cleared while uploading',
    );
    holdPost = false;
    await act(async () => releasePost());
    assert.equal(document.querySelector('.cs-accepted-banner'), null);
    outcome = 'accepted';
    pendingReads = 1;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      // Flush the POST and initial pending GET without advancing polling time.
      await act(async () => {
        button('提交').click();
      });
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'completed watch response must render immediately without a 750ms polling delay',
      );
      const completedReadsBeforePoll = terminalReads;
      await act(async () => t.mock.timers.tick(3000));
      assert.equal(
        terminalReads,
        completedReadsBeforePoll,
        'terminal feedback must stop polling',
      );
    } finally {
      t.mock.timers.reset();
    }
    assert.match(
      document.querySelector('.cs-accepted-banner').textContent,
      /Accepted/,
    );
    assert.ok(
      document.querySelector('.cs-accepted-banner').closest('[role="dialog"]'),
      'formal AC must open a result dialog, not only an inline banner',
    );
    assert.equal(progressEvents, 1);
    assert.ok(watchReads > 0, 'active submission uses the watch endpoint');
    assert.equal(
      document.querySelector('.cs-accepted-banner').textContent.trim(),
      'Accepted',
    );
    await click(document.querySelector('[aria-label="收起通过提示"]'));
    await click(button('题目描述'));
    await choose('题面语言', 'en');
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'dismissed feedback must not replay',
    );
    acknowledgement = 'accepted';
    await click(button('Submit'));
    assert.match(
      document.querySelector('.cs-accepted-banner').textContent,
      /Accepted/,
    );
    assert.equal(progressEvents, 2);
    await click(
      document.querySelector('[aria-label="Dismiss success message"]'),
    );
    failWatch = true;
    pendingReads = 1;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await act(async () => button('Submit').click());
      assert.equal(document.querySelector('.cs-accepted-banner'), null);
      await act(async () => t.mock.timers.tick(750));
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'unavailable watch falls back to ordinary polling',
      );
    } finally {
      t.mock.timers.reset();
      failWatch = false;
    }
    await click(
      document.querySelector('[aria-label="Dismiss success message"]'),
    );
    failDetailOnce = true;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await act(async () => button('Submit').click());
      assert.equal(document.querySelector('.cs-accepted-banner'), null);
      await act(async () => t.mock.timers.tick(750));
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'terminal POST receipt still retries missing details',
      );
      assert.equal(document.querySelector('.cs-inline-error'), null);
    } finally {
      t.mock.timers.reset();
    }
    sessionStorage.setItem('cswork:oj:active:student:lc-1', freshSubmission.id);
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          key: 'reloaded',
          problem,
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'receipt prevents replay after reload',
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
