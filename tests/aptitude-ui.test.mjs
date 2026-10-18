// /oa/aptitude in jsdom: practice misses land in the review (this browser, or the account note read
// before it is written); the speed test has no way back, resumes after a reload, hides the
// formula sheet while running and hands itself in on time; a running mock OA hides it all.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

const settle = (ms = 50) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const buttons = () => [...document.querySelectorAll('button')];
const button = (text) => buttons().find((n) => n.textContent.trim().startsWith(text));
const realFetch = globalThis.fetch;

function dom(stored = {}) {
  const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/oa/aptitude' }).window;
  for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value);
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'navigator', 'location', 'history', 'StorageEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return window;
}
async function render(viewer = '') {
  const { createRoot } = await import('react-dom/client');
  const { AptitudePractice } = await import('../app/oa/aptitude/practice.tsx');
  const root = createRoot(document.getElementById('root'));
  const sheet = createElement('details', { className: 'apt-formulas' }, createElement('summary', null, 'Formula sheet'));
  await act(async () => root.render(createElement(AptitudePractice, { zh: false, viewer, children: sheet })));
  await settle();
  return root;
}
const key = async (k) => act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
const shownId = () => document.querySelector('.oa-mcq-choices input').name.slice('mcq-'.length);

test('practice: a miss is graded, explained and saved to this browser’s review when signed out', async () => {
  dom();
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const { aptitudeById } = await import('../lib/aptitude.ts');
  const { mcqDay } = await import('../lib/mock-oa.ts');
  const { MCQ_LOCAL_KEY } = await import('../app/oa/mcq/practice.tsx');
  const root = await render();
  assert.ok(document.querySelector('[role="tablist"]'));
  assert.ok(document.querySelector('.apt-formulas'), 'formula sheet shows outside a test');
  await act(async () => button('Speed & distance').click());
  const id = shownId();
  assert.match(id, /^apt-speed-\d+$/);
  const q = aptitudeById(id);
  const wrong = (q.answer[0] + 1) % 4;
  await act(async () => document.querySelectorAll('.oa-mcq-choices input')[wrong].click());
  await act(async () => button('Submit').click());
  await settle();
  assert.match(document.querySelector('.oa-mcq-why').textContent, /The answer is/);
  assert.deepEqual(JSON.parse(localStorage.getItem(MCQ_LOCAL_KEY))[id], [0, mcqDay(), wrong]);
  // A right answer to a fresh question writes nothing.
  await act(async () => button('Next question').click());
  const next = aptitudeById(shownId());
  await act(async () => document.querySelectorAll('.oa-mcq-choices input')[next.answer[0]].click());
  await act(async () => button('Submit').click());
  await settle();
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(MCQ_LOCAL_KEY))), [id]);
  root.unmount();
  globalThis.fetch = realFetch;
});

test('practice signed in: the account review is read first, then written with the miss added', async () => {
  dom();
  const puts = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(JSON.parse(init.body).body));
      return Response.json({});
    }
    return Response.json({ target: 'mcq:answers', body: JSON.stringify({ 'mcq-os-1': [1, 100, 2] }), updatedAt: 1 });
  };
  const { aptitudeById } = await import('../lib/aptitude.ts');
  const root = await render('u1');
  const id = shownId();
  await act(async () => document.querySelectorAll('.oa-mcq-choices input')[(aptitudeById(id).answer[0] + 1) % 4].click());
  await act(async () => button('Submit').click());
  await settle();
  assert.equal(puts.length, 1);
  assert.deepEqual(Object.keys(puts[0]).sort(), [id, 'mcq-os-1'].sort());
  root.unmount();
  globalThis.fetch = realFetch;
});

