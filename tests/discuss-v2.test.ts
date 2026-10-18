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
// rowid: notices written in the same millisecond keep their insert order (ids are random).
const notices = (userId: string, kind = '') =>
  sqlite()
    .prepare(`SELECT kind,title,body,href,read_at AS readAt FROM notifications WHERE user_id=? AND (?='' OR kind=?) ORDER BY created_at,rowid`)
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
  // No reply to another post's comment or a made-up one.
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

  // A reply to a reply goes under the same top-level comment: one level, never deeper.
  const deeper = (await ok<Detail>(ada, 'POST', `posts/${post.id}/comments`, { body: 'Deeper', parentId: reply.id })).comments;
  assert.equal(deeper.find((c) => c.body === 'Deeper')!.parentId, top.id);

  // A removed comment's replies stay, standing on their own, and can still be answered.
  await ok(bob, 'POST', `post-comments/${top.id}/delete`, {});
  await ok(dee, 'POST', `posts/${post.id}/comments`, { body: 'To an orphan', parentId: reply.id });
  const after = await ok<Detail>(dee, 'GET', `posts/${post.id}`);
  assert.deepEqual(
    after.comments.map((c) => c.body).sort((a, b) => a.localeCompare(b)),
    ['Deeper', 'Newer reply', 'Older reply', 'Second', 'To an orphan'],
  );
  assert.ok(after.comments.every((c) => c.parentId === null));
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
  // A reply to that reply notifies whom it answers (bob), not the top comment's author again.
  const bobReply = (await ok<Detail>(ada, 'GET', `posts/${post.id}`)).comments.find((c) => c.body.startsWith('Thanks'))!;
  await ok(cy, 'POST', `posts/${post.id}/comments`, { body: 'Agreed', parentId: bobReply.id });
  assert.deepEqual(notices(bob.id, 'reply').map((n) => [n.title, n.body]), [['有人回复了你的评论', 'Na***: Agreed']]);
  assert.equal(notices(dee.id).length, 1);
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
  // Un-voting and voting again raises nothing: only a new high for the day does.
  sqlite().prepare('UPDATE notifications SET read_at=1').run();
  for (const [who, on] of [[cy, false], [bob, false], [cy, true], [bob, true]] as const)
    await ok(who, 'POST', `posts/${post.id}/vote`, { on });
  assert.deepEqual(notices(ada.id, 'like').map((n) => [n.title, n.readAt]), [['2 人赞了你的帖子', 1]]);
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
  // An anonymous author mentions no one, blocked or not, so a missing notice names no one.
  assert.deepEqual(notices(ada.id, 'mention'), []);

  await ok(ada, 'POST', `posts/${post.id}/vote`, { on: true });
  const top = (await ok<Detail>(ada, 'POST', `posts/${post.id}/comments`, { body: 'Congrats' })).comments[0];
  // The author answering under it stays anonymous, marked as the poster, in replies' notices too.
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'Thank you', parentId: top.id });
  assert.deepEqual(notices(ada.id, 'reply').map((n) => n.body), ['Thank you']);
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
  sqlite().prepare('UPDATE solution_posts SET created_at=created_at-1000 WHERE id=?').run(a.id);
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

void test("a judge problem's notices carry no excerpt into the recipient's running exam", async () => {
  const { post } = await ok<Detail>(ada, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 'Greedy', body: 'Sort it' });
  sqlite().prepare('DELETE FROM notifications').run();
  const now = Date.now();
  sqlite()
    .prepare(
      "INSERT INTO skill_attempts(id,user_id,test,ids_json,language,started_at,deadline,created_at) VALUES('dv-exam',?,'python','[\"oa-amazon-1\"]',NULL,?,?,0)",
    )
    .run(ada.id, now - 1000, now + 3600000);
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'Sort by end time, then two pointers' });
  assert.deepEqual(notices(ada.id).map((n) => [n.title, n.body]), [['有人回复了你的帖子', '']]);
  sqlite().prepare("UPDATE skill_attempts SET finished_at=? WHERE id='dv-exam'").run(Date.now());
  await ok(bob, 'POST', `posts/${post.id}/comments`, { body: 'Or a heap' });
  assert.equal(notices(ada.id).at(-1)!.body, '@bob-b: Or a heap');
});

void test("an anonymous interview report's author writes anonymously, as its OP, in its discussion", async () => {
  sqlite()
    .prepare(
      `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,status,anonymous,created_at)
      VALUES('dvAnonReport',?,'amazon','Amazon loop','SWE','2026-09','Four rounds','approved',1,1)`,
    )
    .run(bob.id);
  const problemId = 'exp:member.dvAnonReport';
  sqlite().prepare('DELETE FROM notifications').run();
  const asked = (await ok<Detail>(ada, 'POST', 'posts', { problemId, title: '', body: 'Which team?' })).post;
  // Answering a reader's thread under it: no name or reputation, marked OP, and its notice names no
  // one and mentions no one, as an anonymous post's author's would.
  await ok(bob, 'POST', `posts/${asked.id}/comments`, { body: 'Ads infra, cc @ada' });
  assert.deepEqual(notices(ada.id, 'reply').map((n) => n.body), ['Ads infra, cc @ada']);
  assert.deepEqual(notices(ada.id, 'mention'), []);
  // Its own post there goes up anonymous though the box was left unticked, so it stays off the
  // profile and its upvotes out of the reputation.
  const own = (await ok<Detail>(bob, 'POST', 'posts', { problemId, title: '', body: 'More details on round 2' })).post;
  assert.equal(own.anonymous, true);
  const reputation = publicProfile('bob-b', new Map())!.reputation;
  await ok(ada, 'POST', `posts/${own.id}/vote`, { on: true });
  const profile = publicProfile('bob-b', new Map())!;
  assert.equal(profile.reputation, reputation);
  assert.ok(!profile.posts.items.some((p) => p.id === own.id));
  for (const reader of [ada, null]) {
    const listed = await ok<List>(reader, 'GET', `posts?problem=${problemId}&sort=new`);
    const detail = await ok<Detail>(reader, 'GET', `posts/${asked.id}`);
    const json = JSON.stringify([listed, detail]);
    for (const leak of ['bob-b', bob.id, 'Name dv-bob', 'Na***']) assert.ok(!json.includes(leak), leak);
    assert.deepEqual([listed.items.find((p) => p.id === own.id)!.author, listed.items.length], ['', 2]);
    const answer = detail.comments.find((c) => c.body === 'Ads infra, cc @ada')!;
    assert.deepEqual([answer.author, answer.op, answer.anonymous, answer.reputation], ['', true, true, null]);
  }
});
