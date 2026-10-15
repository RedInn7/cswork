import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-discuss-v2-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
delete process.env.COURSE_ACCESS;
delete process.env.HIDDEN_COMPANIES;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { notificationPage } = await import('../lib/server/lms-support');
const { publicProfile } = await import('../lib/server/learner-cloud');

const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const ada = person('dv-ada');
const bob = person('dv-bob');
const cy = person('dv-cy');
const dee = person('dv-dee');
const teacher: Person = { ...person('dv-teacher'), role: 'teacher' };

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
    return (error as { status?: number }).status ?? 400;
  }
}
type Comment = {
  id: string;
  parentId: string | null;
  body: string;
  author: string;
  votes: number;
  voted: boolean;
  op: boolean;
  anonymous: boolean;
  reputation: number | null;
};
type Post = { id: string; author: string; anonymous: boolean; pinned: boolean; reputation: number | null; mine: boolean };
type Detail = { post: Post; comments: Comment[]; moderator: boolean };
type List = { items: Post[] };
const notices = (userId: string, kind = '') =>
  sqlite()
    .prepare(`SELECT kind,title,body,href,read_at AS readAt FROM notifications WHERE user_id=? AND (?='' OR kind=?) ORDER BY created_at,id`)
    .all(userId, kind, kind) as { kind: string; title: string; body: string; href: string; readAt: number | null }[];
