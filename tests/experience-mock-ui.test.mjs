import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

// "Practise this loop" (/?view=mock&experience=<id>): one draw per visit, the replace prompt as
// usual, never over a running skill exam; "draw again" keeps the same loop.
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.indexedDB = { open: () => ({}) };
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
const { createRoot } = await import('react-dom/client');
const { MockOa } = await import('../components/mock-oa.tsx');
const { mockStorageKey, readMockState } = await import('../lib/mock-oa.ts');

const ID = 'CCCCCCCCCCCC';
const drawn = {
  ids: ['lc-1', 'lc-42'], company: 'amazon', name: 'Amazon', platform: null, preset: false, questions: 2, minutes: 90,
  slots: ['easy', 'hard'], scoring: 'tests', source: 'mixed', topics: [], experience: ID, now: Date.now(),
};
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const path = typeof url === 'string' ? url : url.url;
  calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
  if (path === '/api/oj/mock-oa/presets') return Response.json({ updated: '2026-10', companies: [], others: [], all: { oa: 0, lc: 0 } });
  if (path === '/api/oj/mock-oa/history') return Response.json({ items: [], saved: [] });
  if (path === '/api/oj/mock-oa/draw') return Response.json(drawn);
  if (path.startsWith('/api/oj/mock-oa/report?')) return Response.json({ items: [], score: { value: 0, min: 0, max: 100, per: [], estimate: false }, pending: false });
  return Response.json({});
};
const boot = {
  person: { id: 'u1', name: 'U', email: 'u@example.test', role: 'student', verified: true },
  courses: [], problems: [], progress: [], submissions: [], notifications: [], services: {},
};
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};
const draws = () => calls.filter((c) => c.path === '/api/oj/mock-oa/draw');
async function visit(params) {
  const navigated = [];
  const root = createRoot(document.getElementById('root'));
  const render = () => root.render(createElement(MockOa, { boot, params, navigate: (...a) => navigated.push(a) }));
  await act(async () => {
    render();
    await settle();
  });
  // A re-render (new params object, same link) draws nothing more.
  await act(async () => {
    render();
    await settle();
  });
  return { root, navigated };
}

test('?experience= draws that loop once and opens its check-in', async () => {
  localStorage.clear();
  calls.length = 0;
  const { root, navigated } = await visit({ view: 'mock', experience: ID });
  assert.equal(draws().length, 1);
  assert.equal(draws()[0].body.experience, ID);
  assert.equal(draws()[0].body.company, undefined);
  const active = readMockState('u1').active;
  assert.deepEqual([active.experience, active.preset, active.ids], [ID, false, ['lc-1', 'lc-42']]);
  assert.deepEqual(navigated.at(-1), ['mock', { session: active.id }]);
  // A post always draws the same problems: the check-in offers no "Redraw", and a problem that is
  // unavailable points back to the post.
  await act(async () => {
    root.render(createElement(MockOa, { boot, params: { view: 'mock', session: active.id }, navigate() {} }));
    await settle();
  });
  assert.ok(![...document.querySelectorAll('button')].some((b) => b.textContent.includes('Redraw')));
  const alert = document.querySelector('[role="alert"]');
  assert.ok(alert.textContent.includes('Practise them one by one from the post'));
  assert.equal(alert.querySelector('a').getAttribute('href'), `/library/experience-ugc/${ID}`);
  await act(async () => root.unmount());

  // The report's "New draw" asks for the same loop again.
  const finished = { ...active, startedAt: Date.now() - 60_000, finishedAt: Date.now() };
  localStorage.setItem(mockStorageKey('u1'), JSON.stringify({ active: null, history: [finished] }));
  const again = await visit({ view: 'mock', report: finished.id });
  const draw = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('New draw'));
  await act(async () => {
    draw.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await settle();
  });
  assert.equal(draws().length, 2);
  assert.equal(draws()[1].body.experience, ID);
  await act(async () => again.root.unmount());
});

test('a running mock asks first; a running skill exam is never replaced', async () => {
  const started = { ...drawn, id: 'm1', skew: 0, createdAt: Date.now(), startedAt: Date.now() };
  localStorage.setItem(mockStorageKey('u1'), JSON.stringify({ active: started, history: [] }));
  calls.length = 0;
  let visitTo = await visit({ view: 'mock', experience: ID });
  assert.equal(draws().length, 0, 'the replace prompt comes first');
  assert.ok(document.body.textContent.includes('End the mock in progress?'));
  await act(async () => visitTo.root.unmount());

  localStorage.setItem(mockStorageKey('u1'), JSON.stringify({ active: { ...started, cert: { test: 'python-basics' } }, history: [] }));
  visitTo = await visit({ view: 'mock', experience: ID });
  assert.equal(draws().length, 0);
  assert.ok(document.querySelector('[role="alert"]').textContent.includes('skill exam is in progress'));
  await act(async () => visitTo.root.unmount());
});
