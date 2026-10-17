// /roadmap: the prerequisite graph renders on the server; the tracks fill in progress
// and read marks on the client, and stay a guest's map when the marks API says 401.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// Stylesheets load as nothing; the page reads the locale cookie through a stubbed next/headers (English).
const mocks = {
  'next/headers': 'export const cookies = async () => ({ get: () => undefined }); export const headers = async () => new Headers();',
  'next/link': 'export default function Link() { return null; }',
  'next/navigation': 'export const usePathname = () => "/roadmap"; export const useSearchParams = () => new URLSearchParams();',
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks = ${JSON.stringify(mocks)};
export async function resolve(s, c, n) { return mocks[s] ? { url: 'mock:' + s, shortCircuit: true } : n(s, c); }
export async function load(url, context, next) { if (url.startsWith('mock:')) return { format: 'module', source: mocks[url.slice(5)], shortCircuit: true }; if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }`)}`,
  import.meta.url,
);

const { RouteGraph, graphState } = await import('../components/route-graph.tsx');
const { ROUTE_SLUGS } = await import('../lib/route-stops.ts');

test('the graph draws every stop and prerequisite on the server, linking to its practice', () => {
  const totals = Object.fromEntries(ROUTE_SLUGS.map((slug) => [slug, { solved: 0, total: 10 }]));
  const doc = new JSDOM(
    `<main>${renderToStaticMarkup(createElement(RouteGraph, { progress: totals, member: false, english: true }))}</main>`,
  ).window.document;
  const nodes = [...doc.querySelectorAll('a.route-graph-node')];
  assert.equal(nodes.length, 35);
  assert.equal(nodes[0].getAttribute('href'), '/?view=problems&section=array-foundations');
  assert.equal(nodes[0].getAttribute('aria-label'), 'Stop 01: In-place Arrays, 10 problems');
  assert.ok(nodes.every((node) => !node.hasAttribute('data-state')), 'guests get plain nodes');
  assert.equal(doc.querySelectorAll('.route-graph-ring').length, 0);
  assert.equal(doc.querySelectorAll('.route-graph-edge').length, 43);
  const svg = doc.querySelector('.route-graph svg');
  assert.ok(Number(svg.getAttribute('width')) > 375, 'wide: it scrolls inside .route-graph on phones');
});

test('states are hints: done at 80%, ready once prerequisites reach 60%', () => {
  const p = {
    'array-foundations': { solved: 8, total: 10 },
    'linked-list': { solved: 5, total: 10 },
    'hash-counting': { solved: 0, total: 10 },
    'binary-tree': { solved: 0, total: 10 },
  };
  assert.equal(graphState(p, 'array-foundations'), 'done');
  assert.equal(graphState(p, 'linked-list'), 'active');
  assert.equal(graphState(p, 'hash-counting'), 'ready');
  assert.equal(graphState(p, 'binary-tree'), 'later', 'linked lists are at 50%');
  assert.equal(graphState({ 'linked-list': { solved: 6, total: 10 } }, 'binary-tree'), 'ready');
  assert.equal(graphState({}, 'array-foundations'), 'ready', 'the root is always open');
});

