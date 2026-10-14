import test, { after, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-user-drafts-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { DRAFT_ROWS } = await import('../lib/server/learner-cloud');
const { CLOUD_DRAFT_DELAY_MS, cloudDraftUrl, flushCloudDrafts, writeEditorDraft } = await import(
  '../lib/editor-settings'
);

const me: Person = { id: 'draft-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'draft-other', email: 'other@example.test' };
const path = 'cloud/drafts/lc-1?language=python&mode=acm';

async function call(p: Person | null, method: string, target: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${target}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  try {
    const response = await handleOj(request, p, url.pathname.split('/').slice(3));
    return { status: response.status, body: (await response.json()) as { draft?: { code: string; updatedAt: number } | null } };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: {} };
  }
}
const draftOf = async (p: Person, target = path) => (await call(p, 'GET', target)).body.draft;

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a draft is the signed-in owner’s alone, per problem, language and mode', async () => {
  assert.equal((await call(null, 'GET', path)).status, 401);
  assert.equal(await draftOf(me), null);
  assert.equal((await call(me, 'PUT', path, { code: 'print(1)', updatedAt: 1000 })).status, 200);
  assert.deepEqual(await draftOf(me), { code: 'print(1)', updatedAt: 1000 });
  // Nobody else reads it, and the other mode / language are separate drafts.
  assert.equal(await draftOf(other), null);
  assert.equal(await draftOf(me, 'cloud/drafts/lc-1?language=python&mode=leetcode'), null);
  assert.equal(await draftOf(me, 'cloud/drafts/lc-1?language=go&mode=acm'), null);
});

void test('an older upload never overwrites a newer device’s edit; future clocks are capped', async () => {
  await call(me, 'PUT', path, { code: 'newer', updatedAt: 5000 });
  await call(me, 'PUT', path, { code: 'stale tab', updatedAt: 4000 });
  assert.equal((await draftOf(me))?.code, 'newer');
  const future = Date.now() + 86400000;
  await call(me, 'PUT', path, { code: 'ahead', updatedAt: future });
  const saved = await draftOf(me);
  assert.equal(saved?.code, 'ahead');
  assert.ok(saved!.updatedAt <= Date.now());
});

void test('bad keys and oversized or odd code are refused', async () => {
  for (const target of [
    'cloud/drafts/lc-1?language=ruby&mode=acm',
    'cloud/drafts/lc-1?language=python',
  ])
    assert.equal((await call(me, 'GET', target)).status, 400);
  assert.equal((await call(me, 'GET', 'cloud/drafts/a%2Fb?language=python&mode=acm')).status, 404);
  assert.equal((await call(me, 'PUT', path, { code: 'x'.repeat(65537), updatedAt: 1 })).status, 413);
  assert.equal((await call(me, 'PUT', path, { code: 'a\0b', updatedAt: Date.now() })).status, 400);
  assert.equal((await call(me, 'PUT', path, { code: 'x', updatedAt: 1, userId: 'draft-other' })).status, 400);
});

void test(`past ${DRAFT_ROWS} drafts the least recently edited go`, async () => {
  const insert = sqlite().prepare(
    "INSERT INTO user_drafts(user_id,problem_id,language,coding_mode,code,updated_at) VALUES(?,?,'cpp','acm','x',?)",
  );
  sqlite().transaction(() => {
    for (let i = 0; i < DRAFT_ROWS; i++) insert.run(other.id, `lc-${i + 10}`, 100 + i);
  })();
  await call(other, 'PUT', path, { code: 'fresh', updatedAt: Date.now() });
  const count = (sqlite().prepare('SELECT COUNT(*) AS n FROM user_drafts WHERE user_id=?').get(other.id) as { n: number }).n;
  assert.equal(count, DRAFT_ROWS);
  assert.equal(await draftOf(other, 'cloud/drafts/lc-10?language=cpp&mode=acm'), null);
  assert.equal((await draftOf(other))?.code, 'fresh');
  // Another learner's drafts are untouched by this one's cap.
  assert.ok(await draftOf(me));
});

void test('signed-in drafts upload once typing pauses, and flush when the tab goes away', () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
  });
  const sent: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response('{}');
  }) as typeof fetch;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const target = { problemId: 'lc-1', language: 'python' as const, codingMode: 'acm' as const };
    writeEditorDraft('k', 'a', target);
    writeEditorDraft('k', 'ab', target);
    writeEditorDraft('guest', 'local only');
    mock.timers.tick(CLOUD_DRAFT_DELAY_MS - 1);
    assert.equal(sent.length, 0);
    mock.timers.tick(1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, cloudDraftUrl(target));
    assert.equal(sent[0].init.method, 'PUT');
    assert.equal(JSON.parse(sent[0].init.body as string).code, 'ab');
    assert.equal(JSON.parse(store.get('k')!).code, 'ab');
    writeEditorDraft('k', 'abc', target);
    flushCloudDrafts();
    assert.equal(sent.length, 2);
    assert.equal(sent[1].init.keepalive, true);
    mock.timers.tick(CLOUD_DRAFT_DELAY_MS);
    assert.equal(sent.length, 2);
  } finally {
    mock.timers.reset();
    globalThis.fetch = realFetch;
  }
});
