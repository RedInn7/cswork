import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// next/link renders a plain anchor (vinext provides it in the app).
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link({prefetch,...p}){return globalThis.__link(p)}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);
globalThis.__link = (props) => createElement('a', props);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock-peer' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { MockPeer } = await import('../components/mock-peer.tsx');

const wait = () => act(async () => new Promise((r) => setTimeout(r, 5)));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function set(input, value) {
  const proto = input instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}

test('practice now: with reminders off and a focus, it asks at once and counts the 15 minutes down', async () => {
  let state = { request: null, paused: false, pairs: [] };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    if (path === 'oj/reports/companies') return Response.json({ items: [{ slug: 'google', name: 'Google' }, { slug: 'meta', name: 'Meta' }] });
    if (path === 'oj/peer' && init.body) {
      const body = JSON.parse(init.body);
      posts.push(body);
      state = { ...state, request: { displayName: body.displayName, kind: body.kind, level: body.level, slots: [], instant: body.instant, expired: false, createdAt: Date.now() } };
      return Response.json(state, { status: 201 });
    }
    if (path === 'oj/peer') return Response.json(state);
    throw new Error(`unexpected ${path}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MockPeer, { navigate() {}, params: {} })));
  await wait();
  assert.equal(button('Practice now').disabled, true, 'a name first');
  set(document.querySelector('.peer-name input'), 'Cat');
  // The focus section loads its companies when opened.
  const details = document.querySelector('.peer-focus');
  details.open = true;
  await act(async () => details.dispatchEvent(new dom.window.Event('toggle')));
  await wait();
  const select = details.querySelector('select');
  assert.deepEqual([...select.options].map((o) => o.value), ['', 'google', 'meta']);
  await act(async () => set(select, 'meta'));
  assert.ok([...document.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === 'Remove Meta'));
  const topics = [...details.querySelectorAll('.peer-topics button')];
  for (const chip of topics.slice(0, 4)) await act(async () => chip.click());
  assert.equal(topics[3].disabled, true, 'three topics at most');
  await act(async () => document.querySelector('.peer-remind input').click());
  await act(async () => button('Practice now').click());
  await wait();
  const [body] = posts;
  assert.equal(body.instant, true);
  assert.deepEqual(body.slots, []);
  assert.equal(body.remind, false);
  assert.deepEqual(body.focus, { companies: ['meta'], topics: ['array-foundations', 'hash-counting', 'string-processing'] });
  assert.match(document.querySelector('.peer-waiting').textContent, /Practice now with the same type and level in the next 15 minutes/);
  assert.match(document.querySelector('.peer-countdown').textContent, /^1[45]:\d\d$/);
  assert.equal(document.querySelectorAll('.peer-chips li').length, 0);
  await act(async () => root.unmount());
});

test('an instant pair counts from when it matched, not from the top of its hour', async () => {
  const HOUR = 3600000;
  const start = Date.now() - 10 * 60000;
  const pair = {
    id: 'Pair00000002',
    kind: 'behavioral',
    level: 'mid',
    // Its hour ended long before the 80 minutes from the match do.
    slot: Math.floor(Date.now() / HOUR) - 2,
    start,
    partner: 'Amy',
    meetUrl: '',
    status: 'scheduled',
    rounds: [
      { set: 'aaaa1111', as: 'candidate' },
      { set: 'bbbb2222', as: 'interviewer' },
    ],
    reported: false,
    reportedMe: false,
    canReport: true,
    canCancel: false,
  };
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/oj/peer')) return Response.json({ request: null, paused: false, pairs: [pair] });
    throw new Error(`unexpected ${url}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MockPeer, { navigate() {}, params: {} })));
  await wait();
  assert.ok(document.querySelector('[aria-labelledby="peer-upcoming"] .peer-pass'));
  assert.equal(document.querySelector('[aria-labelledby="peer-past"]'), null);
  assert.equal(document.querySelector('.peer-pass-time time').getAttribute('datetime'), new Date(start).toISOString());
  await act(async () => root.unmount());
});
