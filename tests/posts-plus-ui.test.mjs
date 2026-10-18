import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The mermaid renderer is stubbed: this checks which blocks reach it, not mermaid itself.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const diagram = `import React from ${JSON.stringify(react)};export const CourseDiagram=({source})=>React.createElement('figure',{'data-diagram':''},source);`;
register(
  `data:text/javascript,${encodeURIComponent(`const diagram=${JSON.stringify(diagram)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/course-diagram.tsx'))return {format:'module',source:diagram,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const id = '11111111-1111-4111-8111-111111111111';
const thread = {
  id,
  problemId: 'lc-1',
  title: 'Which language for OAs?',
  language: '',
  tag: '',
  hidden: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  author: 'Grace',
  mine: false,
  votes: 0,
  voted: false,
  comments: 0,
  stars: 0,
  starred: false,
  excerpt: 'Curious',
};
const body = ['Curious.', '```mermaid', 'graph TD', '  A-->B', '```', '```python', 'x = 1', '```'].join('\n');

test('a solution draws its mermaid, saves and lists saved posts', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SolutionPosts } = await import('../components/solution-posts.tsx');

  const sent = [];
  const gets = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    if (init.method === 'POST') {
      const data = JSON.parse(init.body);
      sent.push([path, data]);
      return Response.json(data);
    }
    gets.push(path);
    if (path.startsWith('/api/oj/posts?starred=1'))
      return Response.json({ solved: true, items: [{ ...thread, problemId: 'q:tell-me', title: 'My STAR answer', starred: true }], more: false, next: 1 });
    if (path.startsWith('/api/oj/posts?')) return Response.json({ solved: true, items: [thread], more: false });
    return Response.json({ post: { ...thread, body }, comments: [] });
  };
  const root = createRoot(document.getElementById('root'));
  const $ = (selector) => document.querySelector(selector);
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = (text) => act(async () => button(text).click());
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
  try {
    await act(async () => root.render(createElement(SolutionPosts, { problemId: 'lc-1', english: true })));
    await settle();
    await click('Which language for OAs?');
    await settle();
    // ```mermaid goes to the diagram renderer; other code stays a code block.
    const article = $('.cs-post-body');
    assert.equal(article.querySelector('figure[data-diagram]')?.textContent, 'graph TD\n  A-->B\n');
    assert.equal(article.querySelector('pre code')?.textContent.includes('x = 1'), true);
    assert.equal(article.textContent.includes('A-->B') && !article.querySelector('pre code')?.textContent.includes('A-->B'), true);

    // Save: a star mark on post:<id>.
    const save = button('Save');
    assert.equal(save.getAttribute('aria-pressed'), 'false');
    await act(async () => save.click());
    assert.deepEqual(sent.at(-1), ['/api/oj/marks', { target: `post:${id}`, mark: 'star', on: true }]);
    assert.equal(button('Saved').getAttribute('aria-pressed'), 'true');

    // Saved posts from every target, titled and labelled with their kind.
    await click('All solutions');
    await settle();
    await click('Saved');
    await settle();
    assert.equal(gets.includes('/api/oj/posts?starred=1'), true);
    assert.equal($('.cs-post-row-title').textContent, 'My STAR answer');
    assert.equal($('.cs-post-row-meta').textContent.includes('Answer'), true);
    assert.equal($('.cs-posts-sort'), null, 'no sort among saved posts');

    // The editor says mermaid works.
    await click('Saved');
    await settle();
    await click('Write a solution');
    assert.equal($('.cs-post-editor-note').textContent.includes('mermaid'), true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});

test('a guest outside academy goes to sign in', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  const assigned = [];
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { assign: (url) => assigned.push(url) } });
  const { createRoot } = await import('react-dom/client');
  const { SolutionPosts } = await import('../components/solution-posts.tsx');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ solved: true, items: [], more: false });
  const root = createRoot(document.getElementById('root'));
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = (text) => act(async () => button(text).click());
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
  try {
    // A guest: academy cancels the event and signs them in itself; with nobody listening the
    // account page takes over.
    await act(async () => root.render(createElement(SolutionPosts, { problemId: 'sd:caching', english: true, signedIn: false })));
    await settle();
    await click('Join the discussion');
    assert.deepEqual(assigned, ['/?view=account']);
    let handled = 0;
    const academy = (e) => (e.preventDefault(), handled++);
    window.addEventListener('cswork:auth-required', academy);
    await click('Join the discussion');
    window.removeEventListener('cswork:auth-required', academy);
    assert.deepEqual([handled, assigned.length], [1, 1]);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    delete globalThis.location;
  }
});
