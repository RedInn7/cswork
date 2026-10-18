// The study goal (lib/study-goal.ts, lib/server/study-days.ts, GET oj/study-goal): XP per local
// day with per-kind caps, the learner's pref:study, met goals kept as marks, covered days in the
// streak, the contest pause, and the seeded daily quests.
// Not UTC: the local days must come from the tz parameter, never the server's zone.
process.env.TZ = 'America/New_York';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-study-goal-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.APP_URL = 'https://cswork.test';

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { dailyQuests, STUDY_KINDS, tally, xpOf } = await import('../lib/study-goal');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const isoDate = (at: number) => new Date(at).toISOString().slice(0, 10);
// A tz (Date#getTimezoneOffset) whose local time is about noon now, so "an hour ago" is today.
const NOON_TZ = Math.round((new Date().getUTCHours() + new Date().getUTCMinutes() / 60 - 12) * 60);
const localDate = (at: number, tz: number) => isoDate(at - tz * MINUTE);

const person = (id: string, verified = true): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified });
function addUser(id: string, verified = true) {
  const p = person(id, verified);
  sqlite()
    .prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,0,0)')
    .run(p.id, p.name, p.email, +p.verified);
  return p;
}
async function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const request = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const response = await handleOj(request, p, url.pathname.split('/').slice(3));
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
const goal = (p: Person, tz = NOON_TZ) => call(p, 'GET', `oj/study-goal?tz=${tz}`);
let seq = 0;
function submit(userId: string, problem: string, at: number, mode = 'judge', status = 'accepted') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,finished_at,created_at,updated_at)
      VALUES(?,?,?,'python','x',?,1,?,?,?,?)`,
    )
    .run(`s-${++seq}`, userId, problem, status, mode, at + 1000, at, at);
}
const mark = (userId: string, target: string, kind: string, at: number) =>
  sqlite().prepare('INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,?,?)').run(userId, target, kind, at);
const note = (userId: string, target: string, body: string, at = Date.now()) =>
  sqlite()
    .prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,target) DO UPDATE SET body=excluded.body')
    .run(userId, target, body, at);

void test('XP: distinct items, each kind capped per local day', () => {
  const at = Date.UTC(2026, 9, 15, 12);
  const events = [
    ...Array.from({ length: 8 }, (_, i) => ({ kind: 'ac' as const, key: `lc-${i}`, at })),
    { kind: 'ac' as const, key: 'lc-0', at: at + HOUR },
    ...Array.from({ length: 4 }, (_, i) => ({ kind: 'sd' as const, key: `sd:${i}`, at })),
    { kind: 'mcq' as const, key: 'q1', at },
  ];
  const day = tally(events, 0).get('2026-10-15')!;
  assert.deepEqual(day, { ac: 8, sd: 4, mcq: 1 });
  assert.equal(xpOf(day), 60 + 30 + 1);
  assert.equal(xpOf(), 0);
});

void test('quests: the same seed draws the same 3, leaning on neglected areas', () => {
  const busy = Object.fromEntries(STUDY_KINDS.map((kind) => [kind, kind === 'recall' || kind === 'sd' ? 0 : 30]));
  assert.deepEqual(dailyQuests('u|2026-10-15', busy), dailyQuests('u|2026-10-15', busy));
  let neglected = 0;
  let ac = 0;
  for (let i = 0; i < 300; i++) {
    const quests = dailyQuests(`u|${i}`, busy);
    assert.equal(new Set(quests).size, 3);
    neglected += +quests.includes('recall') + +quests.includes('sd');
    ac += +quests.includes('ac');
    assert(!dailyQuests(`v|${i}`, { mcq: Infinity }).includes('mcq'));
  }
  // Unweighted, each kind would come up in 3 of 7 draws (about 129 of 300).
  assert(neglected > 560, `recall and sd drawn ${neglected} times`);
  assert(ac < 90, `ac drawn ${ac} times`);
});

void test('GET oj/study-goal: tz decides the local day; GET only, tz checked', async () => {
  const p = addUser('g-tz');
  // 03:00 UTC two days ago is 20:00 the evening before at tz 420 (UTC-7).
  const base = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 2 * DAY;
  mark(p.id, 'sd:intro', 'read', base + 3 * HOUR);
  const west = await goal(p, 420);
  assert.equal(west.status, 200);
  assert.equal(west.data.week.find((d: { date: string }) => d.date === isoDate(base - DAY)).xp, 10);
  assert.equal(west.data.week.find((d: { date: string }) => d.date === isoDate(base)).xp, 0);
  const utc = await goal(p, 0);
  assert.equal(utc.data.week.find((d: { date: string }) => d.date === isoDate(base)).xp, 10);
  assert.equal(utc.data.week.length, 7);
  assert.equal(utc.data.week[6].date, utc.data.today);
  assert.equal((await call(p, 'GET', 'oj/study-goal')).status, 400);
  assert.equal((await call(p, 'GET', 'oj/study-goal?tz=1000')).status, 400);
  assert.equal((await call(p, 'POST', 'oj/study-goal?tz=0', {})).status, 404);
});

void test('every kind of study counts, each up to its daily cap', async () => {
  const p = addUser('g-caps');
  const at = Date.now() - HOUR;
  for (let i = 0; i < 8; i++) submit(p.id, `lc-${i}`, at);
  submit(p.id, 'lc-0', at); // the same problem again
  submit(p.id, 'lc-9', at, 'judge', 'wrong_answer');
  submit(p.id, 'lc-10', at, 'run');
  for (let i = 0; i < 3; i++) submit(p.id, `lc-${i}`, at, i ? 'complexity' : 'stress');
  for (let i = 0; i < 25; i++)
    sqlite()
      .prepare('INSERT INTO mcq_answers(question_id,user_id,picks,correct,created_at) VALUES(?,?,?,?,?)')
      .run(`q-${i}`, p.id, '[0]', 1, at);
  for (let i = 0; i < 4; i++) mark(p.id, `sd:ch-${i}`, 'read', at);
  mark(p.id, 'sd:ch-9', 'star', at);
  for (let i = 0; i < 4; i++) mark(p.id, `content:english/u-${i}`, 'done', at);
  for (let i = 0; i < 3; i++)
    sqlite()
      .prepare(
        `INSERT INTO mock_sessions(id,user_id,preset,scoring,source,set_hash,ids_json,slots_json,minutes,skew,created_at,started_at,finished_at,reason,updated_at)
        VALUES(?,?,2,'icpc','local','h','[]','[]',60,0,?,?,?,'submit',?)`,
      )
      .run(`m-${i}`, p.id, at, at, at, at);
  const day = Math.floor(at / DAY);
  const items = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`sd:c${i}`, [1, day, `Card ${i}`]]));
  note(p.id, 'recall:queue', JSON.stringify({ v: 1, items: { ...items, 'sd:old': [2, day - 30, 'Old'] } }), at);
  const { data } = await goal(p);
  // ac 60 (8 × 10, capped), stress 10, mcq 20, sd 30, english 15, mock 30, recall 10.
  assert.equal(data.todayXp, 60 + 10 + 20 + 30 + 15 + 30 + 10);
  assert.equal(data.week[6].ac, 8);
  assert.equal(data.week[6].xp, data.todayXp);
  // Every quest is done today; `have` stops at `need`.
  assert.equal(data.quests.length, 3);
  for (const q of data.quests) assert.equal(q.have, q.need);
  assert.equal(data.covered.at(-1).date, data.today);
});

void test('pref:study: a bad field falls back on its own, bad JSON on both', async () => {
  const p = addUser('g-pref');
  note(p.id, 'pref:study', 'not json');
  let { data } = await goal(p);
  assert.deepEqual([data.goalXp, data.restWeekdays], [30, []]);
  note(p.id, 'pref:study', JSON.stringify({ goalXp: 5, restWeekdays: [1] }));
  ({ data } = await goal(p));
  assert.deepEqual([data.goalXp, data.restWeekdays], [30, [1]]);
  note(p.id, 'pref:study', JSON.stringify({ goalXp: 50, restWeekdays: [1, 2, 3] }));
  ({ data } = await goal(p));
  assert.deepEqual([data.goalXp, data.restWeekdays], [50, []]);
});

void test('a running contest or skill test pauses it', async () => {
  const p = addUser('g-contest');
  const now = Date.now();
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES('room-g','Room','weekly','["lc-1"]',?,90,'public',0)`,
    )
    .run(now - 10 * MINUTE);
  sqlite()
    .prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('room-g',?,?,0)")
    .run(p.id, p.id);
  assert.deepEqual((await goal(p)).data, { paused: true });
  sqlite().prepare('UPDATE contest_rooms SET starts_at=? WHERE id=?').run(now - 100 * MINUTE, 'room-g');
  assert.equal((await goal(p)).data.paused, undefined);
});

