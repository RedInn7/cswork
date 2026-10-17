import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-mock-oa-plus-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { mockPeers, mockReport } = await import('../lib/server/mock-oa');
const { onTopics, PEER_MIN } = await import('../lib/mock-oa');
const { ojImportSchema } = await import('../lib/oj-types');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const DAY = 86400000;
let n = 0;
function mock(
  user: string,
  score: number,
  extra: { company?: string | null; preset?: number; source?: string; ids?: string[]; at?: number; scoring?: string } = {},
) {
  const at = extra.at ?? Date.now() - DAY;
  sqlite()
    .prepare(
      `INSERT INTO mock_sessions(id,user_id,company,name,platform,preset,scoring,source,set_hash,ids_json,slots_json,minutes,skew,
        created_at,started_at,finished_at,reason,score,max,solved,estimate,updated_at)
      VALUES(?,?,?,NULL,NULL,?,?,?,'h',?,'[]',60,0,?,?,?,'manual',?,200,0,0,?)`,
    )
    .run(
      `m${n++}`,
      user,
      extra.company ?? null,
      extra.preset ?? 0,
      extra.scoring ?? 'tests',
      extra.source ?? 'mixed',
      JSON.stringify(extra.ids ?? ['lc-1', 'lc-2']),
      at,
      at,
      at,
      score,
      at,
    );
}

void test('a custom mock on chosen topics draws only from problems on one of them', () => {
  const pool = [
    { id: 'a', difficulty: 'easy' as const, loose: false, topics: ['dp-grid', 'binary-search'] },
    { id: 'b', difficulty: 'easy' as const, loose: false, topics: ['graph-topological'] },
    { id: 'c', difficulty: 'easy' as const, loose: true },
  ];
  assert.deepEqual(onTopics(pool, ['binary-search']).map((p) => p.id), ['a']);
  assert.deepEqual(onTopics(pool, ['graph-topological', 'dp-grid']).map((p) => p.id), ['a', 'b']);
  assert.equal(onTopics(pool).length, 3);
});

void test('percentiles compare each learner once, at their best, within the scenario and 180 days', async () => {
  const preset = { company: 'acme', preset: true, source: 'mixed' as const, questions: 2 };
  // Under PEER_MIN learners: no percentile at all.
  for (let i = 0; i < PEER_MIN - 1; i++) mock(`u${i}`, i * 10, { company: 'acme', preset: 1 });
  assert.equal(await mockPeers('me', preset, 0.5), null);
  // A second, better try of the same learner replaces the first.
  mock('u0', 190, { company: 'acme', preset: 1 });
  // Not the same scenario, too old, unscored, or my own: none of these count.
  mock('other-co', 50, { company: 'other', preset: 1 });
  mock('old', 50, { company: 'acme', preset: 1, at: Date.now() - 200 * DAY });
  mock('me', 10, { company: 'acme', preset: 1 });
  mock('pending', 50, { company: 'acme', preset: 1 });
  sqlite().prepare("UPDATE mock_sessions SET score=NULL WHERE user_id='pending'").run();
  assert.equal(await mockPeers('me', preset, 0.5), null);
  mock(`u${PEER_MIN - 1}`, 0, { company: 'acme', preset: 1 });
  // Scores 0,0(u19),10..180 out of 200, u0 at its best 190: below half are u1..u9 and u19.
  assert.deepEqual(await mockPeers('me', preset, 0.5), { n: PEER_MIN, below: 10 });
  // A custom mock with a company has no comparison.
  assert.equal(await mockPeers('me', { ...preset, preset: false }, 0.5), null);
  // Custom mocks compare by count and source, without a company.
  for (let i = 0; i < PEER_MIN; i++) mock(`c${i}`, 100, { source: 'oa', ids: ['oa-a-1', 'oa-a-2', 'oa-a-3'] });
  const custom = { company: null, preset: false, source: 'oa' as const, questions: 3 };
  assert.deepEqual(await mockPeers('me', custom, 0.6), { n: PEER_MIN, below: PEER_MIN });
  assert.equal(await mockPeers('me', { ...custom, questions: 2 }, 0.6), null);
  assert.equal(await mockPeers('me', { ...custom, source: 'lc' }, 0.6), null);
  // Single-submit mocks (first submissions only) have their own pool.
  assert.equal(await mockPeers('me', { ...custom, scoring: 'codility' }, 0.6), null);
  for (let i = 0; i < PEER_MIN; i++) mock(`s${i}`, 160, { source: 'oa', ids: ['oa-a-1', 'oa-a-2', 'oa-a-3'], scoring: 'codility' });
  assert.deepEqual(await mockPeers('me', { ...custom, scoring: 'codility' }, 0.6), { n: PEER_MIN, below: 0 });
  assert.deepEqual(await mockPeers('me', custom, 0.6), { n: PEER_MIN, below: PEER_MIN }, 'the standard pool is unchanged');
  // The report asks with its scenario; without one (the history upload's rescoring) it compares nothing.
  const person = { id: 'me', name: 'Me', email: 'me@example.test', role: 'student' as const, verified: true };
  const window = { ids: 'lc-1,lc-2', from: String(Date.now() - 3600_000), to: String(Date.now()), slots: 'easy,hard' };
  const report = await mockReport(person, new URLSearchParams({ ...window, preset: '1', company: 'acme', source: 'mixed' }));
  assert.deepEqual(report.peers, { n: PEER_MIN, below: 0 });
  assert.equal((await mockReport(person, new URLSearchParams(window))).peers, null);
  assert.equal((await mockReport(person, new URLSearchParams({ ...window, preset: '1', company: 'ACME!', source: 'mixed' }))).peers, null);
});

