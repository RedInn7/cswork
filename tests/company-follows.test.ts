// Following companies (lib/server/follows.ts, company-follows.ts): the follows/companies API, the
// notice when a member report on a followed company is first approved, and the daily digest of
// new OA problems over each follow's window since its last digest.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-company-follows-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
content.close();

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { sendCompanyDigest } = await import('../lib/server/company-follows');
const { reportCompanies } = await import('../lib/server/learner-cloud');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const person = (id: string, role: Person['role'] = 'student'): Person => ({ id, name: id, email: `${id}@example.test`, role, verified: true });
async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const request = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const response = await handleOj(request, p, url.pathname.split('/').slice(3));
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
const follow = (p: Person, slug: string, on = true) => call(p, 'POST', 'oj/follows/companies', { slug, on });
const notices = (userId: string) =>
  sqlite().prepare('SELECT id,kind,title,body,href FROM notifications WHERE user_id=? ORDER BY id').all(userId) as {
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string;
  }[];

void test('follows/companies: listed signed out too, company pages only, at most 20', async () => {
  const amy = person('cf-amy');
  assert.deepEqual((await call(null, 'GET', 'oj/follows/companies')).data, { signedIn: false, items: [] });
  assert.equal((await call(null, 'POST', 'oj/follows/companies', { slug: 'amazon', on: true })).status, 401);
  assert.equal((await follow(amy, 'no-such-company')).status, 404);
  assert.equal((await call(amy, 'POST', 'oj/follows/companies', { slug: 'amazon', on: true, extra: 1 })).status, 400);
  assert.deepEqual((await follow(amy, 'amazon')).data, { signedIn: true, items: [{ slug: 'amazon', name: 'Amazon' }] });
  // Following again changes nothing.
  assert.equal((await follow(amy, 'amazon')).data.items.length, 1);
  assert.deepEqual((await follow(amy, 'amazon', false)).data.items, []);
  const others = reportCompanies()
    .map((c) => c.slug)
    .filter((s) => s !== 'amazon')
    .slice(0, 21);
  for (const slug of others.slice(0, 20)) assert.equal((await follow(amy, slug)).status, 200, slug);
  assert.equal((await follow(amy, others[20])).status, 409);
  assert.equal((await call(amy, 'GET', 'oj/follows/companies')).data.items.length, 20);
  // Following one already followed is no new one.
  assert.equal((await follow(amy, others[0])).status, 200);
  await follow(amy, others[0], false);
  assert.equal((await follow(amy, others[20])).status, 200);
});

void test('a report’s approval notifies the company’s followers once each, never its author', async () => {
  const author = person('cf-author');
  const teacher = person('cf-teacher', 'teacher');
  const [fan, other, late] = ['cf-fan', 'cf-other', 'cf-late'].map((id) => person(id));
  await follow(fan, 'amazon');
  await follow(author, 'amazon');
  await follow(other, 'airbnb');
  const created = await call(author, 'POST', 'oj/experiences', {
    company: 'amazon',
    title: 'Amazon SDE new grad loop',
    role: 'Software Engineer',
    rounds: ['Online Assessment', 'Onsite'],
    result: 'Offer',
    month: new Date().toISOString().slice(0, 7),
    body: 'Two coding rounds and one behavioral round, all in one day. '.repeat(3),
    questions: ['LRU cache'],
    agree: true,
  });
  assert.equal(created.status, 201);
  const id = created.data.member.id as string;
  const review = (status: string, note = '') => call(teacher, 'POST', `oj/experiences/${id}/review`, { status, note });
  assert.equal((await review('rejected', 'Needs detail')).status, 200);
  assert.deepEqual(notices(fan.id), []);
  assert.equal((await review('approved')).status, 200);
  assert.deepEqual(notices(fan.id), [
    {
      id: `follow-exp:${id}:${fan.id}`,
      kind: 'company-report',
      title: 'Amazon 有新面经',
      body: 'Amazon SDE new grad loop',
      href: `/library/experience-ugc/${id}`,
    },
  ]);
  assert.deepEqual(notices(author.id), []);
  assert.deepEqual(notices(other.id), []);
  // Approving it again (clearing reports) is no news. Published again after a takedown, it is
  // news to followers who never heard of it; each follower hears once.
  await follow(late, 'amazon');
  await review('approved');
  assert.deepEqual(notices(late.id), []);
  await review('rejected', 'NDA');
  await review('approved');
  assert.equal(notices(fan.id).length, 1);
  assert.equal(notices(late.id).length, 1);
  assert.deepEqual(notices(author.id), []);
});

