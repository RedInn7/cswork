// Practice points: awards are idempotent and capped, report points follow the report's state,
// upvotes need real accounts, redemptions buy freezes (3 a month) and AI calls, and the hooks
// on submissions, reviews and votes pay through the API.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-points-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
const { sqlite } = await import('../db/sqlite');
const points = await import('../lib/server/points');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { handleOj } = await import('../lib/server/oj-api');
const { dailyProblem } = await import('../lib/server/daily-problem');
const { aiBonusLeft, AI_DAILY_LIMITS } = await import('../lib/server/ai-tutor');
const { beijingDate } = await import('../lib/daily-problem');
const { practiceStats } = await import('../components/practice-calendar');

const DAY = 86400000;
const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
const teacher = person('pt-teacher', { role: 'teacher' });
const ledger = (userId: string) =>
  sqlite().prepare('SELECT reason,delta,ref_id AS ref FROM point_ledger WHERE user_id=? ORDER BY rowid').all(userId) as {
    reason: string;
    delta: number;
    ref: string;
  }[];
let n = 0;
function accepted(userId: string, problemId: string, at: number) {
  const id = `pt-s${++n}`;
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','x','accepted',1,1,'judge',?,?)`,
    )
    .run(id, userId, problemId, at, at);
  return { id, user_id: userId, problem_id: problemId, mode: 'judge', status: 'accepted', created_at: at };
}
const call = async (p: Person, path: string[], body?: unknown) => {
  const request = new Request(`https://cswork.test/api/oj/${path.join('/')}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return (await handleOj(request, p, path)).json();
};
const status = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return 200;
  } catch (error) {
    return (error as { status?: number }).status ?? 500;
  }
};

function fixture(id: string): OjProblemPackage {
  return {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Two Sum',
      difficulty: '简单',
      tags: ['hash'],
      description: 'Stub.',
      input: 'n',
      output: 'm',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      { name: 'sample', input: '1\n', expectedOutput: '1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: '2\n', expectedOutput: '2\n', hidden: true, weight: 1 },
    ],
  };
}

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','T','T','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','T','','t',0,'','1',0)",
  ).run();
  // The only judgeable problem, so it is every day's daily problem.
  const saved = await saveProblemDraft(teacher, fixture('lc-1'), null);
  await publishProblemDraft(teacher, 'lc-1', saved.draft!.revision);
  const version = db.prepare("SELECT current_version_id FROM oj_problems WHERE id='lc-1'").pluck().get();
  db.prepare(
    `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,
    case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}',
    'h',1,1,'lc-1',?,0)`,
  ).run(`h:${version}`);
});
after(() => {
  delete process.env.ANTHROPIC_API_KEY;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('an AC pays the day, the first AC of a problem, the daily problem and every 7th day in a row, once each', async () => {
  const now = Date.now();
  const daily = await dailyProblem();
  assert.equal(daily?.id, 'lc-1');
  const first = accepted('ac-user', 'lc-1', now);
  assert.equal(await points.awardAccepted(first, now), 10 + 5 + 20);
  assert.equal(await points.awardAccepted(first, now), 0, 'a replay pays nothing');
  // A second AC of the same problem the same day: nothing new.
  assert.equal(await points.awardAccepted(accepted('ac-user', 'lc-1', now + 1), now), 0);
  // A run is no formal submission; an old AC read today (history from before points) pays nothing.
  assert.equal(await points.awardAccepted({ ...first, id: 'x', mode: 'run' }, now), 0);
  assert.equal(await points.awardAccepted(accepted('old-user', 'lc-1', now - 3 * DAY), now), 0);
  assert.equal(points.balance('ac-user'), 35);
  // Six earlier days in a row: the 7th (today) pays the streak; those days pay their own 10.
  // Each paid as it was judged.
  for (let d = 6; d >= 1; d--)
    await points.awardAccepted(accepted('streak-user', `lc-90${d}`, now - d * DAY), now - d * DAY);
  const before = points.balance('streak-user');
  const today = await points.awardAccepted(accepted('streak-user', 'lc-999', now), now);
  assert.equal(today, 10 + 5 + 50);
  assert.equal(points.balance('streak-user'), before + 65);
  assert.ok(ledger('streak-user').some((row) => row.reason === 'streak' && row.ref === beijingDate(now)));
});

void test('first ACs stop paying past 100 a day, and a capped-out problem never pays later', async () => {
  const now = Date.now();
  let got = 0;
  for (let i = 0; i < 25; i++) got += points.award('cap-user', 'first-ac', `lc-${i}`, 5, now, 100);
  assert.equal(got, 100);
  assert.equal(points.award('cap-user', 'first-ac', 'lc-24', 5, now + DAY, 100), 0);
  assert.equal(ledger('cap-user').length, 25);
});

void test('upvotes pay authors 2 each, 40 a day, only from verified accounts a week old', () => {
  const db = sqlite();
  const now = Date.now();
  const voter = (id: string, ageDays: number, verified = true) => {
    db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(
      id,
      id,
      `${id}@example.test`,
      verified ? 1 : 0,
      now - ageDays * DAY,
      now,
    );
    return person(id, { verified });
  };
  assert.equal(points.awardUpvote('author', voter('fresh-voter', 2), 'post-1', now), 0);
  assert.equal(points.awardUpvote('author', voter('unverified-voter', 30, false), 'post-1', now), 0);
  const old = voter('old-voter', 30);
  assert.equal(points.awardUpvote('author', old, 'post-1', now), 2);
  assert.equal(points.awardUpvote('author', old, 'post-1', now), 0, 'once per voter and post');
  assert.equal(points.awardUpvote('old-voter', old, 'post-2', now), 0, 'no self-votes');
  let total = 2;
  for (let i = 0; i < 25; i++) total += points.awardUpvote('author', old, `post-x${i}`, now);
  assert.equal(total, 40);
});

void test('report points follow the report: approved 100, reported down 0, re-approved 100, withdrawn 0', async () => {
  const db = sqlite();
  db.prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,created_at)
    VALUES('expAAAAAAAAA','writer','amazon','T','SDE','2026-09','body',1)`,
  ).run();
  const review = (status: string, note = '') =>
    call(teacher, ['experiences', 'expAAAAAAAAA', 'review'], { status, note });
  await review('approved');
  assert.equal(points.balance('writer'), 100);
  await review('approved');
  assert.equal(points.balance('writer'), 100, 'approving again pays nothing more');
  // Three readers' reports take it down (FLAGS_HIDE), and its points with it.
  for (const reader of ['r1', 'r2', 'r3'])
    db.prepare(
      "INSERT INTO experience_flags(submission_id,user_id,reason,created_at) VALUES('expAAAAAAAAA',?,'spam',1)",
    ).run(reader);
  points.settleExperience('expAAAAAAAAA', false);
  assert.equal(points.balance('writer'), 0);
  await review('approved');
  assert.equal(points.balance('writer'), 100);
  await review('rejected', 'not an interview');
  assert.equal(points.balance('writer'), 0);
  await review('approved');
  await call(person('writer'), ['experiences', 'expAAAAAAAAA', 'withdraw'], {});
  assert.equal(points.balance('writer'), 0);
  assert.deepEqual(
    ledger('writer').map((row) => row.delta),
    [100, -100, 100, -100, 100, -100],
  );
});

