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
const { dueReviews, wrongBook, REVIEW_LADDER, solveQuality } = await import('../lib/practice-review');
const { recordAid } = await import('../lib/server/practice-aids');
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
      help: 'none',
      solveSeconds: null,
      whiteboard: null,
      brute: false,
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

void test('the notes hub searches written notes by every word, with snippets and pages', async () => {
  type Hits = {
    items: { target: string; snippet: string; problemId: string | null; updatedAt: number }[];
    total: number;
    nextCursor: string | null;
  };
  const put = (target: string, body: string) => ok(me, 'PUT', `notes?target=${encodeURIComponent(target)}`, { body });
  await put('problem:lc-1', `${'开头。'.repeat(60)}用哈希表一遍扫描，记下 Complement 的下标。`);
  await put('content:interview_question/lru', 'LRU: hash map plus a doubly linked list');
  await put('sd:url-shortener', '{"q1":"hash"}'); // Quiz answers never show up.
  await put('sd:url-shortener/draft', 'my design'); // Nor design drafts, even in the quiz list below.
  await put('mcq:answers', '{"dsa-1":[1,0]}'); // Nor does the MCQ review state.
  await put('story:1', 'hash story');
  // A note on one of the learner's own submissions; someone else's is a 404.
  await put('sub:s1', '50% 的 WA 来自 a_b 下标');
  assert.equal(await status(me, 'PUT', 'notes?target=sub:s10', { body: 'x' }), 404);
  assert.equal(await status(me, 'PUT', 'notes?target=sub:nope', { body: 'x' }), 404);
  // Saved in the same millisecond: set the order explicitly.
  for (const [target, at] of [['problem:lc-1', 10], ['content:interview_question/lru', 20], ['sub:s1', 30]] as const)
    sqlite().prepare('UPDATE user_notes SET updated_at=? WHERE user_id=? AND target=?').run(at, me.id, target);
  const search = (query: string) => ok<Hits>(me, 'GET', `notes${query}`);
  const all = await search('');
  assert.deepEqual(all.items.map((i) => i.target), ['sub:s1', 'content:interview_question/lru', 'problem:lc-1']);
  assert.equal(all.total, 3);
  assert.equal(all.items[0].problemId, 'lc-1', 'a submission note links to its problem');
  assert.equal(all.items[1].problemId, null);
  assert.ok(all.items[2].snippet.startsWith('开头。') && all.items[2].snippet.endsWith('…'), 'from the start without q');
  const hash = await search('?q=HASH');
  assert.deepEqual(hash.items.map((i) => i.target), ['content:interview_question/lru'], 'case-insensitive, every word');
  const cjk = await search(`?q=${encodeURIComponent('哈希表  complement')}`);
  assert.deepEqual(cjk.items.map((i) => i.target), ['problem:lc-1']);
  assert.ok(cjk.items[0].snippet.startsWith('…') && cjk.items[0].snippet.includes('用哈希表'), 'around the first hit');
  // % and _ are literal, not wildcards.
  assert.deepEqual((await search('?q=50%25')).items.map((i) => i.target), ['sub:s1']);
  assert.deepEqual((await search('?q=a_b')).items.map((i) => i.target), ['sub:s1']);
  assert.equal((await search('?q=a%25b')).total, 0);
  assert.deepEqual((await search('?prefix=content')).items.map((i) => i.target), ['content:interview_question/lru']);
  assert.deepEqual((await search('?prefix=sub:')).items.map((i) => i.target), ['sub:s1']);
  assert.equal(await status(me, 'GET', 'notes?prefix=sd'), 400);
  assert.equal(await status(me, 'GET', 'notes?cursor=junk'), 400);
  // The story bank keeps its own listing, bodies included.
  const stories = await ok<{ items: { target: string; body: string }[] }>(me, 'GET', 'notes?prefix=story%3A');
  assert.deepEqual(stories.items.map((i) => [i.target, i.body]), [['story:1', 'hash story']]);
  // So do the system design quiz answers, for the MCQ page's review of the wrong ones.
  const quizzes = await ok<{ items: { target: string; body: string }[] }>(me, 'GET', 'notes?prefix=sd%3A');
  assert.deepEqual(quizzes.items.map((i) => [i.target, i.body]), [['sd:url-shortener', '{"q1":"hash"}']]);
  assert.equal((await ok<{ items: unknown[] }>(other, 'GET', 'notes?prefix=sd%3A')).items.length, 0);
  assert.equal((await ok<Hits>(other, 'GET', 'notes')).total, 0);
  // 50 a page: the cursor picks up after the last one shown.
  sqlite().transaction(() => {
    for (let i = 0; i < 60; i++)
      sqlite()
        .prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,?)')
        .run(me.id, `problem:p-${i}`, `bulk ${i}`, 1000 + Math.floor(i / 2));
  })();
  const first = await search('?q=bulk');
  assert.equal(first.items.length, 50);
  assert.equal(first.total, 60);
  const rest = await search(`?q=bulk&cursor=${first.nextCursor}`);
  assert.equal(rest.items.length, 10);
  assert.equal(rest.nextCursor, null);
  assert.equal(new Set([...first.items, ...rest.items].map((i) => i.target)).size, 60);
  sqlite().prepare("DELETE FROM user_notes WHERE user_id=? AND target<>'story:1'").run(me.id);
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

void test('done ticks move in as one batch, all or none, and show on classic lists', async () => {
  type Marks = { items: { target: string }[] };
  const batch = (targets: unknown, extra = {}) => ({ targets, mark: 'done', ...extra });
  const added = await ok<{ added: number }>(me, 'POST', 'marks', batch(['problem:lc-1', 'problem:lc-11', 'problem:lc-1']));
  assert.equal(added.added, 2, 'duplicates count once');
  assert.equal((await ok<{ added: number }>(me, 'POST', 'marks', batch(['problem:lc-1']))).added, 0, 'idempotent');
  const done = async (p = me) =>
    (await ok<Marks>(p, 'GET', 'marks?mark=done')).items.map((i) => i.target).sort();
  assert.deepEqual(await done(), ['problem:lc-1', 'problem:lc-11']);
  assert.deepEqual(await done(other), []);
  // One bad entry refuses the whole batch.
  for (const body of [
    batch([]),
    batch(Array.from({ length: 501 }, (_, i) => `problem:lc-${i + 1}`)),
    batch(['problem:lc-3', 'content:x/y']),
    batch(['problem:lc-3'], { mark: 'star' }),
    batch(['problem:lc-3'], { on: true }),
  ])
    assert.equal(await status(me, 'POST', 'marks', body), 400);
  assert.equal(await status(null, 'POST', 'marks', batch(['problem:lc-3'])), 401);
  assert.deepEqual(await done(), ['problem:lc-1', 'problem:lc-11']);
  // A batch that would pass the per-learner cap adds nothing.
  const full: Person = { ...me, id: 'practice-full' };
  const insert = sqlite().prepare("INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'star',1)");
  sqlite().transaction(() => {
    for (let i = 0; i < 4999; i++) insert.run(full.id, `problem:x-${i}`);
  })();
  assert.equal(await status(full, 'POST', 'marks', batch(['problem:lc-1', 'problem:lc-2'])), 409);
  assert.deepEqual(await done(full), []);
  assert.equal((await ok<{ added: number }>(full, 'POST', 'marks', batch(['problem:lc-1']))).added, 1);
  // At the cap, ticks already there still merge.
  assert.equal((await ok<{ added: number }>(full, 'POST', 'marks', batch(['problem:lc-1']))).added, 0);
  assert.equal(await status(full, 'POST', 'marks', batch(['problem:lc-1', 'problem:lc-2'])), 409);
  // The classic list view carries the ticks.
  const { listClassicLibrary } = await import('../lib/server/study-library');
  const { classicList } = await import('../lib/classic-lists');
  const items = (p: Person) =>
    listClassicLibrary(classicList('blind-75')!, p.id).groups.flatMap((g) => g.items);
  const ticked = (p: Person) => items(p).flatMap((item) => (item.done ? [item.number] : []));
  assert.deepEqual(ticked(me).sort((a, b) => a! - b!), [1, 11]);
  assert.deepEqual(ticked(other), []);
  assert.ok(items(me).every((item) => typeof item.done === 'boolean'));
});

void test('reviews climb the 3/7/21/60-day ladder by distinct AC days', () => {
  assert.deepEqual(REVIEW_LADDER, [3, 7, 21, 60]);
  const noon = new Date(2026, 9, 1, 12).getTime();
  const day = (d: number, h = 12) => new Date(2026, 9, 1 + d, h).getTime();
  const item = (problemId: string, acAt: number[], failuresBeforeAc = 0, help: History['help'] = 'none'): History => ({
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
    help,
    solveSeconds: null,
    whiteboard: null,
    brute: false,
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
  // A solve with help comes back after a day first and takes one review more to master.
  const helped = [item('hinted', [noon], 0, 'hint'), item('read', [noon, day(1)], 0, 'solution')];
  assert.deepEqual(dueReviews(helped, day(1)).map((r) => [r.item.problemId, r.level, r.steps]), [['hinted', 1, 5]]);
  assert.deepEqual(dueReviews(helped, day(4)).map((r) => [r.item.problemId, r.level, r.steps]), [['hinted', 1, 5], ['read', 2, 5]]);
  assert.equal(dueReviews(history, day(3))[0].steps, 4);
  const days = (n: number) => Array.from({ length: n }, (_, i) => day(i));
  assert.deepEqual(dueReviews([item('h5', days(5), 0, 'hint')], day(400)).map((r) => r.level), [5]);
  assert.deepEqual(dueReviews([item('h6', days(6), 0, 'hint')], day(400)), []);
  assert.deepEqual(
    wrongBook([item('a', []), item('b', [noon], 2), item('c', [noon], 1)]).map((i) => i.problemId),
    ['a', 'b'],
  );
});

void test('solve quality: independent and first-try rates, median first-solve time per difficulty', () => {
  const solved = (problemId: string, extra: Partial<History>): History => ({
    problemId,
    attempts: 1,
    firstAt: t0,
    lastAt: t0,
    firstAcAt: t0,
    failuresBeforeAc: 0,
    lastStatus: 'accepted',
    languages: ['python'],
    acAt: [t0],
    stop: null,
    help: 'none',
    solveSeconds: null,
    whiteboard: null,
    brute: false,
    ...extra,
  });
  const levels: Record<string, string> = { a: '简单', b: '简单', c: '简单', d: '中等', e: '中等', f: '困难', x: '困难' };
  const q = solveQuality(
    [
      solved('a', { solveSeconds: 600 }),
      solved('b', { solveSeconds: 1200, help: 'hint', failuresBeforeAc: 2 }),
      solved('c', { solveSeconds: 300 }),
      solved('d', { solveSeconds: 1000, help: 'solution' }),
      solved('e', { solveSeconds: 2001 }),
      solved('f', {}), // Untimed: no Hard median.
      { ...solved('x', { help: 'hint', failuresBeforeAc: 3 }), firstAcAt: null, acAt: [] }, // Unsolved: not counted.
    ],
    (id) => levels[id],
  );
  assert.deepEqual(q, {
    solved: 6,
    independent: 4,
    firstTry: 5,
    wbTried: 0,
    wbPassed: 0,
    brute: 0,
    medians: [
      { difficulty: '简单', seconds: 600, budget: 900, count: 3 },
      { difficulty: '中等', seconds: 1501, budget: 1500, count: 2 },
    ],
  });
});

void test('aids: hints and first-AC time from the client, help derived against the first AC', async () => {
  sqlite()
    .prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('lc-9','c','l','v-9',1,1,1)`,
    )
    .run();
  const post = (body: unknown, p: Person | null = me, id = 'lc-9') => status(p, 'POST', `problems/${id}/aids`, body);
  assert.equal(await post({ kind: 'hint' }, null), 401);
  // Only hint and time, time in whole seconds within the timer's cap, nothing else in the body.
  for (const body of [
    { kind: 'ai' },
    { kind: 'editorial' },
    { kind: 'nope' },
    { kind: 'time' },
    { kind: 'time', seconds: 0 },
    { kind: 'time', seconds: 21601 },
    { kind: 'time', seconds: 1.5 },
    { kind: 'time', seconds: '60' },
    { kind: 'hint', seconds: 5 },
  ])
    assert.equal(await post(body), 400, JSON.stringify(body));
  assert.equal(await post({ kind: 'hint' }, me, 'lc-nope'), 404, 'only a published problem');
  type Recorded = { recorded: boolean };
  const aid = (body: unknown) => ok<Recorded>(me, 'POST', 'problems/lc-9/aids', body);
  assert.deepEqual(await aid({ kind: 'hint' }), { recorded: true });
  assert.deepEqual(await aid({ kind: 'hint' }), { recorded: false }, 'the first time only');
  assert.deepEqual(await aid({ kind: 'time', seconds: 600 }), { recorded: false }, 'no AC yet');
  const later = Date.now() + 60_000;
  submit(me.id, 'lc-9', 'accepted', later);
  assert.deepEqual(await aid({ kind: 'time', seconds: 21600 }), { recorded: true });
  assert.deepEqual(await aid({ kind: 'time', seconds: 60 }), { recorded: false });
  type Items = { items: History[] };
  const find = async (id: string) => (await ok<Items>(me, 'GET', 'history')).items.find((i) => i.problemId === id)!;
  assert.deepEqual([(await find('lc-9')).help, (await find('lc-9')).solveSeconds], ['hint', 21600]);
  // The AI or the editorial before the first AC outranks a hint.
  sqlite().prepare("INSERT INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES(?,'lc-9','ai',0,?)").run(me.id, later - 1);
  assert.equal((await find('lc-9')).help, 'solution');
  // After the first AC help is inert, and a review's AC never sends a time.
  assert.equal(recordAid(me.id, 'lc-1', 'editorial'), true);
  assert.equal(recordAid(me.id, 'lc-1', 'editorial'), false);
  assert.equal((await find('lc-1')).help, 'none');
  submit(me.id, 'lc-10', 'accepted', Date.now() - 1000);
  submit(me.id, 'lc-10', 'accepted', Date.now());
  assert.deepEqual(await ok(me, 'POST', 'problems/lc-10/aids', { kind: 'time', seconds: 60 }), { recorded: false });
  assert.equal((await find('lc-10')).solveSeconds, null);
  // Still unsolved: any help so far counts. Nobody else's record leaks.
  assert.equal(recordAid(me.id, 'oa-acme-1', 'editorial'), true);
  assert.equal((await find('oa-acme-1')).help, 'solution');
  assert.equal((await ok<Items>(other, 'GET', 'history')).items[0].help, 'none');
});

void test('grades: only a review AC of your own, graded again in place, never help, in the history', async () => {
  const { randomUUID } = await import('node:crypto');
  // The aids test above spent most of this minute's practice-aids-write budget.
  sqlite().prepare('DELETE FROM limits').run();
  const graded = (user: string, problem: string, state: string, at: number) => {
    const id = randomUUID();
    sqlite()
      .prepare(
        `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,created_at,updated_at)
        VALUES(?,?,?,'python','',?,1,'judge',?,?)`,
      )
      .run(id, user, problem, state, at, at);
    return id;
  };
  const first = graded(me.id, 'lc-11', 'accepted', t0);
  const failed = graded(me.id, 'lc-11', 'wrong_answer', t0 + 3 * DAY);
  const review = graded(me.id, 'lc-11', 'accepted', t0 + 3 * DAY + 1);
  graded(other.id, 'lc-11', 'accepted', t0);
  const theirs = graded(other.id, 'lc-11', 'accepted', t0 + 3 * DAY);
  const grade = (submissionId: string, value: unknown = 2, id = 'lc-11') =>
    status(me, 'POST', `problems/${id}/aids`, { kind: 'grade', grade: value, submissionId });
  assert.equal(await status(null, 'POST', 'problems/lc-11/aids', { kind: 'grade', grade: 3, submissionId: review }), 401);
  assert.equal(await grade(theirs), 404, "someone else's submission");
  assert.equal(await grade(failed), 404, 'not accepted');
  assert.equal(await grade(first), 404, 'the first AC is no review');
  assert.equal(await grade(review, 2, 'lc-1'), 404, 'another problem');
  assert.equal(await grade(randomUUID()), 404);
  for (const value of [0, 5, 2.5, '3']) assert.equal(await grade(review, value), 400, String(value));
  assert.equal(await status(me, 'POST', 'problems/lc-11/aids', { kind: 'grade', grade: 3, submissionId: 's1' }), 400);
  assert.equal(
    await status(me, 'POST', 'problems/lc-11/aids', { kind: 'grade', grade: 3, submissionId: review, extra: 1 }),
    400,
  );
  assert.deepEqual(await ok(me, 'POST', 'problems/lc-11/aids', { kind: 'grade', grade: 1, submissionId: review }), { recorded: true });
  assert.deepEqual(await ok(me, 'POST', 'problems/lc-11/aids', { kind: 'grade', grade: 4, submissionId: review }), { recorded: true });
  assert.deepEqual(
    sqlite().prepare("SELECT kind,value FROM practice_aids WHERE user_id=? AND problem_id='lc-11'").all(me.id),
    [{ kind: `grade:${review}`, value: 4 }],
    'graded again in place',
  );
  const items = (await ok<{ items: History[] }>(me, 'GET', 'history')).items;
  const lc11 = items.find((i) => i.problemId === 'lc-11')!;
  assert.deepEqual(lc11.grades, [[t0 + 3 * DAY + 1, 4]]);
  assert.equal(lc11.help, 'none', 'a grade is no help');
  assert.equal(items.find((i) => i.problemId === 'lc-1')!.grades, undefined);
  assert.equal((await ok<{ items: History[] }>(other, 'GET', 'history')).items.find((i) => i.problemId === 'lc-11')!.grades, undefined);
});
