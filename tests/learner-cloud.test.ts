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
const { publicProfile, publicCatalogue, companyReports, recentSince, monthKey } = await import('../lib/server/learner-cloud');
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
  // A company hidden after the fact drops out of the count as it does from the list.
  sqlite()
    .prepare(`INSERT INTO user_list_items(list_id,problem_id,position,added_at) VALUES(?,'oa-hiddenco-1',99,1)`)
    .run(created.id);
  assert.equal((await ok<{ items: { count: number }[] }>(me, 'GET', 'lists')).items[0].count, 2);
  // Public pages need a verified address; private lists do not.
  assert.equal(await status(fresh, 'POST', 'lists', { title: 'spam', visibility: 'public' }), 403);
  assert.equal(await status(fresh, 'POST', 'lists', { title: 'mine' }), 201);
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
  // Two ACs of one problem in one hour are one heatmap entry.
  const hour = Math.floor(now / 3600000) * 3600000;
  submit(me.id, 'lc-1', 'accepted', hour + 1);
  submit(me.id, 'lc-1', 'accepted', hour + 2);
  submit(me.id, 'oa-hiddenco-1', 'accepted', now - 1000);
  const catalogue = new Map([
    ['lc-1', { difficulty: '简单' }],
    ['lc-3', { difficulty: '中等' }],
    ['oa-amazon-1', { difficulty: '中等' }],
    // A course exercise a guest could open still never counts on a profile.
    ['course-x', { difficulty: '简单' }],
  ]);
  assert.deepEqual(await ok(me, 'GET', 'profile'), { profile: null, badges: [], recapYears: [] });
  assert.equal(await status(me, 'POST', 'profile', { handle: 'lists', visible: true }), 400, 'reserved');
  assert.equal(await status(me, 'POST', 'profile', { handle: 'a', visible: true }), 400);
  const saved = await ok<{ profile: { handle: string; visible: boolean; indexable: boolean } }>(me, 'POST', 'profile', {
    handle: 'Line-Rider',
    visible: false,
    indexable: true,
    bio: 'grinding',
  });
  assert.deepEqual(saved.profile, {
    handle: 'line-rider',
    visible: false,
    indexable: false,
    showContest: false,
    showPractice: false,
    bio: 'grinding',
    featuredBadge: null,
    links: [],
    school: '',
    gradYear: null,
    targetRole: '',
  });
  assert.equal(publicProfile('line-rider', catalogue), null, 'not public until switched on');
  assert.equal(await status(other, 'POST', 'profile', { handle: 'line-rider', visible: true }), 409);
  assert.equal(await status(fresh, 'POST', 'profile', { handle: 'fresh-one', visible: true }), 403, 'verify first');
  assert.equal(await status(fresh, 'POST', 'profile', { handle: 'fresh-one', visible: false }), 200);
  await ok(me, 'POST', 'profile', { handle: 'line-rider', visible: true, bio: 'grinding' });
  const page = publicProfile('line-rider', catalogue, now)!;
  assert.equal(page.handle, 'line-rider');
  assert.equal(page.indexable, false);
  assert.deepEqual(page.solved, { total: 1, easy: 1, medium: 0, hard: 0 });
  assert.deepEqual(page.recent.map((r) => r.id), ['lc-1']);
  // Activity carries opaque numbers and whole hours: no problem ids or exact times for guests.
  assert.ok(page.activity.every((a) => /^\d+$/.test(a.problem_id) && a.created_at % 3600000 === 0));
  assert.equal(page.activity.filter((a) => a.created_at === hour).length, 1);
  assert.ok(page.recent.every((r) => r.at % 3600000 === 0));
  assert.equal(page.stops.length, 1);
  assert.equal(JSON.stringify(page).includes('me@example.test'), false);
  assert.equal(JSON.stringify(page).includes('cloud-me'), false, 'no user id either');
  assert.equal(publicProfile('nobody-here', catalogue), null);
  // My progress links a public recap only for the years that page serves (the same UTC, public-only count).
  const mine = await ok<{ recapYears: number[] }>(me, 'GET', 'profile');
  assert.deepEqual(mine.recapYears, publicProfile('line-rider', await publicCatalogue(), now)!.years);
});

