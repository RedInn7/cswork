import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// next/link renders a plain anchor (vinext provides it in the app).
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link({prefetch,...p}){return globalThis.__link(p)}',shortCircuit:true};return n(s,c);}" +
      `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
globalThis.__link = (props) => createElement('a', props);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
dom.window.localStorage.setItem('cswork:locale', 'en'); // UI copy below is the English site
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
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
  'history',
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
const { GiftBlock, RedeemGift } = await import('../components/course-gift.tsx');
const { NewsletterToggle } = await import('../components/newsletter-toggle.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
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
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, restore: () => (globalThis.fetch = original) };
}

test('gift order: the buyer copies the code or link and can swap it', async () => {
  const order = {
    id: 'order-1',
    course_id: 'gomall',
    course_title: 'Go Mall',
    status: 'paid',
    gift: { code: 'ABCD-EFGH-JKMN-PQRS', issuedAt: 1, redeemedAt: null, revokedAt: null },
  };
  const copied = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (s) => copied.push(s) },
  });
  const changes = [];
  const api = serve((path) => {
    if (path === 'gifts/order-1/reissue')
      return Response.json({ ...order, gift: { ...order.gift, code: 'WXYZ-WXYZ-WXYZ-WXYZ' } });
  });
  try {
    const root = await mount(createElement(GiftBlock, { order, onChange: (next) => changes.push(next) }));
    assert.ok(document.querySelector('.commerce-gift-code code').textContent === 'ABCD-EFGH-JKMN-PQRS');
    await act(async () => button('Copy link').click());
    await wait();
    assert.deepEqual(copied, ['https://cswork.test/?view=gift#code=ABCD-EFGH-JKMN-PQRS']);
    await act(async () => button('Void and get a new code').click());
    await wait();
    assert.ok(changes.at(-1).gift.code === 'WXYZ-WXYZ-WXYZ-WXYZ');
    await act(async () => root.render(createElement(GiftBlock, { order: { ...order, gift: { ...order.gift, code: null, redeemedAt: Date.UTC(2026, 9, 1) } }, onChange: () => {} })));
    assert.ok(document.querySelector('.commerce-gift').textContent.includes('Redeemed on'));
    assert.ok(document.querySelector('.commerce-gift-code') === null);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('redeem form: the code from the link fragment, sent once', async () => {
  history.replaceState(null, '', '/?view=gift#code=ABCD-EFGH-JKMN-PQRS');
  const done = [];
  const api = serve((path, body) => {
    if (path === 'gifts/redeem' && body.code === 'ABCD-EFGH-JKMN-PQRS') return Response.json({ courseId: 'gomall', title: 'Go Mall' });
  });
  try {
    const root = await mount(createElement(RedeemGift, { onDone: (title) => done.push(title) }));
    const input = document.querySelector('.commerce-redeem input');
    assert.ok(input.value === 'ABCD-EFGH-JKMN-PQRS');
    await act(async () => button('Redeem').click());
    await wait();
    assert.deepEqual(api.posts, [['gifts/redeem', { code: 'ABCD-EFGH-JKMN-PQRS' }]]);
    assert.deepEqual(done, ['Go Mall']);
    assert.ok(document.querySelector('.commerce-redeem input').value === '');
    await act(async () => root.unmount());
  } finally {
    api.restore();
    history.replaceState(null, '', '/');
  }
});

test('newsletter toggle: signed out, then subscribe while mail is off', async () => {
  let signedIn = false;
  let lost = false;
  const api = serve((path, body) => {
    if (path === 'oj/newsletter' && !body)
      return lost
        ? Response.json({ subscribed: true, confirmed: false, mail: true, resend: true })
        : signedIn
          ? Response.json({ subscribed: false, confirmed: false, mail: false })
          : Response.json({ error: 'Please sign in first' }, { status: 401 });
    if (path === 'oj/newsletter') return Response.json({ subscribed: body.subscribe, confirmed: false, mail: lost, resend: false });
  });
  try {
    let root = await mount(createElement(NewsletterToggle));
    assert.ok(document.querySelector('.newsletter-toggle a').getAttribute('href') === '/?view=account#newsletter');
    await act(async () => root.unmount());
    signedIn = true;
    root = await mount(createElement(NewsletterToggle));
    await act(async () => button('Subscribe').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/newsletter', { subscribe: true, locale: 'en' }]);
    assert.ok(document.querySelector('.newsletter-toggle [role="status"]').textContent.includes('Once email delivery is switched on'));
    await act(async () => button('Unsubscribe').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/newsletter', { subscribe: false, locale: 'en' }]);
    await act(async () => root.unmount());
    // A confirmation sent over a day ago and never clicked: one button sends it again.
    lost = true;
    root = await mount(createElement(NewsletterToggle));
    await act(async () => button('Send it again').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/newsletter', { subscribe: true, locale: 'en' }]);
    assert.ok(![...document.querySelectorAll('button')].some((b) => b.textContent.includes('Send it again')));
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});