const thread = (p: Person, extra: Record<string, unknown> = {}) =>
  ok<Detail>(p, 'POST', 'posts', { problemId: 'discuss:interview', title: 'Loop prep', body: 'How did it go?', ...extra });

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('oa-amazon-1','gomall','00-overview','v-1',1,1,1)`,
  ).run();
  // Accounts a week old and more, so upvotes pay; handles for everyone but dee (and cy's is hidden).
  for (const p of [ada, bob, cy, dee, teacher])
    db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(
      p.id,
      `Name ${p.id}`,
      p.email,
    );
  const profile = db.prepare(
    `INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,?,0,'',1,1)`,
  );
  profile.run(ada.id, 'ada', 1);
  profile.run(bob.id, 'bob-b', 1);
  profile.run(cy.id, 'cy-hidden', 0);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('replies nest one level, order by votes, and comment votes pay nothing', async () => {
  const { post } = await thread(ada);
  const top = (await ok<Detail>(bob, 'POST', `posts/${post.id}/comments`, { body: 'First' })).comments[0];
  const second = (await ok<Detail>(cy, 'POST', `posts/${post.id}/comments`, { body: 'Second' })).comments[1];
  await ok(dee, 'POST', `posts/${post.id}/comments`, { body: 'Older reply', parentId: top.id });
  const detail = await ok<Detail>(cy, 'POST', `posts/${post.id}/comments`, { body: 'Newer reply', parentId: top.id });
  const reply = detail.comments.find((c) => c.body === 'Newer reply')!;
  assert.equal(reply.parentId, top.id);
  // No reply to a reply, nor to another post's comment or a made-up one.
  assert.equal(await status(dee, 'POST', `posts/${post.id}/comments`, { body: 'Deeper', parentId: reply.id }), 400);
  const other = (await thread(bob)).post;
  assert.equal(await status(dee, 'POST', `posts/${other.id}/comments`, { body: 'Elsewhere', parentId: top.id }), 404);
  assert.equal(
    await status(dee, 'POST', `posts/${post.id}/comments`, { body: 'x', parentId: '00000000-0000-0000-0000-000000000000' }),
    404,
  );

  // Votes: not your own, toggled, no points; they reorder top-level comments and replies alike.
  assert.equal(await status(cy, 'POST', `post-comments/${reply.id}/vote`, { on: true }), 400);
  assert.deepEqual(await ok(ada, 'POST', `post-comments/${reply.id}/vote`, { on: true }), { votes: 1, voted: true });
  await ok(ada, 'POST', `post-comments/${second.id}/vote`, { on: true });
  await ok(bob, 'POST', `post-comments/${second.id}/vote`, { on: true });
  await ok(bob, 'POST', `post-comments/${second.id}/vote`, { on: false });
  await ok(dee, 'POST', `post-comments/${second.id}/vote`, { on: true });
  const read = await ok<Detail>(dee, 'GET', `posts/${post.id}`);
  assert.deepEqual(
    read.comments.map((c) => [c.body, c.parentId === top.id, c.votes]),
    [
      ['Second', false, 2],
      ['First', false, 0],
      ['Newer reply', true, 1],
      ['Older reply', true, 0],
    ],
  );
  assert.equal(read.comments[0].voted, true);
  const paid = sqlite().prepare("SELECT COUNT(*) FROM point_ledger WHERE user_id=?").pluck().get(cy.id) as number;
  assert.equal(paid, 0, 'comment votes pay no points');

  // A removed comment's replies stay, standing on their own.
  await ok(bob, 'POST', `post-comments/${top.id}/delete`, {});
  const after = await ok<Detail>(dee, 'GET', `posts/${post.id}`);
  assert.deepEqual(after.comments.map((c) => [c.body, c.parentId]), [
    ['Second', null],
    ['Newer reply', null],
    ['Older reply', null],
  ]);
});

void test('replies and @mentions notify; only visible handles, never yourself', async () => {
  sqlite().prepare('DELETE FROM notifications').run();
  const { post } = await thread(ada, { body: 'Ask @bob-b and @cy-hidden and @ada and @nobody-here' });
  // A hidden profile's handle is no handle; nor is your own.
  assert.deepEqual(notices(bob.id).map((n) => [n.kind, n.title]), [['mention', '有人在讨论中提到了你']]);
  assert.deepEqual(notices(cy.id), []);
  assert.deepEqual(notices(ada.id), []);
  assert.equal(notices(bob.id)[0].href, `/?view=discuss&channel=interview&post=${post.id}`);
  assert.equal(notices(bob.id)[0].body, '@ada: Loop prep');

  const comment = (await ok<Detail>(dee, 'POST', `posts/${post.id}/comments`, { body: 'Good luck' })).comments[0];
  assert.deepEqual(notices(ada.id).map((n) => [n.kind, n.title]), [['reply', '有人回复了你的帖子']]);
  // dee has no public handle: a masked name, never the account name.
  assert.equal(notices(ada.id)[0].body, 'Na***: Good luck');
  // A reply notifies the comment's author and the post's, once each, plus whoever it names.
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'Thanks @ada @bob-b', parentId: comment.id });
  assert.deepEqual(notices(dee.id).map((n) => n.title), ['有人回复了你的评论']);
  assert.deepEqual(notices(ada.id).map((n) => n.title), ['有人回复了你的帖子', '有人回复了你的帖子']);
  assert.equal(notices(bob.id).length, 1, 'no notice for mentioning yourself');
  // At most five handles a text.
  const many = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
  for (const h of many) {
    sqlite().prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(h, h, `${h}@x.test`);
    sqlite()
      .prepare(`INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,1,0,'',1,1)`)
      .run(h, `user-${h}`);
  }
  await ok(dee, 'POST', `posts/${post.id}/comments`, { body: many.map((h) => `@user-${h}`).join(' ') });
  assert.equal(many.filter((h) => notices(h).length).length, 5);
  // Someone blocking you hears nothing of your mentions.
  sqlite().prepare('INSERT INTO dm_blocks(user_id,blocked_id,created_at) VALUES(?,?,1)').run('a1', bob.id);
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'cc @user-a1' });
  assert.equal(notices('a1').length, 1);

  // ?kind= picks one tab.
  const url = (kind: string) => new URL(`https://cswork.test/api/lms/notifications?kind=${kind}`);
  sqlite().prepare("INSERT INTO notifications(id,user_id,kind,title,body,href,created_at) VALUES('dm1',?,'dm','x','y','/',1)").run(ada.id);
  const replies = notices(ada.id, 'reply').length;
  assert.ok(replies >= 2);
  assert.equal((await notificationPage(ada, url('reply'))).items.length, replies);
  assert.equal((await notificationPage(ada, url('mention'))).items.length, 0);
  assert.equal((await notificationPage(bob, url('mention'))).items.length, 1);
  assert.equal((await notificationPage(ada, url('bogus'))).items.length, replies + 1, 'an unknown kind lists everything');
});

void test('upvotes merge into one notice per post and day', async () => {
  const { post } = await thread(ada);
  sqlite().prepare('DELETE FROM notifications').run();
  await ok(bob, 'POST', `posts/${post.id}/vote`, { on: true });
  assert.deepEqual(notices(ada.id, 'like').map((n) => [n.title, n.body]), [['1 人赞了你的帖子', 'Loop prep']]);
  sqlite().prepare('UPDATE notifications SET read_at=1').run();
  await ok(cy, 'POST', `posts/${post.id}/vote`, { on: true });
  const likes = notices(ada.id, 'like');
  assert.deepEqual(likes.map((n) => [n.title, n.readAt]), [['2 人赞了你的帖子', null]]);
  // Upvoting yourself is refused; a hidden post notifies no one.
  assert.equal(await status(ada, 'POST', `posts/${post.id}/vote`, { on: true }), 400);
  await ok(teacher, 'POST', `posts/${post.id}/hide`, {});
  assert.equal(await status(dee, 'POST', `posts/${post.id}/vote`, { on: true }), 404);
  assert.equal(notices(ada.id, 'like')[0].title, '2 人赞了你的帖子');
});

