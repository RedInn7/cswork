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

const post = {
  id: '11111111-1111-4111-8111-111111111111',
  problemId: 'lc-1',
  title: 'Hash map in one pass',
  language: 'python',
  hidden: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  author: 'Grace',
  mine: false,
  votes: 2,
  voted: false,
  comments: 0,
  excerpt: '## Idea\n```python\nx = 1\n```\nKeep a **map**',
};
const body = [
  '## Idea',
  '<script>window.hacked = 1</script><img src="https://tracker.example/x.png">',
  '![pixel](https://tracker.example/pixel.png)',
  '[bad](javascript:alert(1)) [good](https://cswork.org)',
  'Use 2 ** 10 and 3 ** 4 here, `2^10` too.',
  '```python',
  'seen = {}',
  'ans = x ** 2 + y ** 3',
  '```',
].join('\n');

test('solutions stay locked until an AC or a confirm, render posts without HTML or images, and prefill the editor', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SolutionPosts, plainExcerpt, codeBlock } = await import('../components/solution-posts.tsx');

  assert.equal(plainExcerpt(post.excerpt), 'Idea Keep a map');
  assert.equal(codeBlock('a = "```"\n', 'python'), '````python\na = "```"\n````');

  let solved = false;
  const posts = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    if (init.method === 'POST') {
      const data = JSON.parse(init.body);
      posts.push([path, data]);
      if (path.endsWith('/vote')) return Response.json({ votes: 3, voted: true });
      return Response.json({ post: { ...post, id: '22222222-2222-4222-8222-222222222222', mine: true, body: data.body }, comments: [] }, { status: 201 });
    }
    if (path.startsWith('/api/oj/posts?')) return Response.json({ solved, items: [post], more: false });
    return Response.json({ post: { ...post, body }, comments: [{ id: 'c1', body: '<b>hi</b>', createdAt: 1, author: '', mine: false }] });
  };
  const root = createRoot(document.getElementById('root'));
  const $ = (selector) => document.querySelector(selector);
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = (text) => act(async () => button(text).click());
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
  try {
    await act(async () =>
      root.render(createElement(SolutionPosts, { problemId: 'lc-1', english: true, code: 'def f():\n    return 1\n', language: 'python' })),
    );
    await settle();
    assert.equal($('.cs-posts-locked') !== null, true, 'locked before an AC');
    assert.equal($('.cs-post-row') === null, true, 'no spoilers behind the lock');
    await click('Show anyway');
    assert.equal($('[role="alertdialog"]') !== null, true, 'asks before showing');
    await click('Show solutions');
    assert.equal($('.cs-post-row') !== null, true);
    assert.equal(sessionStorage.getItem('cswork:solutions-peek:lc-1'), '1');
    assert.equal($('.cs-post-row-excerpt').textContent, 'Idea Keep a map');

    // A post: Markdown and code blocks, but no raw HTML, no images and no script URLs.
    await click('Hash map in one pass');
    await settle();
    const article = $('.cs-post-body');
    assert.equal(article.querySelector('h2')?.textContent, 'Idea');
    assert.equal(article.querySelector('pre code')?.textContent.includes('seen = {}'), true);
    assert.equal(article.querySelector('script, img') === null, true);
    // None of the imported-statement repairs (bold, superscripts) rewrite a learner's text or code.
    assert.equal(article.textContent.includes('Use 2 ** 10 and 3 ** 4 here, 2^10 too.'), true);
    assert.equal(article.querySelector('pre code')?.textContent.includes('ans = x ** 2 + y ** 3'), true);
    assert.equal(article.querySelector('strong, sup') === null, true);
    assert.equal(dom.window.hacked === undefined, true);
    const links = [...article.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    assert.equal(links.some((href) => href.startsWith('javascript')), false);
    assert.equal(links.includes('https://cswork.org'), true);
    assert.equal($('.cs-comment-body').textContent, '<b>hi</b>', 'comments are plain text');
    assert.equal($('.cs-comment-body b') === null, true);
    await act(async () => $('[data-vote]').click());
    assert.equal($('[data-vote]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(posts.at(-1), [`/api/oj/posts/${post.id}/vote`, { on: true }]);

    // Solved: no lock, and a new post starts from an outline with the editor's code.
    solved = true;
    sessionStorage.clear();
    await act(async () => root.render(createElement('div')));
    await act(async () =>
      root.render(createElement(SolutionPosts, { problemId: 'lc-1', english: true, code: 'def f():\n    return 1\n', language: 'python' })),
    );
    await settle();
    assert.equal($('.cs-posts-locked') === null, true);
    await click('Write a solution');
    const area = $('textarea[aria-label="Body"]');
    assert.equal(area.value.includes('```python\ndef f():\n    return 1\n```'), true);
    const title = $('.cs-post-editor input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(title, 'My take');
      title.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => $('.cs-post-editor').requestSubmit());
    await settle();
    const [path, sent] = posts.at(-1);
    assert.equal(path, '/api/oj/posts');
    assert.equal(sent.problemId, 'lc-1');
    assert.equal(sent.title, 'My take');
    assert.equal(sent.language, 'python');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