void test('redeem: freezes cost 100, 3 a month; AI packs cost 50 for 5 calls past the daily limit', async () => {
  const buyer = person('buyer');
  points.award('buyer', 'grant', 'test', 420);
  assert.equal(await status(call(buyer, ['points', 'redeem'], { item: 'ai' })), 404, 'no AI, no AI pack');
  for (let i = 0; i < 3; i++) await call(buyer, ['points', 'redeem'], { item: 'freeze' });
  assert.equal(await status(call(buyer, ['points', 'redeem'], { item: 'freeze' })), 409);
  assert.equal(points.purchasedFreezes('buyer').length, 3);
  assert.notEqual(await status(call(buyer, ['points', 'redeem'], { item: 'gold' })), 200);
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const after = (await call(buyer, ['points', 'redeem'], { item: 'ai' })) as {
    balance: number;
    ai: { bonus: number };
    freezes: { boughtThisMonth: number };
    ledger: { reason: string; ref?: string }[];
  };
  assert.equal(after.balance, 420 - 300 - 50);
  assert.equal(after.ai.bonus, 5);
  assert.equal(after.freezes.boughtThisMonth, 3);
  await call(buyer, ['points', 'redeem'], { item: 'ai' });
  assert.equal(await status(call(buyer, ['points', 'redeem'], { item: 'ai' })), 409, '20 left: not enough');
  // Calls past a day's limit spend the pack, refunds hand them back.
  sqlite()
    .prepare("INSERT INTO ai_usage(day,user_id,kind,count) VALUES('2026-01-01','buyer','hint',?)")
    .run(AI_DAILY_LIMITS.hint + 2);
  assert.equal(aiBonusLeft('buyer'), 8);
  assert.equal(((await call(buyer, ['ai', 'usage'])) as { bonus: number }).bonus, 8);
  delete process.env.ANTHROPIC_API_KEY;
});

void test('the ledger API hides voters and report ids, and an AC pays through the submission detail', async () => {
  const me = person('api-user');
  const sub = accepted('api-user', 'lc-1', Date.now() - DAY);
  points.award('api-user', 'upvote', 'post-1:secret-voter', 2);
  await call(me, ['submissions', sub.id]);
  const view = (await call(me, ['points'])) as { balance: number; ledger: { reason: string; ref?: string }[] };
  assert.equal(view.balance, 2 + 10 + 5);
  assert.equal(JSON.stringify(view).includes('secret-voter'), false);
  assert.ok(view.ledger.some((row) => row.reason === 'first-ac' && row.ref === 'lc-1'));
  // Someone else's submission: a teacher may read it, but the points go to its owner.
  const theirs = accepted('owner-user', 'lc-1', Date.now());
  await call(teacher, ['submissions', theirs.id]);
  assert.equal(points.balance('pt-teacher'), 0);
  assert.ok(points.balance('owner-user') > 0);
});

void test('a bought freeze adds one to its month on the calendar', () => {
  // The month's two free freezes go to the oldest gaps (2nd, 4th); a bought one covers the 11th.
  const day = (d: number) => new Date(2026, 8, d, 12).getTime();
  const activity = [1, 3, 5, 10, 12].map((d) => ({ problem_id: `p${d}`, created_at: day(d) }));
  const stamp = new Date(2026, 8, 12).toDateString();
  const without = practiceStats(activity, stamp, true);
  const withOne = practiceStats(activity, stamp, true, [], undefined, [day(12)]);
  assert.equal(without.streak, 1);
  assert.equal(withOne.streak, 2);
  assert.equal(withOne.freezesLeft, 0);
});
