// The installable app: the manifest names icons that exist at their sizes, and public/sw.js never
// stores a page (SSR or RSC) — navigations go to the network and fall back to /offline, only
// /_next/static/ build files are cached — and sign-out empties what it kept.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

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
  const net = { online: true, seen: [] };
  const fetch = async (r) => {
    net.seen.push(url(r));
    if (!net.online) throw new TypeError('offline');
    const path = new URL(url(r)).pathname;
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
    clients: { claim: async () => {} },
  };
  vm.runInNewContext(readFileSync(new URL('public/sw.js', root), 'utf8'), { self, caches, fetch, Response, URL, Promise });
  const lifecycle = async (type) => {
    const waits = [];
    handlers[type]({ waitUntil: (p) => waits.push(p) });
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
  const cached = () => [...(caches.stores.get('cswork-v1')?.keys() ?? [])].map((u) => new URL(u).pathname).sort();
  return { net, caches, lifecycle, request, cached };
}

test('install keeps the offline page and its stylesheet; activate drops older versions', async () => {
  const sw = worker();
  sw.caches.stores.set('cswork-v0', new Map([[`${ORIGIN}/old`, new Response('x')]]));
  await sw.lifecycle('install');
  assert.deepEqual(sw.cached(), ['/_next/static/css/app-1a2b.css', '/offline']);
  await sw.lifecycle('activate');
  assert.deepEqual([...sw.caches.stores.keys()], ['cswork-v1']);
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

test('the manifest installs standalone from / and its icons exist at their stated sizes', async () => {
  const { default: manifest } = await import('../app/manifest.ts');
  const m = manifest();
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/?source=pwa');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of [...m.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const png = readFileSync(new URL(`public${icon.src}`, root));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', icon.src);
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  }
});
