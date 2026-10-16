import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

const question = (n, choices) => ({ id: `lc-${n}`, number: n, titleZh: `题 ${n}`, titleEn: `Problem ${n}`, choices });
const first = question(1, ['array-foundations', 'hash-counting', 'string-processing', 'two-pointers-windows']);
const second = question(203, ['linked-list', 'binary-tree', 'binary-tree-paths', 'binary-search-tree']);
const DAY = 86_400_000;
const latest = {
  at: Date.UTC(2026, 9, 1),
  groups: [
    { group: 0, right: 0, total: 1, level: null, skip: false, picks: [{ id: 'lc-9', number: 9, titleZh: '题 9', titleEn: 'Problem 9', score: 1200, rated: false }] },
    { group: 1, right: 1, total: 1, level: 1832, skip: true, picks: [] },
  ],
};

test('the quiz starts, shows each verdict, and ends on a skill map with problems to check', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.org/placement' });
  for (const name of ['window', 'document', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const posts = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/oj/speedrun/placement');
    if (init.method === 'GET') return Response.json({ latest: null, retakeAt: null, session: null });
    const data = JSON.parse(init.body);
    posts.push(data);
    if (data.start) return Response.json({ latest: null, retakeAt: null, session: { total: 2, index: 0, answered: [], group: 0, question: first } });
    if (data.id === 'lc-1')
      return Response.json({
        verdict: { id: 'lc-1', pick: data.pick, answer: 'hash-counting', right: false, reason: '理由', reasonEn: 'Count with a map.' },
        latest: null,
        retakeAt: null,
        session: { total: 2, index: 1, answered: [false], group: 1, question: second },
      });
    return Response.json({
      verdict: { id: 'lc-203', pick: data.pick, answer: 'linked-list', right: true, reason: '理由', reasonEn: 'Walk the list.' },
      latest,
      retakeAt: latest.at + 30 * DAY + 400 * DAY,
      session: null,
    });
  };
  const { createRoot } = await import('react-dom/client');
  const { Placement } = await import('../components/placement.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Placement, { zh: false })));
  const text = () => document.body.textContent;
  const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(label));
  const choice = (slugName) => [...document.querySelectorAll('.sr-choice')].find((b) => b.textContent.includes(slugName));

  assert.ok(text().includes('6 groups, 3 questions each'));
  await act(async () => button('Start the quiz').click());
  assert.deepEqual(posts, [{ start: true }]);
  assert.ok(text().includes('Problem 1'));
  assert.ok(text().includes('Pattern placement · Linear Structures'));
  assert.equal(document.querySelector('.sr-count .sr-only').textContent, 'Question 1 of 2');
  assert.equal(document.activeElement?.id, 'sr-heading', 'the first question takes focus');
  assert.equal([...document.querySelectorAll('.sr-roundel')].some((r) => r.textContent), false, 'no stop numbers before the answer');

  await act(async () => choice('In-place Arrays').click());
  assert.deepEqual(posts.at(-1), { id: 'lc-1', pick: 'array-foundations' });
  assert.ok(text().includes("Not quite: it's stop 02, Hashing"));
  assert.ok(text().includes('Count with a map.'));
  assert.equal(document.querySelectorAll('.sr-choice:disabled').length, 4);
  assert.equal(document.activeElement?.textContent.includes('Next'), true, 'Next takes focus');
  assert.equal(document.querySelector('.sr-pips li[data-state="wrong"]') !== null, true);

  await act(async () => button('Next').click());
  assert.ok(text().includes('Problem 203'));
  assert.equal(document.activeElement?.id, 'sr-heading');
  await act(async () => choice('Linked Lists').click());
  assert.ok(text().includes('Correct'));
  await act(async () => button('See results').click());

  // The result: one group of two to skip, a level per group, a problem to check the weak one.
  assert.equal(document.querySelector('.sr-score').textContent.includes('1/ 2'), true);
  assert.ok(text().includes('Skill map'));
  assert.equal(document.querySelectorAll('.pl-skip').length, 1);
  assert.ok(text().includes('Level ≈1832'));
  assert.ok(text().includes('No estimate'));
  const check = [...document.querySelectorAll('.sr-review a')];
  assert.deepEqual(check.map((a) => a.getAttribute('href')), ['/?view=problem&problem=lc-9']);
  assert.ok(document.querySelector('.sr-review').textContent.includes('≈1200'), 'a stand-in score says so');
  assert.equal(document.querySelectorAll('.sr-result .sr-pips li[data-state="right"]').length, 5, 'Lists & Trees lit on the line');
  assert.ok(text().includes('You can retake it from'));
  assert.equal(button('Retake'), undefined);
  assert.ok(text().includes('not a measure of coding skill'));
  await act(async () => root.unmount());
});

