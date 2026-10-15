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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { SolutionPosts } = await import('../components/solution-posts.tsx');
const { NotificationsPane } = await import('../components/lms-notifications.tsx');

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const button = (text) => $$('button').find((b) => b.textContent.includes(text));
const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
function type(element, value) {
  const proto = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
const sent = [];
let reads = [];
let reply = () => ({});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  if (init.method === 'POST') sent.push([path, JSON.parse(init.body)]);
  else reads.push(path);
  return Response.json(reply(path, init));
};

const postId = '11111111-1111-4111-8111-111111111111';
const post = {
  id: postId,
  problemId: 'discuss:offer',
  title: 'Offer numbers',
  language: '',
  hidden: 0,
  createdAt: 1,
  updatedAt: 1,
  author: '',
  mine: false,
  votes: 0,
  voted: false,
  comments: 2,
  anonymous: true,
  pinned: true,
  reputation: null,
  body: 'Details',
};
const comments = [
  { id: 'c-top', parentId: null, body: 'Congrats', createdAt: 1, author: 'ada', mine: false, votes: 1, voted: false, op: false, anonymous: false, reputation: 12 },
  { id: 'c-reply', parentId: 'c-top', body: 'Thanks', createdAt: 2, author: '', mine: false, votes: 0, voted: false, op: true, anonymous: true, reputation: null },
];

test('a thread: anonymous and featured, nested replies, comment votes and a moderator’s pin', async () => {
  const root = createRoot($('#root'));
  reply = (path) => {
    if (path.endsWith('/vote')) return { votes: 2, voted: true };
    if (path.endsWith('/pin') || path.endsWith('/unpin')) return { id: postId, pinned: path.endsWith('/pin') };
    return { post, comments, moderator: true };
  };
  try {
    await act(async () => root.render(createElement(SolutionPosts, { problemId: 'discuss:offer', english: true, initialPost: postId })));
    await settle();
    assert.ok($('.cs-post-meta').textContent.includes('Anonymous'));
    assert.ok($('.cs-post-meta [data-pinned]'), 'featured badge');
    const items = $$('.cs-comments li');
    assert.deepEqual(items.map((li) => li.hasAttribute('data-reply')), [false, true]);
    assert.ok(items[0].textContent.includes('12 rep'));
    assert.ok(items[1].textContent.includes('Anonymous') && items[1].textContent.includes('OP'));
    // The indent is visual only: a screen reader hears whose comment a reply answers.
    assert.equal(items[1].querySelector('.sr-only').textContent, 'Reply to ada:');
    assert.equal(items[0].querySelector('.cs-comment-meta .sr-only'), null);

    // Replying to a reply names that reply (the server files it under the top-level comment).
    await act(async () => items[1].querySelector('[aria-expanded]').click());
    const box = $('textarea[aria-label="Write a reply"]');
    await act(async () => type(box, 'You are welcome'));
    await act(async () => box.form.requestSubmit());
    await settle();
    assert.deepEqual(sent.at(-1), [`/api/oj/posts/${postId}/comments`, { body: 'You are welcome', parentId: 'c-reply' }]);
    // The reply form is gone; focus is back on the Reply button that opened it, not <body>.
    assert.equal($('textarea[aria-label="Write a reply"]'), null);
    assert.equal(document.activeElement, $$('.cs-comments li')[1].querySelector('[aria-expanded]'));

    await act(async () => $$('.cs-comments [data-vote]')[0].click());
    assert.deepEqual(sent.at(-1), ['/api/oj/post-comments/c-top/vote', { on: true }]);
    assert.equal($$('.cs-comments [data-vote]')[0].getAttribute('aria-pressed'), 'true');

    await act(async () => button('Unfeature').click());
    assert.equal(sent.at(-1)[0], `/api/oj/posts/${postId}/unpin`);
    assert.ok(button('Feature'));
  } finally {
    await act(async () => root.unmount());
  }
});

test('posting anonymously is offered only where it is allowed', async () => {
  for (const [problemId, offered] of [
    ['discuss:referral', false],
    ['lc-1', false],
    ['discuss:offer', true],
  ]) {
    reply = (path) => (path.includes('companies') ? { items: [] } : { solved: true, items: [], more: false });
    const root = createRoot($('#root'));
    try {
      await act(async () => root.render(createElement(SolutionPosts, { problemId, english: true, unlocked: true })));
      await settle();
      await act(async () => $('.cs-posts-write').click());
      const box = $$('.cs-post-editor input[type="checkbox"]').find((c) => c.parentElement.textContent.includes('anonymously'));
      assert.equal(!!box, offered, problemId);
      if (!offered) continue;
      await act(async () => type($('.cs-post-editor input'), 'Comp'));
      await act(async () => type($('textarea[aria-label="Body"]'), 'Numbers'));
      await act(async () => box.click());
      reply = () => ({ post: { ...post, mine: true }, comments: [] });
      await act(async () => $('.cs-post-editor').requestSubmit());
      await settle();
      assert.equal(sent.at(-1)[0], '/api/oj/posts');
      assert.equal(sent.at(-1)[1].anonymous, true);
    } finally {
      await act(async () => root.unmount());
    }
  }
});

test('the inbox filters by kind', async () => {
  reads = [];
  reply = () => ({ items: [], total: 0, unread: 0, nextCursor: null });
  const root = createRoot($('#root'));
  try {
    await act(async () =>
      root.render(createElement(NotificationsPane, { refresh: async () => {}, navigate: () => {}, close: () => {} })),
    );
    await settle();
    assert.equal(reads.at(-1), '/api/lms/notifications?');
    await act(async () => button('Mentions').click());
    await settle();
    assert.equal(reads.at(-1), '/api/lms/notifications?kind=mention&');
    assert.equal(button('Mentions').getAttribute('aria-pressed'), 'true');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
