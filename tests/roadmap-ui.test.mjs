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
