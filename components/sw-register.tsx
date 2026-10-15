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

/**
 * Before sign-out: this browser's push subscription goes, on the server and in the browser, so the
 * next account signed in here never gets the last one's reminders (components/reminder-settings.tsx).
 */
export async function clearPush() {
  try {
    const subscription = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch('/api/oj/notify/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, on: false }),
    }).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // No service worker or Push API here: nothing was subscribed.
  }
}
