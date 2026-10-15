// The starter (Wednesday, easier, Div. 3 rating rule), boards filtered to the people one follows,
// and opt-in (and withdrawable) shared code after a room is over.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import {
  drawWeekly,
  isRatedKind,
  roomWeek,
  starterId,
  starterStart,
  STARTER_SLOTS,
  weeklyId,
  weeklyStart,
  weekNumber,
} from '../lib/contest';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-contest-tiers-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { contestSources, enter, ensureWeekly, insertRoom, roomView, settleWeeklies, sharedCode, ratingHistory, RATE_GRACE } =
  await import('../lib/server/contests');

const MIN = 60000;
const DAY = 86400000;
const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const amy = person('t-amy'); // new: 1500
const pro = person('t-pro'); // rated 1800 before: races the starter unrated
const mid = person('t-mid'); // rated 1600 before
const late = person('t-late');

const RATED = [
  ['lc-2325', 1268],
  ['lc-2326', 1422],
  ['lc-2327', 1894],
  ['lc-2328', 2001],
  ['lc-3168', 1211],
  ['lc-3169', 1483],
  ['lc-3170', 1772],
  ['lc-3171', 2163],
  ['lc-1', 1100],
  ['lc-2', 1150],
] as const;
contestSources.rated = () => RATED.map(([id, rating]) => ({ id, rating }));
contestSources.summaries = async () =>
  RATED.map(([id]) => ({ id, title: `题 ${id}`, titleEn: `Problem ${id}`, difficulty: '中等' as const, tags: [] }));

function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
let n = 0;
function submit(user: string, problem: string, state: string, at: number, code = '') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python',?,?,0,4,'judge',?,?)`,
    )
    .run(`ts${++n}`, user, problem, code, state, at, at);
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const WEEK = 60;
const S = starterStart(WEEK);
const ID = starterId(WEEK);

void test('the starter runs Wednesday 20:00 Beijing time, three easier slots; site ids parse', () => {
  assert.equal(new Date(starterStart(1)).toISOString(), '2026-10-14T12:00:00.000Z');
  assert.equal(weekNumber(starterStart(7)), 7);
  assert.ok(starterStart(7) < weeklyStart(7));
  assert.equal(roomWeek('starter-12'), 12);
  assert.equal(roomWeek('weekly-3'), 3);
  assert.equal(roomWeek('abc'), null);
  assert.ok(isRatedKind('starter') && isRatedKind('weekly') && !isRatedKind('duel'));
  const drawn = drawWeekly(RATED.map(([id, rating]) => ({ id, rating })), 3, new Set(), STARTER_SLOTS)!;
  assert.equal(drawn.length, 3);
  assert.ok(['lc-1', 'lc-2'].includes(drawn[0]));
});

