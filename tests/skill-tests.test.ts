// Skill certification: the server-drawn exam (never a solved problem), the 7-day cooldown, the
// contest gate during the exam, scoring on finish or deadline, and the certificates it issues;
// plus the self-paced course certificate issued when the last chapter is marked read.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import { archiveMock, mockClock, mockDeadline, questionStates, type MockSession } from '../lib/mock-oa';
import { skillScore, skillSession, skillTest } from '../lib/skill-tests';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-skill-tests-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { skillSources, startSkillTest, finishSkillTest, skillOverview } = await import('../lib/server/skill-tests');
const { inRunningContest, refuseInContest } = await import('../lib/server/contests');
const { certificateById, profileCertificates, SELF_PACED } = await import('../lib/server/certificates');

const MIN = 60000;
const DAY = 86400000;
const person = (id: string, verified = true): Person => ({ id, name: `Name ${id}`, email: `${id}@example.test`, role: 'student', verified });
const amy = person('s-amy');
const bob = person('s-bob');
const zoe = person('s-zoe');

const LINE = [
  ['lc-1', 'easy', 1200],
  ['lc-20', 'easy', 1300],
  ['lc-21', 'easy', 1350],
  ['lc-3', 'medium', 1500],
  ['lc-15', 'medium', 1550],
  ['lc-11', 'medium', 1700],
  ['lc-42', 'hard', 1900],
] as const;
skillSources.line500 = async () =>
  LINE.map(([id, difficulty, rating]) => ({ id, difficulty, loose: false, rating }));
skillSources.sql = () => [];

