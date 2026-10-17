// The top bar's study goal (components/daily-goal.tsx): the streak and XP ring, the week, the
// quests and the goal settings; nothing for guests, during a contest or while a mock OA runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator', 'getComputedStyle'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { createRoot } = await import('react-dom/client');
const { DailyGoal } = await import('../components/daily-goal.tsx');

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));
const day = (date, o = {}) => ({ date, xp: 0, ac: 0, frozen: false, covered: null, ...o });
const GOAL = {
  user: 'me',
  streak: 4,
  freezesLeft: 1,
  rescue: false,
  goalXp: 30,
  restWeekdays: [0],
  todayXp: 12,
  today: '2026-10-17',
  week: [
    day('2026-10-11', { covered: 'rest' }),
    day('2026-10-12', { ac: 2, xp: 20 }),
    day('2026-10-13', { frozen: true }),
    day('2026-10-14', { ac: 1, xp: 10 }),
    day('2026-10-15', { xp: 30, covered: 'goal' }),
    day('2026-10-16', { ac: 3, xp: 30 }),
    day('2026-10-17', { ac: 1, xp: 12 }),
  ],
  covered: [],
  quests: [
    { kind: 'ac', need: 2, have: 1 },
    { kind: 'sd', need: 1, have: 1 },
    { kind: 'recall', need: 3, have: 0 },
  ],
};

let reply = () => Response.json(GOAL);
const requests = [];
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method ?? 'GET', body: init.body ?? null });
  return reply(String(url), init);
};
async function render() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(DailyGoal)));
  await settle();
  return root;
}

test('the trigger shows the streak and today’s ring; the popover the week, quests and settings', async () => {
  const root = await render();
  try {
    const trigger = document.querySelector('.daily-goal');
    assert.ok(trigger, 'the trigger renders');
    assert.match(requests[0].url, /^\/api\/oj\/study-goal\?tz=-?\d+$/);
    assert.equal(trigger.textContent.trim(), '4');
    assert.equal(trigger.getAttribute('aria-label'), '4-day streak, 12 of 30 XP today');
    assert.equal(trigger.hasAttribute('data-met'), false);
    assert.ok(trigger.querySelector('svg[data-lit]'), 'an AC today lights the flame');
    await act(async () => trigger.click());
    await settle();
    const pop = document.querySelector('.daily-goal-pop');
    assert.ok(pop, 'the popover opens');
    assert.match(pop.querySelector('.daily-goal-xp').textContent, /12 \/ 30 XP18 to go/);
    const days = [...pop.querySelectorAll('.daily-goal-week li')];
    assert.deepEqual(
      days.map((li) => li.getAttribute('data-state')),
      ['rest', 'ac', 'frozen', 'ac', 'goal', 'ac', 'ac'],
    );
    assert.equal(days[6].hasAttribute('data-today'), true);
    assert.match(days[4].querySelector('.sr-only').textContent, /2026-10-15: XP goal met, 30 XP/);
    const quests = [...pop.querySelectorAll('.daily-goal-quests li')];
    assert.deepEqual(
      quests.map((li) => [li.querySelector('a').getAttribute('href'), li.hasAttribute('data-done')]),
      [
        ['/?view=problems', false],
        ['/system-design', true],
        ['/?view=progress&tab=review', false],
      ],
    );
    assert.match(pop.textContent, /1 freeze left this month/);
    // Settings: the goal tier and the rest days (at most 2) save the note pref:study.
    const [tiers, rest] = pop.querySelectorAll('.daily-goal-choices');
    assert.equal(tiers.querySelector('[aria-pressed="true"]').textContent, '30');
    const restButtons = [...rest.querySelectorAll('button')];
    assert.deepEqual(
      restButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label')),
      ['Sunday'],
    );
    reply = (url, init) => (init.method === 'PUT' ? Response.json({ ok: true }) : Response.json({ ...GOAL, goalXp: 50, restWeekdays: [0, 6] }));
    await act(async () => [...tiers.querySelectorAll('button')].find((b) => b.textContent === '50').click());
    await settle();
    const put = requests.find((r) => r.method === 'PUT');
    assert.equal(put.url, '/api/oj/notes?target=pref%3Astudy');
    assert.deepEqual(JSON.parse(JSON.parse(put.body).body), { goalXp: 50, restWeekdays: [0] });
    assert.equal(document.querySelector('.daily-goal').getAttribute('aria-label'), '4-day streak, 12 of 50 XP today');
    // Two rest days picked: the others wait until one is taken back.
    const after = [...document.querySelectorAll('.daily-goal-choices')[1].querySelectorAll('button')];
    assert.equal(after.filter((b) => b.disabled).length, 5);
  } finally {
    await act(async () => root.unmount());
  }
});

// The cache holds a minute; a focus after that asks again.
const realNow = Date.now;
let skew = 0;
async function refocus() {
  skew += 61000;
  Date.now = () => realNow() + skew;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await settle();
}

test('nothing for guests, during a contest or skill test, or while a mock OA runs here', async () => {
  const { mockStorageKey } = await import('../lib/mock-oa.ts');
  reply = () => Response.json(GOAL);
  const root = await render();
  try {
    await refocus();
    assert.ok(document.querySelector('.daily-goal'));
    reply = () => Response.json({ paused: true });
    await refocus();
    assert.equal(document.querySelector('.daily-goal'), null, 'paused');
    reply = () => Response.json({ error: 'sign in' }, { status: 401 });
    await refocus();
    assert.equal(document.querySelector('.daily-goal'), null, 'signed out');
    // A failed request keeps what was shown.
    reply = () => Response.json(GOAL);
    await refocus();
    assert.ok(document.querySelector('.daily-goal'));
    reply = () => Response.json({ error: 'busy' }, { status: 429 });
    await refocus();
    assert.ok(document.querySelector('.daily-goal'), 'a 429 keeps the last answer');
    // A started mock OA (not timed out) in this browser: the ring would show its sealed ACs.
    const now = Date.now();
    const active = { id: 'm1', company: null, name: null, platform: null, preset: true, scoring: 'icpc', source: 'local', slots: ['easy'], ids: ['lc-1'], minutes: 60, skew: 0, createdAt: now, startedAt: now };
    localStorage.setItem(mockStorageKey('me'), JSON.stringify({ active, history: [] }));
    reply = () => Response.json(GOAL);
    await refocus();
    assert.equal(document.querySelector('.daily-goal'), null, 'mock OA running');
  } finally {
    await act(async () => root.unmount());
    localStorage.removeItem(mockStorageKey('me'));
    Date.now = realNow;
  }
});