void test('the starter is drawn with the weekly, never sharing a problem, and Div. 3 rated', async () => {
  const { weekly, starter } = ensureWeekly(S - DAY);
  assert.equal(weekly?.id, weeklyId(WEEK));
  assert.equal(starter?.id, ID);
  assert.equal(starter?.kind, 'starter');
  assert.equal(starter?.duration_min, 60);
  assert.equal(starter?.starts_at, S);
  const weeklyIds = JSON.parse(weekly!.problem_ids_json) as string[];
  const starterIds = JSON.parse(starter!.problem_ids_json) as string[];
  assert.equal(starterIds.length, 3);
  assert.ok(starterIds.every((id) => !weeklyIds.includes(id)));
  // Seen again: the same rooms.
  assert.equal(ensureWeekly(S - DAY + 1).starter?.problem_ids_json, starter!.problem_ids_json);

  // Ratings from an earlier rated weekly.
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
      VALUES('weekly-50',NULL,'w','weekly','[]',?,90,'public',1,1)`,
    )
    .run(weeklyStart(50));
  const rate = sqlite().prepare(
    `INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES(?,'weekly-50',1500,?,1,2,1,1)`,
  );
  rate.run(pro.id, 1800);
  rate.run(mid.id, 1600);

  for (const [p, name, shareCode] of [
    [amy, 'Amy', true],
    [pro, 'Pro', true],
    [mid, 'Mid', false],
  ] as const) {
    const response = await call(p, 'POST', `contests/${ID}/join`, { displayName: name, shareCode });
    assert.equal(response.status, 200);
  }
  const ids = starterIds;
  for (const [i, pid] of ids.entries()) submit(pro.id, pid, 'accepted', S + (2 + i) * MIN, `pro ${pid}`);
  submit(mid.id, ids[0], 'wrong_answer', S + 3 * MIN, 'mid wrong');
  submit(mid.id, ids[0], 'accepted', S + 4 * MIN, `mid ${ids[0]}`);
  submit(mid.id, ids[1], 'accepted', S + 9 * MIN, `mid ${ids[1]}`);
  submit(amy.id, ids[0], 'accepted', S + 10 * MIN, `amy first ${ids[0]}`);
  submit(amy.id, ids[0], 'accepted', S + 11 * MIN, `amy again ${ids[0]}`);

  const running = await roomView(ID, amy, S + 30 * MIN);
  assert.deepEqual(
    running.standings!.live.map((r) => [r.name, r.rank, r.unrated]),
    [
      ['Pro', 1, true],
      ['Mid', 2, false],
      ['Amy', 3, false],
    ],
  );

  await settleWeeklies(S + 60 * MIN + RATE_GRACE);
  const rows = sqlite()
    .prepare('SELECT user_id,before,rank,entrants FROM contest_ratings WHERE room_id=? ORDER BY rank')
    .all(ID) as { user_id: string; before: number; rank: number; entrants: number }[];
  // Pro races unrated; the others rank among themselves, from their own ratings.
  assert.deepEqual(
    rows.map((r) => [r.user_id, r.before, r.rank, r.entrants]),
    [
      [mid.id, 1600, 1, 2],
      [amy.id, 1500, 2, 2],
    ],
  );
  const ended = await roomView(ID, null, S + 60 * MIN + RATE_GRACE + 1);
  assert.equal(ended.rated, true);
  assert.equal(ended.standings!.live[0].rating, null);
  assert.ok(ended.standings!.live[1].rating);
  assert.deepEqual(
    ratingHistory(mid.id).map((h) => [h.kind, h.week]),
    [
      ['weekly', 50],
      ['starter', WEEK],
    ],
  );
});

void test('only the people I follow: rated live rows of a weekly or starter, ranks stay overall', async () => {
  const stan = person('t-stan');
  for (const [p, handle, showContest] of [
    [pro, 'pro-racer', true],
    [mid, 'mid-racer', true],
    [stan, 'stan-racer', false],
  ] as const)
    assert.equal((await call(p, 'POST', 'profile', { handle, visible: true, showContest })).status, 200);
  for (const handle of ['pro-racer', 'mid-racer', 'stan-racer'])
    assert.equal((await call(amy, 'POST', 'follows', { handle, on: true })).status, 200);
  // A virtual run nobody follows: no profile ever shows that table, so it stays whole.
  sqlite()
    .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,?,?)')
    .run(ID, 't-vee', 'Vee', S + 10 * MIN, S + 10 * MIN);
  const all = await roomView(ID, amy, S + 30 * MIN);
  assert.equal(all.following, false);
  const mine = await roomView(ID, amy, S + 30 * MIN, true);
  assert.equal(mine.following, true);
  // Pro shows contests but raced the starter unrated: no point on their curve ties the name.
  assert.deepEqual(
    mine.standings!.live.map((r) => [r.name, r.rank]),
    [
      ['Mid', 2],
      ['Amy', 3],
    ],
  );
  assert.deepEqual(mine.standings!.virtual.map((r) => r.name), ['Vee']);
  // Before the rating: live entrants racing rated.
  const ratedAt = sqlite().prepare('SELECT rated_at FROM contest_rooms WHERE id=?').pluck().get(ID);
  sqlite().prepare('UPDATE contest_rooms SET rated_at=NULL WHERE id=?').run(ID);
  assert.deepEqual((await roomView(ID, amy, S + 30 * MIN, true)).standings!.live.map((r) => r.name), ['Mid', 'Amy']);
  sqlite().prepare('UPDATE contest_rooms SET rated_at=? WHERE id=?').run(ratedAt, ID);
  assert.equal((await roomView(ID, null, S + 30 * MIN, true)).following, null);
  assert.equal((await roomView(ID, null, S + 30 * MIN, true)).standings!.live.length, 3);
  // A mashup is never on a profile: the filter is ignored.
  const t0 = Date.now();
  const mashup = insertRoom(
    { owner: amy.id, title: 'M', kind: 'mashup', ids: ['lc-1'], startsAt: t0 + MIN, durationMin: 60 },
    { userId: amy.id, name: 'Amy', share: false },
    t0,
  );
  enter(mashup, mid, 'Mid', t0);
  enter(mashup, stan, 'Stan', t0);
  const room = await roomView(mashup.id, amy, t0 + 10 * MIN, true);
  assert.equal(room.following, null);
  assert.equal(room.standings!.live.length, 3);
});

void test('shared code: opt-in, first AC in the window, RATE_GRACE after the end, never mid-contest', async () => {
  const ids = (await roomView(ID, amy, S + 30 * MIN)).problems!.map((p) => p.id);
  const end = S + 60 * MIN;
  assert.equal((await roomView(ID, amy, end + RATE_GRACE - 1)).codeOpen, false);
  await assert.rejects(sharedCode(ID, ids[0], amy, end + RATE_GRACE - 1), { status: 403 });
  const open = await roomView(ID, amy, end + RATE_GRACE);
  assert.equal(open.codeOpen, true);
  assert.deepEqual(
    open.standings!.live.map((r) => [r.name, r.shared]),
    [
      ['Pro', true],
      ['Mid', false],
      ['Amy', true],
    ],
  );
  const { items } = await sharedCode(ID, ids[0], late, end + RATE_GRACE);
  assert.deepEqual(
    items.map((i) => [i.name, i.code, i.at, i.virtual, i.language]),
    [
      ['Pro', `pro ${ids[0]}`, 2 * MIN, false, 'python'],
      ['Amy', `amy first ${ids[0]}`, 10 * MIN, false, 'python'],
    ],
  );
  await assert.rejects(sharedCode(ID, 'lc-9999', late, end + RATE_GRACE), { status: 404 });
  // A virtual run of the room still going: its problems stay closed to that reader.
  sqlite()
    .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,?,?)')
    .run(ID, late.id, 'Late', end + 20 * MIN, end + 20 * MIN);
  assert.equal((await roomView(ID, late, end + 30 * MIN)).codeOpen, false);
  await assert.rejects(sharedCode(ID, ids[0], late, end + 30 * MIN), { status: 403 });
  // Signed out: no code links, the endpoint wants an account.
  const signedOut = await roomView(ID, null, end + RATE_GRACE);
  assert.equal(signedOut.codeOpen, false);
  assert.ok(signedOut.standings!.live.every((r) => !r.shared));
  // The picked sharer comes first, inside the 50 the panel lists.
  assert.deepEqual(
    (await sharedCode(ID, ids[0], amy, end + RATE_GRACE, 'Amy')).items.map((i) => i.name),
    ['Amy', 'Pro'],
  );
  // A sharer still racing a virtual run: their code waits for their own window to end.
  const vic = person('t-vic');
  sqlite()
    .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start,share_code) VALUES(?,?,?,?,?,1)')
    .run(ID, vic.id, 'Vic', end + 40 * MIN, end + 40 * MIN);
  submit(vic.id, ids[0], 'accepted', end + 45 * MIN, 'vic');
  const names = async (at: number) => (await sharedCode(ID, ids[0], amy, at)).items.map((i) => i.name);
  const vicShared = async (at: number) => (await roomView(ID, amy, at)).standings!.virtual.find((r) => r.name === 'Vic')!.shared;
  assert.deepEqual(await names(end + 50 * MIN), ['Pro', 'Amy']);
  assert.equal(await vicShared(end + 50 * MIN), false);
  assert.deepEqual(await names(end + 100 * MIN), ['Pro', 'Amy', 'Vic']);
  assert.equal(await vicShared(end + 100 * MIN), true);
  // An entrant can withdraw sharing any time: gone from the panel and the board.
  assert.equal((await roomView(ID, pro, end + 100 * MIN)).me?.share, true);
  assert.equal(await status(null, 'POST', `contests/${ID}/share`, { on: false }), 401);
  assert.equal(await status(person('t-nobody'), 'POST', `contests/${ID}/share`, { on: false }), 404);
  assert.equal(await status(pro, 'POST', `contests/${ID}/share`, { on: 'no' }), 400);
  assert.equal(await status(pro, 'POST', `contests/${ID}/share`, { on: false }), 200);
  assert.equal((await roomView(ID, pro, end + 100 * MIN)).me?.share, false);
  assert.deepEqual(await names(end + 100 * MIN), ['Amy', 'Vic']);
  assert.equal((await roomView(ID, amy, end + 100 * MIN)).standings!.live.find((r) => r.name === 'Pro')!.shared, false);
  // The endpoint: an account, a problem id.
  assert.equal(await status(null, 'GET', `contests/${ID}/code?problem=${ids[0]}`), 401);
  assert.equal(await status(amy, 'GET', `contests/${ID}/code?problem=x`), 400);
});

void test("a profile curves starters too, but the contest badges stay the weekly's", async () => {
  assert.equal((await call(amy, 'POST', 'profile', { handle: 'amy-racer', visible: true, showContest: true })).status, 200);
  const { publicProfile } = await import('../lib/server/learner-cloud');
  const profile = publicProfile('amy-racer', new Map())!;
  assert.deepEqual(profile.contest.map((c) => c.kind), ['starter']);
  assert.ok(!profile.badges.some((b) => b.group === 'contest'));
});
