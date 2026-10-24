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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock' });
dom.window.localStorage.setItem('cswork:locale', 'en');
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.indexedDB = { open: () => ({}) };
const { createRoot } = await import('react-dom/client');
const { MockOa } = await import('../components/mock-oa.tsx');

const presets = { updated: '2026-10', companies: [], others: [], all: { oa: 40, lc: 60 } };
const calls = [];
let report;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
  if (path === '/api/oj/mock-oa/presets') return Response.json(presets);
  if (path === '/api/oj/mock-oa/history') return Response.json({ items: [], saved: [] });
  if (path === '/api/oj/mock-oa/draw') return Response.json({ error: '所选知识点下的题不够，减少题量或多选几个' }, { status: 409 });
  if (path.startsWith('/api/oj/mock-oa/report?')) return Response.json(report);
  return Response.json({});
};
const boot = {
  person: { id: 'u1', name: 'U', email: 'u@example.test', role: 'student', verified: true },
  courses: [],
  problems: [],
  progress: [],
  submissions: [],
  notifications: [],
  services: {},
};
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};
const click = (node) => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

test('a custom mock sends its chosen topics, at most five, and shows why a draw fell short', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(MockOa, { boot, params: { view: 'mock' }, navigate() {} }));
    await settle();
  });
  const chips = [...document.querySelectorAll('.mock-topics button')];
  assert.equal(chips.length, 35);
  for (const chip of chips.slice(0, 6)) await act(async () => click(chip));
  assert.equal(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').length, 5);
  assert.equal(chips[5].disabled, true);
  // Off again frees a place.
  await act(async () => click(chips[0]));
  assert.equal(chips[5].disabled, false);
  assert.match(document.querySelector('.mock-topics legend').textContent, /4\/5/);
  await act(async () => {
    document.querySelector('.mock-custom form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  });
  const draw = calls.find((c) => c.path === '/api/oj/mock-oa/draw');
  assert.deepEqual(draw.body.custom.topics, ['hash-counting', 'string-processing', 'two-pointers-windows', 'prefix-intervals']);
  assert.match(document.querySelector('.mock-note[role="alert"]').textContent, /Not enough problems on the topics you picked/);
  await act(async () => root.unmount());
});

test('the report asks with its scenario and says how the score stands once enough people took it', async () => {
  const start = Date.now() - 3600_000;
  const session = {
    id: '11111111-2222-4333-8444-555555555555', company: 'acme', name: 'Acme', platform: 'HackerRank', preset: true,
    scoring: 'tests', source: 'mixed', slots: ['easy', 'hard'], ids: ['lc-1', 'lc-2'], minutes: 60, skew: 0,
    createdAt: start, startedAt: start, finishedAt: start + 1800_000, reason: 'manual',
  };
  localStorage.setItem('cswork:mock:v1:u1', JSON.stringify({ active: null, history: [session] }));
  const item = (id) => ({ id, attempts: 1, best: { passed: 3, total: 3, accepted: true }, firstAcceptedMs: 1000, pending: false });
  report = {
    items: [item('lc-1'), item('lc-2')],
    score: { value: 200, min: 0, max: 200, per: [100, 100], estimate: false },
    pending: false,
    peers: { n: 40, below: 26 },
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(MockOa, { boot, params: { view: 'mock', report: session.id }, navigate() {} }));
    await settle();
  });
  const query = new URLSearchParams(calls.findLast((c) => c.path.startsWith('/api/oj/mock-oa/report?')).path.split('?')[1]);
  assert.equal(query.get('preset'), '1');
  assert.equal(query.get('company'), 'acme');
  assert.equal(query.get('source'), 'mixed');
  assert.equal(document.querySelector('.mock-peers').textContent, 'Ahead of 65% of mocks like this (40 people)');
  await act(async () => root.unmount());
});
