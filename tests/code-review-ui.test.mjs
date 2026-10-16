// The review page and the "ask for a review" box: comments sit under their line as plain text,
// a click on a line number posts {line, body}; the link is made, shown once and copied; the
// workspace offers it only on an accepted formal submission; the page is never indexed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent(
    "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { CodeReview, ReviewLink } = await import('../components/code-review.tsx');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const review = {
  id: null,
  mine: false,
  problem: { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum' },
  language: 'python',
  code: 'def f():\n    return 1',
  status: 'accepted',
  note: 'Is this idiomatic?',
  author: null,
  createdAt: 0,
  comments: [{ id: 'c1', line: 2, body: '<b>bold?</b>', createdAt: 1, reviewer: 1, handle: null, mine: false }],
};

test('the review page: comments under their line as text; a line number opens the form and posts', async () => {
  const posted = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/reviews/tok/comments')) {
      posted.push(JSON.parse(init.body));
      return Response.json({ id: 'c2' });
    }
    if (u.endsWith('/api/oj/reviews/tok')) return Response.json(review);
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(CodeReview, { token: 'tok' })));
  await settle();
  assert.equal(document.querySelector('h1').textContent, 'Two Sum');
  assert.equal(document.querySelector('h1 a').getAttribute('href'), '/?view=problem&problem=lc-1');
  const lines = document.querySelectorAll('.cr-code > li');
  assert.equal(lines.length, 2);
  const comment = lines[1].querySelector('.cr-comment');
  assert.equal(comment.querySelector('strong').textContent, 'Reviewer 1');
  assert.equal(comment.querySelector('p').textContent, '<b>bold?</b>', 'plain text, never HTML');
  assert.equal(comment.querySelector('b'), null);
  assert.equal(button('Close this link'), undefined, 'only the author closes it');

  const number = lines[0].querySelector('.cr-num');
  assert.equal(number.getAttribute('aria-label'), 'Comment on line 1');
  await act(async () => number.click());
  assert.equal(number.getAttribute('aria-expanded'), 'true');
  await type(lines[0].querySelector('textarea'), 'Name it better.');
  await act(async () => button('Comment').click());
  await settle();
  assert.deepEqual(posted, [{ line: 1, body: 'Name it better.' }]);
  await act(async () => root.unmount());
});

test('ask for a review: the link is made with the note, shown once and copied', async () => {
  const made = [];
  let copied = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text) => void (copied = text) },
  });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/reviews') && init.method === 'POST') {
      made.push(JSON.parse(init.body));
      return Response.json({ id: 'r1', token: 'T'.repeat(32) });
    }
    if (u.endsWith('/api/oj/reviews?submission=s1')) return Response.json({ items: made.length ? [{ id: 'r1', note: '', createdAt: Date.UTC(2026, 9, 15, 12), comments: 2 }] : [] });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ReviewLink, { submissionId: 's1' })));
  const details = document.querySelector('details');
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });
  await settle();
  await type(details.querySelector('textarea'), 'Check the loop');
  await act(async () => button('Make a review link').click());
  await settle();
  assert.deepEqual(made, [{ submissionId: 's1', note: 'Check the loop' }]);
  const link = `https://cswork.test/review/${'T'.repeat(32)}`;
  assert.equal(details.querySelector('.cr-made input').value, link);
  assert.equal(copied, link);
  assert.equal(details.querySelector('output').textContent, 'Link copied.');
  assert.equal(details.querySelector('.cr-links a').getAttribute('href'), '/review/r1');
  assert.equal(details.querySelector('.cr-links a').textContent, '10/15/2026 · 2 comments');
  await act(async () => root.unmount());
});

test('the workspace offers it on an accepted formal submission; the page is never indexed', () => {
  const workspace = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.match(workspace, /inspected\.mode === 'judge' && inspected\.status === 'accepted' && communityProblem\(inspected\.problem_id\) && \(\s*<ReviewLink/);
  const page = readFileSync(new URL('../app/review/[token]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /referrer: 'no-referrer'/);
  assert.ok(!page.includes('seoMetadata'), 'no canonical URL carrying the token');
});
