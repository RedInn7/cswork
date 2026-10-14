import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-solution-posts-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'hiddenco';
delete process.env.CONTENT_DATABASE_PATH;
delete process.env.COURSE_ACCESS;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');

const me: Person = { id: 'posts-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'posts-other', email: 'other@example.test' };
const fresh: Person = { ...me, id: 'posts-new', email: 'new@example.test', verified: false };
const teacher: Person = { ...me, id: 'posts-teacher', email: 'teacher@example.test', role: 'teacher' };

function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function ok<T>(p: Person | null, method: string, path: string, body?: unknown) {
  const response = await call(p, method, path, body);
  assert.ok(response.status === 200 || response.status === 201, `${path} ${response.status}`);
  return (await response.json()) as T;
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    // handleOj throws HttpError/ZodError; the API wrapper turns them into responses.
    return (error as { status?: number }).status ?? 400;
  }
}
type Post = { id: string; title: string; author: string; mine: boolean; votes: number; voted: boolean; comments: number; hidden: number };
type Detail = { post: Post & { body: string }; comments: { id: string; body: string; author: string; mine: boolean }[] };
type List = { solved: boolean; items: Post[]; more: boolean };

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const id of ['oa-amazon-1', 'oa-hiddenco-1', 'course-x'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
  // Display names come from the account; the email must never leave the server.
  for (const p of [me, other])
    db.prepare(
      'INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)',
    ).run(p.id, p.id === me.id ? 'Ada' : 'Grace', p.email);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('posts: write, list by votes or date, edit and delete only your own', async () => {
  assert.equal(await status(null, 'GET', 'posts?problem=oa-amazon-1'), 401);
  const empty = await ok<List>(me, 'GET', 'posts?problem=oa-amazon-1');
  assert.deepEqual(empty, { solved: false, items: [], more: false });
  // Course exercises and a hidden company's problems have no solutions page.
  assert.equal(await status(me, 'GET', 'posts?problem=oa-hiddenco-1'), 404);
  assert.equal(await status(me, 'GET', 'posts?problem=course-x'), 404);
  assert.equal(await status(me, 'POST', 'posts', { problemId: 'oa-hiddenco-1', title: 't', body: 'b' }), 404);
  assert.equal(await status(fresh, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 't', body: 'b' }), 403);
  assert.equal(await status(me, 'POST', 'posts', { problemId: 'oa-amazon-1', title: ' ', body: 'b' }), 400);
  assert.equal(
    await status(me, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 't', body: 'x'.repeat(20001) }),
    400,
  );
  const first = await ok<Detail>(me, 'POST', 'posts', {
    problemId: 'oa-amazon-1',
    title: 'Two pointers',
    body: '## Idea\n<script>alert(1)</script>\n```python\nprint(1)\n```',
    language: 'python',
  });
  assert.equal(first.post.author, 'Ada');
  assert.equal(first.post.mine, true);
  assert.ok(first.post.body.includes('<script>'), 'stored as typed; the client renders without raw HTML');
  const second = await ok<Detail>(other, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 'Hash map', body: 'O(n)' });
  // One language's posts (the AC dialog's histogram links here); an unknown language is a 400.
  assert.deepEqual((await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1&language=python')).items.map((p) => p.id), [first.post.id]);
  assert.equal((await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1&language=')).items.length, 2);
  assert.equal(await status(other, 'GET', 'posts?problem=oa-amazon-1&language=ruby'), 400);
  const serialized = JSON.stringify(await ok(me, 'GET', 'posts?problem=oa-amazon-1'));
  assert.ok(!serialized.includes('@example.test'), 'no email in the list');
  assert.ok(!serialized.includes('posts-other'), 'no user ids in the list');
  // Others see a masked name (account names are often real ones), or the public handle once chosen.
  const authors = async () => (await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1&sort=new')).items.map((p) => p.author);
  assert.deepEqual(await authors(), ['Grace', 'Ad***']);
  const profile = sqlite().prepare(
    'INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,?,0,\'\',1,1)',
  );
  profile.run(me.id, 'ada-dev', 0);
  assert.deepEqual(await authors(), ['Grace', 'Ad***'], 'a hidden profile keeps its handle private');
  sqlite().prepare('UPDATE user_profiles SET visible=1 WHERE user_id=?').run(me.id);
  assert.deepEqual(await authors(), ['Grace', 'ada-dev']);
  sqlite().prepare('DELETE FROM user_profiles WHERE user_id=?').run(me.id);

  // Another learner can neither edit nor delete it (no IDOR).
  assert.equal(await status(other, 'POST', `posts/${first.post.id}/edit`, { title: 'x', body: 'y' }), 404);
  assert.equal(await status(other, 'POST', `posts/${first.post.id}/delete`, {}), 404);
  const edited = await ok<Detail>(me, 'POST', `posts/${first.post.id}/edit`, { title: 'Two pointers v2', body: 'Better' });
  assert.equal(edited.post.title, 'Two pointers v2');

  // Votes: one per learner, never on your own post; the order follows them.
  assert.equal(await status(me, 'POST', `posts/${first.post.id}/vote`, { on: true }), 400);
  await ok(other, 'POST', `posts/${first.post.id}/vote`, { on: true });
  const twice = await ok<{ votes: number; voted: boolean }>(other, 'POST', `posts/${first.post.id}/vote`, { on: true });
  assert.deepEqual(twice, { votes: 1, voted: true });
  const byVotes = await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1');
  assert.deepEqual(byVotes.items.map((p) => p.title), ['Two pointers v2', 'Hash map']);
  assert.equal(byVotes.items[0].voted, true);
  const byDate = await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1&sort=new');
  assert.deepEqual(byDate.items.map((p) => p.id), [second.post.id, first.post.id]);

  // An AC on the problem unlocks the tab without a confirm.
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES('ac1',?,'oa-amazon-1','python','','accepted',4,4,'judge',1,1)`,
    )
    .run(me.id);
  assert.equal((await ok<List>(me, 'GET', 'posts?problem=oa-amazon-1')).solved, true);
  assert.equal((await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1')).solved, false);

  // Deleting is a soft delete the author cannot undo, and it leaves every list.
  await ok(other, 'POST', `posts/${second.post.id}/delete`, {});
  assert.equal(await status(other, 'GET', `posts/${second.post.id}`), 404);
  assert.equal(await status(other, 'POST', `posts/${second.post.id}/edit`, { title: 'back', body: 'again' }), 404);
  assert.deepEqual((await ok<List>(me, 'GET', 'posts?problem=oa-amazon-1')).items.map((p) => p.id), [first.post.id]);
  const row = sqlite().prepare('SELECT hidden FROM solution_posts WHERE id=?').get(second.post.id) as { hidden: number };
  assert.equal(row.hidden, 1);
});

void test('comments, reports and teacher moderation', async () => {
  const { post } = await ok<Detail>(me, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 'Greedy', body: 'Sort first' });
  const withComment = await ok<Detail>(other, 'POST', `posts/${post.id}/comments`, { body: 'Why sort?' });
  assert.equal(withComment.comments.length, 1);
  assert.equal(withComment.comments[0].author, 'Grace');
  assert.equal(withComment.comments[0].mine, true);
  assert.equal((await ok<Detail>(me, 'GET', `posts/${post.id}`)).comments[0].author, 'Gr***');
  assert.equal(await status(other, 'POST', `posts/${post.id}/comments`, { body: 'x'.repeat(1001) }), 400);
  const commentId = withComment.comments[0].id;
  // Only the author removes a comment.
  assert.equal(await status(me, 'POST', `post-comments/${commentId}/delete`, {}), 404);

  // Reports: not your own, one per learner, a known reason.
  assert.equal(await status(me, 'POST', `posts/${post.id}/report`, { reason: 'spam' }), 400);
  assert.equal(await status(other, 'POST', `posts/${post.id}/report`, { reason: 'because' }), 400);
  await ok(other, 'POST', `posts/${post.id}/report`, { reason: 'spam' });
  await ok(other, 'POST', `posts/${post.id}/report`, { reason: 'offensive' });
  await ok(me, 'POST', `post-comments/${commentId}/report`, { reason: 'offensive' });

  // Students cannot moderate or read the queue.
  assert.equal(await status(other, 'GET', 'posts/moderation'), 403);
  assert.equal(await status(other, 'POST', `posts/${post.id}/hide`, {}), 403);
  type Queue = { reported: { kind: string; id: string; reports: number; reasons: string }[]; latest: { id: string }[] };
  const queue = await ok<Queue>(teacher, 'GET', 'posts/moderation');
  assert.deepEqual(
    queue.reported.map((r) => [r.kind, r.id, r.reports, r.reasons]).sort(),
    [
      ['comment', commentId, 1, 'offensive'],
      ['post', post.id, 1, 'spam'],
    ],
  );
  assert.ok(queue.latest.some((item) => item.id === commentId));
  assert.ok(!JSON.stringify(queue).includes('@example.test'));

  // Hiding takes it out for everyone but its author (who sees it is hidden), and clears the reports.
  assert.deepEqual(await ok(teacher, 'POST', `posts/${post.id}/hide`, {}), { id: post.id, hidden: 2 });
  assert.equal(await status(other, 'GET', `posts/${post.id}`), 404);
  assert.equal(await status(other, 'POST', `posts/${post.id}/vote`, { on: true }), 404);
  assert.equal(await status(other, 'POST', `posts/${post.id}/comments`, { body: 'hi' }), 404);
  assert.ok(!(await ok<List>(other, 'GET', 'posts?problem=oa-amazon-1')).items.some((p) => p.id === post.id));
  const own = (await ok<List>(me, 'GET', 'posts?problem=oa-amazon-1')).items.find((p) => p.id === post.id);
  assert.equal(own?.hidden, 2);
  assert.equal((await ok<Detail>(teacher, 'GET', `posts/${post.id}`)).post.hidden, 2, 'moderators can still read it');
  assert.equal((await ok<Queue>(teacher, 'GET', 'posts/moderation')).reported.length, 1);
  await ok(teacher, 'POST', `posts/${post.id}/unhide`, {});
  assert.equal((await ok<Detail>(other, 'GET', `posts/${post.id}`)).post.hidden, 0);

  await ok(teacher, 'POST', `post-comments/${commentId}/hide`, {});
  assert.equal((await ok<Detail>(other, 'GET', `posts/${post.id}`)).comments.length, 0);
  assert.equal((await ok<Queue>(teacher, 'GET', 'posts/moderation')).reported.length, 0);
  // An author's own removal stays removed: unhide only reverses a moderator's hide.
  await ok(me, 'POST', `posts/${post.id}/delete`, {});
  assert.deepEqual(await ok(teacher, 'POST', `posts/${post.id}/unhide`, {}), { id: post.id, hidden: 1 });
  assert.equal(await status(teacher, 'POST', `posts/${post.id}/bogus`, {}), 404);
});

void test('daily caps stop a scripted client', async () => {
  const spammer: Person = { ...me, id: 'posts-spam', email: 'spam@example.test' };
  for (let i = 0; i < 10; i++)
    await ok(spammer, 'POST', 'posts', { problemId: 'oa-amazon-1', title: `t${i}`, body: 'b' });
  assert.equal(await status(spammer, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 'one more', body: 'b' }), 429);
  const page = await ok<List>(me, 'GET', 'posts?problem=oa-amazon-1&sort=new');
  assert.equal(page.items.length, 11);
});
