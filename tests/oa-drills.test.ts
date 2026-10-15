import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';
import { bugLines, buildDrills, drillsFor } from '../scripts/oa-judge/build-drills.mjs';
import { changedLines, scoreReview } from '../lib/oa-drills';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-oa-drills-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
// Rows and outbox entries only: no worker, runner or Redis is contacted.
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
process.env.GO_JUDGE_TOKEN = 'fixture';
process.env.REDIS_URL = 'redis://127.0.0.1:6381';
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { createSubmission, cancelSubmission, formalMode } = await import('../lib/server/oj-submissions');
const { handleOj } = await import('../lib/server/oj-api');
const { oaDrillIndex } = await import('../lib/server/oa-library');
const { awardAccepted } = await import('../lib/server/points');

const me: Person = { id: 'drill-me', name: 'Me', email: 'drill@example.test', role: 'student', verified: true };
const teacher: Person = { ...me, id: 'drill-teacher', role: 'teacher' };

function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const enterContest = (problem: string) => {
  const room = randomUUID();
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES(?,NULL,'room','custom',?,?,60,'private',0)`,
    )
    .run(room, JSON.stringify([problem]), Date.now() - 1000);
  sqlite()
    .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,0,NULL)')
    .run(room, me.id, me.id);
  return () => sqlite().prepare('DELETE FROM contest_entries WHERE room_id=?').run(room);
};

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  const fixture: OjProblemPackage = {
    schemaVersion: 1,
    problem: {
      id: 'lc-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Two Sum',
      difficulty: '简单',
      tags: ['test'],
      description: 'Two Sum.',
      input: 'n, nums, target.',
      output: 'Two indices.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python', 'cpp'],
    },
    cases: [
      { name: 'sample', input: '4 2 7 11 15 9\n', expectedOutput: '0 1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: '2 3 3 6\n', expectedOutput: '0 1\n', hidden: true, weight: 1 },
    ],
  };
  const saved = await saveProblemDraft(teacher, fixture, null);
  await publishProblemDraft(teacher, 'lc-1', saved.draft!.revision);
  // A library problem: open to every learner.
  const version = (db.prepare("SELECT current_version_id AS id FROM oj_problems WHERE id='lc-1'").get() as { id: string }).id;
  db.prepare(
    "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','source',1,1,'lc-1',?,0)",
  ).run(`source:${version}`);
  // The first problem with live drills, published from its checked-in package.
  const oa = JSON.parse(readFileSync(`content/oa-judge/packages/${[...oaDrillIndex().keys()][0]}.json`, 'utf8')) as OjProblemPackage;
  await publishProblemDraft(teacher, oa.problem.id, (await saveProblemDraft(teacher, oa, null)).draft!.revision);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a drill is a mutant one to three lines off the reference, trailing whitespace ignored', () => {
  const ref = 'a=1\nb=2\nc=3\nd=4\nprint(a)\n';
  assert.deepEqual(bugLines(ref, 'a=1  \nb=2\nc=3\nd=4\nprint(a)'), []);
  assert.deepEqual(bugLines(ref, 'a=1\nb=0\nc=3\nd=4\nprint(b)\n'), [2, 5]);
  assert.equal(bugLines(ref, 'a=1\nprint(a)\n'), null, 'a different line count is no drill');
  const drills = drillsFor(
    ref,
    [
      { name: '同一份', code: ref },
      { name: '改一行', code: ref.replace('b=2', 'b=0') },
      { name: '改一行', code: ref.replace('b=2', 'b=0') },
      { name: '改四行', code: 'x\ny\nz\nw\nprint(a)\n' },
      { name: 'C++', code: ref.replace('b=2', 'b=9'), language: 'cpp' },
      { name: '改三行', code: 'a=0\nb=0\nc=0\nd=4\nprint(a)\n' },
    ],
    { 改一行: 'One line changed' },
  ) as { n: number; bugLines: number[]; budget: number; nameZh: string; nameEn?: string }[];
  assert.deepEqual(
    drills.map(({ n, bugLines, budget, nameZh, nameEn }) => ({ n, bugLines, budget, nameZh, nameEn })),
    [
      { n: 1, bugLines: [2], budget: 2, nameZh: '改一行', nameEn: 'One line changed' },
      { n: 5, bugLines: [1, 2, 3], budget: 4, nameZh: '改三行', nameEn: undefined },
    ],
    'unchanged, duplicate, over-three-line and non-Python mutants are dropped; n is the mutant index',
  );
});

void test('the checked-in drills.json is what build-drills.mjs builds', () => {
  const built = buildDrills();
  assert.deepEqual(
    JSON.parse(readFileSync('content/oa-judge/drills.json', 'utf8')),
    built,
    'content/oa-judge/drills.json is stale: run node scripts/oa-judge/build-drills.mjs',
  );
  const all = Object.values(built.problems as Record<string, { drills: { budget: number; bugLines: number[] }[] }>).flatMap(
    (p) => p.drills,
  );
  assert(all.length > 1500, `${all.length} drills`);
  for (const drill of all) assert.equal(drill.budget, drill.bugLines.length + 1);
});

void test('changed lines count an edit once, whether a line is replaced, inserted or deleted', () => {
  const code = 'a\nb\nc\nd\ne';
  assert.equal(changedLines(code, code + '\n  \n'), 0);
  assert.equal(changedLines(code, 'a\nB\nc\nd\ne'), 1);
  assert.equal(changedLines(code, 'a\nb\nx\nc\nd\ne'), 1, 'an insertion does not shift every later line');
  assert.equal(changedLines(code, 'a\nc\nd\ne'), 1);
  assert.equal(changedLines(code, 'A\nb\nc\nd\nE'), 2);
  assert.deepEqual(scoreReview([2, 5], [5, 1, 7]), { hits: [5], missed: [2], falsePositives: [1, 7] });
});

void test('drills and reviews need an account and their own method; the code never names the bug', async () => {
  const [id, drills] = [...oaDrillIndex()][0];
  assert.equal(await status(null, 'GET', `oa-library/${id}/drill`), 401);
  assert.equal(await status(null, 'POST', `oa-library/${id}/review`, { n: drills[0], lines: [1] }), 401);
  assert.equal(await status(me, 'POST', `oa-library/${id}/drill`, {}), 404);
  assert.equal(await status(me, 'GET', `oa-library/${id}/review`), 404);
  assert.equal(await status(me, 'GET', 'oa-library/oa-nope-1/drill'), 404);
  const { items } = (await (await call(me, 'GET', `oa-library/${id}/drill`)).json()) as { items: Record<string, unknown>[] };
  assert.deepEqual(items.map((item) => item.n), drills);
  for (const item of items) assert.deepEqual(Object.keys(item).sort(), ['budget', 'code', 'n']);
  const stored = (JSON.parse(readFileSync('content/oa-judge/drills.json', 'utf8')) as {
    problems: Record<string, { drills: { n: number; bugLines: number[]; nameZh: string }[] }>;
  }).problems[id].drills[0];
  const wrong = [1, 2, 3, 4].find((line) => !stored.bugLines.includes(line))!;
  const review = (await (
    await call(me, 'POST', `oa-library/${id}/review`, { n: stored.n, lines: [stored.bugLines[0], wrong] })
  ).json()) as { hits: number[]; missed: number[]; falsePositives: number[]; bugLines: number[]; nameZh: string };
  assert.deepEqual(review.hits, [stored.bugLines[0]]);
  assert.deepEqual(review.missed, stored.bugLines.slice(1));
  assert.deepEqual(review.falsePositives, [wrong]);
  assert.deepEqual(review.bugLines, stored.bugLines);
  assert.equal(review.nameZh, stored.nameZh);
  assert.equal(await status(me, 'POST', `oa-library/${id}/review`, { n: 99999, lines: [] }), 404);
  assert.equal(await status(me, 'POST', `oa-library/${id}/review`, { n: stored.n, lines: ['1'] }), 400);
});

void test('a drill submission is judged on every case but unlisted, pointless and never solved', async () => {
  const submit = (body: Record<string, unknown>) =>
    createSubmission(me, { problemId: 'lc-1', language: 'python', code: 'print(0, 1)', idempotencyKey: randomUUID(), ...body });
  await assert.rejects(submit({ mode: 'drill', stdin: '1' }), (e: { status?: number }) => e.status === 400);
  const drill = await submit({ mode: 'drill' });
  const row = sqlite().prepare('SELECT * FROM submissions WHERE id=?').get(drill.id) as {
    mode: string;
    total: number;
    practice_round_id: string | null;
    user_id: string;
    problem_id: string;
    created_at: number;
  };
  assert.equal(row.mode, 'drill');
  assert.equal(row.total, 2, 'hidden cases count, like a formal submission');
  assert.equal(formalMode(row.mode), true);
  assert.equal(await awardAccepted({ ...row, id: drill.id, status: 'accepted' }), 0, 'no points');
  const history = (await (await call(me, 'GET', 'submissions?problemId=lc-1')).json()) as { items: unknown[] };
  assert.equal(history.items.length, 0, 'drills stay out of the submission list');
  await cancelSubmission(me, drill.id);
});

void test('a running contest closes the problem’s drills, reviews and drill submissions', async () => {
  const [id, drills] = [...oaDrillIndex()][0];
  const leave = enterContest(id);
  assert.equal(await status(me, 'GET', `oa-library/${id}/drill`), 403);
  assert.equal(await status(me, 'POST', `oa-library/${id}/review`, { n: drills[0], lines: [1] }), 403);
  const body = { problemId: id, language: 'python', code: 'print(1)', mode: 'drill', idempotencyKey: randomUUID() };
  assert.equal(await status(me, 'POST', 'submissions', body), 403);
  assert.equal(await status(me, 'POST', 'submissions', { ...body, mode: 'drill-run', idempotencyKey: randomUUID() }), 403);
  leave();
  assert.equal(await status(me, 'GET', `oa-library/${id}/drill`), 200);
  const created = (await (await call(me, 'POST', 'submissions', body)).json()) as { id: string; mode: string };
  assert.equal(created.mode, 'drill');
  await cancelSubmission(me, created.id);
});

void test('drill submissions and runs only on a problem with live drills; a drill run is an unlisted run', async () => {
  const [id] = [...oaDrillIndex()][0];
  const body = { language: 'python', code: 'print(1)', idempotencyKey: randomUUID() };
  // Any other problem: no unlisted judging of its hidden cases.
  assert.equal(await status(me, 'POST', 'submissions', { ...body, problemId: 'lc-1', mode: 'drill' }), 404);
  assert.equal(await status(me, 'POST', 'submissions', { ...body, problemId: 'lc-1', mode: 'drill-run' }), 404);
  const created = (await (
    await call(me, 'POST', 'submissions', { ...body, problemId: id, mode: 'drill-run', stdin: '1\n' })
  ).json()) as { id: string; mode: string; total: number };
  assert.equal(created.mode, 'run', 'the page shows it as a run');
  assert.equal(created.total, 1, 'custom input, like a run');
  const row = sqlite().prepare('SELECT mode FROM submissions WHERE id=?').get(created.id) as { mode: string };
  assert.equal(row.mode, 'drill-run');
  assert.equal(formalMode(row.mode), false);
  const history = (await (await call(me, 'GET', `submissions?problemId=${id}`)).json()) as { items: { id: string }[] };
  assert.ok(!history.items.some((item) => item.id === created.id), 'drill runs stay out of the submission list');
  await cancelSubmission(me, created.id);
});