test('speed test: no going back, keys pick and advance, a reload resumes, the formula sheet hides', async () => {
  dom();
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const { SPEED_KEY, speedSet } = await import('../lib/aptitude.ts');
  let root = await render();
  await act(async () => button('50-question speed test').click());
  await act(async () => button('Start the test').click());
  assert.match(document.body.textContent, /Question 1 of 50/);
  assert.equal(document.querySelector('.apt-formulas'), null, 'no formula sheet during the test');
  assert.equal(document.querySelector('[role="tablist"]'), null, 'no practice tab during the test');
  assert.equal(document.querySelector('.oa-mcq-palette'), null);
  assert.ok(!buttons().some((b) => /back|previous|上一题|返回/i.test(b.textContent)), 'no way back');
  assert.deepEqual(buttons().map((b) => b.textContent.trim()), ['Next', 'Skip']);
  assert.equal(document.querySelector('.oa-mcq-why'), null, 'no explanations during the test');
  await key('2');
  assert.equal(document.querySelectorAll('.oa-mcq-choices input')[1].checked, true);
  await key('Enter');
  assert.match(document.body.textContent, /Question 2 of 50/);
  await act(async () => button('Skip').click());
  const saved = JSON.parse(localStorage.getItem(SPEED_KEY));
  assert.equal(saved.at, 2);
  assert.deepEqual(saved.picks.slice(0, 2), [1, null]);
  assert.ok(saved.ms[0] >= 0 && saved.ms[1] >= 0 && saved.ms[2] === null);
  root.unmount();

  // Reload: straight back to question 3, the same question, the clock still running.
  root = await render();
  assert.match(document.body.textContent, /Question 3 of 50/);
  assert.equal(shownId(), speedSet(saved.seed, false)[2]);
  assert.equal(document.querySelector('.apt-formulas'), null);
  root.unmount();
  globalThis.fetch = realFetch;
});

test('speed test: time up hands it in, shows the result, and the misses go to the review', async () => {
  const { SPEED_KEY, newSpeed, speedSet, aptitudeById } = await import('../lib/aptitude.ts');
  const { MCQ_LOCAL_KEY } = await import('../app/oa/mcq/practice.tsx');
  const now = Date.now();
  // Started 15 minutes and a second ago, three answered (one wrong), on question 4.
  const s = newSpeed(99, true, false, now - 15 * 60_000 - 1000);
  const ids = speedSet(99);
  const answers = ids.map((id) => aptitudeById(id).answer[0]);
  s.picks = s.picks.map((_, i) => (i < 2 ? answers[i] : i === 2 ? (answers[2] + 1) % 4 : null));
  s.ms = s.ms.map((_, i) => (i < 3 ? 20_000 : null));
  s.at = 3;
  s.shownAt = now - 60_000;
  dom({ [SPEED_KEY]: JSON.stringify(s) });
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const root = await render();
  assert.match(document.body.textContent, /Your result/);
  assert.match(document.querySelector('.apt-result').textContent, /Net score.*1\.7 \/ 50/);
  assert.ok(document.querySelector('.apt-formulas'), 'the formula sheet is back');
  assert.ok(document.querySelector('.apt-pace svg[role="img"]'));
  assert.equal(document.querySelectorAll('.apt-table tbody tr').length, 50);
  assert.match(document.querySelector('.apt-rules').textContent, /never reached/);
  await settle();
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(MCQ_LOCAL_KEY))), [ids[2]]);
  assert.equal(JSON.parse(localStorage.getItem(SPEED_KEY)).saved, true);
  await act(async () => button('Take a new test').click());
  assert.equal(localStorage.getItem(SPEED_KEY), null);
  assert.ok(button('Start the test'));
  root.unmount();

  // Running out while the page is open: the ticking clock hands it in.
  const close = newSpeed(5, false, false, Date.now() - 15 * 60_000 + 400);
  dom({ [SPEED_KEY]: JSON.stringify(close) });
  const open = await render();
  assert.match(document.body.textContent, /Question 1 of 50/);
  await settle(1100);
  assert.match(document.body.textContent, /Your result/);
  open.unmount();
  globalThis.fetch = realFetch;
});

test('a mock OA in progress: only a notice', async () => {
  const { mockStorageKey } = await import('../lib/mock-oa.ts');
  const active = { id: 'm1', ids: ['lc-1'], slots: ['easy'], minutes: 60, createdAt: Date.now(), startedAt: Date.now() };
  dom({ [mockStorageKey('u9')]: JSON.stringify({ active, history: [] }) });
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const root = await render('u9');
  assert.match(document.querySelector('[role="status"]').textContent, /mock OA is in progress/);
  assert.equal(document.querySelector('.apt-formulas'), null);
  assert.equal(document.querySelector('[role="tablist"]'), null);
  assert.equal(document.querySelector('.oa-mcq-item'), null);
  root.unmount();
  globalThis.fetch = realFetch;
});
