import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

const bank = JSON.parse(readFileSync('lib/content/oa-mcq.json', 'utf8')).questions;
const byId = new Map(bank.map((q) => [q.id, q]));
const single = byId.get('mcq-os-1');
const multi = bank.find((q) => q.answer.length > 1);
const settle = (ms = 50) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim().startsWith(text));

function dom(stored = {}) {
  const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/oa/mcq' }).window;
  for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value);
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history', 'StorageEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return window;
}
async function render(element) {
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await settle();
  return root;
}

test('every select-all question says so, and only those', () => {
  for (const q of bank) {
    assert.equal(q.answer.length > 1, q.en.q.includes('Select all that apply'), q.id);
    assert.equal(q.answer.length > 1, q.zh.q.includes('多选'), q.id);
  }
});

test('practice: submit grades and explains, answers persist in this browser, filters narrow the list', async () => {
  dom();
  const { McqPractice, parseAnswers } = await import('../app/oa/mcq/practice.tsx');
  assert.deepEqual(parseAnswers('{"a":[1],"b":[],"c":"x","d":[0.5]}'), { a: [1] });
  assert.deepEqual(parseAnswers('nope'), {});
  const items = [single, multi, byId.get('mcq-python-1')].map((q) => ({ ...q, zh: undefined, en: undefined, text: q.en }));
  const root = await render(createElement(McqPractice, { items, zh: false }));
  assert.match(document.body.textContent, /3 questions/);
  assert.equal(document.querySelectorAll('input[type="checkbox"]').length, multi.en.choices.length);
  assert.match(document.querySelector('pre code').textContent, /def add/);

  // Submit needs a pick.
  const first = document.querySelector('.oa-mcq-list > li');
  const submit = first.querySelector('.oa-mcq-actions button');
  assert.equal(submit.getAttribute('aria-disabled'), 'true');
  const wrong = single.en.choices.findIndex((_, i) => !single.answer.includes(i));
  await act(async () => first.querySelectorAll('input')[wrong].click());
  await act(async () => submit.click());
  assert.match(first.querySelector('.oa-mcq-why').textContent, new RegExp(`The answer is ${'ABCDEF'[single.answer[0]]}`));
  assert.equal(first.querySelector('[data-state="wrong"] .oa-mcq-mark').textContent, 'Your pick');
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:oa-mcq:v1')), { [single.id]: [wrong] });
  assert.match(document.body.textContent, /1 of 3 answered · 0 correct/);

  // The section filter narrows the list and the counts.
  await act(async () => button('Code output').click());
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 1);
  assert.match(document.body.textContent, /1 questions/);
  root.unmount();

  // A new visit restores the submitted answer; clearing forgets it.
  const again = await render(createElement(McqPractice, { items, zh: false }));
  assert(document.querySelector('.oa-mcq-why'));
  await act(async () => button('Clear my answers').click());
  assert.equal(document.querySelector('.oa-mcq-why'), null);
  assert.equal(localStorage.getItem('cswork:oa-mcq:v1'), null);
  again.unmount();
});

const boot = { person: null, courses: [], problems: [], progress: [], submissions: [], notifications: [], services: {} };
const session = (extra) => ({
  id: '11111111-2222-4333-8444-555555555555',
  company: 'rubrik',
  name: 'Rubrik',
  platform: 'HackerRank',
  preset: true,
  scoring: 'tests',
  source: 'mixed',
  slots: ['easy', 'medium'],
  ids: ['lc-1', 'lc-2'],
  minutes: 90,
  skew: 0,
  createdAt: Date.now() - 60000,
  ...extra,
});

