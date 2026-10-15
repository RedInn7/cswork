// The installable app: the manifest names icons that exist at their sizes, and public/sw.js never
// stores a page (SSR or RSC) — navigations go to the network and fall back to /offline, only
// /_next/static/ build files are cached — and sign-out empties what it kept.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { register } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The offline page imports its stylesheet; tests load stylesheets as nothing.
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

const ORIGIN = 'https://cswork.test';
const root = new URL('..', import.meta.url);
const url = (r) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;

/** Cache Storage in memory, keyed by absolute URL. */
function memoryCaches(fetch) {
  const stores = new Map();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      match: async (r) => m.get(url(r))?.clone(),
      put: async (r, res) => void m.set(url(r), res),
      add: async (r) => {
        const res = await fetch(r);
        if (!res.ok) throw new TypeError('bad status');
        m.set(url(r), res);
      },
      keys: async () => [...m.keys()].map((u) => ({ url: u })),
      delete: async (r) => m.delete(url(r)),
    };
  };
  return {
    stores,
    open: async (name) => store(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (r) => {
      for (const m of stores.values()) if (m.has(url(r))) return m.get(url(r)).clone();
    },
  };
}

/** Loads public/sw.js with a fake network: `online` toggles it, `seen` lists what reached it. */
function worker() {
  // pending: what /api/oj/notify/pending answers (null: signed out).
  const net = { online: true, seen: [], pending: null, shown: [], opened: [] };
  const fetch = async (r) => {
    net.seen.push(url(r));
    if (!net.online) throw new TypeError('offline');
    const path = new URL(url(r)).pathname;
    if (path === '/api/oj/notify/pending')
      return net.pending ? Response.json({ items: net.pending }) : Response.json({ error: 'sign in' }, { status: 401 });
    if (path === '/offline')
      return new Response('<link rel="stylesheet" href="/_next/static/css/app-1a2b.css"><h1>offline</h1>', {
        headers: { 'content-type': 'text/html' },
      });
    const res = new Response(`body of ${path}`, { status: 200 });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };
  const caches = memoryCaches(fetch);
  const handlers = {};
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, openWindow: async (href) => void net.opened.push(href) },
    // JSON: plain objects of this realm, not the worker's.
    registration: { showNotification: async (title, options) => void net.shown.push(JSON.parse(JSON.stringify({ title, ...options }))) },
    navigator: { language: 'zh-CN' },
  };
  vm.runInNewContext(readFileSync(new URL('public/sw.js', root), 'utf8'), { self, caches, fetch, Response, URL, Promise });
  const lifecycle = async (type, event = {}) => {
    const waits = [];
    handlers[type]({ ...event, waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  };
  /** A fetch event: the response the worker gave (or null when it let the browser handle it). */
  const request = async (path, init = {}) => {
    let responded = null;
    const waits = [];
    handlers.fetch({
      request: { method: 'GET', mode: 'cors', ...init, url: path.startsWith('https:') ? path : `${ORIGIN}${path}` },
      respondWith: (p) => (responded = Promise.resolve(p)),
      waitUntil: (p) => waits.push(p),
    });
    const response = responded && (await responded);
    await Promise.all(waits);
    return response;
  };
  const cached = () =>
    ['cswork-v2', 'cswork-offline-v2']
      .flatMap((name) => [...(caches.stores.get(name)?.keys() ?? [])])
      .map((u) => new URL(u).pathname)
      .sort();
  return { net, caches, lifecycle, request, cached };
}

test('install keeps the offline page and its stylesheet; activate drops older versions', async () => {
  const sw = worker();
  sw.caches.stores.set('cswork-v1', new Map([[`${ORIGIN}/old`, new Response('x')]]));
  // v1 kept /offline in one locale; the new install fetches its own copy rather than reuse it.
  sw.caches.stores.set('cswork-offline-v1', new Map([[`${ORIGIN}/offline`, new Response('<h1>现在连不上网</h1>')]]));
  await sw.lifecycle('install');
  assert.deepEqual(sw.cached(), ['/_next/static/css/app-1a2b.css', '/offline']);
  await sw.request('/_next/static/chunks/main-9f8e.js');
  await sw.lifecycle('activate');
  assert.deepEqual([...sw.caches.stores.keys()].sort(), ['cswork-offline-v2', 'cswork-v2']);
  sw.net.online = false;
  assert.match(await (await sw.request('/u/someone', { mode: 'navigate' })).text(), /^<link[^>]+><h1>offline<\/h1>$/);
});

test('trimming old build files never drops the offline page or its stylesheet', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  for (let i = 0; i < 301; i++) await sw.request(`/_next/static/chunks/c${i}.js`);
  assert.equal(sw.caches.stores.get('cswork-v2').size, 300);
  sw.net.online = false;
  const css = await sw.request('/_next/static/css/app-1a2b.css');
  assert.equal(await css.text(), 'body of /_next/static/css/app-1a2b.css');
  assert.match(await (await sw.request('/u/someone', { mode: 'navigate' })).text(), /app-1a2b\.css/);
});

