import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// Posts plus: system design chapter discussions, saved posts and polls on threads.
const dir = mkdtempSync(join(tmpdir(), 'cswork-posts-plus-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.HIDDEN_COMPANIES = 'google';
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
  assert.equal((await ok(null, 'GET', `oj/posts/${post.id}`)).post.poll, null);
});

void test('saved posts: counted on the post, listed across targets, only while still visible', async () => {
  const thread = (await ok(me, 'POST', 'oj/posts', { problemId: 'discuss:algo', title: 'Stacks', body: 'b' })).post;
  const solution = (await ok(me, 'POST', 'oj/posts', { problemId: 'lc-1', title: 'Hash map', body: 'b' })).post;
  const tagged = (await ok(me, 'POST', 'oj/posts', { problemId: 'discuss:career', title: 'Amazon?', body: 'b', tag: 'amazon' })).post;
  assert.equal((await call(null, 'GET', 'oj/posts?starred=1')).status, 401);
  for (const id of [solution.id, thread.id, tagged.id]) await star(ana, id);
  await star(bo, thread.id);
  // An unverified account's save is kept for them but not counted.
  sqlite().prepare('UPDATE "user" SET email_verified=0 WHERE id=?').run(fresh.id);
  await star(fresh, thread.id);
  const read = await ok(ana, 'GET', `oj/posts/${thread.id}`);
  assert.deepEqual([read.post.stars, read.post.starred], [2, true]);
  assert.equal((await ok(fresh, 'GET', `oj/posts/${thread.id}`)).post.starred, true);
  assert.equal((await ok(me, 'GET', `oj/posts/${thread.id}`)).post.starred, false);
  const listed = await ok(ana, 'GET', 'oj/posts?problem=discuss:algo');
  assert.deepEqual([listed.items[0].stars, listed.items[0].starred], [2, true]);
  // Last saved first.
  const saved = sqlite().prepare("UPDATE user_marks SET created_at=? WHERE user_id=? AND target=? AND mark='star'");
  saved.run(1, ana.id, `post:${solution.id}`);
  saved.run(2, ana.id, `post:${thread.id}`);
  saved.run(3, ana.id, `post:${tagged.id}`);
  const mine = await ok(ana, 'GET', 'oj/posts?starred=1');
  assert.deepEqual(mine.items.map((p: { id: string }) => p.id), [tagged.id, thread.id, solution.id]);
  assert.equal(mine.next, 3);
  // An unpublished problem, a hidden company and an author's removal take a saved post out.
  sqlite().prepare("UPDATE oj_problems SET published=0 WHERE id='lc-1'").run();
  sqlite().prepare("UPDATE solution_posts SET tag='google' WHERE id=?").run(tagged.id);
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

void test('polls: threads only, one vote per verified account, counts after voting or the close', async () => {
  const poll = { question: 'Which language for OAs?', options: ['Python', 'C++', 'Java'] };
  const fields = { title: 'OA language', body: 'Curious.' };
  const thread = { problemId: 'discuss:career', ...fields };
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, poll: { ...poll, options: ['A'] } })).status, 400);
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, poll: { ...poll, options: ['A', 'A'] } })).status, 400);
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, poll: { ...poll, options: ['x'.repeat(81), 'y'] } })).status, 400);
  assert.equal(
    (await call(me, 'POST', 'oj/posts', { ...thread, poll: { ...poll, closesAt: Date.now() - 1000 } })).status,
    400,
    'closes in the past',
  );
  const before = (sqlite().prepare('SELECT COUNT(*) FROM solution_posts').pluck().get() as number);
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'sd:framework', body: 'b', poll })).status, 400);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM solution_posts').pluck().get(), before, 'a refused poll saves no post');
  const { post } = await ok(me, 'POST', 'oj/posts', { ...thread, poll });
  assert.deepEqual(post.poll, {
    question: poll.question, options: poll.options, multi: false, closesAt: null, closed: false, voters: 0, mine: [], counts: null,
  });
  const vote = (p: Person, choices: number[]) => call(p, 'POST', `oj/posts/${post.id}/poll`, { choices });
  assert.equal((await vote(fresh, [0])).status, 403, 'a verified account');
  assert.equal((await call(null, 'POST', `oj/posts/${post.id}/poll`, { choices: [0] })).status, 401);
  assert.equal((await vote(ana, [0, 1])).status, 400, 'one choice');
  assert.equal((await vote(ana, [3])).status, 400);
  const voted = await vote(ana, [1]);
  assert.equal(voted.status, 200);
  assert.deepEqual([voted.data.poll.mine, voted.data.poll.counts, voted.data.poll.voters], [[1], [0, 1, 0], 1]);
  assert.equal((await vote(ana, [0])).status, 409, 'never changed');
  const other = (await ok(bo, 'GET', `oj/posts/${post.id}`)).post.poll;
  assert.deepEqual([other.voters, other.counts], [1, null], 'no counts before your own vote');
  assert.ok(!JSON.stringify(other).includes(ana.id));
  // The author cannot change a poll once someone voted; an edit that leaves it out keeps it.
  assert.equal((await call(me, 'POST', `oj/posts/${post.id}/edit`, { ...fields, poll: { ...poll, options: ['Go', 'Rust'] } })).status, 409);
  assert.equal((await call(me, 'POST', `oj/posts/${post.id}/edit`, { ...fields, poll: null })).status, 409);
  const edited = await ok(me, 'POST', `oj/posts/${post.id}/edit`, { title: 'OA language?', body: 'Curious!' });
  assert.deepEqual([edited.post.title, edited.post.poll.options], ['OA language?', poll.options]);
  // Closed: everyone sees the counts, nobody votes.
  sqlite().prepare('UPDATE post_polls SET closes_at=? WHERE post_id=?').run(Date.now() - 1, post.id);
  const closed = (await ok(null, 'GET', `oj/posts/${post.id}`)).post.poll;
  assert.deepEqual([closed.closed, closed.counts], [true, [0, 1, 0]]);
  assert.equal((await vote(bo, [0])).status, 409);
  // A multiple-choice poll takes several options in its one vote; with no votes it can still change.
  const multi = (await ok(me, 'POST', 'oj/posts', { ...thread, poll: { ...poll, multi: true, closesAt: Date.now() + 86400000 } })).post;
  const changed = await ok(me, 'POST', `oj/posts/${multi.id}/edit`, { ...fields, poll: { ...poll, options: ['Go', 'Rust'], multi: true } });
  assert.deepEqual(changed.post.poll.options, ['Go', 'Rust']);
  const both = await ok(bo, 'POST', `oj/posts/${multi.id}/poll`, { choices: [1, 0, 1] });
  assert.deepEqual([both.poll.mine, both.poll.counts, both.poll.voters], [[0, 1], [1, 1], 1]);
});
