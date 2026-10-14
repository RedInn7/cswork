import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';
import { hintsUnlocked, HINT_WAIT_SECONDS } from '../lib/oj-client';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-hints-similar-test-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { ensurePracticeRound } = await import('../lib/server/practice-rounds');
const { handleOj } = await import('../lib/server/oj-api');
const { pickSimilarLc, pickSimilarOa } = await import('../lib/server/study-library');

const student: Person = {
  id: 'hint-student',
  name: 'Student',
  email: 'hint@example.test',
  role: 'student',
  verified: true,
};
const teacher: Person = { ...student, id: 'hint-teacher', role: 'teacher' };

void test('hint 1 is open; hint 2 after a failure or 10 minutes; hint 3 after two failures', () => {
  assert.equal(hintsUnlocked(0, 0), 1);
  assert.equal(hintsUnlocked(0, HINT_WAIT_SECONDS - 1), 1);
  assert.equal(hintsUnlocked(0, HINT_WAIT_SECONDS), 2);
  assert.equal(hintsUnlocked(1, 0), 2);
  // Time alone never opens the last hint.
  assert.equal(hintsUnlocked(1, 99_999), 2);
  assert.equal(hintsUnlocked(2, 0), 3);
  assert.equal(hintsUnlocked(5, 0), 3);
});

void test('LC: the 4 nearest stop-mates in curated order, then 2 asked by the same companies', () => {
  const companies: Record<number, string[]> = {
    1: ['amazon'],
    26: ['amazon', 'meta'],
    454: ['amazon'],
    88: ['meta'],
  };
  const of = (n: number) => companies[n] ?? [];
  // lc-1 opens the hash-counting stop: 49, 128, 219, 220, 454, ... follow it.
  assert.deepEqual(pickSimilarLc(1, [1, 49, 128, 219, 220, 454, 26, 88], of), [
    49, 128, 219, 220, 26, 454,
  ]);
  // From the middle, neighbours on both sides by distance, ties to the earlier one.
  assert.deepEqual(pickSimilarLc(220, [1, 49, 128, 219, 454, 409, 187], () => []), [
    128, 219, 454, 409,
  ]);
  // Only judgeable problems are offered; nothing shared means no company picks.
  assert.deepEqual(pickSimilarLc(1, [1, 26], () => []), []);
  // Off Line 500: company picks only.
  assert.deepEqual(pickSimilarLc(999_999, [26, 88], (n) => (n === 999_999 ? ['meta'] : of(n))), [
    26, 88,
  ]);
});

void test('OA: same-company problems sharing a topic first, then the next ones in order', () => {
  const ids = ['oa-x-1', 'oa-x-2', 'oa-x-3', 'oa-x-4', 'oa-x-5'];
  const topics: Record<string, string[]> = {
    'oa-x-1': ['b'],
    'oa-x-2': ['a', 'b'],
    'oa-x-3': ['a', 'b'],
    'oa-x-5': ['c'],
  };
  const of = (id: string) => topics[id] ?? [];
  assert.deepEqual(pickSimilarOa('oa-x-3', ids, of), ['oa-x-2', 'oa-x-1', 'oa-x-4', 'oa-x-5']);
  assert.deepEqual(pickSimilarOa('oa-x-3', ids, of, 3), ['oa-x-2', 'oa-x-1', 'oa-x-4']);
  // No topics: simply the problems after it, wrapping round.
  assert.deepEqual(pickSimilarOa('oa-x-4', ids, () => []), ['oa-x-5', 'oa-x-1', 'oa-x-2', 'oa-x-3']);
  assert.deepEqual(pickSimilarOa('oa-x-1', ['oa-x-1'], of), []);
});

function packageFor(id: string): OjProblemPackage {
  return {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: `Fixture ${id}`,
      difficulty: '简单',
      tags: ['test'],
      description: 'Print one.',
      input: 'No input.',
      output: 'One integer.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      { name: 'sample', input: '', expectedOutput: '1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: '', expectedOutput: '1\n', hidden: true, weight: 1 },
    ],
  };
}
before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)",
  ).run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO grants(id,email,course_id,source,created_at) VALUES('hint-grant',?,'gomall','test',0)",
  ).run(student.email);
  const row = db.prepare(
    "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES(?,?,?,?,?,?,'[]','{}','source',1,1,?,?,0)",
  );
  // lc-1's stop-mates 49 and 128; 238 shares Amazon and Meta; 27 (another stop) and 999901 (off the line) share nothing.
  for (const [n, difficulty] of [
    [1, 'Easy'],
    [49, 'Medium'],
    [128, '中等'],
    [238, '中等'],
    [27, '简单'],
    [999901, '简单'],
  ] as const) {
    const id = `lc-${n}`;
    const saved = await saveProblemDraft(teacher, packageFor(id), null);
    await publishProblemDraft(teacher, id, saved.draft!.revision);
    const { version } = db
      .prepare('SELECT current_version_id AS version FROM oj_problems WHERE id=?')
      .get(id) as { version: string };
    row.run(id, n, `slug-${n}`, `题${n}`, `Problem ${n}`, difficulty, id, `source:${version}`);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('GET problems/:id serves the three hints, the round failure count and similar problems', async () => {
  const round = ensurePracticeRound(student.id);
  let at = 0;
  const add = (problem: string, status: string, mode = 'judge', roundId: string | null = round) =>
    sqlite()
      .prepare(
        `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id) VALUES(?,?,?,'python','',?,1,?,?,?,?)`,
      )
      .run(`s-${++at}`, student.id, problem, status, at, at, mode, roundId);
  const get = async (id: string) =>
    (await handleOj(new Request(`https://cswork.test/api/oj/problems/${id}`), student, ['problems', id])).json();

  let body = await get('lc-1');
  assert.equal(body.lingHints.zh.length, 3);
  assert.equal(body.lingHints.en.length, 3);
  // The statement's own hints field is left alone.
  assert.deepEqual(body.hints, []);
  assert.equal(body.failedSubmissions, 0);
  assert.equal(body.hintEarned, false);
  // Neighbours in the stop first, then a company pick; lc-27 is not related.
  assert.deepEqual(
    body.similar.map((s: { id: string }) => s.id),
    ['lc-49', 'lc-128', 'lc-238'],
  );
  assert.deepEqual(Object.keys(body.similar[0]).sort(), ['difficulty', 'id', 'solved', 'title', 'titleEn']);
  assert.deepEqual(
    body.similar.map((s: { difficulty: string }) => s.difficulty),
    ['中等', '中等', '中等'],
  );
  assert.equal(body.similar.some((s: { solved: boolean }) => s.solved), false);

  // Runs, judge outages and other rounds do not count; two failures are the cap.
  add('lc-1', 'wrong_answer', 'run');
  add('lc-1', 'system_error');
  add('lc-1', 'wrong_answer', 'judge', null);
  add('lc-49', 'accepted');
  add('lc-1', 'time_limit');
  body = await get('lc-1');
  assert.equal(body.failedSubmissions, 1);
  assert.equal(body.hintEarned, true);
  assert.equal(body.similar.find((s: { id: string }) => s.id === 'lc-49').solved, true);
  add('lc-1', 'wrong_answer');
  add('lc-1', 'runtime_error');
  body = await get('lc-1');
  assert.equal(body.failedSubmissions, 2);

  // Off Line 500 there is nothing to hint.
  body = await get('lc-999901');
  assert.equal(body.lingHints, null);
  assert.equal(body.failedSubmissions, 0);
});
