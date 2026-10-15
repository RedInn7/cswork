// Wave 4 practice UI: rating badges and the bank's sort / rating / list / month filters,
// the contest grid, "problems at your level", the points card and the sprint plan groups.
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
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator', 'history', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
const { createRoot } = await import('react-dom/client');
const { StudyLibrary } = await import('../components/study-library.tsx');
const { LevelPicks } = await import('../components/level-picks.tsx');
const { PointsPanel } = await import('../components/points-panel.tsx');
const { StudyPlan } = await import('../components/study-plan.tsx');
const { RatingBadge } = await import('../components/rating-badge.tsx');
const { buildPlan, DEFAULT_GOAL, planGroups, PLAN_VIEW_KEY } = await import('../lib/study-plan.ts');
const { routeStops } = await import('../lib/route-stops.ts');

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));
const change = async (node, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value').set.call(node, value);
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
  await settle();
};
const labelled = (text) =>
  [...document.querySelectorAll('label')].find((label) => label.textContent.startsWith(text))?.querySelector('select, input');
const lastParams = (requests, path = 'oj/library?') =>
  new URL(requests.filter((url) => url.includes(path)).at(-1), 'https://cswork.test').searchParams;

const item = (number, extra = {}) => ({
  id: `lc-${number}`, number, slug: `p-${number}`, titleZh: `题${number}`, titleEn: `Problem ${number}`, difficulty: 'Medium',
  topics: [], caseStatus: 'verified', caseCount: 1, judgeProblemId: `lc-${number}`, solved: false,
  selection: { order: number, sectionSlug: number < 2000 ? 'hash-counting' : 'array-foundations', sectionTitle: 'x', stage: '核心', reason: '' },
  ...extra,
});
const page = (items) => ({
  items, total: items.length, page: 1, pageSize: 30, topics: [], rounds: [{ id: 'r1', number: 1, createdAt: 1, solved: 0 }],
  activeRoundId: 'r1', currentRound: { id: 'r1', number: 1, createdAt: 1 }, sequence: items.map((i) => i.id), nextProblemId: null, next: null,
  collection: {
    id: 'ling-selected-500', title: 'x', total: 2, available: 2, ready: 2, solved: 0,
    sections: [
      { slug: 'array-foundations', title: 'A', titleEn: 'A', total: 1, solved: 0, companies: 0, reports: 0 },
      { slug: 'hash-counting', title: 'H', titleEn: 'H', total: 1, solved: 0, companies: 0, reports: 0 },
    ],
  },
});

test('rating badges carry their band; unrated problems show none', () => {
  const root = createRoot(document.getElementById('root'));
  act(() => root.render(createElement('div', null, createElement(RatingBadge, { rating: 1650, english: true }), createElement(RatingBadge, { rating: null, english: true }))));
  const badges = document.querySelectorAll('.lc-rating');
  assert.equal(badges.length, 1);
  assert.equal(badges[0].dataset.band, 'blue');
  assert.equal(badges[0].textContent, 'Rating 1650');
  act(() => root.unmount());
});