let n = 0;
function submit(user: string, problem: string, status: string, at: number, passed = 0, language = 'python') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,?,'',?,?,10,'judge',?,?)`,
    )
    .run(`sk${++n}`, user, problem, language, status, passed, at, at);
}
async function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const response = await handleOj(
    new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    }),
    p,
    url.pathname.split('/').slice(3),
  );
  return response.json();
}
const status = (promise: Promise<unknown>) =>
  promise.then(
    () => 200,
    (error: { status?: number }) => error.status ?? 500,
  );

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  for (const p of [amy, bob, zoe])
    db.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)').run(
      p.id,
      p.name,
      p.email,
    );
});
after(() => rmSync(dir, { recursive: true, force: true }));

void test('scoring: 70% overall and 40% on every question to pass', () => {
  const ac = { passed: 10, total: 10, accepted: true };
  const half = { passed: 5, total: 10, accepted: false };
  assert.deepEqual(skillScore([ac, half]), { per: [100, 50], score: 150, max: 200, passed: true });
  assert.equal(skillScore([ac, { passed: 3, total: 10, accepted: false }]).passed, false, 'one question under 40%');
  assert.equal(skillScore([half, half]).passed, false, '50% overall');
  assert.equal(skillScore([]).passed, false);
});

void test('a running attempt becomes the workspace exam session on the server clock, kept out of mock history', () => {
  const attempt = { id: 'x', test: 'python', ids: ['lc-1', 'lc-2'], language: 'python', startedAt: 1_000_000, deadline: 1_000_000 + 45 * MIN, finishedAt: null, score: null, max: null, passed: null };
  // This browser's clock runs 5 seconds behind the server's.
  const session = skillSession(attempt, skillTest('python')!, 1_060_000, 1_055_000, false);
  assert.deepEqual([session.name, session.platform, session.minutes, session.cert], ['Python', 'Python', 45, { test: 'python', language: 'python' }]);
  assert.equal(mockDeadline(session) + session.skew, attempt.deadline);
  assert.equal(mockClock(session, 1_055_000).phase, 'running');
  // The exam bar counts what the server scores: a C++ AC does not solve a question.
  const at = attempt.startedAt + MIN;
  assert.deepEqual(
    questionStates(session, [
      { problem_id: 'lc-1', status: 'accepted', created_at: at, language: 'cpp' },
      { problem_id: 'lc-2', status: 'accepted', created_at: at, language: 'python' },
    ]),
    ['todo', 'ac'],
  );
  const mock = { ...session, id: 'm', cert: undefined } as MockSession;
  const archived = archiveMock({ active: session, history: [mock] }, session);
  assert.deepEqual(archived, { active: null, history: [mock] });
  assert.deepEqual(archiveMock({ active: mock, history: [] }, mock).history, [mock]);
});

void test('the draw skips solved problems, stays in the band, and the exam gates its problems', async () => {
  const t0 = Date.UTC(2026, 9, 1);
  submit(amy.id, 'lc-1', 'accepted', t0 - DAY, 10);
  submit(amy.id, 'lc-3', 'accepted', t0 - DAY, 10);
  await assert.rejects(startSkillTest(person('s-new', false), skillTest('problem-solving-basic')!, t0), { status: 403 });
  const attempt = await startSkillTest(amy, skillTest('problem-solving-basic')!, t0);
  assert.equal(attempt.ids.length, 2);
  for (const id of attempt.ids) {
    assert.ok(!['lc-1', 'lc-3'].includes(id), `${id} was solved`);
    assert.ok(['lc-20', 'lc-21', 'lc-15'].includes(id), `${id} is outside the basic band`);
  }
  assert.equal(attempt.deadline, t0 + 60 * MIN);
  // A second exam while this one runs, and the same test again within 7 days, are refused.
  await assert.rejects(startSkillTest(amy, skillTest('sql')!, t0 + MIN), { status: 409 });
  // Every refuseInContest gate holds during the exam, for this learner only.
  assert.equal(inRunningContest(amy.id, attempt.ids[0], t0 + MIN), true);
  assert.equal(inRunningContest(bob.id, attempt.ids[0], t0 + MIN), false);
  assert.throws(() => refuseInContest(amy, attempt.ids[1], t0 + MIN), { status: 403 });
  assert.equal(inRunningContest(amy.id, attempt.ids[0], t0 + 61 * MIN), false, 'over at the deadline');
  const overview = skillOverview(amy, t0 + MIN);
  assert.equal(overview.running?.id, attempt.id);
  assert.equal(overview.nextAt['problem-solving-basic'], t0 + 7 * DAY);
  assert.equal(overview.nextAt.sql, null);

  // Hand in: AC on one, 5/10 on the other passes; a run before the start does not count.
  submit(amy.id, attempt.ids[0], 'wrong_answer', t0 - MIN, 9);
  submit(amy.id, attempt.ids[0], 'accepted', t0 + 10 * MIN, 10);
  submit(amy.id, attempt.ids[1], 'wrong_answer', t0 + 20 * MIN, 5);
  const done = finishSkillTest(amy, skillTest('problem-solving-basic')!, t0 + 30 * MIN);
  assert.deepEqual([done.score, done.max, done.passed, done.finishedAt], [150, 200, true, t0 + 30 * MIN]);
  assert.equal(inRunningContest(amy.id, attempt.ids[0], t0 + 31 * MIN), false, 'the gate lifts on hand-in');
  await assert.rejects(startSkillTest(amy, skillTest('problem-solving-basic')!, t0 + 6 * DAY), { status: 429 });

  // The certificate: a skill exam, titled from the test, no course row needed.
  const [cert] = skillOverview(amy, t0 + 31 * MIN).certificates;
  assert.equal(cert.courseId, 'skill:problem-solving-basic');
  assert.equal(cert.skill, true);
  const page = certificateById(cert.id, false);
  assert.equal(page?.course, 'Problem Solving (Basic)');
  assert.equal(page?.skill, true);
  assert.equal(certificateById(cert.id)?.course, '算法基础认证');
});

void test('python counts only Python; the deadline hands in; a judging verdict holds the score', async () => {
  const t0 = Date.UTC(2026, 9, 2);
  const attempt = await startSkillTest(bob, skillTest('python')!, t0);
  const [a, b] = attempt.ids;
  submit(bob.id, a, 'accepted', t0 + MIN, 10, 'cpp');
  submit(bob.id, b, 'accepted', t0 + 2 * MIN, 10);
  submit(bob.id, a, 'running', t0 + 44 * MIN, 0);
  // Past the deadline, the overview hands it in, but waits for the verdict still judging.
  let view = skillOverview(bob, t0 + 46 * MIN).attempts[0];
  assert.equal(view.score, null);
  assert.equal(view.finishedAt, t0 + 45 * MIN);
  sqlite().prepare("UPDATE submissions SET status='wrong_answer',passed=2 WHERE user_id=? AND status='running'").run(bob.id);
  view = skillOverview(bob, t0 + 47 * MIN).attempts[0];
  assert.deepEqual([view.score, view.passed], [120, false], 'C++ AC ignored; 2/10 in Python');
  assert.deepEqual(skillOverview(bob, t0 + 47 * MIN).certificates, []);
  assert.throws(() => finishSkillTest(bob, skillTest('python')!, t0 + 48 * MIN), { status: 404 });
});

void test('the draw refuses when every problem in the band is solved or solved on /learn', async () => {
  const t0 = Date.UTC(2026, 9, 3);
  for (const id of ['lc-11']) submit(zoe.id, id, 'accepted', t0 - DAY, 10);
  await assert.rejects(startSkillTest(zoe, skillTest('problem-solving-intermediate')!, t0), { status: 409 });
  // Left in the basic band: lc-1 and lc-20, whose answers the crash courses print.
  for (const id of ['lc-21', 'lc-3', 'lc-15']) submit(zoe.id, id, 'accepted', t0 - DAY, 10);
  await assert.rejects(startSkillTest(zoe, skillTest('problem-solving-basic')!, t0), { status: 409 });
  assert.equal(await status(call(zoe, 'POST', 'skills/nope/start', {})), 404);
});

void test('pd-NN is sql-NN in pandas: a pandas AC solves it for the SQL draw, and the exam gates the twin', async () => {
  const t0 = Date.UTC(2026, 9, 4);
  const sql = skillSources.sql;
  skillSources.sql = () => [
    { id: 'sql-01', difficulty: 'easy', loose: false },
    { id: 'sql-02', difficulty: 'medium', loose: false },
    { id: 'sql-03', difficulty: 'medium', loose: false },
  ];
  try {
    const pat = person('s-pat');
    submit(pat.id, 'pd-02', 'accepted', t0 - DAY, 10, 'pandas');
    await assert.rejects(startSkillTest(pat, skillTest('sql')!, t0), { status: 409 }, 'sql-02 is solved through pd-02');
    const quinn = person('s-quinn');
    const attempt = await startSkillTest(quinn, skillTest('sql')!, t0);
    assert.deepEqual([...attempt.ids].sort(), ['sql-01', 'sql-02', 'sql-03']);
    assert.equal(inRunningContest(quinn.id, 'pd-02', t0 + MIN), true);
    assert.throws(() => refuseInContest(quinn, 'pd-03', t0 + MIN), { status: 403 });
    assert.equal(inRunningContest(quinn.id, 'pd-02', t0 + 46 * MIN), false, 'over at the deadline');
  } finally {
    skillSources.sql = sql;
  }
});

void test('reading the last system design chapter issues the self-paced certificate once', async () => {
  const course = SELF_PACED.find((c) => c.id === 'sd:system-design')!;
  const [last, ...rest] = [...course.targets].reverse();
  for (const target of rest) {
    const reply = (await call(zoe, 'POST', 'marks', { target, mark: 'read', on: true })) as { certificate: string | null };
    assert.equal(reply.certificate, null);
  }
  const reply = (await call(zoe, 'POST', 'marks', { target: last, mark: 'read', on: true })) as { certificate: string };
  assert.match(reply.certificate, /^[A-Za-z0-9_-]{16}$/);
  const again = (await call(zoe, 'POST', 'marks', { target: last, mark: 'read', on: true })) as { certificate: string };
  assert.equal(again.certificate, reply.certificate);
  const page = certificateById(reply.certificate);
  assert.equal(page?.course, '系统设计面试课');
  assert.equal(page?.lessons, course.targets.length);
  assert.equal(page?.skill, false);
  // Listed on a visible profile only after the learner opts in.
  sqlite().prepare('INSERT INTO user_profiles(user_id,handle,visible,created_at,updated_at) VALUES(?,?,1,0,0)').run(zoe.id, 'zoe');
  assert.deepEqual(profileCertificates('zoe'), []);
  sqlite().prepare('UPDATE certificates SET on_profile=1 WHERE id=?').run(reply.certificate);
  assert.equal(profileCertificates('zoe', false)[0]?.course, 'System Design Interview Course');
});
