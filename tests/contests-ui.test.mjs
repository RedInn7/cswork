import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
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
dom.window.localStorage.setItem('cswork:locale', 'en');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ContestCalendar, DuelQueue, RoomLive } = await import('../app/contest/client.tsx');
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
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push(path);
    if (body) posts.push([path, body]);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, calls, restore: () => (globalThis.fetch = original) };
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
    questions: [
      { q: 1, solved: 1, tried: 2 },
      { q: 2, solved: 0, tried: 1 },
    ],
  },
  winner: null,
  rated: false,
  following: null,
  me: { name: 'Amy', virtual: false, share: false, start: now - 10 * MIN, end: now + 50 * MIN },
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
    // Solved / tried per question, under the live board, even while it runs.
    const totals = [...document.querySelectorAll('tfoot .contest-cell')];
    assert.deepEqual(totals.map((c) => c.querySelector('[aria-hidden]').textContent), ['1 / 2', '0 / 1']);
    assert.ok(totals[0].textContent.includes('Q1: 1 solved, 2 tried'));
    assert.ok(document.querySelector('.contest-follow') === null, 'a mashup has no follow filter');
    assert.ok(button('Add to calendar') === undefined, 'it has started');
    assert.ok(document.querySelector('.contest-replay') === null, 'no replay while the run goes on');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('the public weekly: enter before the start; once it runs, joining is virtual; then upsolve links', async () => {
  const upcoming = room({
    id: 'weekly-9',
    kind: 'weekly',
    week: 9,
    visibility: 'public',
    phase: 'upcoming',
    startsAt: now + 60 * MIN,
    endsAt: now + 150 * MIN,
    inviteCode: null,
    owner: false,
    me: null,
    canJoin: true,
    problems: null,
    standings: null,
  });
  const api0 = serve(() => Response.json(upcoming));
  try {
    const root = await mount(createElement(RoomLive, { initial: upcoming, fallbackStart: '' }));
    assert.ok(button('Enter the contest') !== undefined);
    assert.ok(document.querySelector('[role="timer"]') !== null);
    // Add to calendar: an .ics of this one contest, made in the browser.
    const made = [];
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => (made.push(blob), 'blob:ics');
    try {
      await act(async () => button('Add to calendar').click());
    } finally {
      URL.createObjectURL = createObjectURL;
    }
    assert.equal(made.length, 1);
    assert.equal(made[0].type, 'text/calendar');
    const ics = await made[0].text();
    assert.match(ics, /UID:cswork-weekly-9@cswork/);
    assert.match(ics, /SUMMARY:CSWork Weekly #9\r\n/);
    assert.match(ics, /URL:https:\/\/cswork.test\/contest\/weekly-9\r\n/);
    assert.match(ics, /TRIGGER:-PT30M/);
    assert.equal(ics.includes('RRULE'), false);
    await act(async () => root.unmount());
  } finally {
    api0.restore();
  }
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
      ? Response.json({ ...weekly, me: { name: body.displayName, virtual: true, start: now, end: now + 60 * MIN }, canJoin: false, problems: room().problems })
      : Response.json(weekly),
  );
  try {
    const root = await mount(createElement(RoomLive, { initial: weekly, fallbackStart: '' }));
    assert.ok(document.querySelector('h1').textContent === 'CSWork Weekly #9');
    assert.ok(document.querySelector('.contest-hidden-note').textContent.includes('Enter to see the questions'));
    const input = document.querySelector('.contest-join input');
    assert.ok(input.value === 'Captain');
    await act(async () => type(input, 'Amy'));
    assert.ok(button('Enter the contest') === undefined, 'it has started: no live entry');
    await act(async () => button('Run it virtually').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/weekly-9/join', { displayName: 'Amy', shareCode: false }]);
    assert.ok(document.querySelector('.contest-me').textContent.includes('“Amy”'));
    assert.ok(document.querySelector('.contest-me').textContent.includes('virtually'));
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

test('once my own run is over, the room holds my code replay, shown only where this browser recorded one', async () => {
  const over = room({ phase: 'ended', startsAt: now - 90 * MIN, endsAt: now - 30 * MIN, me: { name: 'Amy', virtual: false, share: false, start: now - 90 * MIN, end: now - 30 * MIN } });
  const api = serve(() => Response.json(over));
  try {
    const root = await mount(createElement(RoomLive, { initial: over, fallbackStart: '' }));
    assert.ok(document.querySelector('.contest-replay') !== null);
    // No IndexedDB here, so nothing recorded: no replay deck.
    assert.ok(document.querySelector('#mock-replay-title') === null);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('the lobby calendar: each add button names its contest; copying says so, or hands over the address', async () => {
  const feed = 'https://cswork.test/contest/calendar.ics';
  const setClipboard = (value) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
  const root = await mount(createElement(ContestCalendar, { room: { id: 'starter-9', start: now + MIN, minutes: 60, title: 'CSWork Starter #9' }, feed }));
  try {
    assert.equal(button('Add to calendar').getAttribute('aria-label'), 'Add to calendar: CSWork Starter #9');
    const status = document.querySelector('.contest-calendar [role="status"]');
    // No clipboard: the address, selected, to copy by hand.
    setClipboard(undefined);
    await act(async () => button('Copy calendar link').click());
    const input = document.querySelector('.contest-calendar input');
    assert.equal(input.value, feed);
    assert.equal(document.activeElement, input);
    assert.equal(status.textContent, '');
    // Copied: said in the live region for 2 seconds.
    mock.timers.enable({ apis: ['setTimeout'] });
    setClipboard({ writeText: async () => {} });
    await act(async () => button('Copy calendar link').click());
    assert.equal(status.textContent, 'Copied');
    assert.equal(document.querySelector('.contest-calendar input'), null);
    await act(async () => mock.timers.tick(2000));
    assert.equal(status.textContent, '');
    mock.timers.reset();
    // Refused: the address again.
    setClipboard({ writeText: () => Promise.reject(new Error('denied')) });
    await act(async () => button('Copy calendar link').click());
    assert.equal(document.querySelector('.contest-calendar input').value, feed);
  } finally {
    mock.timers.reset();
    delete navigator.clipboard;
    await act(async () => root.unmount());
  }
});

test('a duel waits for its opponent: no clock, no questions', async () => {
  const waiting = room({ kind: 'duel', cap: 2, entrants: 1, phase: 'upcoming', waiting: true, problems: null, standings: null });
  const api = serve(() => Response.json(waiting));
  try {
    const root = await mount(createElement(RoomLive, { initial: waiting, fallbackStart: '' }));
    assert.ok(document.querySelector('.contest-hidden-note').textContent.includes('when your opponent joins'));
    assert.ok(document.querySelector('[role="timer"]') === null, 'its set start has passed: nothing to count down');
    assert.ok(button('Add to calendar') === undefined, 'no start to put in a calendar');
    await act(async () => root.unmount());
  } finally {
    api.restore();
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
  assert.ok(body.querySelector('svg').getAttribute('aria-label') === 'Rating 1580 after 3 contests, peak 1610');
  assert.ok(body.querySelector('polyline').getAttribute('points').split(' ').length === 3);
  assert.ok(body.querySelectorAll('circle').length === 3);
  assert.ok(!body.querySelector('svg').hasAttribute('preserveAspectRatio'), 'scaled evenly: round dots on a phone');
  assert.ok(body.querySelector('figcaption').textContent.includes('Local'));
  assert.ok(renderToStaticMarkup(createElement(RatingCurve, { points: [], zh: true })) === '');
  assert.ok(renderToStaticMarkup(createElement(BandChip, { rating: 1900, zh: true })).includes('直达'));
});

test('a starter: unrated rows marked, the board narrowed to people I follow, shared code after it', async () => {
  const ended = room({
    id: 'starter-9',
    kind: 'starter',
    week: 9,
    visibility: 'public',
    phase: 'ended',
    startsAt: now - 200 * MIN,
    endsAt: now - 140 * MIN,
    inviteCode: null,
    owner: false,
    me: null,
    rated: true,
    following: false,
    codeOpen: true,
    standings: {
      live: [
        row(1, 'Pro', { solved: 2, penalty: 9 * MIN, unrated: true, shared: true, cells: cells([true, 4 * MIN, 0], [true, 5 * MIN, 0]) }),
        row(2, 'Amy', { me: true, solved: 1, rating: { before: 1500, after: 1520 }, cells: cells([true, 6 * MIN, 0], [false, null, 0]) }),
        row(3, 'Mid', { solved: 0 }),
      ],
      virtual: [],
    },
  });
  const api = serve((path) =>
    path === 'oj/contests/starter-9?following=1'
      ? Response.json({ ...ended, following: true, standings: { live: [ended.standings.live[1]], virtual: [] } })
      : path.startsWith('oj/contests/starter-9/code?')
        ? Response.json({ problem: 'lc-1', items: [{ name: 'Pro', virtual: false, language: 'python', code: 'print(1)', at: 4 * MIN }] })
        : Response.json(ended),
  );
  try {
    const root = await mount(createElement(RoomLive, { initial: ended, fallbackStart: '' }));
    assert.ok(document.querySelector('h1').textContent === 'CSWork Starter #9');
    const pro = [...document.querySelectorAll('tbody tr')][0];
    assert.ok(pro.querySelector('.contest-unrated').textContent === 'unrated');
    assert.ok(document.querySelectorAll('.contest-unrated').length === 1);
    // Only a sharer's solved cells carry the link.
    assert.ok(document.querySelectorAll('.contest-code-link').length === 2);
    await act(async () => document.querySelector('.contest-code-link').click());
    await wait();
    assert.ok(api.calls.some((p) => p === 'oj/contests/starter-9/code?problem=lc-1&name=Pro'));
    assert.ok(document.querySelector('.contest-code pre').textContent === 'print(1)');
    assert.ok(document.querySelector('.contest-code details').open);
    assert.ok(document.activeElement === document.querySelector('#contest-code'), 'focus moves to the code');
    await act(async () => button('Close').click());
    assert.ok(document.querySelector('.contest-code') === null);
    assert.ok(document.activeElement === document.querySelector('.contest-code-link'), 'Close hands focus back to its button');
    const toggle = document.querySelector('.contest-follow input');
    await act(async () => toggle.click());
    await wait();
    assert.ok([...document.querySelectorAll('tbody tr')].length === 1);
    assert.ok(document.querySelector('thead th').textContent === 'Overall');
    assert.ok(document.querySelector('.contest-rank').textContent === '2');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('entering can opt in to sharing code, and an entrant can turn it off again', async () => {
  const upcoming = room({ id: 'weekly-9', kind: 'weekly', week: 9, visibility: 'public', phase: 'upcoming', startsAt: now + 60 * MIN, endsAt: now + 150 * MIN, me: null, canJoin: true, problems: null, standings: null, inviteCode: null, owner: false, suggestedName: 'Amy' });
  let share = null;
  const api = serve((path, body) => {
    if (path === 'oj/contests/weekly-9/join') share = body.shareCode;
    if (path === 'oj/contests/weekly-9/share') return Response.json({ on: (share = body.on) });
    return Response.json(share === null ? upcoming : { ...upcoming, me: { name: 'Amy', virtual: false, share, start: upcoming.startsAt, end: upcoming.endsAt }, canJoin: false });
  });
  try {
    const root = await mount(createElement(RoomLive, { initial: upcoming, fallbackStart: '' }));
    const share = [...document.querySelectorAll('.contest-join input[type="checkbox"]')];
    assert.ok(share.length === 1 && !share[0].checked, 'off by default');
    await act(async () => share[0].click());
    await act(async () => button('Enter the contest').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/weekly-9/join', { displayName: 'Amy', shareCode: true }]);
    const toggle = () => document.querySelector('.contest-hero input[type="checkbox"]');
    assert.ok(toggle().checked, 'in, sharing on');
    await act(async () => toggle().click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/weekly-9/share', { on: false }]);
    assert.ok(api.calls.at(-1) === 'oj/contests/weekly-9', 'reread after the change');
    assert.ok(!toggle().checked, 'withdrawn');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('quick match: queue under a name, wait with the window shown, cancel', async () => {
  let state = { state: 'idle' };
  const api = serve((path, body) => {
    if (path === 'oj/contests/duel/queue' && body) state = { state: 'waiting', since: Date.now(), rating: 1500, window: 200 };
    if (path === 'oj/contests/duel/leave') state = { state: 'idle' };
    return Response.json(state);
  });
  try {
    const root = await mount(createElement(DuelQueue, { suggested: 'Amy', verified: true }));
    assert.ok(api.calls[0] === 'oj/contests/duel/queue', 'picks up a queue from another tab');
    assert.ok(document.querySelector('.contest-join input[type="checkbox"]') === null);
    await act(async () => button('Quick match').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/duel/queue', { displayName: 'Amy' }]);
    const live = document.querySelector('.contest-queue [aria-live]');
    assert.ok(live.textContent.includes('within ±200'));
    const clock = document.querySelector('.contest-queue [role="timer"]');
    assert.ok(clock && !live.contains(clock), 'the ticking clock stays out of the live region');
    await act(async () => button('Cancel').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/contests/duel/leave', {}]);
    assert.ok(button('Quick match') !== undefined);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
  const unverified = await mount(createElement(DuelQueue, { suggested: '', verified: false }));
  assert.ok(document.querySelector('.contest-hidden-note').textContent.includes('Verify your email'));
  await act(async () => unverified.unmount());
});
