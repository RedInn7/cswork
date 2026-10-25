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
  window.localStorage.setItem('cswork:locale', 'en'); // UI copy below is the English site
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

const realFetch = globalThis.fetch;
test('practice: submit grades and explains, answers persist in this browser, filters narrow the list', async () => {
  dom({ 'cswork:oa-mcq:v1': JSON.stringify({ 'mcq-python-1': byId.get('mcq-python-1').answer }) });
  // Signed out: the account note answers 401, so answers stay in this browser.
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const { McqPractice, parseAnswers } = await import('../app/oa/mcq/practice.tsx');
  const { mcqDay } = await import('../lib/mock-oa.ts');
  const today = mcqDay();
  assert.deepEqual(parseAnswers('{"a":[1],"b":[],"c":"x","d":[0.5]}'), { a: [1] });
  assert.deepEqual(parseAnswers('nope'), {});
  const items = [single, multi, byId.get('mcq-python-1')].map((q) => ({ ...q, zh: undefined, en: undefined, text: q.en }));
  const root = await render(createElement(McqPractice, { items, zh: false }));
  // An answer saved before spaced review shows as answered today.
  assert.match(document.body.textContent, /1 of 3 answered/);
  assert.match(document.body.textContent, /stay in this browser/);
  // Moved over and saved at once, so a reload keeps the day it moved instead of restarting it.
  assert.equal(localStorage.getItem('cswork:oa-mcq:v1'), null);
  assert.equal(JSON.parse(localStorage.getItem('cswork:oa-mcq:v2'))['mcq-python-1'][1], today);
  assert.equal(document.querySelectorAll('input[type="checkbox"]').length, multi.en.choices.length);
  assert.match(document.querySelector('pre code').textContent, /def add/);
  // The snippet describes its question's radio group (the legend alone is only "what does this print?").
  const pre = document.querySelector('pre.oa-mcq-code');
  assert.ok(pre.id);
  assert.equal(pre.closest('fieldset').getAttribute('aria-describedby'), pre.id);
  assert.equal(document.querySelector('fieldset').getAttribute('aria-describedby'), null);

  // Submit needs a pick.
  const first = document.querySelector('.oa-mcq-list > li');
  const submit = first.querySelector('.oa-mcq-actions button');
  assert.equal(submit.getAttribute('aria-disabled'), 'true');
  const wrong = single.en.choices.findIndex((_, i) => !single.answer.includes(i));
  await act(async () => first.querySelectorAll('input')[wrong].click());
  await act(async () => submit.click());
  assert.match(first.querySelector('.oa-mcq-why').textContent, new RegExp(`The answer is ${'ABCDEF'[single.answer[0]]}`));
  assert.equal(first.querySelector('[data-state="wrong"] .oa-mcq-mark').textContent, 'Your pick');
  assert.match(first.querySelector('.oa-mcq-due').textContent, /Back for review in 1 day$/);
  // Compact entries [box, day, ...picks]: a miss is box 0.
  const saved = JSON.parse(localStorage.getItem('cswork:oa-mcq:v2'));
  assert.deepEqual(saved[single.id], [0, today, wrong]);
  assert.match(document.body.textContent, /2 of 3 answered · 1 correct/);

  // Missed only: just the wrong one.
  await act(async () => button('Missed only').click());
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 1);
  await act(async () => button('Every question').click());
  // The section filter narrows the list and the counts.
  await act(async () => button('Code output').click());
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 1);
  assert.match(document.body.textContent, /1 of 1 answered/);
  root.unmount();

  // A new visit restores the submitted answer; clearing forgets it, old key included.
  const again = await render(createElement(McqPractice, { items, zh: false }));
  assert(document.querySelector('.oa-mcq-why'));
  await act(async () => button('Clear my answers').click());
  assert.equal(document.querySelector('.oa-mcq-why'), null);
  assert.equal(localStorage.getItem('cswork:oa-mcq:v2'), null);
  assert.equal(localStorage.getItem('cswork:oa-mcq:v1'), null);
  again.unmount();
  globalThis.fetch = realFetch;
});