test('signed in, the tracks show topic progress and read chapters; signed out they stay plain', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/roadmap' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { RoadmapTracks } = await import('../app/roadmap/tracks.tsx');
  const sections = ROUTE_SLUGS.map((slug, i) => ({
    slug,
    title: slug,
    total: 10,
    solved: i === 0 ? 9 : i === 8 ? 3 : 0,
  }));
  let signedIn = true;
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    requests.push(url);
    if (url.includes('/marks'))
      return signedIn
        ? Response.json({ items: [{ target: 'sd:framework', mark: 'read', createdAt: 1 }, { target: 'sd:tech-kafka', mark: 'read', createdAt: 2 }] })
        : Response.json({ error: '请先登录' }, { status: 401 });
    return Response.json({ collection: { sections } });
  };
  const props = {
    english: true,
    totals: Object.fromEntries(ROUTE_SLUGS.map((slug) => [slug, { solved: 0, total: 10 }])),
    sd: [
      { slug: 'framework', title: 'Framework', href: '/system-design/framework', part: 'framework' },
      { slug: 'url-shortener', title: 'URL Shortener', href: '/system-design/url-shortener', part: 'cases' },
      { slug: 'lld-elevator', title: 'Elevator', href: '/system-design/lld-elevator', part: 'lld' },
      { slug: 'tech-kafka', title: 'Kafka', href: '/system-design/tech-kafka', part: 'tech' },
    ],
    guide: [{ title: 'Final rounds', summary: 'STAR stories', href: '/guide/onsite' }],
  };
  const root = createRoot(document.getElementById('root'));
  const render = () =>
    act(async () => {
      root.render(createElement(RoadmapTracks, { ...props, key: String(signedIn) }));
      await new Promise((r) => setTimeout(r, 10));
    });
  try {
    await render();
    assert.ok(requests.some((url) => url.endsWith('/api/oj/library')));
    assert.ok(requests.some((url) => url.endsWith('/api/oj/marks?mark=read')));
    const state = (slug) => document.querySelector(`a.route-graph-node[href$="section=${slug}"]`).getAttribute('data-state');
    assert.equal(state('array-foundations'), 'done');
    assert.equal(state('linked-list'), 'active');
    assert.equal(state('hash-counting'), 'ready');
    assert.equal(state('binary-tree'), 'later');
    assert.equal(document.querySelectorAll('.route-graph-ring').length, 2);
    assert.equal(document.querySelectorAll('.roadmap-legend li').length, 4);
    // An optional chapter shows as read but stays out of the required count.
    assert.match(document.body.textContent, /1 of 3 required chapters read\./);
    const read = [...document.querySelectorAll('.roadmap-parts li[data-read]')];
    assert.deepEqual(read.map((li) => li.textContent), ['Framework (read)', 'Kafka (read)']);
    assert.deepEqual(
      [...document.querySelectorAll('.roadmap-parts h3')].map((h) => h.textContent),
      ['Framework', 'Case studies', 'Low-level design', 'Key technologies (optional)'],
      'empty parts are left out',
    );
    assert.ok(document.querySelector('.roadmap-cards a[href="/?view=stories"]'));
    assert.ok(document.querySelector('.roadmap-cards a[href="/guide/onsite"]'));

    signedIn = false;
    await render();
    assert.ok([...document.querySelectorAll('a.route-graph-node')].every((a) => !a.hasAttribute('data-state')));
    assert.ok(!document.querySelector('.roadmap-legend'));
    assert.match(document.querySelector('.roadmap-note').textContent, /Sign in/);
    assert.equal(document.querySelectorAll('.roadmap-parts li[data-read]').length, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test('every system design chapter lands in its course part, the ML chapters in their own', async () => {
  const { default: RoadmapPage } = await import('../app/roadmap/page.tsx');
  const { RoadmapTracks } = await import('../app/roadmap/tracks.tsx');
  const find = (node) =>
    node && typeof node === 'object'
      ? node.type === RoadmapTracks
        ? node
        : [node.props?.children].flat(Infinity).map(find).find(Boolean)
      : undefined;
  const tracks = find(await RoadmapPage({ searchParams: Promise.resolve({}) }));
  const course = JSON.parse(readFileSync(new URL('../lib/content/system-design-course.json', import.meta.url), 'utf8'));
  const { sd } = tracks.props;
  assert.deepEqual(sd.map((chapter) => chapter.slug), course.chapters.map((chapter) => chapter.slug));
  const part = Object.fromEntries(sd.map((chapter) => [chapter.slug, chapter.part]));
  for (const slug of ['ml-design-framework', 'recsys-ranking', 'search-ranking', 'ads-ctr', 'fraud-detection']) assert.equal(part[slug], 'ml', slug);
  for (const slug of ['ood-interview-approach', 'solid-in-practice', 'lld-elevator']) assert.equal(part[slug], 'lld', slug);
  for (const slug of ['concurrency-primitives', 'bounded-blocking-queue', 'rate-limited-executor']) assert.equal(part[slug], 'concurrency', slug);
  assert.equal(part['url-shortener'], 'cases');
  // The optional chapters are parts of their own, not case studies.
  const OPTIONAL = { tech: 'tech', pattern: 'patterns', 'lld-case': 'lld-cases', api: 'api' };
  for (const chapter of sd) {
    const prefix = chapter.slug.match(/^(tech|pattern|lld-case|api)-/)?.[1];
    if (prefix) assert.equal(part[chapter.slug], OPTIONAL[prefix], chapter.slug);
  }
  // The roadmap's required count matches the certificate's 27 chapters.
  assert.equal(sd.filter((chapter) => !Object.values(OPTIONAL).includes(chapter.part)).length, 27);
  const doc = new JSDOM(renderToStaticMarkup(tracks)).window.document;
  assert.deepEqual(
    [...doc.querySelectorAll('.roadmap-parts h3')].map((h) => h.textContent),
    [
      'Framework', 'Building blocks', 'Case studies', 'Low-level design', 'Concurrency', 'ML system design',
      'Key technologies (optional)', 'Patterns (optional)', 'LLD case library (optional)', 'API design (optional)',
    ],
  );
  assert.equal(doc.querySelectorAll('.roadmap-parts ol li').length, sd.length, 'no chapter is left out');
});

// Role paths v2 (components/role-path.tsx, components/route-editor.tsx): the schedule, marks and learner-made routes.
const findRolePath = async (params) => {
  const { default: RoadmapPage } = await import('../app/roadmap/page.tsx');
  const { RolePath } = await import('../components/role-path.tsx');
  const find = (node) =>
    node && typeof node === 'object'
      ? node.type === RolePath
        ? node
        : [node.props?.children].flat(Infinity).map(find).find(Boolean)
      : undefined;
  return { RolePath, props: find(await RoadmapPage({ searchParams: Promise.resolve(params) })).props };
};
async function mountRolePath(url, props, fetchStub) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url });
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'SubmitEvent', 'FormData', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  const { createRoot } = await import('react-dom/client');
  const { RolePath } = await import('../components/role-path.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(RolePath, props));
    await new Promise((r) => setTimeout(r, 20));
  });
  return {
    async close() {
      await act(async () => root.unmount());
      globalThis.fetch = originalFetch;
      dom.window.close();
    },
  };
}
const wait = (ms = 20) => act(async () => new Promise((r) => setTimeout(r, ms)));
const typeInto = (input, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text || b.getAttribute('aria-label') === text);

