// An OA problem with a guide (content/oa-judge/guides/oa-meta-10.json) in the workspace: the hint
// ladder instead of the package's hint box, and the editorial's English text and code tabs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// tests/oa-drills-ui.test.mjs's stubs: a textarea editor, flat panels, plain dialogs.
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

const ID = 'oa-meta-10';
const guide = JSON.parse(readFileSync(`content/oa-judge/guides/${ID}.json`, 'utf8'));
const extra = JSON.parse(readFileSync(`content/oa-judge/solutions/${ID}.json`, 'utf8')).programs;
const registry = JSON.parse(readFileSync('content/oa-judge/registry.json', 'utf8')).items.find((item) => item.id === ID);
// What GET oa-library/<id>/solution returns: the registry's program first, then the sidecar's.
const solution = {
  explanation: registry.editorial,
  explanationEn: guide.explanationEn,
  solutions: [...registry.authoredSolutions, ...extra.map(({ language, code }) => ({ language, code }))],
};
const settle = (ms = 20) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const click = (text) => act(async () => button(text).click());

function dom() {
  const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' }).window;
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return window;
}

test('a guided OA problem shows the hint ladder, not the hint box, and an editorial with English text and code tabs', async () => {
  const window = dom();
  localStorage.setItem('cswork:locale', 'en');
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  // As the server sends it: the package's hints dropped for the guide's ladder.
  const statement = { title: 'Distinct digits', description: 'Count them.', input: 'left right', output: 'A count.', explanation: '', hints: [] };
  const problem = {
    id: ID,
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: [],
    sampleIn: '476 979\n',
    sampleOut: '371\n',
    languages: ['python', 'go', 'java', 'cpp'],
    translations: { en: statement },
    codingModes: ['acm'],
    oaHints: guide.hints,
    failedSubmissionIds: [],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/cloud/drafts')) return Response.json({ draft: null });
    if (url.endsWith(`/oa-library/${ID}/solution`)) return Response.json(solution);
    if (url.endsWith(`/oa-library/${ID}`)) return Response.json({ id: ID, companySlug: 'meta', companyName: 'Meta' });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null });
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: ID, title: 'Distinct digits', titleEn: 'Distinct digits', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'student' }, courses: [] },
          navigate() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    await settle();
    // One set of hints: the ladder, opened a step at a time with OA's level names.
    assert.equal(document.querySelector('#problem-hints'), null);
    assert.equal(button('Hint'), undefined);
    assert.equal(document.querySelector('#hint-ladder-title').textContent, 'Step-by-step hints');
    await click('Show next hintHint 1');
    assert.match(document.querySelector('.cs-hint-ladder-list').textContent, new RegExp(`Hint 1 · Observation${guide.hints.en[0].slice(0, 20)}`));
    // Hint 2 waits for a failure or ten minutes; showing it anyway names it the approach.
    await click('Show anyway');
    await click('Show hint');
    assert.match(document.querySelectorAll('.cs-hint-ladder-list li')[1].textContent, /^2Hint 2 · Approach/);
    // The editorial: English text, then one tab per language in the Line 500 order.
    await act(async () => [...document.querySelectorAll('[role="tab"]')].find((n) => n.textContent === 'Editorial').click());
    await settle();
    // Laid out and themed like Line 500's editorial: its code block follows a dark editor theme.
    const section = document.querySelector('.oa-solution.cs-ling-editorial');
    assert.match(section.textContent, /Why it works/);
    assert.doesNotMatch(section.textContent, /为什么正确/);
    const tabs = [...section.querySelectorAll('.cs-ling-langs button')];
    assert.deepEqual(tabs.map((n) => n.textContent), ['Python', 'C++', 'Java', 'Go']);
    // It opens on the editor's language.
    assert.equal(section.querySelector('[aria-pressed="true"]').textContent, 'Python');
    assert.equal(section.querySelector('.cs-ling-code').textContent, registry.authoredSolutions[0].code);
    await click('Java');
    assert.equal(section.querySelector('[aria-pressed="true"]').textContent, 'Java');
    assert.equal(section.querySelectorAll('.cs-ling-code').length, 1);
    assert.equal(section.querySelector('.cs-ling-code').textContent, extra.find((p) => p.language === 'java').code);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('signed out, the OA editorial offers sign-in instead of a retry that fails the same way', async () => {
  const window = dom();
  const { createRoot } = await import('react-dom/client');
  const { OaEditorial } = await import('../components/oa-library.tsx');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: '请先登录' }, { status: 401 });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(OaEditorial, { problemId: ID, english: false })));
    await settle();
    assert.equal(document.querySelector('.oa-editorial-signin a').getAttribute('href'), '/?view=account');
    assert.doesNotMatch(document.body.textContent, /重试/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('on a Chinese page the OA editorial keeps the Chinese text; the workspace never mounts it in an exam', async () => {
  const window = dom();
  const { createRoot } = await import('react-dom/client');
  const { OaEditorial } = await import('../components/oa-library.tsx');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(solution);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(OaEditorial, { problemId: ID, english: false, language: 'go' })));
    await settle();
    assert.match(document.body.textContent, /为什么正确/);
    assert.doesNotMatch(document.body.textContent, /Why it works/);
    assert.equal(document.querySelector('[aria-pressed="true"]').textContent, 'Go');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
  const workspace = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /leftTab === 'editorial' && !examMode \? \(\s*<OaEditorial/);
  // Whiteboard mode (no aids) hides the OA hints too.
  assert.match(workspace, /\{problem\.oaHints && !examMode && !wb\.on && \(/);
});

test('a Japanese reader gets a translated problem in Japanese, can switch to English and back, and sees no Japanese option without a translation', async () => {
  const window = dom();
  localStorage.setItem('cswork:locale', 'ja');
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const JA = 'oa-google-25';
  const ja = JSON.parse(readFileSync(`content/oa-judge/translations/${JA}.json`, 'utf8')).ja;
  const hints = JSON.parse(readFileSync(`content/oa-judge/guides/${JA}.json`, 'utf8')).hints;
  const written = JSON.parse(readFileSync(`content/oa-master/editorials/${JA}.json`, 'utf8'));
  const english = { title: 'Highest Frequency', description: 'Count the most frequent value.', input: 'n, then n integers.', output: 'A count.', explanation: '', hints: [] };
  const problem = (id, translations) => ({
    id,
    courseId: 'gomall',
    lessonId: 'lesson',
    ...english,
    title: '数组最高出现次数',
    description: '输出出现次数最多的值的出现次数。',
    difficulty: '简单',
    tags: [],
    sampleIn: '3\n1 2 3\n',
    sampleOut: '1\n',
    languages: ['python'],
    translations,
    codingModes: ['acm'],
    oaHints: hints,
    failedSubmissionIds: [],
  });
  const served = { [JA]: problem(JA, { en: english, ja: { ...ja, hints: [] } }), [ID]: problem(ID, { en: english }) };
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.includes('/cloud/drafts')) return Response.json({ draft: null });
    if (url.endsWith('/solution')) return Response.json({ explanation: written.explanation, explanationEn: written.explanationEn, explanationLocal: { ja: written.explanationJa }, solutions: [] });
    if (url.includes('/oa-library/')) return Response.json({ id: JA, companySlug: 'google', companyName: 'Google' });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null });
    sent.push(init?.headers);
    return Response.json(served[url.split('/').at(-1)]);
  };
  const root = createRoot(document.getElementById('root'));
  const open = async (id) => {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          key: id,
          problem: { id, title: 'x', titleEn: 'x', difficulty: '简单', tags: [], lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'student' }, courses: [] },
          navigate() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    await settle();
  };
  const select = () => document.querySelector('.cs-statement-language');
  const pick = (value) =>
    act(async () => {
      select().value = value;
      select().dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  const prose = () => document.querySelector('.cs-problem-prose').textContent;
  try {
    await open(JA);
    // The API is told the full site language, beside the interface locale.
    assert.deepEqual([sent[0]['X-Locale'], sent[0]['X-Language']], ['en', 'ja']);
    assert.deepEqual([...select().options].map((option) => option.textContent), ['中文', 'English', '日本語']);
    assert.equal(select().value, 'ja');
    assert.ok(prose().includes(ja.description.split('\n')[0]));
    // Hints follow the statement; their labels stay in the English interface.
    await click('Show next hintHint 1');
    assert.ok(document.querySelector('.cs-hint-ladder-list').textContent.includes(`Hint 1 · Observation${hints.ja[0]}`));
    // So does the editorial.
    const tab = (name) => act(async () => [...document.querySelectorAll('[role="tab"]')].find((n) => n.textContent === name).click());
    await tab('Editorial');
    await settle();
    assert.match(document.querySelector('.oa-solution [lang="ja"]').textContent, /計算量/);
    await tab('Description');
    await settle();
    // English on request, remembered, and back.
    await pick('en');
    assert.ok(prose().includes(english.description));
    assert.equal(localStorage.getItem('cswork:problem:locale'), 'en');
    assert.ok(document.querySelector('.cs-hint-ladder-list').textContent.includes(hints.en[0]));
    await pick('ja');
    assert.equal(localStorage.getItem('cswork:problem:locale'), 'ja');
    assert.ok(prose().includes(ja.description.split('\n')[0]));
    // A problem not translated yet: English, and no Japanese option, even with Japanese remembered.
    await open(ID);
    assert.deepEqual([...select().options].map((option) => option.textContent), ['中文', 'English']);
    assert.equal(select().value, 'en');
    assert.ok(prose().includes(english.description));
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
