import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// The content library's seniority facet, popular and hot orders, card counts, curated picks,
// verified member posts, upvotes on experiences and "I was asked this" on interview questions.
const dir = mkdtempSync(join(tmpdir(), 'library-popular-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
process.env.HIDDEN_COMPANIES = 'hush';
const NOW = Date.now();
const DAY = 86400000;
const date = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL DEFAULT 'B')`);
const add = (type: string, slug: string, daysAgo: number, o: Record<string, unknown> = {}) =>
  content
    .prepare(
      `INSERT INTO items(id,type,slug,title,company_slug,company_name,seniority,published_at)
       VALUES(@id,@type,@slug,@title,@company,@name,@seniority,@at)`,
    )
    .run({ id: `${type}/${slug}`, type, slug, title: slug, company: 'acme', name: 'Acme', seniority: null, at: date(daysAgo), ...o });
add('interview_question', 'iq-new', 10, { seniority: 'Senior' });
add('interview_question', 'iq-old', 300, { seniority: 'Junior' });
add('interview_question', 'iq-quiet', 5);
add('interview_question', 'iq-hush', 5, { company: 'hush', name: 'Hush' });
// Maps to lc-146 in company-lc-map.json.
add('coding_question', 'implement-lru-cache-with-o-1-ops', 20);
add('experience', 'ex-acme', 30);
content.close();

const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { handleContent } = await import('../lib/server/content-library');
const { handleOj } = await import('../lib/server/oj-api');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const student: Person = { id: 'u-student', name: 'S', email: 's@example.test', role: 'student', verified: true };
const teacher: Person = { ...student, id: 'u-teacher', email: 't@example.test', role: 'teacher' };
type Card = { type: string; slug: string; curated: boolean; stats: { answers: number; ups: number; asked: { n: number; last: string } | null; practised: number | null } };
const list = async (query: string) => {
  const url = new URL(`http://localhost/api/content/list?${query}`);
  return (await (await handleContent(new Request(url), null, ['list'])).json()) as {
    items: Card[];
    total: number;
    facets: { seniorities: { value: string; n: number }[] };
    memberOnly?: boolean;
  };
};
const slugs = async (query: string) => (await list(query)).items.map((i) => i.slug);
async function oj(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  try {
    const response = await handleOj(
      new Request(url, { method, body: body && JSON.stringify(body), headers: body ? { 'Content-Type': 'application/json' } : {} }),
      p,
      url.pathname.split('/').slice(3),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: {} };
  }
}

