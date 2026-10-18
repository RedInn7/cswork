import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The work badge card, and no direct-message link left on profiles.
register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/', pretendToBeVisual: true });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { createRoot } = await import('react-dom/client');
const { WorkBadgeSettings } = await import('../components/work-badge.tsx');
const { FollowButton } = await import('../components/follow-button.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : el.tagName === 'SELECT' ? dom.window.HTMLSelectElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
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
  const gets = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '').replace(/[?&]tz=-?\d+/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    (body ? posts : gets).push(body ? [path, body] : path);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, gets, restore: () => (globalThis.fetch = original) };
}
test('work badge: every placement starts off and switches one at a time; codes only with mail', async () => {
  let state = {
    mail: true,
    verification: {
      company: { slug: 'google', name: 'Google' },
      domain: 'google.com',
      expiresAt: Date.UTC(2027, 0, 1),
      active: true,
      pending: false,
      show: { profile: false, posts: false },
    },
  };
  const api = serve((path, body) => {
    if (path === 'oj/work') return Response.json(state);
    if (path === 'oj/work/show')
      return Response.json((state = { ...state, verification: { ...state.verification, show: { ...state.verification.show, ...body } } }));
    if (path === 'oj/work/verify') return Response.json((state = { ...state, verification: { ...state.verification, pending: true } }));
  });
  try {
    const root = await mount(createElement(WorkBadgeSettings));
    assert.ok(document.body.textContent.includes('Verified: Google employee (google.com)'));
    const boxes = () => [...document.querySelectorAll('fieldset input[type="checkbox"]')];
    assert.deepEqual(boxes().map((b) => b.checked), [false, false]);
    await act(async () => boxes()[1].click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/work/show', { posts: true }]);
    assert.deepEqual(boxes().map((b) => b.checked), [false, true]);
    await act(async () => type(document.querySelector('input[type="email"]'), 'me@google.com'));
    await act(async () => button('Send code').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/work/verify', { email: 'me@google.com' }]);
    assert.ok(document.querySelector('input[autocomplete="one-time-code"]'));
    await act(async () => root.unmount());
    state = { mail: false, verification: null };
    const off = await mount(createElement(WorkBadgeSettings));
    assert.ok(button('Send code').disabled);
    assert.equal(document.querySelector('fieldset'), null);
    await act(async () => off.unmount());
  } finally {
    api.restore();
  }
});

test('profiles link to no direct messages', async () => {
  const api = serve((path) => {
    if (path.startsWith('oj/follows')) return Response.json({ following: true, self: false, signedIn: true, followers: 1, followees: 1 });
  });
  try {
    const root = await mount(createElement(FollowButton, { handle: 'amy-g', zh: false, followers: 1 }));
    assert.ok(button('Following'));
    assert.equal(document.querySelector('a[href*="view=messages"]'), null);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});
