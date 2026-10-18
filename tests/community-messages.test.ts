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

// The work email badge.
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
const domains = (await import('../lib/content/company-domains.json')).default.domains as Record<string, string[]>;

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
const profile = (user: string, handle: string) =>
  sqlite()
    .prepare(`INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,1,0,'',1,1)`)
    .run(user, handle);
const codeIn = (text: string) => /(\d{6})/.exec(text)![1];

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  // A solution may carry the badge; one to a company's OA problem never does.
  for (const id of ['lc-1', 'oa-amazon-1'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
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
  assert.deepEqual(state.verification.show, { profile: false, posts: false }, 'every placement starts off');
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

void test('badge placements on solutions and profiles', async () => {
  const catalogue = new Map([
    ['lc-1', { difficulty: '简单' }],
    ['oa-amazon-1', { difficulty: '中等' }],
  ]);
  // Amy (verified at Google above) posts a solution.
  const solution = (await ok(amy, 'POST', 'posts', { problemId: 'lc-1', title: 'Two pointers', body: 'Sweep.' })).post;
  assert.equal(solution.employer, null, 'off by default');
  const path = `posts/${solution.id}`;
  await ok(amy, 'POST', 'work/show', { posts: true });
  assert.equal((await ok(bob, 'GET', path)).post.employer, 'Google');
  assert.equal(await status(amy, 'POST', 'work/show', { referrals: true }), 400, 'referral threads left with the board');
  // The profile placement is separate, and off.
  profile(amy.id, 'amy-g');
  assert.equal(publicProfile('amy-g', catalogue)!.employer, null);
  await ok(amy, 'POST', 'work/show', { profile: true });
  assert.equal(publicProfile('amy-g', catalogue)!.employer, 'Google');


  // Experience comments never carry the badge, though her solutions do.
  const comment = (await ok(amy, 'POST', 'posts', { problemId: 'exp:g-exp', body: 'Good luck!' })).post;
  assert.equal(comment.employer, null);
  assert.equal((await ok(bob, 'GET', path)).post.employer, 'Google');
  // Nor does a solution to a company's OA problem, where it would read as job hunting.
  const oa = (await ok(amy, 'POST', 'posts', { problemId: 'oa-amazon-1', title: 'Window', body: 'Notes' })).post;
  assert.equal(oa.employer, null);
  // Nor does her profile list that solution beside its badge; without the badge it lists both.
  const listed = () => publicProfile('amy-g', catalogue)!.posts.items.map((p: { target: string }) => p.target).sort();
  assert.deepEqual(listed(), ['lc-1']);
  await ok(amy, 'POST', 'work/show', { profile: false });
  assert.deepEqual(listed(), ['lc-1', 'oa-amazon-1']);
  await ok(amy, 'POST', 'work/show', { profile: true });
});

void test('verifying at another company switches every placement off', async () => {
  // Renewing at the same company keeps Amy's choices (profile and posts on, from above).
  await verify(amy, 'amy@google.com');
  assert.deepEqual((await ok(amy, 'GET', 'work')).verification.show, { profile: true, posts: true });
  // Consent was for Google: Amazon starts from nothing, before and after the code.
  const code = await verify(amy, 'amy@amazon.com');
  assert.deepEqual((await ok(amy, 'GET', 'work')).verification.show, { profile: false, posts: false });
  const state = await ok(amy, 'POST', 'work/confirm', { code });
  assert.equal(state.verification.company.slug, 'amazon');
  assert.deepEqual(state.verification.show, { profile: false, posts: false });
  assert.equal(publicProfile('amy-g', new Map())!.employer, null);
});