test('pages are never stored: online they come from the network, offline the fallback page', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  const page = await sw.request('/?view=progress', { mode: 'navigate' });
  assert.equal(await page.text(), 'body of /');
  assert.deepEqual(sw.cached(), ['/_next/static/css/app-1a2b.css', '/offline']);
  sw.net.online = false;
  const fallback = await sw.request('/u/someone', { mode: 'navigate' });
  assert.match(await fallback.text(), /offline/);
  // RSC payloads, API reads and writes are left to the browser untouched.
  sw.net.online = true;
  assert.equal(await sw.request('/?view=problems&_rsc=1x2y', { headers: { RSC: '1' } }), null);
  assert.equal(await sw.request('/api/oj/points'), null);
  assert.equal(await sw.request('/api/auth/sign-out', { method: 'POST', mode: 'navigate' }), null);
  assert.equal(await sw.request('https://other.example/_next/static/x.js'), null);
  assert.deepEqual(sw.cached(), ['/_next/static/css/app-1a2b.css', '/offline']);
});

test('build files are cache-first and survive going offline', async () => {
  const sw = worker();
  const first = await sw.request('/_next/static/chunks/main-9f8e.js');
  assert.equal(await first.text(), 'body of /_next/static/chunks/main-9f8e.js');
  sw.net.online = false;
  const again = await sw.request('/_next/static/chunks/main-9f8e.js');
  assert.equal(await again.text(), 'body of /_next/static/chunks/main-9f8e.js');
});

test('sign-out empties every cache, and the next page load puts the offline page back', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  await sw.request('/_next/static/chunks/main-9f8e.js');
  globalThis.caches = sw.caches;
  try {
    const { clearOfflineCaches } = await import('../components/sw-register.tsx');
    await clearOfflineCaches();
    assert.equal(sw.caches.stores.size, 0);
    await sw.request('/', { mode: 'navigate' });
    assert.deepEqual(sw.cached(), ['/_next/static/css/app-1a2b.css', '/offline']);
    // Without Cache Storage at all it does nothing, quietly.
    delete globalThis.caches;
    await clearOfflineCaches();
  } finally {
    delete globalThis.caches;
  }
});

test('a push shows the pending reminders, or a plain one when it cannot read them; a click opens only this site', async () => {
  const sw = worker();
  sw.net.pending = [{ id: 'rem:2026-10-15:u1', title: 'Today’s practice reminder', body: '1 problem is due for review', href: '/?view=progress' }];
  await sw.lifecycle('push');
  assert.deepEqual(sw.net.shown, [
    {
      title: 'Today’s practice reminder',
      body: '1 problem is due for review',
      tag: 'rem:2026-10-15:u1',
      icon: '/icons/icon-192.png',
      data: { href: '/?view=progress' },
    },
  ]);
  // Signed out (or offline), it still shows one: Chrome requires it for every push.
  sw.net.pending = null;
  await sw.lifecycle('push');
  sw.net.online = false;
  await sw.lifecycle('push');
  assert.deepEqual(
    sw.net.shown.slice(1).map((n) => [n.title, n.body, n.data.href]),
    [
      ['cswork', '你有新的学习提醒', '/?view=progress'],
      ['cswork', '你有新的学习提醒', '/?view=progress'],
    ],
  );
  const click = (href) => sw.lifecycle('notificationclick', { notification: { close() {}, data: { href } } });
  await click('/contest/weekly-3');
  await click('https://evil.example/phish');
  assert.deepEqual(sw.net.opened, [`${ORIGIN}/contest/weekly-3`]);
});

test('before sign-out, this browser’s push subscription is dropped on the server and in the browser', async () => {
  const { clearPush } = await import('../components/sw-register.tsx');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const realFetch = globalThis.fetch;
  const posted = [];
  let unsubscribed = 0;
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', unsubscribe: async () => void unsubscribed++ };
  const use = (serviceWorker) => Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker }, configurable: true });
  globalThis.fetch = async (path, init) => {
    posted.push([path, JSON.parse(init.body)]);
    return new Response('{}');
  };
  try {
    use({ getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }) });
    await clearPush();
    assert.deepEqual(posted, [['/api/oj/notify/subscription', { endpoint: subscription.endpoint, on: false }]]);
    assert.equal(unsubscribed, 1);
    // No registration, or no service worker support at all: nothing to do, quietly.
    use({ getRegistration: async () => undefined });
    await clearPush();
    use(undefined);
    await clearPush();
    assert.equal(posted.length, 1);
  } finally {
    globalThis.fetch = realFetch;
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  }
});

test('the manifest installs standalone from / and its icons exist at their stated sizes', async () => {
  const { default: manifest } = await import('../app/manifest.ts');
  const m = manifest();
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/?source=pwa');
  // Fetched without cookies, so it speaks the default locale (English) and says so.
  assert.equal(m.lang, 'en');
  assert.ok(!/[\u4e00-\u9fff]/.test(`${m.name} ${m.short_name} ${m.description}`));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of [...m.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const png = readFileSync(new URL(`public${icon.src}`, root));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', icon.src);
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  }
});

test('the offline page reads in both languages, so the one cached copy serves every reader', async () => {
  const { default: OfflinePage } = await import('../app/offline/page.tsx');
  const doc = renderToStaticMarkup(createElement(OfflinePage));
  assert.match(doc, /<h1><span lang="en">You’re offline<\/span>.*<span lang="zh-CN">现在连不上网<\/span><\/h1>/);
  assert.match(doc, /<p lang="en">.+<\/p><p lang="zh-CN">.+<\/p>/);
  assert.match(doc, /<a href="\/">.*Back to cswork.*回到 cswork.*<\/a>/);
});