test('practice signed in: the review lives in the account note, due questions come back, chapter quiz misses are listed', async () => {
  const today = Math.floor(Date.now() / 86_400_000);
  dom({ 'cswork:oa-mcq:v2': JSON.stringify({ 'mcq-python-1': [1, today, 0] }) });
  const { McqPractice, sdMisses } = await import('../app/oa/mcq/practice.tsx');
  // Missed yesterday: due today. Right 2 days ago in box 1: back in 1 day.
  const note = { [single.id]: [0, today - 1, 9], [multi.id]: [1, today - 2, ...multi.answer] };
  const puts = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'PUT') {
      puts.push([url, JSON.parse(init.body).body]);
      return new Response('{}');
    }
    if (String(url).includes('prefix=sd')) return Response.json({ items: [{ target: 'sd:cache', body: '{"picks":[0,2]}' }] });
    return Response.json({ target: 'mcq:answers', body: JSON.stringify(note), updatedAt: 1 });
  };
  const items = [single, multi, byId.get('mcq-python-1')].map((q) => ({ ...q, zh: undefined, en: undefined, text: q.en }));
  const sd = [{ slug: 'cache', title: 'Caching', answers: [0, 1] }];
  const root = await render(createElement(McqPractice, { items, zh: false, sd }));
  assert.match(document.body.textContent, /saved to your account/);
  // This browser's answers moved into the account and left the browser.
  assert.equal(puts.length, 1);
  assert.equal(puts[0][0], '/api/oj/notes?target=mcq%3Aanswers');
  assert.deepEqual(JSON.parse(puts[0][1])['mcq-python-1'], [1, today, 0]);
  assert.equal(localStorage.getItem('cswork:oa-mcq:v2'), null);

  // Due today: the missed one (fresh, no answer shown) plus the chapter quiz miss.
  assert.match(button('Due today').textContent, /2$/);
  await act(async () => button('Due today').click());
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 1);
  assert.equal(document.querySelector('.oa-mcq-why'), null);
  // The system design course is down: the missed chapter is named, not linked.
  assert.equal(document.querySelector('.oa-mcq-sd a'), null);
  assert.equal(document.querySelector('.oa-mcq-sd li span').textContent, 'Caching');
  assert.match(document.querySelector('.oa-mcq-sd').textContent, /Q2/);
  // Answering it right moves it to box 1 in the account and keeps it on screen.
  const first = document.querySelector('.oa-mcq-list > li');
  await act(async () => first.querySelectorAll('input')[single.answer[0]].click());
  await act(async () => first.querySelector('.oa-mcq-actions button').click());
  await settle();
  assert.match(first.querySelector('.oa-mcq-why').textContent, /Correct/);
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 1);
  assert.deepEqual(JSON.parse(puts.at(-1)[1])[single.id], [1, today, ...single.answer]);
  root.unmount();
  globalThis.fetch = realFetch;

  // A failed move keeps this browser's copy for the next visit.
  dom({ 'cswork:oa-mcq:v2': JSON.stringify({ 'mcq-python-1': [1, today, 0] }) });
  globalThis.fetch = async (url, init) =>
    init?.method === 'PUT' ? new Response('{}', { status: 429 }) : Response.json({ target: 'mcq:answers', body: '', updatedAt: null });
  const failed = await render(createElement(McqPractice, { items, zh: false }));
  assert.match(document.body.textContent, /The last save failed/);
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:oa-mcq:v2'))['mcq-python-1'], [1, today, 0]);
  failed.unmount();
  // Signed out on a topic page's quiz, which never moves answers: the note points to the full page.
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const quiz = await render(createElement(McqPractice, { items, zh: false, compact: true }));
  assert.equal(document.querySelector('.oa-mcq-note a').getAttribute('href'), '/oa/mcq');
  quiz.unmount();
  globalThis.fetch = realFetch;

  // Chapter quiz answers: only full, well-formed ones count.
  assert.deepEqual(sdMisses(sd, new Map([['cache', '{"picks":[0,1]}']])), []);
  assert.deepEqual(sdMisses(sd, new Map([['cache', '{"picks":[0]}']])), []);
  assert.deepEqual(sdMisses(sd, new Map([['cache', 'nope']])), []);
  assert.deepEqual(sdMisses(sd, new Map([['cache', '{"picks":[1,1]}']])), [{ slug: 'cache', title: 'Caching', wrong: [1] }]);
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