void test('the report scores a question by weight only when its submission ran every case', async () => {
  const person = { id: 'weighted', name: 'W', email: 'w@example.test', role: 'student' as const, verified: true };
  const at = Date.now() - 600_000;
  const insert = sqlite().prepare(
    "INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,score,all_cases,mode,created_at,updated_at) VALUES(?,?,?,'python','x',?,?,10,?,?,'judge',?,?)",
  );
  // An older row's score stopped at its first failure: passed / total still counts, not its 90.
  insert.run('old', person.id, 'lc-1', 'wrong_answer', 3, 90, 0, at, at);
  // A run over every case: 9 of 10 passed, but the failed case carried most of the weight.
  insert.run('all', person.id, 'lc-2', 'time_limit', 9, 40, 1, at, at);
  const report = await mockReport(
    person,
    new URLSearchParams({ ids: 'lc-1,lc-2', from: String(at - 1000), to: String(Date.now()), slots: 'easy,hard' }),
  );
  assert.deepEqual(report.score.per, [30, 40]);
  assert.deepEqual(
    report.items.map((i) => [i.best?.id, i.best?.score, i.groups]),
    [
      ['old', undefined, undefined],
      // lc-2 has no judge version here, so there are no groups to show.
      ['all', 40, undefined],
    ],
  );
});

void test('a problem may give some languages their own time limit, within the same bounds', () => {
  const pkg = (timeLimits?: unknown) => ({
    schemaVersion: 1,
    problem: {
      id: 'tl-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Sum',
      difficulty: '简单',
      tags: ['math'],
      description: 'Add.',
      input: 'Two numbers.',
      output: 'Their sum.',
      explanation: '',
      hints: [],
      timeLimit: 1,
      ...(timeLimits === undefined ? {} : { timeLimits }),
      memoryLimit: 65536,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python', 'cpp'],
    },
    cases: [
      { name: '1', input: '1 2\n', expectedOutput: '3\n', hidden: false, weight: 1 },
      { name: '2', input: '2 2\n', expectedOutput: '4\n', hidden: true, weight: 1 },
    ],
  });
  assert.equal(ojImportSchema.safeParse(pkg()).success, true);
  const parsed = ojImportSchema.safeParse(pkg({ python: 3 }));
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data?.problem.timeLimits, { python: 3 });
  assert.equal(ojImportSchema.safeParse(pkg({ rust: 3 })).success, false);
  assert.equal(ojImportSchema.safeParse(pkg({ python: 20 })).success, false);
});

void test('a single-submit report scores each question by its first submission only', async () => {
  const person = { id: 'single', name: 'S', email: 's@example.test', role: 'student' as const, verified: true };
  const at = Date.now() - 600_000;
  const insert = sqlite().prepare(
    "INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,score,all_cases,mode,created_at,updated_at) VALUES(?,?,?,'python','x',?,?,10,?,1,'judge',?,?)",
  );
  insert.run('s-err', person.id, 'lc-1', 'system_error', 0, 0, at, at);
  insert.run('s-first', person.id, 'lc-1', 'wrong_answer', 5, 50, at + 1, at + 1);
  insert.run('s-again', person.id, 'lc-1', 'accepted', 10, 100, at + 2, at + 2);
  const query = { ids: 'lc-1', from: String(at - 1000), to: String(Date.now()), slots: 'medium' };
  const report = await mockReport(person, new URLSearchParams({ ...query, scoring: 'codility' }));
  assert.deepEqual([report.scoring, report.items[0].best?.id, report.items[0].attempts, report.score.per], ['codility', 's-first', 3, [50]]);
  assert.deepEqual((await mockReport(person, new URLSearchParams(query))).score.per, [100]);
});
