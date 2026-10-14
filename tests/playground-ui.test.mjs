import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor','data-language':p.language,value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
  dialog:
    prefix +
    `export const Dialog=({open,children})=>open?React.createElement('div',{role:'dialog'},children):null;export const DialogContent=({children})=>React.createElement('div',null,children);export const DialogDescription=DialogContent;export const DialogHeader=DialogContent;export const DialogTitle=DialogContent;`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/ui/dialog.tsx','dialog']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const { encodeShare } = await import('../lib/playground-share.ts');
const shared = { language: 'go', code: 'package main\nfunc main() { println("shared") }\n', stdin: '7\n' };
const link = await encodeShare(shared);

async function mount(url, props) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { PlaygroundView } = await import('../app/playground/view.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(PlaygroundView, props)));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return { dom, root };
}
const editor = () => document.querySelector('[aria-label="test editor"]');
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

test('a share link opens its code and input; signed out, running asks to sign in', async () => {
  const { root } = await mount(`https://cswork.test/playground#c=${link}`, { signedIn: false, verified: false });
  try {
    assert.equal(editor().value, shared.code);
    assert.equal(editor().getAttribute('data-language'), 'go');
    assert.equal(document.querySelector('textarea:not([aria-label])').value, '7\n');
    assert.equal(document.querySelector('a[href="/?view=account"]') !== null, true);
    assert.equal(button('Run') === undefined, true);
    assert.equal(document.body.textContent.includes('Loaded the code from the link'), true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('signed in: Run sends the code and stdin, watches the run and shows its output', async () => {
  const posts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/api/oj/playground/run')) {
      posts.push(JSON.parse(init.body));
      return Response.json({ id: 'run-1', status: 'running', mode: 'playground', watchToken: 'w1', passed: 0, total: 1, created_at: 1, cases: [] });
    }
    if (String(url).includes('/api/oj/submissions/run-1?wait=1'))
      return Response.json({
        id: 'run-1',
        status: 'finished',
        mode: 'playground',
        passed: 1,
        total: 1,
        created_at: 1,
        runtimeMs: 12,
        memoryKb: 2048,
        cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: 'hi', stdout: 'PLAYGROUND OUT', stderr: '' }],
      });
    return new Response('{}', { status: 404 });
  };
  const { root } = await mount('https://cswork.test/playground', { signedIn: true, verified: true });
  try {
    await act(async () => button('C++').click());
    await act(async () => {
      editor().value = 'int main(){}';
      editor().dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const stdin = document.querySelector('textarea:not([aria-label])');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(stdin, 'hi');
      stdin.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () => button('Run').click());
    await settle();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].language, 'cpp');
    assert.equal(posts[0].code, 'int main(){}');
    assert.equal(posts[0].stdin, 'hi');
    assert.equal(/^[\w-]{16,100}$/.test(posts[0].idempotencyKey), true);
    assert.equal(document.body.textContent.includes('PLAYGROUND OUT'), true);
    // Shown as a test run, never as a formal submission.
    assert.equal(document.body.textContent.includes('Test run'), true);
    // The scratchpad survives a reload, per language.
    await settle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    const saved = JSON.parse(localStorage.getItem('cswork:playground:v1'));
    assert.equal(saved.language, 'cpp');
    assert.equal(saved.code.cpp, 'int main(){}');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = realFetch;
  }
});

test('Share puts the code in the fragment and copies the link', async () => {
  const { root } = await mount('https://cswork.test/playground', { signedIn: true, verified: true });
  let copied = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => void (copied = text) },
  });
  try {
    await act(async () => button('Share link').click());
    await settle();
    assert.equal(location.hash.startsWith('#c='), true);
    assert.equal(copied === location.href, true);
    assert.equal(document.body.textContent.includes('Link copied'), true);
  } finally {
    await act(async () => root.unmount());
  }
});