void test('an anonymous post names no one, its author excepted, on the board, the profile or in notices', async () => {
  // Never on a judge problem's solution or a channel that carries the employee badge.
  assert.equal(
    await status(bob, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 't', body: 'b', anonymous: true }),
    400,
  );
  assert.equal(
    await status(bob, 'POST', 'posts', { problemId: 'discuss:referral', title: 't', body: 'b', anonymous: true }),
    400,
  );
  sqlite().prepare('DELETE FROM notifications').run();
  const { post } = await thread(bob, { problemId: 'discuss:offer', title: 'Offer numbers', body: 'Comp details, cc @ada', anonymous: true });
  assert.equal(post.mine, true);
  assert.equal(post.anonymous, true);
  // A mention from an anonymous author carries no name.
  assert.deepEqual(notices(ada.id).map((n) => n.body), ['Offer numbers']);

  await ok(ada, 'POST', `posts/${post.id}/vote`, { on: true });
  const top = (await ok<Detail>(ada, 'POST', `posts/${post.id}/comments`, { body: 'Congrats' })).comments[0];
  // The author answering under it stays anonymous, marked as the poster, in replies' notices too.
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'Thank you', parentId: top.id });
  assert.equal(notices(ada.id).at(-1)!.body, 'Thank you');
  for (const reader of [ada, null]) {
    const listed = await ok<List>(reader, 'GET', 'posts?problem=discuss:offer&sort=new');
    const detail = await ok<Detail>(reader, 'GET', `posts/${post.id}`);
    const json = JSON.stringify([listed, detail]);
    for (const leak of ['bob-b', bob.id, 'Name dv-bob', 'Na***']) assert.ok(!json.includes(leak), leak);
    assert.deepEqual([detail.post.author, detail.post.anonymous, detail.post.reputation], ['', true, null]);
    const own = detail.comments.find((c) => c.body === 'Thank you')!;
    assert.deepEqual([own.author, own.op, own.anonymous], ['', true, true]);
  }
  // Its author still sees their name on it.
  assert.equal((await ok<Detail>(bob, 'GET', `posts/${post.id}`)).post.author, 'Name dv-bob');

  // Off the author's public profile, and out of its reputation: no upvote ties it to them.
  const before = publicProfile('bob-b', new Map())!;
  assert.ok(!before.posts.items.some((p) => p.id === post.id));
  assert.ok(before.posts.total, 'named posts still list');
  assert.equal(before.reputation, 0);
  const named = (await thread(bob, { title: 'Named one' })).post;
  await ok(ada, 'POST', `posts/${named.id}/vote`, { on: true });
  const after = publicProfile('bob-b', new Map())!;
  assert.equal(after.reputation, 2);
  const anonPaid = sqlite()
    .prepare("SELECT SUM(delta) FROM point_ledger WHERE user_id=? AND reason='upvote' AND ref_id LIKE ?")
    .pluck()
    .get(bob.id, `${post.id}:%`) as number;
  assert.equal(anonPaid, 2, 'the anonymous post still pays its author');
  // Reputation shows beside the handle on named posts.
  assert.equal((await ok<Detail>(ada, 'GET', `posts/${named.id}`)).post.reputation, after.reputation);
});

void test('moderators feature posts first in either order', async () => {
  const a = (await ok<Detail>(dee, 'POST', 'posts', { problemId: 'discuss:career', title: 'Older', body: 'x' })).post;
  const b = (await ok<Detail>(dee, 'POST', 'posts', { problemId: 'discuss:career', title: 'Newer', body: 'y' })).post;
  await ok(ada, 'POST', `posts/${b.id}/vote`, { on: true });
  assert.equal(await status(ada, 'POST', `posts/${a.id}/pin`, {}), 403);
  assert.equal((await ok<Detail>(ada, 'GET', `posts/${a.id}`)).moderator, false);
  assert.equal((await ok<Detail>(teacher, 'GET', `posts/${a.id}`)).moderator, true);
  assert.deepEqual(await ok(teacher, 'POST', `posts/${a.id}/pin`, {}), { id: a.id, pinned: true });
  for (const sort of ['votes', 'new']) {
    const items = (await ok<List>(ada, 'GET', `posts?problem=discuss:career&sort=${sort}`)).items;
    assert.deepEqual(
      items.map((p) => [p.id, p.pinned]),
      [
        [a.id, true],
        [b.id, false],
      ],
    );
  }
  await ok(teacher, 'POST', `posts/${a.id}/unpin`, {});
  assert.equal((await ok<List>(ada, 'GET', 'posts?problem=discuss:career&sort=new')).items[0].id, b.id);
});
