import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/contest/r1' });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { RoomLive } = await import('../app/contest/client.tsx');
const { ContestBar } = await import('../components/contest-bar.tsx');
const { RatingCurve, BandChip } = await import('../components/contest-parts.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}
function serve(routes) {
  const posts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, restore: () => (globalThis.fetch = original) };
}

const MIN = 60000;
const now = Date.now();
const cells = (...list) => list.map(([solved, at, wrong, pending = false]) => ({ solved, at, wrong, pending }));
const row = (rank, name, extra = {}) => ({
  rank,
  name,
  solved: 0,
  penalty: 0,
  finishedAt: null,
  cells: cells([false, null, 0], [false, null, 0]),
  me: false,
  rating: null,
  ...extra,
});
const room = (extra = {}) => ({
  id: 'r1',
  kind: 'mashup',
  title: 'Friday <b>mashup</b>',
  week: null,
  visibility: 'private',
  startsAt: now - 10 * MIN,
  durationMin: 60,
  endsAt: now + 50 * MIN,
  phase: 'running',
  now,
  entrants: 2,
  cap: 100,
  inviteCode: 'ABCD2345',
  owner: true,
  problemCount: 2,
  problems: [
    { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', rating: 1200 },
    { id: 'oa-acme-1', title: 'Acme', titleEn: null, difficulty: '中等', rating: null },
  ],
  standings: {
    live: [
      row(1, 'Amy', { me: true, solved: 1, penalty: 17 * MIN, cells: cells([true, 7 * MIN, 2], [false, null, 0, true]) }),
      row(2, 'Bob', { cells: cells([false, null, 3], [false, null, 0]) }),
    ],
    virtual: [],
  },
  winner: null,
  rated: false,
  me: { name: 'Amy', virtual: false, start: now - 10 * MIN, end: now + 50 * MIN },
  canJoin: false,
  suggestedName: '',
  ...extra,
});

test('a running room: the board, the clock, and questions that open in the contest workspace', async () => {
  const api = serve(() => Response.json(room()));
  try {
    const root = await mount(createElement(RoomLive, { initial: room(), fallbackStart: 'Sun 09:00 (Beijing)' }));
    assert.ok(document.querySelector('h1').textContent === 'Friday <b>mashup</b>', 'titles are text, never HTML');
    assert.ok(document.querySelector('[role="timer"]') !== null);
    const links = [...document.querySelectorAll('.contest-problems a')].map((a) => a.getAttribute('href'));
    assert.deepEqual(links, ['/?view=problem&problem=lc-1&room=r1', '/?view=problem&problem=oa-acme-1&room=r1']);
    const amy = document.querySelector('tr[data-me]');
    assert.ok(amy.textContent.includes('Amy') && amy.textContent.includes('you'));
    const states = [...amy.querySelectorAll('.contest-cell')].map((c) => c.dataset.state);
    assert.deepEqual(states, ['ac', 'pending']);
    assert.ok(amy.querySelector('.contest-cell').textContent.startsWith('07:00 (-2)'));
    assert.ok(amy.querySelector('.contest-time').textContent === '17:00');
    assert.ok([...document.querySelectorAll('tbody tr')][1].querySelector('.contest-cell').textContent.startsWith('-3'));
    assert.ok(document.querySelector('.contest-invite code').textContent === 'ABCD2345');
    assert.ok(document.querySelectorAll('caption').length === 1, 'no virtual table without virtual entrants');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('the public weekly: enter with a name; after the end, upsolve links and a virtual table', async () => {
  const weekly = room({
    id: 'weekly-9',
    kind: 'weekly',
    title: 'CSWork Weekly #9',
    week: 9,
    visibility: 'public',
    inviteCode: null,
    owner: false,
    me: null,
    canJoin: true,
    suggestedName: 'Captain',
    problems: null,
    standings: { live: [], virtual: [] },
  });
  const api = serve((path, body) =>
    path === 'oj/contests/weekly-9/join' && body
      ? Response.json({ ...weekly, me: { name: body.displayName, virtual: false, start: weekly.startsAt, end: weekly.endsAt }, canJoin: false, problems: room().problems })
      : Response.json(weekly),
  );
  try {
    const root = await mount(createElement(RoomLive, { initial: weekly, fallbackStart: '' }));
    assert.ok(document.querySelector('h1').textContent === 'CSWork Weekly #9');
    assert.ok(document.querySelector('.contest-hidden-note').textContent.includes('Enter to see the questions'));
    const input = document.querySelector('.contest-join input');
    assert.ok(input.value === 'Captain');
    await act(async () => type(input, 'Amy'));
    await act(async () => button('Enter the contest').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/weekly-9/join', { displayName: 'Amy' }]);
    assert.ok(document.querySelector('.contest-me').textContent.includes('Amy'));
    assert.ok(document.querySelectorAll('.contest-problems li').length === 2);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
  const ended = room({
    phase: 'ended',
    startsAt: now - 200 * MIN,
    endsAt: now - 140 * MIN,
    me: null,
    inviteCode: null,
    rated: true,
    kind: 'weekly',
    week: 9,
    standings: {
      live: [row(1, 'Amy', { solved: 2, penalty: 30 * MIN, rating: { before: 1500, after: 1532 } })],
      virtual: [row(1, 'Late', { solved: 1, penalty: 5 * MIN })],
    },
  });
  const api2 = serve(() => Response.json(ended));
  try {
    const root = await mount(createElement(RoomLive, { initial: ended, fallbackStart: '' }));
    const links = [...document.querySelectorAll('.contest-problems a')].map((a) => a.getAttribute('href'));
    assert.ok(links.every((href) => href.includes('tab=solutions') && !href.includes('room=')));
    assert.deepEqual(
      [...document.querySelectorAll('caption')].map((c) => c.textContent),
      ['Live', 'Virtual (own clocks, unrated)'],
    );
    assert.ok(document.querySelector('.contest-delta').textContent.startsWith('+32'));
    assert.ok(document.querySelector('[role="timer"]') === null, 'no clock once it is over');
    await act(async () => root.unmount());
  } finally {
    api2.restore();
  }
});

test('the workspace strip: stops per question, the clock, the scoreboard link', async () => {
  const navigations = [];
  const view = room();
  const root = await mount(
    createElement(ContestBar, {
      contest: { view, skew: 0, running: true },
      problemId: 'lc-1',
      submissions: [
        { problem_id: 'lc-1', status: 'accepted', created_at: now - 5 * MIN },
        // Before the window: not this contest's.
        { problem_id: 'oa-acme-1', status: 'accepted', created_at: now - 30 * MIN },
      ],
      navigate: (v, extra) => navigations.push([v, extra]),
    }),
  );
  const stops = [...document.querySelectorAll('.mock-exam-stops li')].map((li) => li.dataset.state);
  assert.deepEqual(stops, ['ac', 'todo']);
  assert.ok(document.querySelector('a[href="/contest/r1"]') !== null);
  await act(async () => [...document.querySelectorAll('.mock-exam-stops button')][1].click());
  assert.deepEqual(navigations, [['problem', { problem: 'oa-acme-1', room: 'r1' }]]);
  await act(async () => root.unmount());
  const done = await mount(
    createElement(ContestBar, { contest: { view, skew: 0, running: false }, problemId: 'lc-1', submissions: [], navigate() {} }),
  );
  assert.ok(document.querySelector('.mock-exam-bar').hasAttribute('data-done'));
  assert.ok(document.querySelector('.mock-exam-stops') === null);
  await act(async () => done.unmount());
});

test('the rating curve: one point per weekly over the bands, said in words', () => {
  const html = renderToStaticMarkup(
    createElement(RatingCurve, {
      points: [
        { week: 1, after: 1540, rank: 2, entrants: 9 },
        { week: 2, after: 1610, rank: 1, entrants: 12 },
        { week: 4, after: 1580, rank: 5, entrants: 10 },
      ],
      zh: false,
    }),
  );
  const body = new JSDOM(html).window.document;
  assert.ok(body.querySelector('svg').getAttribute('aria-label') === 'Rating 1580 after 3 weeklies, peak 1610');
  assert.ok(body.querySelector('polyline').getAttribute('points').split(' ').length === 3);
  assert.ok(body.querySelectorAll('circle').length === 3);
  assert.ok(body.querySelector('figcaption').textContent.includes('Local'));
  assert.ok(renderToStaticMarkup(createElement(RatingCurve, { points: [], zh: true })) === '');
  assert.ok(renderToStaticMarkup(createElement(BandChip, { rating: 1900, zh: true })).includes('直达'));
});
