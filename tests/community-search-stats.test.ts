import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-community-search-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
delete process.env.COURSE_ACCESS;
delete process.env.HIDDEN_COMPANIES;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { handleMetrics } = await import('../lib/server/metrics');
const { standings } = await import('../lib/contest');

const me: Person = { id: 'search-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'search-other', email: 'other@example.test' };
const third: Person = { ...me, id: 'search-third', email: 'third@example.test' };
const teacher: Person = { ...me, id: 'search-teacher', email: 'teacher@example.test', role: 'teacher' };

async function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  try {
    return await handleOj(request, p, url.pathname.split('/').slice(3));
  } catch (error) {
    // handleOj throws HttpError/ZodError; the API wrapper turns them into responses.
    return new Response(null, { status: (error as { status?: number }).status ?? 400 });
  }
}
const titles = async (query: string) => {
  const response = await call(me, 'GET', `posts?${query}`);
  assert.equal(response.status, 200, query);
  return ((await response.json()) as { items: { title: string }[] }).items.map((p) => p.title);
};

const HOUR = 3_600_000;
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at)
    VALUES('oa-amazon-1','gomall','00-overview','v-1',1,1,1)`,
  ).run();
  db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(
    me.id,
    'Ada',
    me.email,
  );
  const now = Date.now();
  const post = (problem: string, title: string, body: string, ageHours: number, votes: number, pinned = 0) => {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO solution_posts(id,problem_id,user_id,title,body,pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
    ).run(id, problem, me.id, title, body, pinned, now - ageHours * HOUR, now - ageHours * HOUR);
    for (let i = 0; i < votes; i++)
      db.prepare('INSERT INTO post_votes(post_id,user_id,created_at) VALUES(?,?,?)').run(id, `voter-${i}`, now);
  };
  // hot = votes / (hours + 2)^1.5: Two pointers 0.38, Sort first 0.27, Hash map 0.01.
  post('oa-amazon-1', 'Two pointers', 'sweep with 100% care', 1, 2);
  post('oa-amazon-1', 'Hash map', 'O(n) with a lookup_table', 100, 10);
  post('oa-amazon-1', 'Pinned guide', 'read me first', 500, 0, 1);
  post('oa-amazon-1', 'Sort first', 'then two pointers meet', 3, 3);
  post('sd:framework', 'Pointers in C', 'two pointers and more', 1, 1);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('posts: hot sort cools votes with age, pinned stays first', async () => {
  assert.deepEqual(await titles('problem=oa-amazon-1'), ['Pinned guide', 'Hash map', 'Sort first', 'Two pointers']);
  assert.deepEqual(await titles('problem=oa-amazon-1&sort=hot'), [
    'Pinned guide',
    'Two pointers',
    'Sort first',
    'Hash map',
  ]);
  assert.deepEqual(await titles('problem=oa-amazon-1&sort=new'), ['Pinned guide', 'Two pointers', 'Sort first', 'Hash map']);
});

void test('posts: q matches every word in the title or body, LIKE wildcards literal, one target only', async () => {
  // Both words, title or body; case-insensitive; the chapter discussion's post stays out.
  assert.deepEqual(await titles('problem=oa-amazon-1&q=two+POINTERS'), ['Sort first', 'Two pointers']);
  assert.deepEqual(await titles('problem=oa-amazon-1&q=two+pointers&sort=hot'), ['Two pointers', 'Sort first']);
  // % and _ match themselves, not anything.
  assert.deepEqual(await titles('problem=oa-amazon-1&q=%25'), ['Two pointers']);
  assert.deepEqual(await titles('problem=oa-amazon-1&q=_'), ['Hash map']);
  assert.deepEqual(await titles(`problem=oa-amazon-1&q=${encodeURIComponent('\\')}`), []);
  // Six words at most: a seventh that matches nothing is dropped.
  assert.deepEqual(await titles('problem=oa-amazon-1&q=e+e+e+e+e+e+zzz'), [
    'Pinned guide',
    'Hash map',
    'Sort first',
    'Two pointers',
  ]);
  assert.deepEqual(await titles('problem=oa-amazon-1&q=nothing-like-this'), []);
  // The removed board's all-channels list is no target.
  assert.equal((await call(me, 'GET', 'posts?problem=discuss:all&q=pointers')).status, 404);
});

void test('editorial votes: helpful / not helpful on lc- and oa- editorials only', async () => {
  const vote = (p: Person, target: string, mark: string, on = true) => call(p, 'POST', 'marks', { target, mark, on });
  assert.equal((await vote(me, 'content:editorial/lc-1', 'down')).status, 200);
  // Switching to helpful clears not helpful, as on a problem.
  assert.equal((await vote(me, 'content:editorial/lc-1', 'up')).status, 200);
  const mine = await call(me, 'GET', `marks?target=${encodeURIComponent('content:editorial/lc-1')}`);
  assert.deepEqual(((await mine.json()) as { items: { mark: string }[] }).items.map((m) => m.mark), ['up']);
  assert.equal((await vote(other, 'content:editorial/lc-1', 'down')).status, 200);
  assert.equal((await vote(other, 'content:editorial/oa-amazon-1', 'down')).status, 200);
  assert.equal((await vote(third, 'content:editorial/oa-amazon-1', 'down')).status, 200);
  for (const target of [
    'content:editorial/course-x',
    'content:editorial/LC-1',
    'content:editorial/lc-1/x',
    'content:editorial/lc_1',
    'content:other/lc-1',
  ])
    assert.equal((await vote(me, target, 'down')).status, 400, target);
  // Well-formed ids with no editorial behind them are refused; taking a vote back still works.
  for (const target of ['content:editorial/lc-999999', 'content:editorial/oa-no-such-1'])
    assert.equal((await vote(me, target, 'down')).status, 404, target);
  assert.equal((await vote(me, 'content:editorial/lc-999999', 'down', false)).status, 200);
  // Experiences still take upvotes only.
  assert.equal((await vote(me, 'content:experience/x', 'down')).status, 400);
  assert.equal((await vote(me, 'content:experience/x', 'up')).status, 200);

  // The owner analytics: most "not helpful" first, all time, verified accounts only.
  const ghost: Person = { ...me, id: 'search-ghost', email: 'ghost@example.test', verified: false };
  assert.equal((await vote(ghost, 'content:editorial/lc-2', 'down')).status, 200);
  const account = sqlite().prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,1,1)');
  for (const p of [other, third]) account.run(p.id, p.name, p.email, 1);
  account.run(ghost.id, ghost.name, ghost.email, 0);
  const response = await handleMetrics(
    new Request('https://cswork.test/api/metrics/summary?days=1'),
    teacher,
    ['summary'],
  );
  const { unhelpfulEditorials } = (await response.json()) as { unhelpfulEditorials: unknown };
  assert.deepEqual(unhelpfulEditorials, [
    { problemId: 'oa-amazon-1', down: 2, up: 0 },
    { problemId: 'lc-1', down: 1, up: 1 },
  ]);
});

void test('contest standings: solved / tried per question, live entrants only', () => {
  const at = (minutes: number) => minutes * 60_000;
  const room = { startsAt: 0, durationMin: 60, problemIds: ['p1', 'p2', 'p3'] };
  const entry = (userId: string, virtualStart: number | null = null) => ({ userId, name: userId, joinedAt: 0, virtualStart });
  const entries = [entry('a'), entry('b'), entry('c'), entry('v', at(90))];
  const subs = [
    { user_id: 'a', problem_id: 'p1', status: 'wrong_answer', created_at: at(2) },
    { user_id: 'a', problem_id: 'p1', status: 'accepted', created_at: at(5) },
    { user_id: 'a', problem_id: 'p2', status: 'compile_error', created_at: at(6) },
    { user_id: 'b', problem_id: 'p1', status: 'accepted', created_at: at(7) },
    // After the window, and cancelled: neither counts.
    { user_id: 'b', problem_id: 'p3', status: 'accepted', created_at: at(61) },
    { user_id: 'c', problem_id: 'p3', status: 'cancelled', created_at: at(8) },
    { user_id: 'c', problem_id: 'p2', status: 'judging', created_at: at(9) },
    // A virtual entrant races their own clock and stays out of the counts.
    { user_id: 'v', problem_id: 'p3', status: 'accepted', created_at: at(95) },
  ];
  assert.deepEqual(standings(room, entries, subs).questions, [
    { q: 1, solved: 2, tried: 2 },
    { q: 2, solved: 0, tried: 2 },
    { q: 3, solved: 0, tried: 0 },
  ]);
  // Mid-contest: only what came in before `now`.
  assert.deepEqual(standings(room, entries, subs, at(5)).questions, [
    { q: 1, solved: 1, tried: 1 },
    { q: 2, solved: 0, tried: 0 },
    { q: 3, solved: 0, tried: 0 },
  ]);
});