test('mock OA: the question palette shows answered, unanswered and marked questions; marks are saved', async () => {
  const s = session({ mcq: { ids: [single.id, multi.id], picks: [[0], []], minutes: 15, startedAt: Date.now() - 1000 } });
  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: s, history: [] }) });
  const { MockOa } = await import('../components/mock-oa.tsx');
  const root = await render(createElement(MockOa, { boot, params: { view: 'mock', session: s.id }, navigate() {} }));
  const saved = () => JSON.parse(localStorage.getItem('cswork:mock:v1:guest')).active;
  const cells = () => [...document.querySelectorAll('.oa-mcq-palette ol button')];
  const states = () => cells().map((b) => `${b.dataset.state}: ${b.getAttribute('aria-label')}`);
  const flagButtons = () => document.querySelectorAll('.oa-mcq-flag');
  assert.deepEqual(states(), ['answered: Q1, answered', 'unanswered: Q2, unanswered']);
  assert.equal(cells()[0].textContent, '1');
  assert.match(document.querySelector('.oa-mcq-palette-key').textContent, /answered 1.*unanswered 1.*marked for review 0/);
  assert.equal(flagButtons()[1].getAttribute('aria-pressed'), 'false');
  await act(async () => flagButtons()[1].click());
  assert.equal(flagButtons()[1].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(saved().mcq.flags, [1]);
  assert.deepEqual(states(), ['answered: Q1, answered', 'flagged: Q2, marked for review']);
  assert.match(button('Hand in and start coding').textContent, /\(1\/2 answered\) · 1 marked for review$/);
  // A marked question that has an answer says both.
  await act(async () => flagButtons()[0].click());
  assert.equal(states()[0], 'flagged: Q1, marked for review, answered');
  // A cell jumps to its question and focuses it.
  await act(async () => cells()[1].click());
  assert.equal(document.activeElement, document.getElementById('mcq-q-1'));
  await act(async () => flagButtons()[1].click());
  assert.deepEqual(saved().mcq.flags, [0]);
  assert.match(document.querySelector('.oa-mcq-palette-key').textContent, /marked for review 1/);
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
  // The rules still name what besides the MCQs is not simulated.
  assert.match(document.querySelector('.mock-briefing').textContent, /Besides coding, the real OA has: New-grad version adds ~10 multithreading/);
  await act(async () => button('Start the clock').click());
  await settle();
  const active = JSON.parse(localStorage.getItem('cswork:mock:v1:guest')).active;
  assert.equal(active.startedAt, undefined, 'the coding clock waits');
  assert.equal(active.mcq.ids.length, 10);
  assert(active.mcq.ids.every((id) => byId.get(id).topic === 'concurrency'));
  assert.equal(moves.length, 0, 'stays on the mock page for the MCQ section');
  // Start's button is gone: the section's heading takes the focus.
  assert.equal(document.activeElement, document.getElementById('mock-mcq-title'));
  assert.match(document.body.textContent, /Hand in and start coding \(0\/10 answered\)/);
  root.unmount();

  dom({ 'cswork:mock:v1:guest': JSON.stringify({ active: session({ preset: false }), history: [] }) });
  root = await render(createElement(MockOa, { boot, params: { view: 'mock', session: s.id }, navigate() {} }));
  assert.equal(document.querySelector('.mock-mcq-toggle'), null);
  root.unmount();
  delete globalThis.fetch;
});