test('mock OA: the MCQ section saves picks, and handing it in starts the coding clock', async () => {
  const s = session({ mcq: { ids: [single.id, multi.id], picks: [[], []], minutes: 15, startedAt: Date.now() - 1000 } });
  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: s, history: [] }) });
  const { MockOa } = await import('../components/mock-oa.tsx');
  const moves = [];
  const root = await render(createElement(MockOa, { boot, params: { view: 'mock', session: s.id }, navigate: (...a) => moves.push(a) }));
  assert.match(document.body.textContent, /MCQ section/);
  assert.match(document.querySelector('[role="timer"]').textContent, /14:5\d/);
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 2);
  assert.equal(document.querySelector('.oa-mcq-why'), null, 'no answers during the exam');
  await act(async () => document.querySelector('.oa-mcq-list input').click());
  const saved = () => JSON.parse(localStorage.getItem('cswork:mock:v1:guest')).active;
  assert.deepEqual(saved().mcq.picks, [[0], []]);
  await act(async () => button('Hand in and start coding (1/2 answered)').click());
  const coding = saved();
  assert(coding.startedAt && coding.mcq.finishedAt === coding.startedAt);
  assert.deepEqual(moves.at(-1), ['problem', { problem: 'lc-1', mock: s.id }]);
  root.unmount();
});

test('mock OA report: an MCQ row with its score, and a review with the answers', async () => {
  const start = Date.now() - 3600000;
  const picks = [single.answer, [multi.answer[0]]];
  const s = session({
    startedAt: start,
    finishedAt: start + 600000,
    mcq: { ids: [single.id, multi.id], picks, minutes: 15, startedAt: start - 900000, finishedAt: start },
  });
  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: null, history: [s] }) });
  const { MockOa } = await import('../components/mock-oa.tsx');
  const root = await render(createElement(MockOa, { boot, params: { view: 'mock', report: s.id }, navigate() {} }));
  const row = [...document.querySelectorAll('.mock-results li')].find((li) => li.textContent.includes('MCQ section'));
  assert(row, 'MCQ row');
  assert.match(row.textContent, /1 of 2 correct/);
  assert.match(row.querySelector('.mock-points').textContent, /^50/);
  const review = document.getElementById('mock-mcq-review');
  assert.equal(review.querySelectorAll('.oa-mcq-why').length, 2);
  assert.equal(review.querySelectorAll('.oa-mcq-why[data-state="right"]').length, 1);
  window.HTMLElement.prototype.scrollIntoView = () => {}; // not in jsdom
  await act(async () => row.querySelector('button').click());
  assert.equal(review.open, true);
  root.unmount();
});

test('mock OA check-in: a preset with an MCQ section offers it (on by default); a custom mock does not', async () => {
  const presets = JSON.parse(readFileSync('lib/content/mock-oa-presets.json', 'utf8')).companies;
  const rubrik = { ...presets.find((c) => c.slug === 'rubrik'), pool: { oa: 9, lc: 9, total: 18 } };
  globalThis.fetch = async () => new Response(JSON.stringify({ companies: [rubrik], others: [], all: { oa: 9, lc: 9 } }));
  const { MockOa } = await import('../components/mock-oa.tsx');
  const moves = [];
  const s = session({});
  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: s, history: [] }) });
  // The problems must exist for the start button to be enabled.
  const known = { ...boot, problems: [{ id: 'lc-1' }, { id: 'lc-2' }] };
  let root = await render(createElement(MockOa, { boot: known, params: { view: 'mock', session: s.id }, navigate: (...a) => moves.push(a) }));
  const toggle = document.querySelector('.mock-mcq-toggle input');
  assert.equal(toggle?.checked, true);
  assert.match(document.querySelector('.mock-mcq-toggle').textContent, /Include the MCQ section: 10 questions \/ 15 min/);
  await act(async () => button('Start the clock').click());
  await settle();
  const active = JSON.parse(localStorage.getItem('cswork:mock:v1:guest')).active;
  assert.equal(active.startedAt, undefined, 'the coding clock waits');
  assert.equal(active.mcq.ids.length, 10);
  assert(active.mcq.ids.every((id) => byId.get(id).topic === 'concurrency'));
  assert.equal(moves.length, 0, 'stays on the mock page for the MCQ section');
  assert.match(document.body.textContent, /Hand in and start coding \(0\/10 answered\)/);
  root.unmount();

  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: session({ preset: false }), history: [] }) });
  root = await render(createElement(MockOa, { boot, params: { view: 'mock', session: s.id }, navigate() {} }));
  assert.equal(document.querySelector('.mock-mcq-toggle'), null);
  root.unmount();
  delete globalThis.fetch;
});
