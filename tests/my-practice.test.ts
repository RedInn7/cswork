import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-my-practice-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { listStudyLibrary } = await import('../lib/server/study-library');
const { dueReviews, wrongBook, REVIEW_LADDER } = await import('../lib/practice-review');
type History = import('../lib/practice-review').PracticeHistoryItem;

const me: Person = {
  id: 'practice-me',
  name: 'Me',
  email: 'me@example.test',
  role: 'student',
  verified: true,
};
const other: Person = { ...me, id: 'practice-other', email: 'other@example.test' };
const DAY = 86400000;
const t0 = Date.UTC(2026, 9, 1, 12);

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
  assert.equal(response.status, 200, path);
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
function submit(user: string, problem: string, state: string, at: number, extra: Record<string, string> = {}) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,created_at,updated_at)
      VALUES(?,?,?,?,?,?,1,?,?,?)`,
    )
    .run(`s${++n}`, user, problem, extra.language ?? 'python', '', state, extra.mode ?? 'judge', at, at);
}

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  submit(me.id, 'lc-1', 'wrong_answer', t0);
  submit(me.id, 'lc-1', 'system_error', t0 + 1); // A judge fault is not the learner's failure.
  submit(me.id, 'lc-1', 'compile_error', t0 + 2, { language: 'cpp' });
  submit(me.id, 'lc-1', 'accepted', t0 + 3);
  submit(me.id, 'lc-1', 'wrong_answer', t0 + 4); // After the first AC: not counted.
  submit(me.id, 'lc-1', 'accepted', t0 + DAY);
  submit(me.id, 'lc-1', 'wrong_answer', t0 + 2 * DAY, { mode: 'run' }); // Runs never count.
  submit(me.id, 'oa-acme-1', 'time_limit', t0 + 3 * DAY);
  submit(me.id, 'oa-acme-1', 'queued', t0 + 3 * DAY + 1);
  submit(other.id, 'lc-1', 'accepted', t0 + 5 * DAY);
  sqlite()
    .prepare(
      `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,
      content_hash,case_count,expected_count,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','h',0,0,0)`,
    )
    .run();
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('history aggregates formal submissions per problem for the signed-in learner only', async () => {
  assert.equal(await status(null, 'GET', 'history'), 401);
  const { items } = await ok<{ items: History[] }>(me, 'GET', 'history');
  assert.deepEqual(
    items.map((item) => item.problemId),
    ['oa-acme-1', 'lc-1'],
    'newest activity first',
  );
  const [oa, lc] = items;
  assert.deepEqual(
    // group_concat order is unspecified; neither list is ordered.
    { ...lc, languages: [...lc.languages].sort(), acAt: [...lc.acAt].sort((a, b) => a - b) },
    {
      problemId: 'lc-1',
      attempts: 6,
      firstAt: t0,
      lastAt: t0 + DAY,
      firstAcAt: t0 + 3,
      failuresBeforeAc: 2,
      lastStatus: 'accepted',
      languages: ['cpp', 'python'],
      acAt: [t0 + 3, t0 + DAY],
      stop: 'hash-counting',
    },
  );
  assert.equal(oa.firstAcAt, null);
  assert.equal(oa.failuresBeforeAc, 1);
  assert.equal(oa.lastStatus, 'queued');
  assert.equal(oa.stop, null);
  assert.deepEqual(oa.acAt, []);
  assert.deepEqual((await ok<{ items: History[] }>(other, 'GET', 'history')).items.length, 1);
});

void test('a note is private, replaced whole, removed when emptied and capped at 20 KB', async () => {
  const path = 'notes?target=problem:lc-1';
  assert.equal(await status(null, 'GET', path), 401);
  assert.deepEqual(await ok(me, 'GET', path), { target: 'problem:lc-1', body: '', updatedAt: null });
  const saved = await ok<{ body: string; updatedAt: number }>(me, 'PUT', path, { body: '哈希表 **一遍**' });
  assert.equal(saved.body, '哈希表 **一遍**');
  assert.equal((await ok<{ body: string }>(me, 'GET', path)).body, '哈希表 **一遍**');
  assert.equal((await ok<{ body: string }>(other, 'GET', path)).body, '', 'other learners never see it');
  assert.deepEqual(
    (await ok<{ items: { target: string }[] }>(me, 'GET', 'notes')).items.map((i) => i.target),
    ['problem:lc-1'],
  );
  // 7,000 CJK characters are 21,000 UTF-8 bytes: over the cap though under 20,000 characters.
  assert.equal(await status(me, 'PUT', path, { body: '字'.repeat(7000) }), 413);
  assert.equal(await status(me, 'PUT', 'notes?target=problem:../x%20y', { body: 'x' }), 400);
  assert.equal(await status(me, 'PUT', path, { body: 'x', extra: 1 }), 400);
  await ok(me, 'PUT', path, { body: '  \n' });
  assert.equal((await ok<{ items: unknown[] }>(me, 'GET', 'notes')).items.length, 0);
});

