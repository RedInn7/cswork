// /certify (components/skill-test.tsx): the exam tickets signed out and in, cooldowns, the confirm
// step, starting an exam into the browser's mock session, the running banner and its hand-in,
// certificates on the profile; and the exam bar handing a skill exam in to the server.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

const MIN = 60000;
const DAY = 86400000;
const T = Date.UTC(2026, 9, 14, 12);

function useDom(url = 'https://cswork.test/certify') {
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  // jsdom does not navigate; location.assign reports here instead.
  virtualConsole.on('jsdomError', (error) => navigations.push(error.message));
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url, virtualConsole });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'StorageEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return navigations;
}
function api(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${String(url)}`;
    calls.push([key, init.body ? JSON.parse(init.body) : undefined]);
    const reply = routes[key];
    if (!reply) return Response.json({ error: `no route ${key}` }, { status: 404 });
    return Response.json(typeof reply === 'function' ? reply() : reply);
  };
  return calls;
}
async function mount(props) {
  const { createRoot } = await import('react-dom/client');
  const { SkillTests } = await import('../components/skill-test.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(SkillTests, props)));
  return root;
}
const ticket = (name) => [...document.querySelectorAll('.certify-ticket')].find((li) => li.querySelector('h3').textContent === name);
const button = (scope, text) => [...scope.querySelectorAll('button')].find((b) => b.textContent === text);
const overview = (extra = {}) => ({
  now: T,
  running: null,
  attempts: [
    { id: 'a1', test: 'sql', ids: ['sql-01', 'sql-02', 'sql-03'], language: null, startedAt: T - 2 * DAY, deadline: T - 2 * DAY + 45 * MIN, finishedAt: T - 2 * DAY + 40 * MIN, score: 150, max: 300, passed: false },
  ],
  nextAt: { 'problem-solving-basic': null, 'problem-solving-intermediate': null, sql: T + 5 * DAY, python: T - DAY },
  certificates: [{ id: 'CertPython000001', courseId: 'skill:python', issuedAt: T - 10 * DAY, onProfile: 0, zh: 'Python 认证', en: 'Python', skill: true }],
  ...extra,
});

test('signed out: four exams with their rules, each asking to sign in', async () => {
  useDom();
  api({});
  const root = await mount({ initial: null, userId: null, verified: false, zh: false });
  const tickets = [...document.querySelectorAll('.certify-ticket')];
  assert.deepEqual(
    tickets.map((li) => li.querySelector('h3').textContent),
    ['Problem Solving (Basic)', 'Problem Solving (Intermediate)', 'SQL', 'Python'],
  );
  for (const li of tickets) assert.equal(li.querySelector('a.certify-primary').getAttribute('href'), '/?view=account');
  assert.match(ticket('Python').textContent, /Python only/);
  assert.match(document.querySelector('.certify-rules').textContent, /70% overall and at least 40% on every question/);
  assert.equal(document.querySelector('.certify-history'), null);
  await act(async () => root.unmount());
});

test('the server HTML has no reader-local dates to mismatch on hydration', async () => {
  const { renderToString } = await import('react-dom/server');
  const { SkillTests } = await import('../components/skill-test.tsx');
  const html = renderToString(createElement(SkillTests, { initial: overview(), userId: 'u1', verified: true, zh: false }));
  assert.match(html, /150\/300 · Not passed/);
  assert.doesNotMatch(html, /Oct|Opens again \w/);
});

test('signed in: cooldowns, past results, certificates, and starting an exam into the mock session', async () => {
  const navigations = useDom();
  const attempt = { id: 'att-1', test: 'problem-solving-basic', ids: ['lc-20', 'lc-15'], language: null, startedAt: T, deadline: T + 60 * MIN, finishedAt: null, score: null, max: null, passed: null };
  const calls = api({
    'POST /api/oj/skills/problem-solving-basic/start': { attempt, now: T },
    'POST /api/certificates/CertPython000001': { ok: true },
  });
  const root = await mount({ initial: overview(), userId: 'u1', verified: true, zh: false });
  // SQL was taken two days ago: closed until its cooldown ends. Python's has ended.
  assert.equal(button(ticket('SQL'), 'Start exam').disabled, true);
  assert.match(ticket('SQL').textContent, /Opens again/);
  assert.equal(button(ticket('Python'), 'Start exam').disabled, false);
  assert.equal(ticket('Python').querySelector('.certify-stamp').getAttribute('href'), '/certificate/CertPython000001');
  assert.deepEqual(
    [...document.querySelectorAll('.certify-history tbody td')].map((td) => td.textContent),
    ['SQL', document.querySelectorAll('.certify-history tbody td')[1].textContent, '150/300 · Not passed'],
  );
  // Listing a certificate on the profile.
  await act(async () => document.querySelector('.certify-certs input[type="checkbox"]').click());
  assert.deepEqual(calls.at(-1), ['POST /api/certificates/CertPython000001', { onProfile: true }]);
  assert.equal(document.querySelector('.certify-certs input[type="checkbox"]').checked, true);

  // Starting asks first, with the confirm button focused; the clock starts on the server.
  await act(async () => button(ticket('Problem Solving (Basic)'), 'Start exam').click());
  const confirm = ticket('Problem Solving (Basic)').querySelector('.certify-confirm');
  assert.match(confirm.textContent, /60-minute clock starts at once/);
  assert.equal(document.activeElement.textContent, 'Start');
  await act(async () => button(confirm, 'Cancel').click());
  assert.equal(ticket('Problem Solving (Basic)').querySelector('.certify-confirm'), null);
  await act(async () => button(ticket('Problem Solving (Basic)'), 'Start exam').click());
  await act(async () => button(ticket('Problem Solving (Basic)'), 'Start').click());
  assert.deepEqual(calls.at(-1), ['POST /api/oj/skills/problem-solving-basic/start', {}]);
  const state = JSON.parse(localStorage.getItem('cswork:mock:v1:u1'));
  assert.equal(state.active.id, 'att-1');
  assert.deepEqual(state.active.cert, { test: 'problem-solving-basic', language: null });
  assert.deepEqual(state.active.ids, ['lc-20', 'lc-15']);
  assert.equal(state.active.minutes, 60);
  assert.equal(state.active.startedAt + state.active.skew, T, 'the server start, in this browser clock');
  assert.ok(navigations.some((message) => /navigation/i.test(message)), 'opens the first question');
  await act(async () => root.unmount());
});

test('a running exam: the banner counts down, blocks other starts, and hands in', async () => {
  useDom();
  const running = { id: 'att-2', test: 'python', ids: ['lc-1', 'lc-3'], language: 'python', startedAt: T - 15 * MIN, deadline: T + 30 * MIN, finishedAt: null, score: null, max: null, passed: null };
  const done = { ...running, finishedAt: T, score: 200, max: 200, passed: true };
  const calls = api({
    'POST /api/oj/skills/python/finish': { attempt: done, now: T },
    'GET /api/oj/skills': overview({ attempts: [done], certificates: [] }),
  });
  const root = await mount({ initial: overview({ running, attempts: [running] }), userId: 'u2', verified: true, zh: true });
  const live = document.querySelector('.certify-live');
  assert.equal(live.querySelector('h2').textContent, 'Python 认证');
  assert.match(live.querySelector('[role="timer"]').textContent, /^(30|29):\d\d$/);
  assert.ok([...document.querySelectorAll('.certify-ticket button.certify-primary')].every((b) => b.disabled), 'one exam at a time');
  assert.equal(document.querySelector('.certify-history td[data-result]').textContent, '进行中');
  await act(async () => button(live, '交卷').click());
  assert.deepEqual(calls.map(([key]) => key), ['POST /api/oj/skills/python/finish', 'GET /api/oj/skills']);
  assert.equal(document.querySelector('.certify-live'), null);
  assert.equal(document.querySelector('.certify-history td[data-result]').textContent, '200/200 · 通过');
  await act(async () => root.unmount());
});

test('the exam bar hands a skill exam in to the server, keeping it out of the mock history', async () => {
  const navigations = useDom('https://cswork.test/?view=problem&problem=sql-01&mock=att-3');
  const calls = api({ 'POST /api/oj/skills/sql/finish': { attempt: {}, now: T } });
  const { finishMockExam } = await import('../components/mock-exam-bar.tsx');
  const session = { id: 'att-3', company: null, name: 'SQL', platform: null, preset: false, scoring: 'tests', source: 'mixed', slots: ['easy'], ids: ['sql-01'], minutes: 45, skew: 0, createdAt: Date.now(), startedAt: Date.now(), cert: { test: 'sql' } };
  localStorage.setItem('cswork:mock:v1:u3', JSON.stringify({ active: session, history: [] }));
  const views = [];
  finishMockExam('u3', 'att-3', (view) => views.push(view));
  await act(async () => new Promise((r) => setTimeout(r, 10)));
  assert.deepEqual(views, [], 'no mock report for a skill exam');
  assert.deepEqual(calls.map(([key]) => key), ['POST /api/oj/skills/sql/finish']);
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:mock:v1:u3')), { active: null, history: [] });
  assert.ok(navigations.some((message) => /navigation/i.test(message)), 'back to /certify');
});

test('time running out on the exam bar hands a skill exam in, though settling already dropped it', async () => {
  const navigations = useDom('https://cswork.test/?view=problem&problem=sql-01&mock=att-4');
  const calls = api({ 'POST /api/oj/skills/sql/finish': { attempt: {}, now: T } });
  const { createRoot } = await import('react-dom/client');
  const { MockExamBar } = await import('../components/mock-exam-bar.tsx');
  const startedAt = Date.now() - 45 * MIN - 1;
  const session = { id: 'att-4', company: null, name: 'SQL', platform: null, preset: false, scoring: 'tests', source: 'mixed', slots: ['easy'], ids: ['sql-01'], minutes: 45, skew: 0, createdAt: startedAt, startedAt, cert: { test: 'sql', language: null } };
  localStorage.setItem('cswork:mock:v1:u4', JSON.stringify({ active: session, history: [] }));
  const views = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MockExamBar, { session, userId: 'u4', problemId: 'sql-01', submissions: [], navigate: (view) => views.push(view) })));
  await act(async () => new Promise((r) => setTimeout(r, 10)));
  assert.deepEqual(views, [], 'no missing mock report');
  assert.deepEqual(calls.map(([key]) => key), ['POST /api/oj/skills/sql/finish']);
  assert.ok(navigations.some((message) => /navigation/i.test(message)), 'on to /certify');
  await act(async () => root.unmount());
});

test('a Python exam counts only Python: a C++ AC neither solves the question nor offers to finish', async () => {
  useDom('https://cswork.test/?view=problem&problem=lc-2&mock=att-5');
  globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
  const { createRoot } = await import('react-dom/client');
  const { ExamAcceptedDialog } = await import('../components/mock-exam-bar.tsx');
  const startedAt = Date.now() - 10 * MIN;
  const session = { id: 'att-5', company: null, name: 'Python', platform: 'Python', preset: false, scoring: 'tests', source: 'lc', slots: ['easy', 'medium'], ids: ['lc-1', 'lc-2'], minutes: 45, skew: 0, createdAt: startedAt, startedAt, cert: { test: 'python', language: 'python' } };
  const submissions = [
    { problem_id: 'lc-1', status: 'accepted', created_at: startedAt + MIN, language: 'python' },
    { problem_id: 'lc-2', status: 'accepted', created_at: startedAt + 2 * MIN, language: 'cpp' },
  ];
  const root = createRoot(document.getElementById('root'));
  const render = (language) =>
    act(async () => root.render(createElement(ExamAcceptedDialog, { session, problemId: 'lc-2', language, submissions, userId: 'u5', navigate() {}, onClose() {} })));
  await render('cpp');
  assert.match(document.querySelector('.cs-accepted-stats').textContent, /Only Python 3 submissions count.*1 of 2/);
  assert.equal(document.querySelector('.cs-accepted-next').textContent, 'Keep going');
  await render('python');
  assert.equal(document.querySelector('.cs-accepted-next').textContent, 'All solved: finish');
  await act(async () => root.unmount());
});