void test('a met goal stays covered after its study is undone, and bridges the streak', async () => {
  const p = addUser('g-keep');
  const tz = NOON_TZ;
  const now = Date.now();
  note(p.id, 'pref:study', JSON.stringify({ goalXp: 10 }));
  // An AC two days ago and today; yesterday only a chapter read (the goal of 10).
  submit(p.id, 'lc-1', now - 2 * DAY);
  submit(p.id, 'lc-2', now - HOUR);
  mark(p.id, 'sd:ch-1', 'read', now - DAY);
  mark(p.id, 'goal:2020-01-01', 'goal', 0);
  let { data } = await goal(p, tz);
  const yesterday = localDate(now - DAY, tz);
  assert.deepEqual(data.covered.find((c: { date: string }) => c.date === yesterday), { date: yesterday, rest: false });
  assert.equal(data.week[5].covered, 'goal');
  // Two AC days, bridged by the covered one: the covered day adds none.
  assert.equal(data.streak, 2);
  assert.equal((await call(p, 'POST', 'oj/marks', { target: 'sd:ch-1', mark: 'read', on: false })).status, 200);
  ({ data } = await goal(p, tz));
  assert.equal(data.week[5].xp, 0);
  assert.equal(data.week[5].covered, 'goal');
  assert.equal(data.streak, 2);
  // Goal marks are the server's: never listed with the learner's marks, and gone after 200 days.
  const marks = (await call(p, 'GET', 'oj/marks')).data.items as { mark: string }[];
  assert(!marks.some((m) => m.mark === 'goal'));
  assert.equal(sqlite().prepare("SELECT COUNT(*) FROM user_marks WHERE user_id=? AND target='goal:2020-01-01'").pluck().get(p.id), 0);
});

