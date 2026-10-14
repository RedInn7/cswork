// cswork's service worker (registered by components/sw-register.tsx in production).
// Pages are never cached: a page can carry someone's own data (SSR or an RSC payload), and a
// shared computer must not show the last user's page offline. Navigations go to the network
// and fall back to /offline; only the hashed build files under /_next/static/ are kept, which
// are the same for everyone. Everything else (API, RSC, POST) passes straight through.
const VERSION = 1;
const CACHE = `cswork-v${VERSION}`;
const OFFLINE = '/offline';
// ponytail: a flat cap on stored build files, oldest out first; old deploys' files age away.
const MAX_FILES = 300;

/** The offline page and its stylesheets, so it still looks like the site with no network. */
async function cacheOffline() {
  const cache = await caches.open(CACHE);
  if (await cache.match(OFFLINE)) return;
  const response = await fetch(OFFLINE, { cache: 'no-store' });
  if (!response.ok) return;
  const html = await response.clone().text();
  const styles = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  await Promise.all(styles.map((href) => cache.add(href).catch(() => {})));
  await cache.put(OFFLINE, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function buildFile(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    const files = keys.filter((key) => new URL(key.url).pathname !== OFFLINE);
    await Promise.all(files.slice(0, Math.max(0, files.length - MAX_FILES)).map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(buildFile(request));
    return;
  }
  if (request.mode !== 'navigate') return;
  // Signing out empties the caches; the next page load puts the offline page back.
  event.waitUntil(cacheOffline().catch(() => {}));
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE).then((page) => page || Response.error())));
});
