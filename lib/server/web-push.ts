import { createPrivateKey, sign } from 'node:crypto';
import { sqlite } from '@/db/sqlite';
import { setting } from './env';

/**
 * Web Push without a library: pushes carry no payload (so no RFC 8291 encryption), only wake the
 * service worker, which fetches what to show from /api/oj/notify/pending (public/sw.js). VAPID
 * (RFC 8292) signs each push with ES256. Off until VAPID_PUBLIC_KEY (the uncompressed P-256 point),
 * VAPID_PRIVATE_KEY (its 32-byte scalar), both base64url, and VAPID_SUBJECT (mailto: or https:) are set.
 */
export const pushReady = () =>
  !!(setting('VAPID_PUBLIC_KEY') && setting('VAPID_PRIVATE_KEY') && setting('VAPID_SUBJECT'));

// The push services browsers subscribe with. A browser submits the endpoint and the worker posts
// to it, so anything else could point the worker at an internal address.
const PUSH_HOST = /^(?:fcm\.googleapis\.com|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com))$/;
/** The endpoint, normalized, when it is https on an allowlisted push service; otherwise null. */
export function pushEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && PUSH_HOST.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const b64 = (data: string | Uint8Array) => Buffer.from(data).toString('base64url');
/** A VAPID JWT for one push service origin, valid 12 hours. */
export function vapidJwt(audience: string, now = Date.now()) {
  const pub = Buffer.from(setting('VAPID_PUBLIC_KEY'), 'base64url');
  const key = createPrivateKey({
    format: 'jwk',
    key: { kty: 'EC', crv: 'P-256', d: setting('VAPID_PRIVATE_KEY'), x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)) },
  });
  const body = `${b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${b64(
    JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: setting('VAPID_SUBJECT') }),
  )}`;
  return `${body}.${b64(sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }))}`;
}

/** Wakes every device the learner turned push on for; gone subscriptions (404/410) are dropped. Returns pushes accepted. */
export async function pushTo(userId: string, now = Date.now()) {
  if (!pushReady()) return 0;
  const db = sqlite();
  const subs = db.prepare('SELECT id,endpoint FROM push_subscriptions WHERE user_id=?').all(userId) as {
    id: string;
    endpoint: string;
  }[];
  let sent = 0;
  for (const s of subs) {
    const endpoint = pushEndpoint(s.endpoint);
    try {
      if (!endpoint) throw new Error('endpoint not allowed');
      const response = await fetch(endpoint, {
        method: 'POST',
        // A redirect could lead anywhere: never followed.
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: {
          TTL: '43200',
          Urgency: 'normal',
          Authorization: `vapid t=${vapidJwt(new URL(endpoint).origin, now)}, k=${setting('VAPID_PUBLIC_KEY')}`,
        },
      });
      if (response.status === 404 || response.status === 410) db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(s.id);
      else if (response.ok) sent++;
      else console.error('push', response.status);
    } catch (error) {
      if (!endpoint) db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(s.id);
      console.error('push', error instanceof Error ? error.message : 'unknown');
    }
  }
  return sent;
}