void test('rest weekdays and the review break are covered as rest', async () => {
  const p = addUser('g-rest');
  const tz = NOON_TZ;
  const now = Date.now();
  const yesterday = localDate(now - DAY, tz);
  note(p.id, 'pref:study', JSON.stringify({ restWeekdays: [new Date(`${yesterday}T00:00:00Z`).getUTCDay()] }));
  note(p.id, 'pref:review', JSON.stringify({ pausedFrom: localDate(now - 4 * DAY, tz), pausedDays: 2 }));
  const { data } = await goal(p, tz);
  assert.equal(data.week[5].covered, 'rest');
  assert.equal(data.week[2].covered, 'rest');
  assert.equal(data.week[3].covered, 'rest');
  assert.equal(data.week[4].covered, null);
  // Only the 7 days before today are filled in: last week's rest weekday stays a gap.
  assert(!data.covered.some((c: { date: string }) => c.date === localDate(now - 8 * DAY, tz)));
  // Past ones are stored, and stay: a new break replacing the old one and no rest weekdays keep
  // them. Today follows the settings until it is over.
  const rest = "SELECT COUNT(*) FROM user_marks WHERE user_id=? AND mark='goal' AND target LIKE 'rest:%'";
  assert.equal(sqlite().prepare(rest).pluck().get(p.id), 3);
  note(p.id, 'pref:study', JSON.stringify({ restWeekdays: [] }));
  note(p.id, 'pref:review', JSON.stringify({ pausedFrom: localDate(now, tz), pausedDays: 1 }));
  const covered = async () => (await goal(p, tz)).data.week.map((d: { covered: string | null }) => d.covered);
  assert.deepEqual(await covered(), [null, null, 'rest', 'rest', null, 'rest', 'rest']);
  note(p.id, 'pref:review', '{}');
  assert.deepEqual(await covered(), [null, null, 'rest', 'rest', null, 'rest', null]);
  // Never listed with the learner's marks, and gone after 200 days like a met goal.
  mark(p.id, 'rest:2020-01-01', 'goal', 0);
  await goal(p, tz);
  assert.equal(sqlite().prepare(rest).pluck().get(p.id), 3);
  assert(!(await call(p, 'GET', 'oj/marks')).data.items.some((m: { mark: string }) => m.mark === 'goal'));
});