test('a refused start shows the server’s message and keeps the intro', async () => {
  globalThis.fetch = async (_url, init) =>
    init.method === 'GET'
      ? Response.json({ latest: null, retakeAt: null, session: null })
      : Response.json({ error: 'There are no problems to quiz you on yet' }, { status: 409 });
  const { createRoot } = await import('react-dom/client');
  const { Placement } = await import('../components/placement.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Placement, { zh: true })));
  await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始测验')).click());
  assert.equal(document.querySelector('[role="alert"]').textContent.includes('There are no problems'), true);
  assert.ok(document.body.textContent.includes('6 组，每组 3 题'));
  await act(async () => root.unmount());
});

test('a question swapped out for a contest shows the next one without a verdict', async () => {
  const view = (question, answered) => ({ latest: null, retakeAt: null, session: { total: 2, index: answered.length, answered, group: 0, question } });
  globalThis.fetch = async (_url, init) => Response.json(init.method === 'GET' ? view(first, []) : view(second, []));
  const { createRoot } = await import('react-dom/client');
  const { Placement } = await import('../components/placement.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Placement, { zh: false })));
  await act(async () => [...document.querySelectorAll('.sr-choice')][0].click());
  assert.ok(document.body.textContent.includes('Problem 203'));
  assert.equal(document.querySelector('.sr-verdict').textContent, '');
  assert.equal(document.querySelectorAll('.sr-choice:disabled').length, 0);
  await act(async () => root.unmount());
});

test('the sprint plan form unticks a new result’s known stops once, starts past them, and never plans nothing', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.org/?view=problems' });
  for (const name of ['window', 'document', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  const { ROUTE_SECTIONS, ROUTE_SLUGS } = await import('../lib/route-stops.ts');
  const { DEFAULT_GOAL } = await import('../lib/study-plan.ts');
  const { StudyPlan } = await import('../components/study-plan.tsx');
  const { createRoot } = await import('react-dom/client');
  // Linear Structures answered right throughout: its eight stops are known.
  const result = { at: 5000, groups: [{ group: 0, right: 3, total: 3, level: 1900, skip: true, picks: [] }] };
  globalThis.fetch = async (url) =>
    url.includes('speedrun/placement') ? Response.json({ latest: result, retakeAt: null, session: null }) : Response.json({ companies: [] });
  const stops = ROUTE_SLUGS.map((slug, index) => ({
    slug,
    index,
    code: String(index + 1).padStart(2, '0'),
    title: slug,
    titleEn: slug,
    shortZh: slug,
    shortEn: slug,
    group: ROUTE_SECTIONS[0],
    start: false,
    total: 10,
    solved: 0,
  }));
  const saved = [];
  let root = createRoot(document.getElementById('root'));
  const render = (goal) =>
    act(async () =>
      root.render(createElement(StudyPlan, { goal, plan: null, today: '2026-10-15', onSave: (g) => saved.push(g), stops, english: true })),
    );
  const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(label));
  const box = (slug) => document.querySelectorAll('.route-plan-topics input[type="checkbox"]')[ROUTE_SLUGS.indexOf(slug)];
  const first = ROUTE_SECTIONS[0].slugs;

  await render(DEFAULT_GOAL);
  await act(async () => button('Plan my sprint').click());
  for (const slug of first) assert.equal(box(slug).checked, false, slug);
  assert.equal(box('linked-list').checked, true);
  assert.equal(document.querySelectorAll('.route-plan-topics label .route-plan-note').length, first.length, 'known stops say so');
  assert.match(document.querySelector('.route-plan-topics [role="status"]').textContent, /unticked 8 known stops/);
  assert.equal(document.querySelector('#route-plan-start').value, String(first.length), 'the start moves past them');
  assert.match(document.querySelector('#route-plan-start-hint').textContent, /and your placement quiz/);
  // Ticking one back is the learner's call: the start moves back to it, so it is planned.
  await act(async () => box('binary-search').click());
  assert.equal(document.querySelector('#route-plan-start').value, String(ROUTE_SLUGS.indexOf('binary-search')));
  await act(async () => button('Save plan').click());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].placementAt, 5000);
  assert.equal(saved[0].startStop, ROUTE_SLUGS.indexOf('binary-search'));
  assert.deepEqual(
    saved[0].topics.filter((slug) => first.includes(slug)),
    ['binary-search'],
  );

  // The same result again changes nothing: the saved choice stands.
  await render({ ...saved[0], status: 'planned' });
  await act(async () => button('Edit sprint plan').click());
  assert.equal(box('binary-search').checked, true);
  assert.equal(box('array-foundations').checked, false);
  assert.equal(document.querySelector('.route-plan-topics [role="status"]'), null);
  await act(async () => root.unmount());

  // Every chosen stop known: unticking them would plan nothing, so the result is not applied.
  root = createRoot(document.getElementById('root'));
  await render({ ...DEFAULT_GOAL, status: 'planned', topics: first });
  await act(async () => button('Edit sprint plan').click());
  for (const slug of first) assert.equal(box(slug).checked, true, slug);
  assert.equal(document.querySelector('#route-plan-start').value, String(DEFAULT_GOAL.startStop));
  assert.equal(document.querySelector('.route-plan-topics [role="status"]'), null);
  await act(async () => button('Save plan').click());
  assert.deepEqual([saved[1].startStop, saved[1].topics, saved[1].placementAt], [DEFAULT_GOAL.startStop, first, DEFAULT_GOAL.placementAt]);
  await act(async () => root.unmount());

  // The note counts the stops it unticked, not every known one.
  root = createRoot(document.getElementById('root'));
  await render({ ...DEFAULT_GOAL, status: 'planned', topics: ROUTE_SLUGS.slice(3) });
  await act(async () => button('Edit sprint plan').click());
  assert.match(document.querySelector('.route-plan-topics [role="status"]').textContent, /unticked 5 known stops/);
  await act(async () => root.unmount());

  // Stops handed over by /career/jd stay ticked; the known ones are only tagged, and the result waits.
  window.history.replaceState(null, '', '/?view=problems&planTopics=binary-search,dp-grid');
  root = createRoot(document.getElementById('root'));
  await render(DEFAULT_GOAL);
  assert.deepEqual(
    ROUTE_SLUGS.filter((slug) => box(slug).checked),
    ['binary-search', 'dp-grid'],
  );
  assert.equal(document.querySelectorAll('.route-plan-topics label .route-plan-note').length, first.length);
  assert.equal(document.querySelector('.route-plan-topics [role="status"]'), null);
  await act(async () => button('Save plan').click());
  assert.deepEqual([saved[2].topics, saved[2].placementAt], [['binary-search', 'dp-grid'], DEFAULT_GOAL.placementAt]);
  await act(async () => root.unmount());
});
