import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// Study group chat, the work email badge, the referral board and direct messages.
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-community-messages-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.CONTENT_DATABASE_PATH = resolve(dir, 'content.sqlite');
// One experience to comment on (its comments must never carry the badge).
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL,
  company_slug TEXT, company_name TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT, listed INTEGER NOT NULL DEFAULT 1)`);
content.prepare(`INSERT INTO items(id,type,slug,title,company_slug,company_name) VALUES('e1','experience','g-exp','G','google','Google')`).run();
content.close();
process.env.HIDDEN_COMPANIES = 'meta';
process.env.WORK_EMAIL_SECRET = 'test-secret';
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { publicProfile } = await import('../lib/server/learner-cloud');
const { employerOf, FREE_MAIL } = await import('../lib/server/work-verify');
const { chatText } = await import('../lib/server/study-groups');
const domains = (await import('../lib/content/company-domains.json')).default.domains as Record<string, string[]>;

const DAY = 86400000;
const mail: { to: string[]; subject: string; text: string }[] = [];
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  mail.push(JSON.parse(raw));
  res.setHeader('Content-Type', 'application/json');
  res.end('{"id":"fixture"}');
});
const person = (id: string, o: Partial<Person> = {}): Person => ({
  id,
  name: `Real ${id}`,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...o,
});
const owner = person('m-owner');
const amy = person('m-amy');
const bob = person('m-bob');
const cat = person('m-cat');
const stranger = person('m-stranger');
const teacher = person('m-teacher', { role: 'teacher' });

async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  try {
    const response = await handleOj(request, p, url.pathname.split('/').slice(3));
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
const status = async (p: Person | null, method: string, path: string, body?: unknown) =>
  (await call(p, method, path, body)).status;
const scalar = (sql: string, ...args: unknown[]) => sqlite().prepare(sql).pluck().get(...args);
const profile = (user: string, handle: string) =>
  sqlite()
    .prepare(`INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,1,0,'',1,1)`)
    .run(user, handle);
const follow = (a: string, b: string) =>
  sqlite().prepare('INSERT INTO user_follows(follower_id,followee_id,created_at) VALUES(?,?,1)').run(a, b);
const codeIn = (text: string) => /(\d{6})/.exec(text)![1];

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const p of [owner, amy, bob, cat, stranger, teacher])
    db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(
      p.id,
      p.name,
      p.email,
    );
  return new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
});
after(() => {
  server.close();
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('group chat: members only, retention, unsay, reports take a message down', async () => {
  // Past retention: the first rate-limited request of the process sweeps it.
  sqlite()
    .prepare(`INSERT INTO study_group_messages(id,group_id,user_id,body,hidden,created_at) VALUES('old','x','y','old',0,?)`)
    .run(Date.now() - 181 * DAY);
  const group = await ok(owner, 'POST', 'groups', { name: 'Chatty', displayName: 'Cap' });
  assert.equal(scalar('SELECT COUNT(*) FROM study_group_messages'), 0, 'old chat swept');
  for (const [p, name] of [[amy, 'Amy'], [bob, 'Bob'], [cat, 'Cat']] as const)
    await ok(p, 'POST', 'groups/join', { code: group.inviteCode, displayName: name });
  const path = `groups/${group.id}/messages`;
  assert.equal(await status(stranger, 'GET', path), 404);
  assert.equal(await status(stranger, 'POST', path, { body: 'hi' }), 404);
  assert.equal(await status(person('m-amy', { verified: false }), 'POST', path, { body: 'hi' }), 403);
  assert.equal(await status(amy, 'POST', path, { body: 'x'.repeat(2001) }), 400);
  assert.equal(await status(amy, 'POST', path, { body: 'a‮b' }), 400);
  // Joined emoji and tab-indented code are ordinary chat; joiners alone are not.
  for (const body of ['👩‍💻 🤷‍♂️ ❤️‍🔥', 'for x in y:\n\tprint(x)', 'می‌خواهم']) assert.ok(chatText.safeParse(body).success, body);
  assert.equal(chatText.safeParse('\u200d\u200c').success, false);
  const first = await ok(amy, 'POST', path, { body: 'Line one\nline two' });
  assert.deepEqual(
    first.items.map((m: { name: string; body: string; mine: boolean }) => [m.name, m.body, m.mine]),
    [['Amy', 'Line one\nline two', true]],
  );
  await new Promise((r) => setTimeout(r, 5));
  const second = (await ok(bob, 'POST', path, { body: 'Hello Amy' })).items.at(-1);
  // Members read the chat by display name only; `after` returns only what is new.
  const read = await ok(owner, 'GET', path);
  assert.equal(read.items.length, 2);
  assert.ok(!JSON.stringify(read).includes('m-amy') && !JSON.stringify(read).includes('Real'));
  assert.deepEqual((await ok(owner, 'GET', `${path}?after=${second.createdAt}`)).items.map((m: { id: string }) => m.id), [second.id]);
  // A teacher reads it only while a message in it is reported, and never writes.
  assert.equal(await status(teacher, 'GET', path), 403);
  assert.equal(await status(teacher, 'POST', path, { body: 'hi' }), 404);
  // Only the author takes a message back.
  assert.equal(await status(amy, 'POST', `groups/${group.id}/unsay`, { message: second.id }), 404);
  const firstId = first.items[0].id;
  await ok(amy, 'POST', `groups/${group.id}/unsay`, { message: firstId });
  assert.deepEqual((await ok(owner, 'GET', path)).items.map((m: { id: string }) => m.id), [second.id]);
  // Three members' reports take it down; the author cannot report their own.
  assert.equal(await status(bob, 'POST', `groups/${group.id}/report`, { message: second.id, reason: 'spam' }), 400);
  for (const p of [owner, amy]) await ok(p, 'POST', `groups/${group.id}/report`, { message: second.id, reason: 'offensive' });
  assert.equal((await ok(bob, 'GET', path)).items.length, 1);
  assert.equal((await ok(teacher, 'GET', path)).items.length, 1);
  await ok(cat, 'POST', `groups/${group.id}/report`, { message: second.id, reason: 'offensive' });
  assert.equal((await ok(bob, 'GET', path)).items.length, 0);
  // The moderation queue lists it under its group; a teacher's restore clears the reports.
  const queue = await ok(teacher, 'GET', 'posts/moderation');
  const item = queue.reported.find((i: { kind: string }) => i.kind === 'gmsg');
  assert.equal(item.title, 'Chatty');
  assert.equal(item.excerpt, 'Hello Amy');
  await ok(teacher, 'POST', `group-messages/${second.id}/dismiss`, {});
  assert.equal((await ok(bob, 'GET', path)).items.length, 1);
  assert.equal(await status(teacher, 'GET', path), 403, 'handled: closed to teachers again');
  assert.equal(await status(amy, 'POST', `group-messages/${second.id}/hide`, {}), 403);
  // Disbanding deletes the chat.
  await ok(owner, 'POST', `groups/${group.id}/delete`, {});
  assert.equal(scalar('SELECT COUNT(*) FROM study_group_messages WHERE group_id=?', group.id), 0);
});

void test('company domains: no free mail, only employers with a page', () => {
  for (const [slug, list] of Object.entries(domains))
    for (const d of list) assert.ok(!FREE_MAIL.has(d), `${slug}: ${d} is free mail`);
  assert.equal(employerOf('ada@gmail.com'), null);
  assert.equal(employerOf('ada@qq.com'), null);
  assert.equal(employerOf('ada@corp.example'), null);
  assert.equal(employerOf('ada@google.com')?.slug, 'google');
  // Exact domains only: big companies relay or hand out mail on their subdomains.
  assert.equal(employerOf('ada@eng.google.com'), null);
  assert.equal(employerOf('bot@x1.na1.apex.salesforce.com'), null);
  assert.equal(employerOf('ada@bloomberg.net'), null, 'every Terminal user has one');
  assert.equal(employerOf('ada@notgoogle.com'), null);
  assert.equal(employerOf('ada@meta.com'), null, 'a hidden company verifies nobody');
});

async function verify(p: Person, email: string) {
  mail.length = 0;
  await ok(p, 'POST', 'work/verify', { email });
  return codeIn(mail[0].text);
}

void test('work email: codes by mail, an HMAC only, one address per account, rate limits', async () => {
  assert.equal(await status(amy, 'POST', 'work/verify', { email: 'amy@google.com' }), 503, 'no mail configured');
  const address = server.address() as { port: number };
  process.env.MAIL_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.RESEND_API_KEY = 're_test';
  process.env.MAIL_FROM = 'CSWork <hi@cswork.test>';
  assert.equal(await status(person('m-amy', { verified: false }), 'POST', 'work/verify', { email: 'amy@google.com' }), 403);
  assert.equal(await status(amy, 'POST', 'work/verify', { email: 'amy@gmail.com' }), 400);
  assert.equal(await status(amy, 'POST', 'work/verify', { email: 'amy@unknown-corp.com' }), 400);
  const code = await verify(amy, 'Amy@Google.com');
  assert.deepEqual(mail[0].to, ['amy@google.com']);
  assert.match(mail[0].subject, /work email/);
  const row = sqlite().prepare('SELECT * FROM work_verifications WHERE user_id=?').get(amy.id) as Record<string, unknown>;
  assert.ok(!JSON.stringify(row).includes('amy@'), 'the address is never stored');
  assert.notEqual(row.email_hash, createHash('sha256').update('amy@google.com').digest('base64url'));
  assert.equal(row.verified_at, null);
  assert.equal((await ok(amy, 'GET', 'work')).verification.pending, true);
  // Wrong codes count; a right one verifies.
  assert.equal(await status(amy, 'POST', 'work/confirm', { code: code === '000000' ? '111111' : '000000' }), 400);
  const state = await ok(amy, 'POST', 'work/confirm', { code });
  assert.equal(state.verification.active, true);
  assert.equal(state.verification.company.slug, 'google');
  assert.deepEqual(state.verification.show, { profile: false, posts: false, referrals: false }, 'every placement starts off');
  assert.equal(await status(amy, 'POST', 'work/confirm', { code }), 400, 'a code works once');
  // The same address cannot verify a second account; the attempt leaves no badge behind.
  const again = await verify(bob, 'amy+bob@google.com');
  assert.equal(await status(bob, 'POST', 'work/confirm', { code: again }), 409);
  assert.equal((await ok(bob, 'GET', 'work')).verification.active, false);
  // Five wrong tries and the code is dead.
  const bobs = await verify(bob, 'bob@google.com');
  for (let i = 0; i < 5; i++) await call(bob, 'POST', 'work/confirm', { code: bobs === '999999' ? '999998' : '999999' });
  assert.equal(await status(bob, 'POST', 'work/confirm', { code: bobs }), 400);
  // Three codes a day per learner (bob has had two), and per address.
  await verify(bob, 'bob@google.com');
  assert.equal(await status(bob, 'POST', 'work/verify', { email: 'bob2@google.com' }), 429);
  for (const p of [cat, owner]) await verify(p, 'shared@google.com');
  await call(stranger, 'POST', 'work/verify', { email: 'shared@google.com' });
  assert.equal(await status(teacher, 'POST', 'work/verify', { email: 'shared@google.com' }), 429);
  // Removing the badge deletes the row.
  assert.equal((await ok(owner, 'POST', 'work/remove', {})).verification, null);
});

void test('badge placements, the referral board and direct messages', async () => {
  // Amy (verified at Google above) posts a referral thread and an experience comment.
  const thread = (await ok(amy, 'POST', 'posts', {
    problemId: 'discuss:referral',
    title: 'Google referrals',
    body: 'Happy to refer for SWE roles.',
    tag: 'google',
  })).post;
  assert.equal(thread.employer, null, 'off by default');
  assert.equal(thread.referral, false, 'off by default');
  const path = `posts/${thread.id}`;
  await ok(amy, 'POST', 'work/show', { posts: true });
  assert.equal((await ok(null, 'GET', path)).post.employer, 'Google');
  assert.equal((await ok(null, 'GET', path)).post.referral, false);
  await ok(amy, 'POST', 'work/show', { referrals: true });
  assert.equal((await ok(null, 'GET', path)).post.referral, true);
  // The profile placement is separate, and off.
  profile(amy.id, 'amy-g');
  assert.equal(publicProfile('amy-g', new Map())!.employer, null);
  await ok(amy, 'POST', 'work/show', { profile: true });
  assert.equal(publicProfile('amy-g', new Map())!.employer, 'Google');

  // Request a referral from the post: the reply goes to Amy, her bell rings once, without the text.
  assert.equal(await status(bob, 'POST', 'dm', { post: thread.id, body: 'Hi', to: 'amy-g' }), 400, 'one way in');
  assert.equal(await status(person('m-bob', { verified: false }), 'POST', 'dm', { post: thread.id, body: 'Hi' }), 403);
  const opened = await ok(bob, 'POST', 'dm', { post: thread.id, body: 'Could you refer me? Secret details' });
  assert.equal(opened.name, '@amy-g');
  assert.equal(opened.post.title, 'Google referrals');
  await ok(bob, 'POST', `dm/${opened.key}`, { body: 'Second line' });
  const notes = sqlite().prepare('SELECT title,body,href FROM notifications WHERE user_id=?').all(amy.id) as {
    title: string;
    body: string;
    href: string;
  }[];
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, '你收到一条内推请求');
  assert.ok(!notes[0].body.includes('Secret') && !notes[0].body.includes('Real'), notes[0].body);
  assert.equal(notes[0].href, `/?view=messages&thread=${opened.key}`);
  // Amy's inbox: masked name (Bob has no public profile), unread until she opens it.
  const box = await ok(amy, 'GET', 'dm');
  assert.equal(box.items[0].unread, 2);
  assert.equal(box.items[0].name, 'Re***');
  assert.ok(!JSON.stringify(box).includes('m-bob'), 'no account ids');
  const convo = await ok(amy, 'GET', `dm/${opened.key}`);
  assert.deepEqual(convo.items.map((m: { body: string; mine: boolean }) => [m.body, m.mine]), [
    ['Could you refer me? Secret details', false],
    ['Second line', false],
  ]);
  assert.equal((await ok(amy, 'GET', 'dm')).items[0].unread, 0);
  assert.equal(await status(stranger, 'GET', `dm/${opened.key}`), 404);
  await ok(amy, 'POST', `dm/${opened.key}`, { body: 'Sure, send your resume.' });

  // Turning requests off stops new ones (from cat) but not the open conversation.
  await ok(amy, 'POST', 'dm/settings', { open: 'follows' });
  assert.equal(await status(cat, 'POST', 'dm', { post: thread.id, body: 'Me too?' }), 403);
  await ok(bob, 'POST', `dm/${opened.key}`, { body: 'Thanks!' });
  await ok(amy, 'POST', 'dm/settings', { open: 'all' });
  // A per-recipient daily cap on new conversations.
  for (let i = 0; i < 9; i++) {
    const asker = person(`m-asker-${i}`);
    await ok(asker, 'POST', 'dm', { post: thread.id, body: `Request ${i}` });
  }
  assert.equal(await status(cat, 'POST', 'dm', { post: thread.id, body: 'Me too?' }), 429);
  sqlite().prepare("UPDATE direct_messages SET created_at=created_at-? WHERE post_id IS NOT NULL").run(DAY);

  // Blocking: neither side can write; the reporter's report reaches the moderators.
  const reply = (await ok(amy, 'GET', `dm/${opened.key}`)).items.find((m: { mine: boolean }) => !m.mine);
  await ok(amy, 'POST', `dm/${opened.key}/report`, { message: reply.id, reason: 'spam' });
  assert.equal(await status(amy, 'POST', `dm/${opened.key}/report`, { message: (await ok(amy, 'GET', `dm/${opened.key}`)).items.find((m: { mine: boolean }) => m.mine).id, reason: 'spam' }), 400);
  const blocked = await ok(amy, 'POST', `dm/${opened.key}/block`, { on: true });
  assert.equal(blocked.canSend, false);
  assert.equal(await status(bob, 'POST', `dm/${opened.key}`, { body: 'Hello?' }), 403);
  assert.equal(await status(amy, 'POST', `dm/${opened.key}`, { body: 'Hello?' }), 403);
  const queue = await ok(teacher, 'GET', 'posts/moderation');
  const reported = queue.reported.find((i: { kind: string }) => i.kind === 'dm');
  assert.equal(reported.id, reply.id);
  await ok(teacher, 'POST', `direct-messages/${reply.id}/hide`, {});
  assert.ok(!(await ok(bob, 'GET', `dm/${opened.key}`)).items.some((m: { id: string }) => m.id === reply.id));
  await ok(amy, 'POST', `dm/${opened.key}/block`, { on: false });
  await ok(bob, 'POST', `dm/${opened.key}`, { body: 'Back again' });

  // Without the referral switch (or the badge), a referral thread takes no requests.
  await ok(amy, 'POST', 'work/show', { referrals: false });
  assert.equal(await status(cat, 'POST', 'dm', { post: thread.id, body: 'Hi' }), 404);

  // Mutual follows may start a conversation; a one-way follow may not; nobody messages themselves.
  profile(cat.id, 'cat-c');
  profile(bob.id, 'bob-b');
  follow(cat.id, bob.id);
  assert.equal(await status(cat, 'POST', 'dm', { to: 'bob-b', body: 'Hi Bob' }), 403);
  follow(bob.id, cat.id);
  const pals = await ok(cat, 'POST', 'dm', { to: 'bob-b', body: 'Hi Bob' });
  assert.equal(pals.name, '@bob-b');
  assert.equal((await ok(person('m-x'), 'GET', `follows?handle=bob-b`)).mutual, false);
  assert.equal((await ok(cat, 'GET', `follows?handle=bob-b`)).mutual, true);
  await ok(bob, 'POST', 'dm/settings', { open: 'none' });
  sqlite().prepare('DELETE FROM direct_messages WHERE thread=?').run([bob.id, cat.id].sort().join('|'));
  assert.equal(await status(cat, 'POST', 'dm', { to: 'bob-b', body: 'Hi again' }), 403);
  assert.equal(await status(cat, 'POST', 'dm', { to: 'cat-c', body: 'Me' }), 400);

  // Experience comments never carry the badge, though her other posts do.
  const comment = (await ok(amy, 'POST', 'posts', { problemId: 'exp:g-exp', body: 'Good luck!' })).post;
  assert.equal(comment.employer, null);
  assert.equal((await ok(null, 'GET', path)).post.employer, 'Google');
  // Nor do threads where it would read as job hunting; the algorithm channel carries it.
  for (const [channel, shown] of [['interview', null], ['offer', null], ['career', null], ['algo', 'Google']] as const) {
    const post = (await ok(amy, 'POST', 'posts', { problemId: `discuss:${channel}`, title: 'Notes', body: 'Notes' })).post;
    assert.equal(post.employer, shown, channel);
  }
});