test('the bank sorts and filters by rating, list and solved month, and browses by contest', async () => {
  const requests = [];
  const navigations = [];
  const rows = [item(1046, { rating: 1290 }), item(2364, { rating: 1622, acceptance: 64 }), item(26)];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.endsWith('/oj/lists')) return Response.json({ items: [{ id: 'list-abc', title: 'Graphs' }] });
    if (url.includes('view=contests'))
      return Response.json({
        contests: [{ code: 'w137', problems: [{ ...item(1046), rating: 1290, q: 1, progressStatus: 'solved', solved: true }, { ...item(1047), rating: 1286, q: 2, caseStatus: 'missing', judgeProblemId: null, progressStatus: 'not_started' }] }],
        total: 1, page: 1, pageSize: 20,
      });
    return Response.json(page(rows));
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(StudyLibrary, { navigate: (...a) => navigations.push(a), availableProblemIds: [], signedIn: true, userId: 'me' })),
    );
    await settle();
    const badges = [...document.querySelectorAll('.study-row .lc-rating')];
    assert.deepEqual(badges.map((b) => b.dataset.band), ['green', 'blue']);
    assert.match(document.querySelectorAll('.study-row')[1].textContent, /64% accepted/);
    // The order select is there without a company, and rating sorts either way.
    const order = labelled('Order');
    assert.ok(order !== undefined);
    assert.equal(order.querySelector('option[value="frequency"]') === null, true);
    await change(order, 'rating:desc');
    let params = lastParams(requests);
    assert.deepEqual([params.get('sort'), params.get('dir')], ['rating', 'desc']);
    assert.equal(document.querySelectorAll('.route-heading').length, 0, 'no stop headings out of line order');
    await change(order, '');
    assert.equal(lastParams(requests).has('dir'), false);
    assert.ok(document.querySelectorAll('.route-heading').length > 0);
    // A rating band, one of my lists and a solved month ride along.
    await change(labelled('Rating'), '1400-1599');
    params = lastParams(requests);
    assert.deepEqual([params.get('ratingMin'), params.get('ratingMax')], ['1400', '1599']);
    await change(labelled('Rating'), '2400-');
    params = lastParams(requests);
    assert.deepEqual([params.get('ratingMin'), params.has('ratingMax')], ['2400', false]);
    await change(labelled('My lists'), 'list-abc');
    assert.equal(lastParams(requests).get('list'), 'list-abc');
    await change(labelled('Solved in'), '2026-09');
    params = lastParams(requests);
    assert.equal(params.get('solved'), '2026-09');
    assert.equal(params.get('tz'), String(new Date().getTimezoneOffset()));
    // Clear filters drops them all.
    await change(labelled('Rating'), '');
    await change(labelled('My lists'), '');
    await change(labelled('Solved in'), '');
    params = lastParams(requests);
    assert.equal(['ratingMin', 'list', 'solved', 'tz'].some((key) => params.has(key)), false);
    // Without a month picker (Safari, Firefox) the box is text: a half-typed month stays and
    // filters nothing until it is whole. The latest month is this local one.
    const month = labelled('Solved in');
    const now = new Date();
    assert.equal(month.getAttribute('max'), `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    // React re-assigns `type` on every render, so pin jsdom's text box under it.
    month.setAttribute('type', 'text');
    Object.defineProperty(month, 'type', { get: () => 'text', set() {} });
    await change(month, '2026-0');
    assert.equal(month.value === '2026-0', true);
    assert.equal(lastParams(requests).has('solved'), false);
    await change(month, '2026-08');
    assert.equal(lastParams(requests).get('solved'), '2026-08');
    await change(month, '');
    // A stop's own "sort by rating" toggle.
    const stop = document.querySelector('.route-stop input[value="hash-counting"]');
    await act(async () => stop.click());
    await settle();
    const toggle = document.querySelector('.route-rating-sort');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
    await act(async () => toggle.click());
    await settle();
    assert.equal(lastParams(requests).get('sort'), 'rating');
    assert.equal(document.querySelector('.route-rating-sort').getAttribute('aria-pressed'), 'true');
    // By contest: the grid replaces the list, Q1–Q4 across; cells open problems or statements.
    const byContest = [...document.querySelectorAll('.study-browse button')].find((b) => b.textContent === 'By contest');
    await act(async () => byContest.click());
    await settle();
    assert.equal(document.querySelector('.study-filters') === null, true);
    assert.equal(new URL(location.href).searchParams.get('browse'), 'contests');
    const cells = [...document.querySelectorAll('.contest-row [role="cell"]')];
    assert.equal(cells.length, 4);
    assert.equal(cells[0].querySelector('.contest-cell').dataset.progress, 'solved');
    assert.match(document.querySelector('.contest-name').textContent, /Weekly 137/);
    await act(async () => cells[0].querySelector('button').click());
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'lc-1046' }]);
    assert.equal(cells[2].querySelector('button') === null, true, 'a gap where the bank lacks Q3');
  } finally {
    act(() => root.unmount());
    history.replaceState(null, '', '/');
  }
});

test('problems at your level: three tiers with chances, nothing when the request fails', async () => {
  const navigations = [];
  globalThis.fetch = async () =>
    Response.json({
      level: 1500, samples: 12,
      tiers: [
        { tier: 'easy', from: 1300, to: 1500, items: [{ id: 'lc-7', number: 7, titleZh: '七', titleEn: 'Seven', rating: 1400, chance: 64 }] },
        { tier: 'moderate', from: 1500, to: 1650, items: [] },
        { tier: 'hard', from: 1650, to: 1850, items: [{ id: 'lc-9', number: 9, titleZh: '九', titleEn: 'Nine', rating: 1800, chance: 30 }] },
      ],
    });
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(LevelPicks, { english: true, navigate: (...a) => navigations.push(a) })));
  await settle();
  assert.match(document.querySelector('.level-picks-head').textContent, /1500.*latest 12 rated ACs/);
  const tiers = [...document.querySelectorAll('.level-tier')];
  assert.deepEqual(tiers.map((t) => t.querySelector('h3').textContent), ['Easy1300–1500', 'Moderate1500–1650', 'Difficult1650–1850']);
  assert.equal(tiers[1].querySelector('.level-tier-empty') !== null, true);
  const link = tiers[0].querySelector('a.level-pick');
  assert.equal(link.getAttribute('href'), '/?view=problem&problem=lc-7');
  assert.match(link.textContent, /64% to solve/);
  await act(async () => link.click());
  assert.deepEqual(navigations, [['problem', { problem: 'lc-7' }]]);
  act(() => root.unmount());
  globalThis.fetch = async () => Response.json({ error: 'Please sign in first' }, { status: 401 });
  const again = createRoot(document.getElementById('root'));
  await act(async () => again.render(createElement(LevelPicks, { english: true })));
  await settle();
  assert.equal(document.querySelector('.level-picks') === null, true);
  act(() => again.unmount());
});

test('the points card shows the balance and buys a freeze, handing the purchase back', async () => {
  const posts = [];
  const summary = (balance, bought) => ({
    balance, ledger: [{ delta: 10, reason: 'ac-day', ref: '2026-10-14', createdAt: Date.now() }, { delta: -100, reason: 'freeze', createdAt: Date.now() }],
    prices: { freeze: 100, ai: 50 }, rules: { acDay: 10, daily: 20, dailyMonth: 100, dailyMonthDays: 25, firstAc: 5, firstAcCap: 100, streak: 50, experience: 100, upvote: 2, upvoteCap: 40 },
    freezes: { boughtThisMonth: bought.length, monthlyMax: 3, purchased: bought }, ai: null,
  });
  globalThis.fetch = async (url, options) => {
    if (options?.method === 'POST') {
      posts.push([url, JSON.parse(options.body)]);
      return Response.json(summary(20, [Date.now()]));
    }
    return Response.json(summary(120, []));
  };
  const changes = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(PointsPanel, { english: true, onChange: (s) => changes.push(s) })));
  await settle();
  assert.equal(document.querySelector('.points-balance strong').textContent, '120');
  const buttons = [...document.querySelectorAll('.points-redeem')];
  assert.equal(buttons.length, 1, 'no AI pack without the AI tutor');
  assert.match(buttons[0].textContent, /0\/3 this month/);
  await act(async () => buttons[0].click());
  await settle();
  assert.deepEqual(posts, [['/api/oj/points/redeem', { item: 'freeze' }]]);
  assert.equal(document.querySelector('.points-balance strong').textContent, '20');
  assert.equal(changes.at(-1).freezes.purchased.length, 1);
  assert.equal(document.querySelector('.points-redeem').disabled, true, 'not enough points left');
  assert.match(document.querySelector('.points-message').textContent, /streak freeze added/);
  assert.deepEqual(
    [...document.querySelectorAll('.points-ledger strong')].map((n) => n.textContent),
    ['+10', '-100'],
  );
  act(() => root.unmount());
});

test('the sprint plan groups by topic or difficulty, ordered as chosen, and remembers it', async () => {
  const goal = { ...DEFAULT_GOAL, status: 'planned', weeklyHours: 20 };
  const line = [
    { id: 'a', difficulty: '困难', stop: 0 },
    { id: 'b', difficulty: '困难', stop: 0 },
    { id: 'c', difficulty: '简单', stop: 1 },
    { id: 'd', difficulty: '中等', stop: 1 },
  ];
  const plan = buildPlan({ goal, today: '2026-10-14', line });
  const byTopic = planGroups(plan.days, 'topic');
  assert.deepEqual(byTopic.map((g) => [g.stop, g.problems]), [[0, 2], [1, 2]]);
  assert.deepEqual(planGroups(plan.days, 'topic', 'difficulty').map((g) => g.stop), [1, 0]);
  assert.deepEqual(planGroups(plan.days, 'difficulty').map((g) => [g.level, g.problems]), [['easy', 1], ['medium', 1], ['hard', 2]]);
  const stops = routeStops([
    { slug: 'array-foundations', title: 'A', titleEn: 'A', total: 2, solved: 0 },
    { slug: 'hash-counting', title: 'H', titleEn: 'H', total: 2, solved: 0 },
  ]).stops;
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(StudyPlan, { goal, plan, today: '2026-10-14', onSave: () => {}, stops, english: true })),
  );
  await settle();
  const group = labelled('Group');
  await change(group, 'difficulty');
  assert.deepEqual(
    [...document.querySelectorAll('.route-plan-weeks ol[data-group] .route-plan-week')].map((n) => n.firstChild.textContent),
    ['Easy', 'Medium', 'Hard'],
  );
  await change(labelled('Group'), 'topic');
  await change(labelled('Order'), 'difficulty');
  assert.deepEqual(JSON.parse(localStorage.getItem(PLAN_VIEW_KEY)), { by: 'topic', order: 'difficulty' });
  act(() => root.unmount());
  // A fresh mount reads the saved view.
  const again = createRoot(document.getElementById('root'));
  await act(async () =>
    again.render(createElement(StudyPlan, { goal, plan, today: '2026-10-14', onSave: () => {}, stops, english: true })),
  );
  await settle();
  assert.equal(labelled('Group').value, 'topic');
  assert.equal(document.querySelectorAll('.route-plan-weeks ol[data-group="topic"] li').length, 2);
  act(() => again.unmount());
});