void test('a featured badge must be earned to save, stays until changed, and drops off once lost', async () => {
  const db = sqlite();
  // Every daily problem of February 2026, from the points ledger: the month badge.
  for (let d = 1; d <= 28; d++)
    db.prepare(
      "INSERT INTO point_ledger(id,user_id,delta,reason,ref_id,created_at) VALUES(?,?,20,'daily',?,1)",
    ).run(`feat-${d}`, other.id, `2026-02-${String(d).padStart(2, '0')}`);
  const profile = { handle: 'month-rider', visible: true };
  const first = await ok<{ badges: { id: string }[] }>(other, 'POST', 'profile', profile);
  assert.ok(first.badges.some((b) => b.id === 'daily:2026-02'), 'a save sends the picker its badges');
  const mine = await ok<{ badges: { id: string }[] }>(other, 'GET', 'profile');
  assert.ok(mine.badges.some((b) => b.id === 'daily:2026-02'));
  assert.equal(await status(other, 'POST', 'profile', { ...profile, featuredBadge: 'daily:2026-03' }), 400);
  assert.equal(await status(other, 'POST', 'profile', { ...profile, featuredBadge: 'domain:line' }), 400);
  await ok(other, 'POST', 'profile', { ...profile, featuredBadge: 'daily:2026-02' });
  // A save without the field keeps it.
  const kept = await ok<{ profile: { featuredBadge: string | null } }>(other, 'POST', 'profile', { ...profile, bio: 'daily' });
  assert.equal(kept.profile.featuredBadge, 'daily:2026-02');
  const catalogue = new Map([['lc-1', { difficulty: '简单' }]]);
  assert.deepEqual(publicProfile('month-rider', catalogue)?.featured, {
    id: 'daily:2026-02',
    group: 'daily',
    zh: '2026 年 2 月每日一题全勤',
    en: 'Daily problem every day, Feb 2026',
  });
  db.prepare("DELETE FROM point_ledger WHERE id='feat-28'").run();
  assert.equal(publicProfile('month-rider', catalogue)?.featured, null, 'no longer earned');
  const cleared = await ok<{ profile: { featuredBadge: string | null } }>(other, 'POST', 'profile', { ...profile, featuredBadge: null });
  assert.equal(cleared.profile.featuredBadge, null);
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

void test('lists: bulk add resolves pasted lines on the server, reorder needs the exact items, both owner only', async () => {
  type List = { id: string; updatedAt: number; items: { problemId: string }[] };
  type Bulk = { added: number; duplicate: number; unknown: string[]; overflow: number; list: List };
  const made = await ok<List>(me, 'POST', 'lists', { title: 'Bulk', problemIds: ['oa-amazon-1'] });
  const path = `lists/${made.id}`;
  assert.equal(await status(null, 'POST', `${path}/bulk`, { lines: ['1'] }), 401);
  const bulk = await ok<Bulk>(me, 'POST', `${path}/bulk`, {
    lines: [
      'https://leetcode.cn/problems/p-3/description/',
      '1',
      'p-1', // The same problem as "1".
      '#1',
      'https://cswork.test/?view=problem&problem=oa-amazon-1', // Already in the list.
      'oa-hiddenco-1',
      'course-x',
      'sql-anything',
      '404',
      'what is this?',
      '',
    ],
  });
  assert.equal(bulk.added, 2);
  assert.equal(bulk.duplicate, 3);
  assert.deepEqual(bulk.unknown, ['oa-hiddenco-1', 'course-x', 'sql-anything', '404', 'what is this?']);
  assert.equal(bulk.overflow, 0);
  assert.deepEqual(bulk.list.items.map((i) => i.problemId), ['oa-amazon-1', 'lc-3', 'lc-1'], 'paste order');
  assert.equal(await status(me, 'POST', `${path}/bulk`, { lines: [] }), 400);
  assert.equal(await status(me, 'POST', `${path}/bulk`, { lines: ['x'.repeat(301)] }), 400);
  assert.equal(await status(me, 'POST', `${path}/bulk`, { lines: ['1'], kinds: ['id'] }), 400);

  await ok(me, 'POST', path, { visibility: 'public' });
  const before = (await ok<List>(me, 'GET', path)).updatedAt;
  const order = ['lc-1', 'oa-amazon-1', 'lc-3'];
  const moved = await ok<List>(me, 'POST', `${path}/reorder`, { problemIds: order });
  assert.deepEqual(moved.items.map((i) => i.problemId), order);
  assert.ok(moved.updatedAt >= before);
  for (const problemIds of [['lc-1', 'oa-amazon-1'], [...order, 'lc-4'], ['lc-1', 'lc-1', 'lc-3']])
    assert.equal(await status(me, 'POST', `${path}/reorder`, { problemIds }), 409, problemIds.join());
  // A public list reads for others, but only its owner writes to it.
  assert.equal(await status(other, 'POST', `${path}/reorder`, { problemIds: order }), 404);
  assert.equal(await status(other, 'POST', `${path}/bulk`, { lines: ['3'] }), 404);
  assert.deepEqual((await ok<List>(other, 'GET', path)).items.map((i) => i.problemId), order);
  // A company hidden after the fact keeps its row, after the order the owner can see.
  sqlite()
    .prepare(`INSERT INTO user_list_items(list_id,problem_id,position,added_at) VALUES(?,'oa-hiddenco-1',0,1)`)
    .run(made.id);
  await ok(me, 'POST', `${path}/reorder`, { problemIds: ['lc-3', 'lc-1', 'oa-amazon-1'] });
  assert.deepEqual(
    sqlite().prepare('SELECT problem_id FROM user_list_items WHERE list_id=? ORDER BY position').pluck().all(made.id),
    ['lc-3', 'lc-1', 'oa-amazon-1', 'oa-hiddenco-1'],
  );

  // Near the cap: what fits goes in, the rest is counted instead of failing the paste.
  const full = await ok<List>(me, 'POST', 'lists', { title: 'Nearly full' });
  const insert = sqlite().prepare('INSERT INTO user_list_items(list_id,problem_id,position,added_at) VALUES(?,?,?,1)');
  for (let i = 0; i < 499; i++) insert.run(full.id, `lc-${10000 + i}`, i + 1);
  const cut = await ok<Bulk>(me, 'POST', `lists/${full.id}/bulk`, { lines: ['3', '1', 'oa-amazon-1', 'lc-10000'] });
  assert.deepEqual([cut.added, cut.overflow, cut.duplicate], [1, 2, 1]);
  assert.equal(cut.list.items.length, 500);
  assert.equal(cut.list.items.at(-1)!.problemId, 'lc-3');
});
