import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-learner-cloud-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'hiddenco';
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { publicProfile, companyReports, recentSince, monthKey } = await import('../lib/server/learner-cloud');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');

const me: Person = { id: 'cloud-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'cloud-other', email: 'other@example.test' };
const fresh: Person = { ...me, id: 'cloud-new', email: 'new@example.test', verified: false };

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
let n = 0;
function submit(user: string, problem: string, state: string, at: number, passed = 0) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','',?,?,4,'judge',?,?)`,
    )
    .run(`s${++n}`, user, problem, state, passed, at, at);
}
const lc = (number: number, difficulty: string) => ({
  id: `lc-${number}`, number, slug: `p-${number}`, titleZh: `题${number}`, titleEn: `P${number}`, difficulty,
  topics: ['数组'], descriptionZh: '题面', descriptionEn: 'Statement', sourceUrl: `https://leetcode.cn/problems/p-${number}/`,
  sourceEnUrl: `https://leetcode.com/problems/p-${number}/`, attribution: 'test', signature: { name: 'f' },
  codeSnippets: [], reference: { path: '/private/x.py' }, cases: [], caseStatus: 'missing',
});
const now = Date.now();

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const file = resolve(dir, 'lc.jsonl');
  writeFileSync(file, [lc(1, '简单'), lc(3, '中等')].map((r) => JSON.stringify(r)).join('\n') + '\n');
  loadStudyLibrary(db, file);
  for (const id of ['lc-1', 'lc-3', 'oa-amazon-1', 'oa-hiddenco-1', 'course-x'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
  for (const id of ['lc-1', 'lc-3'])
    db.prepare(`UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':v-' || ? WHERE id=?`).run(id, id, id);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('finished mocks sync up with the server score, stay per learner and never overwrite another account', async () => {
  const start = now - 3 * 3600000;
  submit(me.id, 'lc-1', 'accepted', start + 60000);
  submit(me.id, 'lc-3', 'wrong_answer', start + 120000, 2);
  const session = {
    id: '6f1c2f9e-5b8e-4d1a-9a3e-0c2b6a1d7e01',
    company: 'amazon',
    name: 'Amazon',
    platform: 'HackerRank',
    preset: true,
    scoring: 'tests',
    source: 'mixed',
    slots: ['easy', 'medium'],
    ids: ['lc-1', 'lc-3'],
    minutes: 90,
    skew: 0,
    createdAt: start - 1000,
    startedAt: start,
    finishedAt: start + 30 * 60000,
    reason: 'manual',
    // The client's own claim is ignored: the server reports the window itself.
    result: { score: 200, max: 200, solved: 2, estimate: false },
  };
  assert.equal(await status(null, 'GET', 'mock-oa/history'), 401);
  const saved = await ok<{ saved: string[]; items: { id: string; result?: { score: number; solved: number } }[] }>(
    me, 'POST', 'mock-oa/history', { sessions: [session, { id: 'junk' }] },
  );
  assert.deepEqual(saved.saved, [session.id], 'malformed sessions are skipped, not fatal');
  assert.deepEqual(saved.items[0].result, { score: 150, max: 200, solved: 1, estimate: false });
  // Another learner posting the same id neither steals nor overwrites it.
  const theirs = await ok<{ saved: string[]; items: unknown[] }>(other, 'POST', 'mock-oa/history', { sessions: [session] });
  assert.deepEqual(theirs.saved, []);
  assert.equal(theirs.items.length, 0);
  const mine = await ok<{ items: { id: string; ids: string[]; startedAt: number }[] }>(me, 'GET', 'mock-oa/history');
  assert.equal(mine.items.length, 1);
  assert.deepEqual(mine.items[0].ids, ['lc-1', 'lc-3']);
  assert.equal(await status(me, 'POST', 'mock-oa/history', { sessions: [], extra: 1 }), 400);
});

void test('lists: create, add, rename, share, fork and delete, each write checked against the owner', async () => {
  type List = { id: string; title: string; visibility: string; items: { problemId: string }[]; mine: boolean; owner: string | null };
  assert.equal(await status(null, 'POST', 'lists', { title: 'x' }), 401);
  const created = await ok<List>(me, 'POST', 'lists', {
    title: '  Graph warm-up ',
    problemIds: ['lc-1', 'course-x', 'oa-hiddenco-1', 'lc-404'],
  });
  assert.equal(created.title, 'Graph warm-up');
  assert.deepEqual(created.items.map((i) => i.problemId), ['lc-1'], 'only published, visible problems go in');
  const path = `lists/${created.id}`;
  await ok(me, 'POST', `${path}/items`, { problemId: 'oa-amazon-1', on: true });
  await ok(me, 'POST', `${path}/items`, { problemId: 'oa-amazon-1', on: true }); // Idempotent.
  assert.equal(await status(me, 'POST', `${path}/items`, { problemId: 'oa-hiddenco-1', on: true }), 404);
  const menu = await ok<{ items: { id: string; count: number; has: boolean }[] }>(me, 'GET', 'lists?problem=oa-amazon-1');
  assert.deepEqual(menu.items.map((l) => [l.id, l.count, l.has]), [[created.id, 2, true]]);
  // Private: another learner and guests see nothing, and cannot write or fork.
  assert.equal(await status(other, 'GET', path), 404);
  assert.equal(await status(null, 'GET', path), 404);
  assert.equal(await status(other, 'POST', `${path}/items`, { problemId: 'lc-3', on: true }), 404);
  assert.equal(await status(other, 'POST', path, { title: 'mine now' }), 404);
  assert.equal(await status(other, 'POST', `${path}/delete`), 404);
  assert.equal(await status(other, 'POST', `${path}/fork`), 404);
  const shared = await ok<List>(me, 'POST', path, { visibility: 'public', title: 'Warm-up' });
  assert.equal(shared.visibility, 'public');
  const seen = await ok<List>(null, 'GET', path);
  assert.equal(seen.mine, false);
  assert.equal(seen.owner, null, 'no public profile, no name');
  assert.deepEqual(seen.items.map((i) => i.problemId), ['lc-1', 'oa-amazon-1']);
  const fork = await ok<List & { forkedFrom: string }>(other, 'POST', `${path}/fork`);
  assert.equal(fork.mine, true);
  assert.equal(fork.visibility, 'private');
  assert.equal(fork.forkedFrom, created.id);
  assert.deepEqual(fork.items.map((i) => i.problemId), ['lc-1', 'oa-amazon-1']);
  await ok(me, 'POST', `${path}/items`, { problemId: 'lc-1', on: false });
  assert.deepEqual((await ok<List>(me, 'GET', path)).items.map((i) => i.problemId), ['oa-amazon-1']);
  assert.equal((await ok<List>(other, 'GET', `lists/${fork.id}`)).items.length, 2, 'a fork is a copy');
  await ok(me, 'POST', `${path}/delete`);
  assert.equal(await status(me, 'GET', path), 404);
  assert.equal((sqlite().prepare('SELECT COUNT(*) AS n FROM user_list_items WHERE list_id=?').get(created.id) as { n: number }).n, 0);
  assert.equal(await status(me, 'POST', 'lists', { title: '' }), 400);
  assert.equal(await status(me, 'POST', 'lists/not-an-id', { title: 'x' }), 404);
});

void test('the public profile is off by default, names nobody and counts only published problems', async () => {
  submit(me.id, 'course-x', 'accepted', now - 1000);
  submit(me.id, 'oa-hiddenco-1', 'accepted', now - 1000);
  const catalogue = new Map([
    ['lc-1', { difficulty: '简单' }],
    ['lc-3', { difficulty: '中等' }],
    ['oa-amazon-1', { difficulty: '中等' }],
    // A course exercise a guest could open still never counts on a profile.
    ['course-x', { difficulty: '简单' }],
  ]);
  assert.deepEqual(await ok(me, 'GET', 'profile'), { profile: null });
  assert.equal(await status(me, 'POST', 'profile', { handle: 'lists', visible: true }), 400, 'reserved');
  assert.equal(await status(me, 'POST', 'profile', { handle: 'a', visible: true }), 400);
  const saved = await ok<{ profile: { handle: string; visible: boolean; indexable: boolean } }>(me, 'POST', 'profile', {
    handle: 'Line-Rider',
    visible: false,
    indexable: true,
    bio: 'grinding',
  });
  assert.deepEqual(saved.profile, { handle: 'line-rider', visible: false, indexable: false, bio: 'grinding' });
  assert.equal(publicProfile('line-rider', catalogue), null, 'not public until switched on');
  assert.equal(await status(other, 'POST', 'profile', { handle: 'line-rider', visible: true }), 409);
  await ok(me, 'POST', 'profile', { handle: 'line-rider', visible: true, bio: 'grinding' });
  const page = publicProfile('line-rider', catalogue, now)!;
  assert.equal(page.handle, 'line-rider');
  assert.equal(page.indexable, false);
  assert.deepEqual(page.solved, { total: 1, easy: 1, medium: 0, hard: 0 });
  assert.deepEqual(page.recent.map((r) => r.id), ['lc-1']);
  assert.ok(page.activity.every((a) => catalogue.has(a.problem_id)));
  assert.equal(page.stops.length, 1);
  assert.equal(JSON.stringify(page).includes('me@example.test'), false);
  assert.equal(JSON.stringify(page).includes('cloud-me'), false, 'no user id either');
  assert.equal(publicProfile('nobody-here', catalogue), null);
});

void test('asked reports: verified learners, one per problem and month, counted by people over six months', async () => {
  const thisMonth = monthKey(now);
  const old = recentSince(now, 8);
  assert.equal(await status(fresh, 'POST', 'reports', { problemId: 'lc-1', month: thisMonth }), 403);
  assert.equal(await status(me, 'POST', 'reports', { problemId: 'course-x', month: thisMonth }), 400);
  assert.equal(await status(me, 'POST', 'reports', { problemId: 'lc-404', month: thisMonth }), 404);
  assert.equal(await status(me, 'POST', 'reports', { problemId: 'lc-1', month: '2099-01' }), 400);
  assert.equal(await status(me, 'POST', 'reports', { problemId: 'lc-1', company: 'no-such-co', month: thisMonth }), 400);
  type Summary = { total: number; last: string | null; companies: { slug: string; n: number }[]; mine: { month: string; company: string; round: string }[] };
  await ok(me, 'POST', 'reports', { problemId: 'lc-1', company: 'amazon', round: 'oa', month: thisMonth });
  // Same month again corrects the round instead of counting twice.
  const again = await ok<Summary>(me, 'POST', 'reports', { problemId: 'lc-1', company: 'amazon', round: 'onsite', month: thisMonth });
  assert.deepEqual(again.mine, [{ month: thisMonth, company: 'amazon', round: 'onsite' }]);
  await ok(other, 'POST', 'reports', { problemId: 'lc-1', month: thisMonth });
  await ok(other, 'POST', 'reports', { problemId: 'lc-1', company: 'amazon', month: old }); // Too old to count.
  const seen = await ok<Summary>(null, 'GET', 'reports?problem=lc-1');
  assert.equal(seen.total, 2);
  assert.equal(seen.last, thisMonth);
  assert.deepEqual(seen.companies.map((c) => [c.slug, c.n]), [['amazon', 1]]);
  assert.deepEqual(seen.mine, [], 'reporters stay private');
  assert.deepEqual(companyReports('amazon', now).map((r) => [r.problemId, r.n]), [['lc-1', 1]]);
  assert.equal(await status(null, 'GET', 'reports?problem=oa-hiddenco-1'), 404);
  const companies = await ok<{ items: { slug: string }[] }>(null, 'GET', 'reports/companies');
  assert.ok(companies.items.some((c) => c.slug === 'amazon'));
  assert.equal(companies.items.some((c) => c.slug === 'hiddenco'), false);
  const withdrawn = await ok<Summary>(me, 'POST', 'reports/withdraw', { problemId: 'lc-1', month: thisMonth });
  assert.equal(withdrawn.total, 1);
  assert.deepEqual(withdrawn.mine, []);
  // Twenty a day at most.
  sqlite()
    .prepare(
      `WITH RECURSIVE k(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM k WHERE i<20)
      INSERT INTO problem_reports(id,user_id,problem_id,asked_month,created_at) SELECT 'r'||i,?,'lc-'||(1000+i),?,? FROM k`,
    )
    .run(me.id, thisMonth, now);
  assert.equal(await status(me, 'POST', 'reports', { problemId: 'lc-3', month: thisMonth }), 429);
});