test('signed out, a role path is scheduled in this browser, with no marks and no copy button', async () => {
  const { props } = await findRolePath({ role: 'generalist' });
  assert.equal(props.catalog, undefined, 'the public page carries no catalog');
  assert.ok(props.steps.every((s) => typeof s.minutes === 'number'));
  const writes = [];
  const page = await mountRolePath('https://cswork.test/roadmap?role=generalist', props, async (input, init) => {
    if (init?.method === 'PUT') writes.push(String(input));
    return Response.json({ error: '请先登录' }, { status: 401 });
  });
  try {
    const hours = document.querySelector('.role-path-schedule input[type="number"]');
    assert.equal(hours.value, '10');
    assert.ok(document.querySelector('.role-path-schedule input[type="date"]'));
    assert.match(document.querySelector('.role-path-pace').textContent, /^At 10 h a week you finish on /);
    const weeks = document.querySelectorAll('.role-path-weeks > li').length;
    assert.ok(weeks > 4, `${weeks} weeks`);
    assert.equal(document.querySelector('.role-path-weeks .role-path-week').textContent, 'This week');
    // Every required step gets an estimate and a day; the optional crash course and OOP quiz do not.
    const scheduled = [...document.querySelectorAll('.role-path-steps > li')].filter((li) => li.querySelector('.role-path-eta'));
    assert.equal(scheduled.length, props.steps.filter((s) => !s.optional && !s.unavailable).length);
    assert.match(scheduled[0].querySelector('.role-path-eta').textContent, /^~[\d.]+ h · done by /);
    assert.equal(document.querySelector('.role-path-fork'), null);
    assert.equal(document.querySelectorAll('.role-path-marks').length, 0);
    assert.equal(document.querySelector('.role-path-mine'), null);
    assert.match(document.body.textContent, /Sign in to mark steps in progress or skipped/);

    typeInto(hours, '20');
    await wait();
    assert.match(document.querySelector('.role-path-pace').textContent, /^At 20 h a week/);
    assert.ok(document.querySelectorAll('.role-path-weeks > li').length < weeks);
    button('Save schedule').click();
    await wait();
    const saved = JSON.parse(localStorage.getItem('cswork:route:v1:guest')).generalist;
    assert.equal(saved.weeklyHours, 20);
    assert.equal(Object.keys(saved.planned).length, scheduled.length);
    assert.match(document.body.textContent, /Schedule saved in this browser\./);
    assert.deepEqual(writes, [], 'a guest writes no notes');

    // The hours can be cleared and retyped; leaving the field puts back the last valid value.
    const pace = () => document.querySelector('.role-path-pace').textContent;
    typeInto(hours, '');
    await wait();
    assert.equal(hours.value, '', 'not snapped back while typing');
    assert.match(pace(), /^At 20 h a week/);
    typeInto(hours, '15');
    await wait();
    assert.match(pace(), /^At 15 h a week/);
    typeInto(hours, '');
    hours.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true }));
    await wait();
    assert.equal(hours.value, '15');
  } finally {
    await page.close();
  }
});

