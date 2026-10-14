// /roadmap: the prerequisite graph renders on the server; the tracks fill in progress
// and read marks on the client, and stay a guest's map when the marks API says 401.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
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
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes('/marks'))
      return signedIn
        ? Response.json({ items: [{ target: 'sd:framework', mark: 'read', createdAt: 1 }] })
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
    assert.match(document.body.textContent, /1 of 3 chapters read\./);
    const read = [...document.querySelectorAll('.roadmap-parts li[data-read]')];
    assert.deepEqual(read.map((li) => li.textContent), ['Framework (read)']);
    assert.deepEqual(
      [...document.querySelectorAll('.roadmap-parts h3')].map((h) => h.textContent),
      ['Framework', 'Case studies', 'Low-level design'],
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