const db = sqlite();
const mark = db.prepare('INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,?,?)');
const post = db.prepare(
  'INSERT INTO solution_posts(id,problem_id,user_id,title,body,hidden,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
);
const report = db.prepare(
  'INSERT INTO problem_reports(id,user_id,problem_id,company,round,asked_month,created_at) VALUES(?,?,?,?,?,?,?)',
);
const month = new Date(NOW).toISOString().slice(0, 7);
// iq-old: five answers (one hidden by a moderator does not count) = 10.
for (let i = 0; i < 6; i++) post.run(`p${i}`, 'q:iq-old', `a${i}`, 'T', 'B', i === 5 ? 2 : 0, NOW, NOW);
// iq-new: a star, two learners asked = 1 + 6 = 7, and an upvote = 8.
mark.run('a1', 'content:interview_question/iq-new', 'star', NOW);
mark.run('a2', 'content:interview_question/iq-new', 'up', NOW);
report.run('r1', 'a1', 'q:iq-new', 'acme', 'onsite', month, NOW);
report.run('r2', 'a2', 'q:iq-new', '', '', month, NOW);
// The coding question is reported as the judge problem it maps to; 20 people tried lc-146, 12 solved it.
report.run('r3', 'a3', 'lc-146', '', '', month, NOW);
for (let i = 0; i < 20; i++)
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,created_at,updated_at)
     VALUES(?,?,?,?,?,?,1,'judge',?,?)`,
  ).run(`s${i}`, `solver${i}`, 'lc-146', 'python', '', i < 12 ? 'accepted' : 'wrong_answer', NOW, NOW);

void test('seniority filters and has a facet', async () => {
  assert.deepEqual(await slugs('type=questions&seniority=Senior'), ['iq-new']);
  assert.deepEqual(
    (await list('type=questions')).facets.seniorities.map((f) => [f.value, f.n]).sort(),
    [['Junior', 1], ['Senior', 1]],
  );
});

void test('popular ranks by stars, answers, reporters and upvotes; hot lets age weigh in', async () => {
  assert.deepEqual(await slugs('type=interview_question'), ['iq-hush', 'iq-quiet', 'iq-new', 'iq-old'], 'newest first by default');
  const popular = await slugs('type=interview_question&sort=popular');
  assert.deepEqual(popular.slice(0, 2), ['iq-old', 'iq-new'], 'score 10 before 8');
  const hot = await slugs('type=interview_question&sort=hot');
  assert.deepEqual(hot.slice(0, 2), ['iq-new', 'iq-old'], '8 over 12 days beats 10 over 302');
  assert.deepEqual(popular.slice(2), ['iq-hush', 'iq-quiet'], 'the unscored stay newest first behind them');
  assert.equal((await list('type=interview_question&sort=popular')).total, popular.length);
});

void test('cards carry answers, upvotes, recent reporters and people who solved a mapped problem', async () => {
  const cards = new Map((await list('type=questions')).items.map((c) => [c.slug, c]));
  assert.deepEqual(cards.get('iq-old')!.stats, { answers: 5, ups: 0, asked: null, practised: null });
  assert.deepEqual(cards.get('iq-new')!.stats, { answers: 0, ups: 1, asked: { n: 2, last: month }, practised: null });
  assert.deepEqual(cards.get('implement-lru-cache-with-o-1-ops')!.stats, { answers: 0, ups: 0, asked: { n: 1, last: month }, practised: 12 });
  assert.equal(cards.get('iq-old')!.curated, false);
});

void test('curated: teachers only, then a badge and a filter', async () => {
  const target = 'content:interview_question/iq-quiet';
  assert.equal((await oj(student, 'POST', 'marks', { target, mark: 'curated', on: true })).status, 403);
  assert.equal((await oj(teacher, 'POST', 'marks', { target: 'problem:lc-1', mark: 'curated', on: true })).status, 403);
  assert.equal((await oj(teacher, 'POST', 'marks', { target, mark: 'curated', on: true })).status, 200);
  assert.deepEqual(await slugs('type=questions&curated=1'), ['iq-quiet']);
  assert.equal((await list('type=questions')).items.find((c) => c.slug === 'iq-quiet')!.curated, true);
});

void test('upvotes: experiences and interview questions, not other content', async () => {
  const up = (target: string) => oj(student, 'POST', 'marks', { target, mark: 'up', on: true });
  assert.equal((await up('content:experience/ex-acme')).status, 200);
  assert.equal((await up('content:interview_question/iq-old')).status, 200);
  assert.equal((await up('content:guide/acme-swe')).status, 400);
  assert.equal((await oj(student, 'POST', 'marks', { target: 'content:experience/ex-acme', mark: 'down', on: true })).status, 400);
});

void test('"I was asked this" on a library interview question', async () => {
  const sent = await oj(student, 'POST', 'reports', { problemId: 'q:iq-quiet', company: null, round: 'onsite', month });
  assert.equal(sent.status, 200);
  assert.equal(sent.body.total, 1);
  assert.equal((await oj(student, 'GET', 'reports?problem=q%3Aiq-quiet')).body.total, 1);
  // A hidden company's question, a missing one and a malformed id read as missing or invalid.
  assert.equal((await oj(student, 'POST', 'reports', { problemId: 'q:iq-hush', month })).status, 404);
  assert.equal((await oj(student, 'POST', 'reports', { problemId: 'q:nope', month })).status, 404);
  assert.equal((await oj(student, 'GET', 'reports?problem=q%3Aiq-hush')).status, 404);
  assert.equal((await oj(student, 'POST', 'reports', { problemId: 'q:a/b', month })).status, 400);
  // Reports on questions never enter a company page's judge problem list.
  const { companyReports } = await import('../lib/server/learner-cloud');
  assert.ok(companyReports('acme').every((r) => !r.problemId.startsWith('q:')));
});

void test('verified: member posts by authors with a verified address only', async () => {
  const user = db.prepare(
    'INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  );
  user.run('m-yes', 'Y', 'y@example.test', 1, NOW, NOW);
  user.run('m-no', 'N', 'n@example.test', 0, NOW, NOW);
  const submit = db.prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,rounds,result,interview_month,body,questions,status,review_note,reviewed_at,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  submit.run('vvvvvvvvvvvv', 'm-yes', 'amazon', 'Verified loop', 'SDE', '[]', null, month, 'x'.repeat(100), '[]', 'approved', '', NOW, NOW);
  submit.run('nnnnnnnnnnnn', 'm-no', 'amazon', 'Unverified loop', 'SDE', '[]', null, month, 'x'.repeat(100), '[]', 'approved', '', NOW, NOW);
  const all = await list('type=experience');
  assert.ok(all.items.some((c) => c.slug === 'member.nnnnnnnnnnnn'));
  const verified = await list('type=experience&verified=1');
  assert.deepEqual(verified.items.map((c) => c.slug), ['member.vvvvvvvvvvvv']);
  assert.equal(verified.memberOnly, true);
  // Members give no seniority: a seniority filter leaves them out.
  assert.equal((await list('type=experience&seniority=Senior')).items.some((c) => c.slug.startsWith('member.')), false);
});
