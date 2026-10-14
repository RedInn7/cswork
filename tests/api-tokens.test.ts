import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-api-tokens-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { tokenCaller, tokenScope, hashToken, TOKEN_PREFIX } = await import('../lib/server/api-tokens');

const me: Person = { id: 'pat-me', name: 'Me', email: 'me@example.test', role: 'teacher', verified: true };
const other: Person = { ...me, id: 'pat-other', email: 'other@example.test', role: 'student' };

function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function status(promise: Promise<unknown>) {
  try {
    const value = await promise;
    return value instanceof Response ? value.status : 200;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const bearer = (path: string, token: string, method = 'GET') =>
  tokenCaller(
    new Request(`https://cswork.test/api/${path}`, { method, headers: { Authorization: `Bearer ${token}` } }),
    path.split('?')[0].split('/'),
  );
async function create(p: Person, name: string) {
  const response = await call(p, 'POST', 'tokens', { name });
  assert.equal(response.status, 201);
  return (await response.json()) as { token: string; item: { id: string; name: string } };
}

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const add = sqlite().prepare(
    'INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,0,0)',
  );
  add.run(me.id, me.name, 'Me@Example.test', 1);
  add.run(other.id, other.name, other.email, 0);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('tokens are random, shown once and stored only as their SHA-256', async () => {
  const a = await create(me, 'Claude Code');
  const b = await create(me, 'Cursor');
  assert.match(a.token, /^cswork_pat_[A-Za-z0-9_-]{43}$/);
  assert.ok(a.token.startsWith(TOKEN_PREFIX));
  assert.notEqual(a.token, b.token);
  assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const stored = sqlite().prepare('SELECT token_hash FROM api_tokens WHERE id=?').get(a.item.id) as {
    token_hash: string;
  };
  assert.equal(stored.token_hash, hashToken(a.token));
  assert.ok(!JSON.stringify(sqlite().prepare('SELECT * FROM api_tokens').all()).includes(a.token));
  const list = (await (await call(me, 'GET', 'tokens')).json()) as { items: Record<string, unknown>[] };
  assert.deepEqual(list.items.map((t) => t.name).sort(), ['Claude Code', 'Cursor']);
  // The list never carries the token or its hash.
  assert.ok(list.items.every((t) => !('token' in t) && !('token_hash' in t) && !('tokenHash' in t)));
  assert.equal(await status(call(me, 'POST', 'tokens', { name: '  ' })), 400);
  assert.equal(await status(call(me, 'POST', 'tokens', { name: 'x'.repeat(61) })), 400);
  assert.equal(await status(call(me, 'POST', 'tokens', { name: 'a\u0000b' })), 400);
  assert.equal(await status(call(me, 'POST', 'tokens', { name: 'ok', extra: 1 })), 400);
});

void test('a token acts as its learner (never a teacher) only on the scoped endpoints', async () => {
  const { token, item } = await create(me, 'scoped');
  const p = await bearer('oj/problems/lc-1', token);
  assert.ok(p);
  assert.equal(p.id, me.id);
  assert.equal(p.email, 'me@example.test');
  assert.equal(p.role, 'student');
  assert.equal(p.verified, true);
  for (const [method, path] of [
    ['GET', 'oj/daily'],
    ['GET', 'oj/library'],
    ['GET', 'oj/oa-library'],
    ['GET', 'oj/problems/oa-acme-1'],
    ['POST', 'oj/submissions'],
    ['GET', 'oj/submissions/3b0c1d2e-0000-4000-8000-000000000000'],
  ])
    assert.ok(tokenScope(method, path), `${method} ${path}`);
  for (const [method, path] of [
    ['GET', 'oj/tokens'],
    ['POST', 'oj/tokens'],
    ['POST', 'oj/tokens/x/revoke'],
    ['GET', 'oj/notes'],
    ['GET', 'oj/history'],
    ['GET', 'oj/submissions'],
    ['POST', 'oj/submissions/x/cancel'],
    ['GET', 'oj/admin/problems'],
    ['GET', 'oj/library/lc-1'],
    ['GET', 'oj/oa-library/oa-acme-1/solution'],
    ['POST', 'oj/precompile'],
    ['PUT', 'oj/notes'],
    ['GET', 'bootstrap'],
    ['POST', 'metrics'],
    ['GET', 'oj/problems/../tokens'],
  ]) {
    assert.equal(tokenScope(method, path), null, `${method} ${path}`);
    assert.equal(await status(bearer(path, token, method)), 403, `${method} ${path}`);
  }
  // No header: the browser session applies.
  assert.equal(
    await tokenCaller(new Request('https://cswork.test/api/oj/notes'), ['oj', 'notes']),
    null,
  );
  // Malformed, unknown and revoked tokens are all 401.
  assert.equal(await status(bearer('oj/daily', 'cswork_pat_short')), 401);
  assert.equal(await status(bearer('oj/daily', TOKEN_PREFIX + 'A'.repeat(43))), 401);
  const used = sqlite().prepare('SELECT last_used_at FROM api_tokens WHERE id=?').get(item.id) as {
    last_used_at: number | null;
  };
  assert.ok(used.last_used_at);
  // Another learner cannot revoke it (no IDOR); the owner can, and it stops working at once.
  assert.equal(await status(call(other, 'POST', `tokens/${item.id}/revoke`)), 404);
  assert.ok(await bearer('oj/daily', token));
  assert.equal((await call(me, 'POST', `tokens/${item.id}/revoke`)).status, 200);
  assert.equal(await status(bearer('oj/daily', token)), 401);
  assert.equal(await status(call(me, 'POST', `tokens/${item.id}/revoke`)), 404);
  const list = (await (await call(me, 'GET', 'tokens')).json()) as { items: { id: string }[] };
  assert.ok(!list.items.some((t) => t.id === item.id));
});

void test('tokens are rate limited per token and capped per learner', async () => {
  const { token } = await create(other, 'busy');
  // One fixed minute, so the window cannot roll over mid-loop.
  const realNow = Date.now;
  const minute = Math.floor(realNow() / 60000) * 60000 + 1000;
  Date.now = () => minute;
  try {
    for (let i = 0; i < 60; i++) await bearer('oj/daily', token);
    assert.equal(await status(bearer('oj/daily', token)), 429);
  } finally {
    Date.now = realNow;
  }
  for (let i = 1; i < 10; i++) await create(other, `t${i}`);
  assert.equal(await status(call(other, 'POST', 'tokens', { name: 'eleventh' })), 409);
  assert.equal(await status(call(other, 'GET', 'tokens/x')), 404);
});

void test("today's problem is public", async () => {
  const response = await handleOj(new Request('https://cswork.test/api/oj/daily'), null, ['daily']);
  assert.equal(response.status, 200);
  assert.ok('daily' in ((await response.json()) as object));
});
