import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// tests/workspace-cases-ui.test.mjs's stubs; this editor also hands over a format action
// and can report the language service down.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){React.useEffect(()=>{p.onFormatReady?.(()=>{globalThis.formatCalls=(globalThis.formatCalls||0)+1;});return()=>p.onFormatReady?.(null);},[]);return React.createElement('div',null,React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)}),React.createElement('button',{type:'button',onClick:()=>p.onIntelligenceStatus?.({state:'unavailable',message:'down'})},'lsp down'));} export function CodeDiff(){return null;}`,
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

test('a newer draft from another device, Format, and Open in Playground', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const { decodeShare } = await import('../lib/playground-share.ts');
  const statement = { title: 'A+B', description: 'Add.', input: 'Two numbers.', output: 'Their sum.', explanation: '', hints: [] };
  const problem = {
    id: 'acm-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    ...statement,
    difficulty: '简单',
    tags: ['数学'],
    sampleIn: '1 2\n',
    sampleOut: '3\n',
    languages: ['python'],
    translations: { en: statement },
    codingModes: ['acm'],
  };
  const laptop = { code: 'print("from the laptop")', updatedAt: Date.now() - 5 * 60000 };
  const puts = [];
  const draftReads = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.includes('/cloud/drafts/')) {
      if (init?.method === 'PUT') {
        puts.push({ url, body: JSON.parse(init.body), keepalive: init.keepalive });
        return Response.json({ saved: true });
      }
      draftReads.push(url);
      return Response.json({ draft: laptop });
    }
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: {} });
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null });
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
  const editor = () => document.querySelector('[aria-label="test editor"]');
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: 'acm-1', title: 'A+B', titleEn: 'A+B', difficulty: '简单', tags: problem.tags, lessonId: 'lesson', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    await settle();
    // Nothing saved in this browser: the server copy wins and says where it came from.
    assert.equal(draftReads.some((u) => u.endsWith('/cloud/drafts/acm-1?language=python&mode=acm')), true);
    assert.equal(editor().value, laptop.code);
    const notice = document.querySelector('.cs-draft-restored');
    assert.equal(notice !== null, true);
    assert.equal(notice.textContent.includes('Restored from another device (5 minutes ago)'), true);
    assert.equal(JSON.parse(localStorage.getItem('cswork:editor:draft:student:acm-1:python')).code, laptop.code);
    // Undo restores the starter and, once the tab hides, uploads it as the newest copy.
    await act(async () => button('Undo').click());
    await settle();
    assert.equal(editor().value === laptop.code, false);
    assert.equal(document.querySelector('.cs-draft-restored') === null, true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    await act(async () => window.dispatchEvent(new window.Event('pagehide')));
    assert.equal(puts.length, 1);
    assert.equal(puts[0].body.code, editor().value);
    assert.equal(puts[0].keepalive, true);

    // Format goes to the editor's format action, and greys out when the service is down.
    globalThis.formatCalls = 0;
    await act(async () => button('Format').click());
    assert.equal(globalThis.formatCalls, 1);
    await act(async () => button('lsp down').click());
    assert.equal(button('Format').disabled, true);

    // Open in Playground: the tab opens at once, then gets the code and the example as stdin.
    const tab = { opener: window, location: { href: '' }, close() {} };
    window.open = () => tab;
    await act(async () => document.querySelector('[aria-label="Open in Playground"]').click());
    await settle();
    assert.equal(tab.opener === null, true);
    assert.equal(tab.location.href.startsWith('/playground#c='), true);
    const opened = await decodeShare(tab.location.href.slice('/playground'.length));
    assert.equal(opened.language, 'python');
    assert.equal(opened.code, editor().value);
    assert.equal(opened.stdin, '1 2\n');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