test("practice: ?topic= starts filtered, a missed pick says why, site-wide shares show", async () => {
  const today = Math.floor(Date.now() / 86_400_000);
  const web = {
    id: 'mcq-web-x',
    section: 'cs',
    topic: 'web',
    answer: [1],
    text: { q: 'Which one?', choices: ['a', 'b', 'c', 'd'], explain: 'Because b.', whys: ['A misses x.', 'B is it.', 'C confuses y.', 'D misses z.'] },
  };
  const plain = (q) => ({ ...q, zh: undefined, en: undefined, text: q.en });
  // The server sends only the topic's questions (mcqScope in tests/mock-oa-mcq.test.ts).
  const fresh = bank.find((q) => q.topic === 'web');
  const items = [web, plain(fresh)];
  // Missed today (picked C): its answer shows until it comes back tomorrow.
  const note = { [web.id]: [0, today, 2] };
  const calls = [];
  // This browser holds a signed-out answer and a pre-review one to another subject.
  const old = JSON.stringify({ 'mcq-python-1': byId.get('mcq-python-1').answer });
  dom({ 'cswork:oa-mcq:v1': old, 'cswork:oa-mcq:v2': JSON.stringify({ [single.id]: [1, today, ...single.answer] }) });
  globalThis.fetch = async (url, init) => {
    calls.push([String(url), init?.method ?? 'GET', init?.body]);
    if (String(url).startsWith('/api/oj/mcq/stats')) return Response.json({ items: { [web.id]: { n: 40, right: 10, picks: [5, 10, 20, 5] } } });
    if (init?.method) return Response.json({});
    return Response.json({ target: 'mcq:answers', body: JSON.stringify(note), updatedAt: 1 });
  };
  const { McqPractice } = await import('../app/oa/mcq/practice.tsx');
  const root = await render(createElement(McqPractice, { items, zh: false, initial: { topic: 'web' } }));
  assert.match(document.querySelector('.oa-mcq-scope').textContent, /Showing only Web frontend/);
  assert.equal(document.querySelectorAll('.oa-mcq-list > li').length, 2);
  // The signed-out answer moved to the account; the other subject's old answer waits for its page.
  assert.equal(localStorage.getItem('cswork:oa-mcq:v2'), null);
  assert.equal(localStorage.getItem('cswork:oa-mcq:v1'), old);
  // The wrong pick's own reason comes before the explanation.
  const why = document.querySelector('.oa-mcq-why');
  assert.equal(why.querySelector('.oa-mcq-pick-why').textContent, 'Your pick C: C confuses y.');
  assert.match(why.textContent, /Your pick C: C confuses y\.Because b\.$/);
  // Shares for the revealed question, asked for once.
  assert.deepEqual(calls.filter(([u]) => u.startsWith('/api/oj/mcq/stats')).map(([u]) => u), [`/api/oj/mcq/stats?ids=${web.id}`]);
  assert.match(document.body.textContent, /25% of 40 people got it right · 50% picked C/);

  // A first answer signed in also counts toward the shares.
  const [seen, first] = document.querySelectorAll('.oa-mcq-list > li');
  await act(async () => first.querySelectorAll('input')[fresh.answer[0]].click());
  await act(async () => first.querySelector('.oa-mcq-actions button').click());
  await settle();
  const answers = () => calls.filter(([u]) => u === '/api/oj/mcq/answers');
  assert.deepEqual(answers().map(([, , body]) => JSON.parse(body)), [{ id: fresh.id, picks: fresh.answer }]);
  // Right: no pick-why.
  assert.equal(first.querySelector('.oa-mcq-pick-why'), null);
  // Answering again after seeing the answer is not a first answer, so nothing more is posted.
  await act(async () => seen.querySelector('.oa-mcq-actions button').click());
  await act(async () => seen.querySelectorAll('input')[web.answer[0]].click());
  await act(async () => seen.querySelector('.oa-mcq-actions button').click());
  await settle();
  assert.match(seen.querySelector('.oa-mcq-why').textContent, /Correct/);
  assert.equal(answers().length, 1);
  root.unmount();

  // Signed out: nothing is posted for the shares.
  dom({ 'cswork:oa-mcq:v2': JSON.stringify(note) });
  calls.length = 0;
  globalThis.fetch = async (url, init) => {
    calls.push([String(url), init?.method ?? 'GET']);
    return new Response('{}', { status: 401 });
  };
  const guest = await render(createElement(McqPractice, { items, zh: false }));
  assert.equal(calls.filter(([, method]) => method === 'POST').length, 0);
  guest.unmount();
  globalThis.fetch = realFetch;
});
