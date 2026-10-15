// cswork's service worker (registered by components/sw-register.tsx in production).
// Pages are never cached: a page can carry someone's own data (SSR or an RSC payload), and a
// shared computer must not show the last user's page offline. Navigations go to the network
// and fall back to /offline; only the hashed build files under /_next/static/ are kept, which
// are the same for everyone. Everything else (API, RSC, POST) passes straight through.
// 2: /offline is bilingual now; v1 kept it in whichever locale first fetched it.
const VERSION = 2;
const CACHE = `cswork-v${VERSION}`;
// The offline page and its stylesheets live apart, so trimming build files never drops them.
const OFFLINE_CACHE = `cswork-offline-v${VERSION}`;
const OFFLINE = '/offline';
// ponytail: a flat cap on stored build files, oldest out first; old deploys' files age away.
const MAX_FILES = 300;

/** The offline page and its stylesheets, so it still looks like the site with no network. */
async function cacheOffline() {
  const cache = await caches.open(OFFLINE_CACHE);
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function buildFile(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const cache = await caches.open(CACHE);
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FILES)).map((key) => cache.delete(key)));
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

// Reminders (lib/server/reminders.ts): a push carries no payload, it only says "look". The worker
// asks the server what to show for the signed-in learner. Every push must show something
// (userVisibleOnly), so when that fails (signed out, offline) a plain one stands in.
self.addEventListener('push', (event) => {
  const zh = /^zh\b/i.test(self.navigator?.language || '');
  const fallback = { id: 'cswork', title: 'cswork', body: zh ? '你有新的学习提醒' : 'You have a new reminder', href: '/?view=progress' };
  event.waitUntil(
    fetch('/api/oj/notify/pending', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .catch(() => ({ items: [] }))
      .then(({ items }) =>
        Promise.all(
          (items?.length ? items : [fallback]).map((n) =>
            // The notice id as tag: a second push for the same reminder replaces it quietly.
            self.registration.showNotification(n.title, { body: n.body, tag: n.id, icon: '/icons/icon-192.png', data: { href: n.href } }),
          ),
        ),
      ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || '/', self.location.origin);
  // Only this site's pages.
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(target.href));
});