test('a learner-made route mixes site steps and own entries; a step the site no longer has reads retired', async () => {
  const bad = await findRolePath({ route: '../etc', role: 'backend' });
  assert.equal(bad.props.route, null);
  assert.equal(bad.props.catalog, undefined);
  const { props } = await findRolePath({ route: 'r-fall26', role: 'backend' });
  assert.equal(props.role, null, '?route= wins');
  assert.equal(props.route, 'r-fall26');
  assert.ok(props.catalog['line-stops:array-foundations'] && props.catalog['sql-track:joins']);
  const doc = {
    v: 1,
    name: 'Fall plan',
    from: 'backend',
    steps: [
      { kind: 'sql-track', ref: 'joins' },
      { kind: 'line-stops', ref: 'array-foundations,retired-stop' },
      { kind: 'ext', id: 'ext-abc123', title: 'CS61B lectures 1–12', units: 12, done: 3, unitMinutes: 60 },
    ],
    targetDate: '',
    weeklyHours: 10,
    state: { 'sql-track:joins': 'doing' },
    planned: {},
  };
  const puts = [];
  const page = await mountRolePath('https://cswork.test/roadmap?route=r-fall26', props, async (input, init) => {
    const url = String(input);
    if (init?.method === 'PUT') {
      puts.push({ url, body: JSON.parse(JSON.parse(init.body).body), keepalive: init.keepalive });
      return Response.json({ updatedAt: 1 });
    }
    if (url.includes('prefix=route'))
      return Response.json({
        items: [
          { target: 'route:r-fall26', body: JSON.stringify(doc), updatedAt: 2 },
          { target: 'route:role-backend', body: JSON.stringify({ v: 1, targetDate: '', weeklyHours: 6, state: {}, planned: {} }), updatedAt: 1 },
        ],
      });
    if (url.endsWith('/api/oj/marks')) return Response.json({ items: [] });
    if (url.endsWith('/api/oj/history')) return Response.json({ items: [] });
    throw new Error(url);
  });
  try {
    await wait();
    const rows = () => [...document.querySelectorAll('.role-path-steps > li')];
    assert.equal(rows().length, 3);
    assert.match(document.querySelector('.role-path-blurb').textContent, /^Fall plan · Copied from Backend engineer$/);
    assert.match(rows()[0].textContent, /SQL: .*In progress/);
    assert.equal(rows()[0].querySelector('button[aria-pressed="true"]').textContent, 'In progress');
    const retired = rows()[1];
    assert.match(retired.textContent, /Content retired/);
    assert.ok(retired.hasAttribute('data-off'));
    assert.equal(retired.querySelector('.role-path-eta'), null, 'left out of the schedule');
    assert.match(rows()[2].textContent, /CS61B lectures 1–12Your entry3\/12/);
    assert.match(rows()[2].querySelector('.role-path-eta').textContent, /^~9 h · done by /);
    assert.deepEqual([...document.querySelectorAll('.role-path-mine a')].map((a) => [a.textContent, a.getAttribute('aria-current')]), [['Fall plan', 'page']]);
    assert.ok(button('New blank route'));
    // The picker groups the site's content by kind; a step already on the route is disabled.
    const select = document.querySelector('.role-path-editor select');
    assert.ok(select.querySelector('optgroup[label="Line 500"] option[value="line-stops:array-foundations"]'));
    assert.ok(!select.querySelector('option[value^="line-stops:array-foundations,"]'), 'multi-stop steps come only with a copy');
    assert.equal(select.querySelector('option[value="sql-track:joins"]').disabled, true);
    assert.ok(select.querySelector('optgroup[label="Crash courses"] option[value="course:big-o"]'));

    // "+1" and "−1" name themselves by their visible text first (WCAG 2.5.3).
    button('+1: CS61B lectures 1–12').click();
    await wait();
    assert.match(rows()[2].textContent, /4\/12/);
    button('−1: CS61B lectures 1–12').click();
    await wait();
    assert.match(rows()[2].textContent, /3\/12/);
    button('+1: CS61B lectures 1–12').click();
    await wait();
    assert.match(rows()[2].textContent, /4\/12/);
    button('Remove: Content retired').click();
    await wait();
    assert.equal(rows().length, 2);
    const form = document.querySelectorAll('.role-path-editor form')[0];
    typeInto(form.querySelector('input[name="title"]'), 'DDIA chapters 1–6');
    typeInto(form.querySelector('input[name="units"]'), '6');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    assert.equal(rows().length, 3);
    assert.match(rows()[2].textContent, /DDIA chapters 1–6Your entry0\/6/);
    assert.equal(button('−1: DDIA chapters 1–6'), undefined, 'nothing to take back at 0');
    assert.equal(puts.length, 0, 'saves wait for the edits to settle');
    await wait(900);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].url, '/api/oj/notes?target=route%3Ar-fall26');
    const saved = puts[0].body;
    assert.deepEqual(saved.steps.map((s) => s.ref ?? s.title), ['joins', 'CS61B lectures 1–12', 'DDIA chapters 1–6']);
    assert.equal(saved.steps[1].done, 4);
    assert.match(saved.steps[2].id, /^ext-[a-z0-9]{6}$/);
    assert.equal(saved.steps[2].unitMinutes, 60);
    assert.equal(puts[0].keepalive, true);

    // Following a link never unmounts the page: the pending save goes out on pagehide, once.
    button('−1: CS61B lectures 1–12').click();
    await wait();
    assert.equal(puts.length, 1);
    window.dispatchEvent(new window.Event('pagehide'));
    await wait();
    assert.equal(puts.length, 2);
    assert.equal(puts[1].body.steps[1].done, 3);
    await wait(900);
    assert.equal(puts.length, 2, 'the timer does not save it again');
  } finally {
    await page.close();
  }
});