void test('a mock finish or a review card day from the future counts nothing and breaks nothing', async () => {
  const p = addUser('g-future');
  const now = Date.now();
  note(p.id, 'recall:queue', JSON.stringify({ v: 1, items: { far: [0, 1e20, 't'], max: [0, 1e306, 't'], ok: [0, Math.floor(now / DAY), 't'] } }), now);
  sqlite()
    .prepare(
      `INSERT INTO mock_sessions(id,user_id,preset,scoring,source,set_hash,ids_json,slots_json,minutes,skew,created_at,started_at,finished_at,reason,updated_at)
      VALUES('m-future',?,2,'icpc','local','h','[]','[]',60,0,0,0,?,'submit',0)`,
    )
    .run(p.id, Number.MAX_SAFE_INTEGER);
  const { status, data } = await goal(p, 0);
  assert.equal(status, 200);
  assert.equal(data.todayXp, 1, 'the one card graded today');
});

void test('own cards and problem ideas graded today count like open questions', async () => {
  const p = addUser('g-cards');
  const now = Date.now();
  const day = Math.floor(now / DAY);
  note(p.id, 'recall:queue', JSON.stringify({ v: 1, items: { 'sd:a': [1, day, 'A'] } }), now);
  note(p.id, 'recall:cards', JSON.stringify({ v: 1, items: { 'card:abcdefghijkl': [1, day, ''] } }), now);
  note(p.id, 'recall:ideas', JSON.stringify({ v: 1, items: { 'idea:lc-1': [1, day, ''] } }), now);
  const { data } = await goal(p, 0);
  // 1 XP each; the same day count ticks the 'Self-grade 3 review cards' quest.
  assert.equal(data.todayXp, 3);
});

void test("goal and rest marks take none of the learner's 5000 marks", async () => {
  const p = addUser('g-quota');
  const insert = sqlite().prepare('INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,?,0)');
  sqlite().transaction(() => {
    for (let i = 0; i < 4999; i++) insert.run(p.id, `problem:lc-${i}`, 'star');
    for (let i = 0; i < 9; i++) insert.run(p.id, `goal:2026-01-0${i + 1}`, 'goal');
  })();
  assert.equal((await call(p, 'POST', 'oj/marks', { targets: ['problem:lc-9000'], mark: 'done' })).status, 200);
  assert.equal((await call(p, 'POST', 'oj/marks', { target: 'problem:lc-9001', mark: 'star', on: true })).status, 409);
});

void test('an unverified account never draws the MCQ quest', async () => {
  for (let i = 0; i < 10; i++) {
    const { data } = await goal(addUser(`g-unverified-${i}`, false));
    assert(!data.quests.some((q: { kind: string }) => q.kind === 'mcq'));
  }
});
