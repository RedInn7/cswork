import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

// CSS is a no-op; next/link (aliased by the bundler) is a stub.
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.localStorage.setItem('cswork:locale', 'en'); // English UI copy below; the site defaults to zh.
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { ContentDetail } = await import('../components/content-library.tsx');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const click = (label) => act(async () => button(label).click());
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const body = [
  '# Tell me about a time you disagreed with a teammate',
  '',
  'Walk through the conflict and how it ended.',
  '',
  '### What a Strong Answer Covers',
  '- SECRET-RUBRIC: a specific disagreement with stakes',
].join('\n');
const question = {
  type: 'interview_question', slug: 'disagree-1', title: 'Disagreeing with a teammate', summary: null,
  company: { slug: 'amazon', name: 'Amazon' }, role: null, category: 'Behavioral & Leadership', difficulty: null,
  round: null, seniority: null, tags: [], publishedAt: null, partial: false,
  body, updatedAt: null, extra: {}, relations: [], dupOf: null, practice: null, companyPractice: null,
};

test('question page: the rubric stays closed until the learner writes or insists', async () => {
  const puts = [];
  let answer = '';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/content/item')) return Response.json(question);
    if (init.method === 'PUT') {
      puts.push([decodeURIComponent(u.split('target=')[1]), JSON.parse(init.body).body]);
      return Response.json({ updatedAt: 9 });
    }
    if (u.includes('target=content')) return Response.json({ body: answer, updatedAt: answer ? 1 : null });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  const render = () =>
    act(async () =>
      root.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'disagree-1' }, navigate() {}, problemIds: [], userId: 'u1' })),
    );
  await render();
  await settle();
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), false, 'the rubric is hidden at first');
  assert.equal(document.body.textContent.includes('Walk through the conflict'), true);
  // Insisting asks once to try first, then opens.
  await click('Show the answer');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), false);
  assert.equal(document.body.textContent.includes('Write a few lines first?'), true);
  await click("OK, I'll try first");
  assert.equal(document.activeElement?.classList.contains('ip-try-input'), true, 'focus goes to the answer box');
  await type(document.querySelector('.ip-try-input'), 'I would set up a design review');
  assert.equal(!!button('Compare with the reference answer'), true);
  await click('Compare with the reference answer');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), true);
  await settle(900);
  assert.deepEqual(puts.at(-1), ['content:interview_question/disagree-1', 'I would set up a design review']);
  await act(async () => root.unmount());

  // An answer written on an earlier visit counts as trying: the rubric opens on load.
  answer = 'my earlier answer';
  const again = createRoot(document.getElementById('root'));
  await act(async () =>
    again.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'disagree-1' }, navigate() {}, problemIds: [], userId: 'u1' })),
  );
  await settle();
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), true);
  await act(async () => again.unmount());
});

test('a guest answer is saved to the account on sign-in, or offered against the saved one', async () => {
  const { TryFirst } = await import('../components/try-first.tsx');
  const puts = [];
  let saved = '';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body).body);
      return Response.json({ updatedAt: 9 });
    }
    if (u.includes('target=content')) return Response.json({ body: saved, updatedAt: saved ? 1 : null });
    throw new Error(`unexpected ${u}`);
  };
  // Question page (no local copy): typed as a guest, then signed in without a reload.
  const root = createRoot(document.getElementById('root'));
  const view = (userId) =>
    act(async () => root.render(createElement(TryFirst, { userId, target: 'content:interview_question/q9', revealed: false, onReveal() {} })));
  await view(null);
  await type(document.querySelector('.ip-try-input'), 'guest outline');
  await view('u1');
  await settle();
  assert.equal(document.querySelector('.ip-try-input').value === 'guest outline', true, 'still on screen after sign-in');
  assert.deepEqual(puts, ['guest outline']);
  await act(async () => root.unmount());

  // A draft kept on this device as a guest (the system design reader's), with a different answer already saved: the learner picks.
  saved = 'answer from last week';
  puts.length = 0;
  let run = 'run notes';
  const again = createRoot(document.getElementById('root'));
  const solo = (userId) =>
    act(async () =>
      again.render(
        createElement(TryFirst, {
          userId, target: 'content:interview_question/q9', revealed: false, onReveal() {},
          local: { value: run, onChange: (v) => (run = v) },
        }),
      ),
    );
  await solo(null);
  await solo('u1');
  await settle();
  assert.equal(document.querySelector('.ip-try-input').value === 'answer from last week', true);
  assert.equal(document.body.textContent.includes("Use this device's version"), true);
  await click("Use this device's version");
  await settle(900);
  assert.deepEqual(puts, ['run notes']);
  await act(async () => again.unmount());
});