void test('marks toggle per learner and drive the Line 500 starred/redo filters', async () => {
  const mark = (p: Person, m: string, on: boolean) =>
    ok(p, 'POST', 'marks', { target: 'problem:lc-1', mark: m, on });
  await mark(me, 'star', true);
  await mark(me, 'star', true); // Idempotent.
  await mark(me, 'redo', true);
  type Marks = { items: { target: string; mark: string }[] };
  assert.deepEqual(
    (await ok<Marks>(me, 'GET', 'marks?mark=star')).items.map((i) => [i.target, i.mark]),
    [['problem:lc-1', 'star']],
  );
  assert.equal((await ok<Marks>(me, 'GET', 'marks?target=problem:lc-1')).items.length, 2);
  assert.equal((await ok<Marks>(other, 'GET', 'marks')).items.length, 0);
  assert.equal(await status(me, 'GET', 'marks?mark=love'), 400);
  assert.equal(await status(me, 'POST', 'marks', { target: 'problem:lc-1', mark: 'star' }), 400);
  const listed = (state: string, p = me) =>
    listStudyLibrary(new URLSearchParams({ status: state }), p.id) as unknown as {
      total: number;
      items: { starred: boolean; redo: boolean }[];
    };
  assert.equal(listed('starred').total, 1);
  assert.equal(listed('starred').items[0].redo, true);
  assert.equal(listed('starred', other).total, 0);
  await mark(me, 'star', false);
  assert.equal(listed('starred').total, 0);
  assert.equal(listed('redo').total, 1);
});

void test('a problem vote is up or down, never both, and only on a problem', async () => {
  type Marks = { items: { mark: string }[] };
  const vote = (m: string, on = true, target = 'problem:lc-2') => ok(me, 'POST', 'marks', { target, mark: m, on });
  const marks = async () =>
    (await ok<Marks>(me, 'GET', 'marks?target=problem:lc-2')).items.map((i) => i.mark).sort();
  await vote('star');
  await vote('up');
  assert.deepEqual(await marks(), ['star', 'up']);
  await vote('down');
  assert.deepEqual(await marks(), ['down', 'star'], 'down replaces up; the star stays');
  await vote('down', false);
  assert.deepEqual(await marks(), ['star']);
  assert.equal(await status(me, 'POST', 'marks', { target: 'content:x/y', mark: 'up', on: true }), 400);
  const { problemVote } = await import('../lib/server/my-practice');
  await vote('up');
  assert.equal(problemVote(me.id, 'lc-2'), 'up');
  assert.equal(problemVote(other.id, 'lc-2'), null);
});

void test('reviews climb the 3/7/21/60-day ladder by distinct AC days', () => {
  assert.deepEqual(REVIEW_LADDER, [3, 7, 21, 60]);
  const noon = new Date(2026, 9, 1, 12).getTime();
  const day = (d: number, h = 12) => new Date(2026, 9, 1 + d, h).getTime();
  const item = (problemId: string, acAt: number[], failuresBeforeAc = 0): History => ({
    problemId,
    attempts: acAt.length || 1,
    firstAt: acAt[0] ?? noon,
    lastAt: acAt.at(-1) ?? noon,
    firstAcAt: acAt[0] ?? null,
    failuresBeforeAc,
    lastStatus: acAt.length ? 'accepted' : 'wrong_answer',
    languages: ['python'],
    acAt,
    stop: null,
  });
  const history = [
    item('once', [noon]), // Level 1: due on day 3.
    item('twice-same-day', [noon, day(0, 18)]), // Still one day: level 1.
    item('twice', [noon, day(1)]), // Level 2: 7 days after day 1.
    item('mastered', [noon, day(1), day(2), day(3), day(4)]),
    item('unsolved', []),
  ];
  const due = (d: number, h = 0) => dueReviews(history, day(d, h)).map((r) => r.item.problemId);
  assert.deepEqual(due(2, 23), [], 'nothing before day 3');
  assert.deepEqual(due(3), ['once', 'twice-same-day'], 'due from local midnight');
  assert.deepEqual(due(8), ['once', 'twice-same-day', 'twice'], 'overdue stays listed, oldest first');
  assert.equal(dueReviews(history, day(8))[2].level, 2);
  assert.ok(!due(400).includes('mastered'));
  assert.deepEqual(
    wrongBook([item('a', []), item('b', [noon], 2), item('c', [noon], 1)]).map((i) => i.problemId),
    ['a', 'b'],
  );
});
