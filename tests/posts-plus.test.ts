import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// Posts plus: system design chapter discussions and saved posts.
const dir = mkdtempSync(join(tmpdir(), 'cswork-posts-plus-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
delete process.env.COURSE_ACCESS;

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { targetKind } = await import('../lib/community');

const person = (id: string, o: Partial<Person> = {}): Person => ({
  id,
  name: `Name ${id}`,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...o,
});
const [me, ana, bo] = ['pp-me', 'pp-ana', 'pp-bo'].map((id) => person(id));
const fresh = person('pp-fresh', { verified: false });

async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const r = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  try {
    const response = await handleOj(r, p, url.pathname.split('/').slice(3));
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
async function ok(p: Person | null, method: string, path: string, body?: unknown) {
  const r = await call(p, method, path, body);
  assert.ok(r.status === 200 || r.status === 201, `${method} ${path} → ${r.status}`);
  return r.data;
}
const star = (p: Person, id: string, on = true) => ok(p, 'POST', 'oj/marks', { target: `post:${id}`, mark: 'star', on });

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const id of ['oa-amazon-1', 'lc-1'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
  for (const p of [me, ana, bo, fresh])
    db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(
      p.id,
      p.name,
      p.email,
    );
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('an unknown prefix is no target; sd:<chapter> is a discussion anyone reads', async () => {
  assert.equal(targetKind('lc-1'), 'problem');
  assert.equal(targetKind('sd:framework'), 'sd');
  assert.equal(targetKind('editorial:lc-1'), null);
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'editorial:lc-1', title: 't', body: 'b' })).status, 404);
  assert.equal((await call(me, 'GET', 'oj/posts?problem=editorial:lc-1')).status, 404);
  assert.deepEqual(await ok(null, 'GET', 'oj/posts?problem=sd:framework'), { solved: true, items: [], more: false });
  assert.equal((await call(null, 'GET', 'oj/posts?problem=sd:no-such-chapter')).status, 404);
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'sd:framework', body: 'x', tag: 'amazon' })).status, 400);
  const { post } = await ok(me, 'POST', 'oj/posts', { problemId: 'sd:framework', body: '**Why** start with requirements?\nmore' });
  assert.equal(post.title, 'Why start with requirements?', 'untitled like a comment');
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=sd:framework')).items.length, 1);
  assert.equal('poll' in (await ok(null, 'GET', `oj/posts/${post.id}`)).post, false, 'polls left with the board');
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'sd:framework', body: 'b', poll: { question: 'q', options: ['a', 'b'] } })).status, 400);
});

void test('saved posts: counted on the post, listed across targets, only while still visible', async () => {
  const thread = (await ok(me, 'POST', 'oj/posts', { problemId: 'sd:building-blocks', title: 'Stacks', body: 'b' })).post;
  const solution = (await ok(me, 'POST', 'oj/posts', { problemId: 'lc-1', title: 'Hash map', body: 'b' })).post;
  // A thread left from the removed discussion board, saved before it went.
  const board = '00000000-0000-4000-8000-0000000000c0';
  sqlite()
    .prepare("INSERT INTO solution_posts(id,problem_id,user_id,title,body,created_at,updated_at) VALUES(?,'discuss:career',?,'Amazon?','b',1,1)")
    .run(board, me.id);
  sqlite().prepare("INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'star',3)").run(ana.id, `post:${board}`);
  assert.equal((await call(null, 'GET', 'oj/posts?starred=1')).status, 401);
  for (const id of [solution.id, thread.id]) await star(ana, id);
  await star(bo, thread.id);
  // An unverified account's save is kept for them but not counted.
  sqlite().prepare('UPDATE "user" SET email_verified=0 WHERE id=?').run(fresh.id);
  await star(fresh, thread.id);
  const read = await ok(ana, 'GET', `oj/posts/${thread.id}`);
  assert.deepEqual([read.post.stars, read.post.starred], [2, true]);
  assert.equal((await ok(fresh, 'GET', `oj/posts/${thread.id}`)).post.starred, true);
  assert.equal((await ok(me, 'GET', `oj/posts/${thread.id}`)).post.starred, false);
  const listed = await ok(ana, 'GET', 'oj/posts?problem=sd:building-blocks');
  assert.deepEqual([listed.items[0].stars, listed.items[0].starred], [2, true]);
  // Last saved first; the board thread reads as missing, so it is left out.
  const saved = sqlite().prepare("UPDATE user_marks SET created_at=? WHERE user_id=? AND target=? AND mark='star'");
  saved.run(1, ana.id, `post:${solution.id}`);
  saved.run(2, ana.id, `post:${thread.id}`);
  const mine = await ok(ana, 'GET', 'oj/posts?starred=1');
  assert.deepEqual(mine.items.map((p: { id: string }) => p.id), [thread.id, solution.id]);
  assert.equal(mine.next, 3);
  // An unpublished problem and an author's removal take a saved post out.
  sqlite().prepare("UPDATE oj_problems SET published=0 WHERE id='lc-1'").run();
  assert.deepEqual((await ok(ana, 'GET', 'oj/posts?starred=1')).items.map((p: { id: string }) => p.id), [thread.id]);
  await ok(me, 'POST', `oj/posts/${thread.id}/delete`, {});
  assert.deepEqual((await ok(ana, 'GET', 'oj/posts?starred=1')).items, []);
  sqlite().prepare("UPDATE oj_problems SET published=1 WHERE id='lc-1'").run();
  await star(ana, solution.id, false);
  assert.equal((await ok(ana, 'GET', `oj/posts/${solution.id}`)).post.stars, 0);
});

void test('saved posts leave out a problem in the reader’s running contest', async () => {
  const { post } = await ok(me, 'POST', 'oj/posts', { problemId: 'oa-amazon-1', title: 'Window', body: 'b' });
  await star(bo, post.id);
  assert.ok((await ok(bo, 'GET', 'oj/posts?starred=1')).items.some((p: { id: string }) => p.id === post.id));
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES('pp-room',NULL,'r','custom',?,?,60,'private',0)`,
    )
    .run(JSON.stringify(['oa-amazon-1']), Date.now() - 60000);
  sqlite()
    .prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES('pp-room',?,'bo',0,NULL)")
    .run(bo.id);
  assert.equal((await ok(bo, 'GET', 'oj/posts?starred=1')).items.some((p: { id: string }) => p.id === post.id), false);
  assert.equal((await call(bo, 'GET', `oj/posts/${post.id}`)).status, 403);
});
