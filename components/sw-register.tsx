'use client';
import { useEffect } from 'react';

/** Registers public/sw.js; the root layout renders this in production only. */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}

/** On sign-out: empty the service worker's caches, so nothing of the session stays on a shared device. */
export async function clearOfflineCaches() {
  try {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  } catch {
    // No Cache Storage here (insecure origin, old browser): nothing was cached either.
  }
}