test("a member's schedule waits for their progress: no false behind banner, no save of inflated days", async () => {
  const { props } = await findRolePath({ role: 'generalist' });
  const id = (s) => `${s.kind}:${s.ref}`;
  const counted = props.steps.filter((s) => !s.optional && !s.unavailable && s.keys.length > 0);
  const solved = counted.find((s) => s.keys.every((k) => k.startsWith('problem:')));
  const other = counted.find((s) => s !== solved);
  const doc = { v: 1, targetDate: '', weeklyHours: 10, state: {}, planned: { [id(solved)]: '2000-01-03', [id(other)]: '2000-01-03' } };
  const mount = (marksFail) =>
    mountRolePath('https://cswork.test/roadmap?role=generalist', props, async (input) => {
      const url = String(input);
      if (url.includes('prefix=route')) return Response.json({ items: [{ target: 'route:role-generalist', body: JSON.stringify(doc), updatedAt: 1 }] });
      if (url.endsWith('/api/oj/marks')) return marksFail ? Response.json({ error: 'Too many requests' }, { status: 429 }) : Response.json({ items: [] });
      if (url.endsWith('/api/oj/history'))
        return Response.json({ items: solved.keys.map((k) => ({ problemId: k.slice('problem:'.length), firstAcAt: 1 })) });
      if (url.includes('mcq%3Aanswers')) return Response.json({ target: 'mcq:answers', body: '' });
      throw new Error(url);
    });

  let page = await mount(true);
  try {
    await wait();
    assert.equal(document.querySelector('.role-path-error').textContent, 'Too many requests');
    assert.equal(document.querySelector('.role-path-behind'), null);
    assert.equal(document.querySelector('.role-path-eta'), null);
    assert.equal(button('Save schedule'), undefined);
    assert.equal(document.querySelector('.role-path-pace').textContent, '');
  } finally {
    await page.close();
  }

  page = await mount(false);
  try {
    await wait();
    assert.equal(document.querySelector('.role-path-error'), null);
    // The solved step is off the schedule; only the other one is behind.
    assert.match(document.querySelector('.role-path-behind').textContent, /^1 step behind/);
    assert.ok(button('Save schedule'));
  } finally {
    await page.close();
  }
});