// Real OA problems with their trusted package checksums, published at chosen times.
const registry = JSON.parse(readFileSync('content/oa-judge/registry.json', 'utf8')) as {
  items: { id: string; packageChecksum: string }[];
};
function publish(id: string, at: number) {
  const checksum = registry.items.find((i) => i.id === id)!.packageChecksum;
  const db = sqlite();
  db.prepare("INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,'oa','oa',0,?,?)").run(id, at, at);
  db.prepare("INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,?,?,'t',?)").run(
    `${id}-v1`,
    id,
    JSON.stringify({ id }),
    checksum,
    at,
  );
  db.prepare('UPDATE oj_problems SET current_version_id=?,published=1 WHERE id=?').run(`${id}-v1`, id);
}

void test('the OA digest: from Beijing 09:00, new problems since each follow’s last digest, once', async () => {
  const HOUR = 3600000;
  // Beijing 2026-10-15 09:00 is 01:00 UTC.
  const nine = Date.UTC(2026, 9, 15, 1);
  const since = nine - 3 * 24 * HOUR;
  const [ann, ben, cat] = ['cf-ann', 'cf-ben', 'cf-cat'].map((id) => person(id));
  // The tests above followed on the wall clock; this one runs on its own.
  sqlite().prepare('DELETE FROM company_follows').run();
  const followAt = (p: Person, slug: string, at: number, last: number | null = null) =>
    sqlite()
      .prepare('INSERT INTO company_follows(user_id,company_slug,created_at,last_digest_at) VALUES(?,?,?,?)')
      .run(p.id, slug, at, last);
  // Ann's last digest was three days ago (the worker was down since): both Amazon problems count.
  followAt(ann, 'amazon', since - HOUR, since);
  followAt(ben, 'amazon', since - HOUR, since);
  followAt(ben, 'airbnb', since - HOUR, since);
  // Cat followed Airbnb after its new problem went online.
  followAt(cat, 'airbnb', nine - HOUR);
  publish('oa-amazon-114', nine - 40 * HOUR);
  publish('oa-amazon-116', nine - 2 * HOUR);
  publish('oa-airbnb-6', nine - 5 * HOUR);
  publish('oa-amazon-151', since - 2 * HOUR); // Before every window.

  assert.equal(await sendCompanyDigest(nine - 1), 0, 'not before 09:00 Beijing');
  assert.equal(await sendCompanyDigest(nine), 2);
  assert.deepEqual(
    notices(ann.id).map(({ id, kind, title, body, href }) => ({ id, kind, title, body, href })),
    [{ id: `follow-oa:2026-10-15:${ann.id}`, kind: 'company-oa', title: '关注的公司上线了 2 道新 OA 题', body: 'Amazon 2', href: '/oa/amazon' }],
  );
  const [benNotice] = notices(ben.id);
  assert.equal(benNotice.title, '关注的公司上线了 3 道新 OA 题');
  assert.deepEqual(benNotice.body.split(' · ').sort(), ['Airbnb 1', 'Amazon 2']);
  assert.deepEqual(notices(cat.id), []);
  // Every due follow moved on, Cat's too.
  assert.deepEqual(
    sqlite().prepare('SELECT DISTINCT last_digest_at FROM company_follows WHERE user_id IN (?,?,?)').pluck().all(ann.id, ben.id, cat.id),
    [nine],
  );
  // Later that day: nothing new to do.
  assert.equal(await sendCompanyDigest(nine + 5 * HOUR), 0);
  // The next morning: just the one problem since, linking to it.
  publish('oa-airbnb-8', nine + 6 * HOUR);
  assert.equal(await sendCompanyDigest(nine + 24 * HOUR), 2);
  assert.deepEqual(
    notices(cat.id).map(({ title, body, href }) => ({ title, body, href })),
    [{ title: '关注的公司上线了 1 道新 OA 题', body: 'Airbnb 1', href: '/oa/airbnb/oa-airbnb-8' }],
  );
  assert.equal(notices(ann.id).length, 1);
});
