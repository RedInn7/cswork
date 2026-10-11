import test from 'node:test';
import assert from 'node:assert/strict';
import { beacon, track } from '../lib/analytics';

/** Installs browser globals for one test and restores Node's afterwards. */
function browser(globals: Record<string, unknown>) {
  const saved = Object.keys(globals).map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  for (const [name, value] of Object.entries(globals))
    Object.defineProperty(globalThis, name, { configurable: true, value });
  return () => {
    for (const [name, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
  };
}

void test('analytics does nothing on the server', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response();
  };
  try {
    track('judge_submit', { mode: 'run' });
    beacon('page_view', { view: 'problems' });
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});

void test('track sends clean params to gtag and the dashboard; page views skip gtag', () => {
  const gtag: unknown[][] = [];
  const beacons: { url: string; body: string }[] = [];
  const store = new Map<string, string>();
  const restore = browser({
    window: { gtag: (...args: unknown[]) => gtag.push(args) },
    navigator: {
      sendBeacon: (url: string, body: string) =>
        beacons.push({ url, body }) > 0,
    },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
  try {
    track('judge_result', {
      mode: 'submit',
      language: 'cpp',
      verdict: 'x'.repeat(200),
      passed: 3,
      duration_ms: 812,
      queue_ms: null,
      server_ms: Number.NaN,
    });
    beacon('page_view', { view: 'content', type: undefined });
    track('search', { view: 'questions', q: 'lru cache' }); // free text stays first-party
    const kept = {
      mode: 'submit',
      verdict: 'x'.repeat(120),
      passed: 3,
      duration_ms: 812,
    };
    // GA4 reads `language` as the visitor's UI language, so gtag gets code_language.
    assert.deepEqual(gtag, [
      ['event', 'judge_result', { ...kept, code_language: 'cpp' }],
    ]);
    assert.deepEqual(
      beacons.map(({ url }) => url),
      ['/api/metrics', '/api/metrics', '/api/metrics'],
    );
    const [result, page, search] = beacons.map(({ body }) => JSON.parse(body));
    assert.deepEqual(search.events, [
      { name: 'search', params: { view: 'questions', q: 'lru cache' } },
    ]);
    assert.deepEqual(result.events, [
      { name: 'judge_result', params: { ...kept, language: 'cpp' } },
    ]);
    assert.deepEqual(page.events, [
      { name: 'page_view', params: { view: 'content' } },
    ]);
    assert.match(result.vid, /^[0-9a-f-]{36}$/);
    assert.equal(page.vid, result.vid);
    assert.equal(store.get('cswork:vid'), result.vid);
  } finally {
    restore();
  }
});

void test('blocked gtag, storage and beacon still reach the dashboard without throwing', async () => {
  const original = globalThis.fetch;
  const posts: RequestInit[] = [];
  globalThis.fetch = async (_url, init) => {
    posts.push(init!);
    throw new TypeError('offline');
  };
  const restore = browser({
    window: {},
    navigator: { sendBeacon: () => false },
    localStorage: {
      getItem() {
        throw new Error('blocked');
      },
    },
  });
  try {
    track('login', { method: 'email' });
    track('language_switch', { locale: 'zh' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(posts.length, 2);
    assert.equal(posts[0].keepalive, true);
    const [first, second] = posts.map(({ body }) => JSON.parse(body as string));
    assert.deepEqual(first.events, [
      { name: 'login', params: { method: 'email' } },
    ]);
    assert.equal(second.vid, first.vid, 'one in-memory id per page load');
  } finally {
    restore();
    globalThis.fetch = original;
  }
});
