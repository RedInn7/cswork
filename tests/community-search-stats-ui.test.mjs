import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const alert = `import React from ${JSON.stringify(react)};export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;export const AlertDialogContent=({children})=>React.createElement('div',null,children);export const AlertDialogDescription=AlertDialogContent;export const AlertDialogHeader=AlertDialogContent;export const AlertDialogFooter=AlertDialogContent;export const AlertDialogTitle=AlertDialogContent;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`;
register(
  `data:text/javascript,${encodeURIComponent(`const alert=${JSON.stringify(alert)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/ui/alert-dialog.tsx'))return {format:'module',source:alert,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

test('the posts panel searches inside its target and sorts by hot', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SolutionPosts } = await import('../components/solution-posts.tsx');
  const asked = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.startsWith('/api/oj/posts?')) asked.push(new URL(path, 'https://cswork.test').searchParams);
    return Response.json(path.includes('companies') ? { items: [] } : { solved: true, items: [], more: false });
  };
  const root = createRoot(document.getElementById('root'));
  const $ = (selector) => document.querySelector(selector);
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
  try {
    await act(async () =>
      root.render(createElement(SolutionPosts, { problemId: 'discuss:interview', english: true, initialQuery: ' two pointers ' })),
    );
    await settle();
    assert.equal(asked.at(-1).get('q'), 'two pointers', 'a board link starts the search');
    assert.equal($('input[type="search"]').value, 'two pointers');
    assert.equal($('.cs-posts-state').textContent, 'No posts match "two pointers".');
    const hot = [...document.querySelectorAll('.cs-posts-sort button')].find((b) => b.textContent === 'Hot');
    await act(async () => hot.click());
    await settle();
    assert.equal(asked.at(-1).get('sort'), 'hot');
    assert.equal(hot.getAttribute('aria-pressed'), 'true');
    const input = $('input[type="search"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'heap');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => $('form[role="search"]').requestSubmit());
    await settle();
    assert.equal(asked.at(-1).get('q'), 'heap');
    assert.equal(asked.at(-1).get('problem'), 'discuss:interview', 'never a search across targets');
    assert.equal(asked.at(-1).get('sort'), 'hot');

    // Answers under an interview question list inline: no search box there.
    await act(async () => root.render(createElement(SolutionPosts, { key: 'q', problemId: 'q:two-sum', english: true, initialQuery: 'x' })));
    await settle();
    assert.equal($('form[role="search"]'), null);
    assert.equal(asked.at(-1).get('q'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
