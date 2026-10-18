import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import {
  contestBand,
  contestIcs,
  drawWeekly,
  duelWinner,
  eloRatings,
  PENALTY_MS,
  ratingWeight,
  standings,
  starterStart,
  weeklyId,
  weeklyStart,
  weekNumber,
  WEEKLY_EPOCH,
} from '../lib/contest';
import { achievements, contestBadges } from '../lib/achievements';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-contests-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'hiddenco';
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const contests = await import('../lib/server/contests');
const { contestSources, contestLobby, roomView, settleWeeklies, leaderboard, ratingHistory, RATE_GRACE } = contests;

const MIN = 60000;
const DAY = 86400000;
const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: `Real ${id}`,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
const amy = person('c-amy');
const bob = person('c-bob');
const cat = person('c-cat');
const dan = person('c-dan');
const stranger = person('c-stranger');

// w300 and w400 problems: ratings 1268/1422/1894/2001 and 1211/1483/1772/2163.
const RATED = [
  ['lc-2325', 1268],
  ['lc-2326', 1422],
  ['lc-2327', 1894],
  ['lc-2328', 2001],
  ['lc-3168', 1211],
  ['lc-3169', 1483],
  ['lc-3170', 1772],
  ['lc-3171', 2163],
] as const;
contestSources.rated = () => RATED.map(([id, rating]) => ({ id, rating }));
contestSources.summaries = async () => [
  ...RATED.map(([id]) => ({ id, title: `题 ${id}`, titleEn: `Problem ${id}`, difficulty: '中等' as const, tags: [] })),
  { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单' as const, tags: [] },
  { id: 'oa-acme-1', title: 'Acme 1', difficulty: '中等' as const, tags: [] },
  { id: 'oa-hiddenco-1', title: 'Hidden 1', difficulty: '中等' as const, tags: [] },
];

function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
type View = Awaited<ReturnType<typeof roomView>>;
async function ok<T = View>(p: Person | null, method: string, path: string, body?: unknown) {
  const response = await call(p, method, path, body);
  assert.ok(response.status === 200 || response.status === 201, `${path} ${response.status}`);
  return (await response.json()) as T;
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
let n = 0;
function submit(user: string, problem: string, state: string, at: number) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','',?,0,4,'judge',?,?)`,
    )
    .run(`cs${++n}`, user, problem, state, at, at);
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('the weekly runs Sunday 09:00–10:30 Beijing time, numbered from the epoch week', () => {
  assert.equal(weekNumber(WEEKLY_EPOCH), 1);
  assert.equal(weekNumber(WEEKLY_EPOCH - 1), 0);
  assert.equal(new Date(weeklyStart(1)).toISOString(), '2026-10-18T01:00:00.000Z');
  assert.equal(weekNumber(weeklyStart(5)), 5);
  assert.equal(weeklyId(5), 'weekly-5');
});

void test('the contest calendar: the weekly and the starter repeat weekly from their first slot, 30-minute alarms', async () => {
  const { GET } = await import('../app/contest/calendar.ics/route');
  const feed = GET(new Request('https://cswork.org/contest/calendar.ics'));
  assert.equal(feed.headers.get('content-type'), 'text/calendar; charset=utf-8');
  const text = await feed.text();
  const events = text.split('BEGIN:VEVENT').slice(1);
  assert.equal(events.length, 2);
  // Sunday 09:00 and Wednesday 20:00 Beijing time, fixed in UTC: Beijing keeps no daylight saving.
  assert.match(events[0], /DTSTART:20261018T010000Z\r\nDTEND:20261018T023000Z\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:CSWork 周赛\r\n/);
  assert.match(events[1], /DTSTART:20261014T120000Z\r\nDTEND:20261014T130000Z\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:CSWork 入门赛\r\n/);
  for (const event of events) assert.match(event, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:[^\r]+\r\nTRIGGER:-PT30M\r\n/);
  assert.match(text, /X-WR-CALNAME:CSWork 比赛\r\n/);
  assert.match(await GET(new Request('https://cswork.org/contest/calendar.ics?lang=en')).text(), /SUMMARY:CSWork Starter\r\n/);
  // One contest, added on its own: no repeat, the title escaped, a stable UID.
  const one = contestIcs([{ id: 'starter-2', start: starterStart(2), minutes: 60, title: 'Starter #2, the one', url: 'https://cswork.org/contest/starter-2' }], undefined, 0);
  assert.equal(one.includes('RRULE'), false);
  assert.equal(one.includes('X-WR-CALNAME'), false);
  assert.match(one, /UID:cswork-starter-2@cswork\r\nDTSTAMP:19700101T000000Z\r\nDTSTART:20261021T120000Z\r\n/);
  assert.match(one, /SUMMARY:Starter #2\\, the one\r\n/);
});

void test('the weekly draw fills Q1–Q4 by rating, reproducibly, avoiding recent problems', () => {
  const pool = RATED.map(([id, rating]) => ({ id, rating }));
  const first = drawWeekly(pool, 7)!;
  assert.deepEqual(drawWeekly([...pool].reverse(), 7), first);
  assert.equal(first.length, 4);
  assert.ok(['lc-2325', 'lc-3168'].includes(first[0]));
  // No problem in 1500–1700: the nearest rating (1483) stands in.
  assert.equal(first[1], 'lc-3169');
  assert.equal(first[2], 'lc-2327');
  assert.equal(first[3], 'lc-3171');
  const other = first[0] === 'lc-2325' ? 'lc-3168' : 'lc-2325';
  assert.equal(drawWeekly(pool, 7, new Set([first[0]]))![0], other);
  assert.equal(drawWeekly(pool.slice(0, 3), 7), null);
});

void test('ICPC standings: AC time plus 5 minutes per earlier wrong verdict, ties share a rank', () => {
  const room = { startsAt: 0, durationMin: 60, problemIds: ['p1', 'p2'] };
  const entries = [
    { userId: 'a', name: 'Ann', joinedAt: 0, virtualStart: null },
    { userId: 'b', name: 'Ben', joinedAt: 0, virtualStart: null },
    { userId: 'c', name: 'Cy', joinedAt: 0, virtualStart: null },
    { userId: 'v', name: 'Vi', joinedAt: 90 * MIN, virtualStart: 90 * MIN },
  ];
  const at = (m: number) => m * MIN;
  const subs = [
    { user_id: 'a', problem_id: 'p1', status: 'wrong_answer', created_at: at(2) },
    { user_id: 'a', problem_id: 'p1', status: 'compile_error', created_at: at(3) },
    { user_id: 'a', problem_id: 'p1', status: 'time_limit', created_at: at(4) },
    { user_id: 'a', problem_id: 'p1', status: 'accepted', created_at: at(12) },
    // After the AC: free.
    { user_id: 'a', problem_id: 'p1', status: 'wrong_answer', created_at: at(13) },
    { user_id: 'b', problem_id: 'p1', status: 'accepted', created_at: at(20) },
    { user_id: 'c', problem_id: 'p1', status: 'accepted', created_at: at(20) },
    { user_id: 'c', problem_id: 'p2', status: 'judging', created_at: at(30) },
    // After the window: does not count.
    { user_id: 'b', problem_id: 'p2', status: 'accepted', created_at: at(61) },
    // The virtual entrant's own clock.
    { user_id: 'v', problem_id: 'p1', status: 'accepted', created_at: at(95) },
    { user_id: 'v', problem_id: 'p2', status: 'accepted', created_at: at(100) },
  ];
  const { live, virtual } = standings(room, entries, subs);
  const ann = live.find((r) => r.name === 'Ann')!;
  assert.equal(ann.penalty, at(12) + 2 * PENALTY_MS);
  assert.equal(ann.cells[0].wrong, 2);
  assert.equal(ann.rank, 3);
  assert.deepEqual(
    live.map((r) => [r.name, r.rank]),
    [
      ['Ben', 1],
      ['Cy', 1],
      ['Ann', 3],
    ],
  );
  assert.equal(live.find((r) => r.name === 'Cy')!.cells[1].pending, true);
  assert.equal(virtual.length, 1);
  assert.equal(virtual[0].solved, 2);
  assert.equal(virtual[0].penalty, at(5) + at(10));
  assert.equal(virtual[0].finishedAt, at(10));
  assert.equal(duelWinner(virtual)?.name, 'Vi');
  assert.equal(duelWinner(live), null);
  // Before `now` only: a live board mid-contest.
  assert.equal(standings(room, entries, subs, at(15)).live.find((r) => r.name === 'Ben')!.solved, 0);
});

void test('Elo: the winner gains, the loser drops, a lone entrant stays, the weight falls', () => {
  const [win, mid, lose] = eloRatings([
    { rating: 1500, contests: 0, rank: 1 },
    { rating: 1500, contests: 0, rank: 2 },
    { rating: 1500, contests: 0, rank: 3 },
  ]);
  assert.ok(win > 1500 && lose < 1500, `${win} ${lose}`);
  assert.ok(Math.abs(mid - 1500) <= 1);
  // An upset moves the favourite further than a win would move them.
  const [strong, weak] = eloRatings([
    { rating: 2000, contests: 5, rank: 2 },
    { rating: 1400, contests: 5, rank: 1 },
  ]);
  assert.ok(strong < 2000 && weak > 1400);
  assert.deepEqual(eloRatings([{ rating: 1700, contests: 3, rank: 1 }]), [1700]);
  assert.equal(ratingWeight(0), 0.5);
  assert.ok(Math.abs(ratingWeight(200) - 2 / 9) < 1e-9);
  assert.ok(ratingWeight(1) < ratingWeight(0));
});

void test('Elo: a tie counts as the middle of its places, so nobody tied at the bottom gains', () => {
  // 3, 2 and 1 solved, then seven who solved nothing, all tied 4th on the board.
  const ten = [1, 2, 3, 4, 4, 4, 4, 4, 4, 4].map((rank) => ({ rating: 1500, contests: 0, rank }));
  const after = eloRatings(ten);
  assert.ok(after.slice(3).every((r) => r < 1500), after.join(' '));
  assert.ok(after[0] > after[1] && after[1] > after[2] && after[2] > 1500);
  // The geometric mean leaves a small upward drift (LeetCode's does too); the tie bug made it +525.
  const drift = after.reduce((sum, r) => sum + r - 1500, 0);
  assert.ok(drift < 150, String(drift));
  // Two equals who both solved nothing stay put.
  assert.deepEqual(
    eloRatings([
      { rating: 1500, contests: 0, rank: 1 },
      { rating: 1500, contests: 0, rank: 1 },
    ]),
    [1500, 1500],
  );
});

void test('bands carry our own names', () => {
  assert.equal(contestBand(1500).key, 'local');
  assert.equal(contestBand(1399).key, 'depot');
  assert.equal(contestBand(1850).key, 'rapid');
  assert.equal(contestBand(3000).en, 'Maglev');
});

void test('contest badges appear only with contest results', () => {
  assert.equal(achievements({ stops: [], bestStreak: 0, acTimes: [], companies: [], perfectMock: false }).some((b) => b.group === 'contest'), false);
  const earned = (results: Parameters<typeof contestBadges>[0]) =>
    contestBadges(results).flatMap((b) => (b.earned ? [b.id] : []));
  assert.deepEqual(earned([]), []);
  assert.deepEqual(earned([{ rank: 5, entrants: 8, after: 1490, solved: 1, total: 4 }]), ['contest:first']);
  assert.deepEqual(earned([{ rank: 2, entrants: 12, after: 1900, solved: 4, total: 4 }]), [
    'contest:first',
    'contest:sweep',
    'contest:podium',
    'contest:rapid',
  ]);
  // Top 25% needs a field; a podium needs ten entrants.
  assert.deepEqual(earned([{ rank: 2, entrants: 4, after: 1900, solved: 3, total: 4 }]), ['contest:first']);
});

const WEEK = 2000;
const START = weeklyStart(WEEK);
const ID = weeklyId(WEEK);

void test('the weekly is drawn on first sight, problems stay hidden until the start, entrants join live', async () => {
  const lobby = await contestLobby(null, START - DAY);
  assert.equal(lobby.weekly?.id, ID);
  assert.equal(lobby.me, null);
  const again = await contestLobby(amy, START - DAY);
  assert.equal(again.weekly?.id, ID);
  assert.equal(
    (sqlite().prepare("SELECT COUNT(*) AS n FROM contest_rooms WHERE kind='weekly'").get() as { n: number }).n,
    1,
  );
  assert.ok(again.replays.some((r) => r.code === 'w300'));
  const early = await roomView(ID, amy, START - DAY);
  assert.equal(early.phase, 'upcoming');
  assert.equal(early.problems, null);
  assert.equal(early.problemCount, 4);
  assert.equal(early.canJoin, true);
  assert.equal(await status(person('c-unverified', { verified: false }), 'POST', `contests/${ID}/join`, { displayName: 'U' }), 403);
  for (const [p, name] of [
    [amy, 'Amy'],
    [bob, 'Bob'],
    [cat, 'Cat'],
    [dan, 'Dan'],
  ] as const)
    assert.equal((await ok(p, 'POST', `contests/${ID}/join`, { displayName: name })).me?.virtual, false);
  assert.equal(await status(stranger, 'POST', `contests/${ID}/join`, { displayName: 'amy' }), 409);
  // Running: entrants see the problems, others the board only.
  const running = await roomView(ID, amy, START + 5 * MIN);
  assert.equal(running.phase, 'running');
  assert.equal(running.problems?.length, 4);
  assert.equal((await roomView(ID, stranger, START + 5 * MIN)).problems, null);
  assert.equal((await roomView(ID, null, START + 5 * MIN)).standings?.live.length, 4);
});

void test('a finished weekly is rated once, after the grace period, for entrants who submitted', async () => {
  const ids = (await roomView(ID, amy, START + 5 * MIN)).problems!.map((p) => p.id);
  submit(amy.id, ids[0], 'accepted', START + 5 * MIN);
  submit(amy.id, ids[1], 'accepted', START + 20 * MIN);
  submit(bob.id, ids[0], 'wrong_answer', START + 3 * MIN);
  submit(bob.id, ids[0], 'accepted', START + 8 * MIN);
  submit(cat.id, ids[2], 'wrong_answer', START + 30 * MIN);
  // Dan registered but never submitted: not rated.
  const end = START + 90 * MIN;
  await settleWeeklies(end + RATE_GRACE - 1);
  assert.equal((await roomView(ID, amy, end + 1)).rated, false);
  await settleWeeklies(end + RATE_GRACE);
  await settleWeeklies(end + RATE_GRACE + 1);
  const rows = sqlite().prepare('SELECT user_id,before,after,rank,entrants FROM contest_ratings ORDER BY rank').all() as {
    user_id: string;
    before: number;
    after: number;
    rank: number;
    entrants: number;
  }[];
  assert.deepEqual(
    rows.map((r) => [r.user_id, r.rank, r.entrants, r.before]),
    [
      [amy.id, 1, 3, 1500],
      [bob.id, 2, 3, 1500],
      [cat.id, 3, 3, 1500],
    ],
  );
  assert.ok(rows[0].after > 1500 && rows[2].after < 1500);
  const view = await roomView(ID, null, end + RATE_GRACE + 2);
  assert.equal(view.rated, true);
  assert.equal(view.standings!.live[0].rating?.after, rows[0].after);
  // Never an account id on a public board.
  assert.equal(JSON.stringify(view).includes('c-amy'), false);
  const board = await leaderboard(bob, 100, end + RATE_GRACE + 3);
  assert.deepEqual(
    board.map((r) => [r.name, r.rank, r.me]),
    [
      ['Amy', 1, false],
      ['Bob', 2, true],
      ['Cat', 3, false],
    ],
  );
  assert.deepEqual(
    ratingHistory(amy.id).map((h) => [h.week, h.after, h.total]),
    [[WEEK, rows[0].after, 4]],
  );
  // Joining after the window is a virtual run on its own clock.
  sqlite().prepare('UPDATE contest_rooms SET starts_at=? WHERE id=?').run(Date.now() - 200 * MIN, ID);
  const late = await ok(stranger, 'POST', `contests/${ID}/join`, { displayName: 'Late' });
  assert.equal(late.me?.virtual, true);
  assert.ok(late.problems?.length === 4);
});

void test('joining a weekly once it has started is a virtual run: earlier solves never count, never rated', async () => {
  const week = WEEK + 1,
    id = weeklyId(week);
  assert.equal(contests.ensureWeekly(weeklyStart(week) - DAY).weekly?.id, id);
  const honest = person('c-honest'),
    sneaky = person('c-sneaky');
  assert.equal((await ok(honest, 'POST', `contests/${id}/join`, { displayName: 'Honest' })).me?.virtual, false);
  // The contest is now 80 minutes in.
  const start = Date.now() - 80 * MIN;
  sqlite().prepare('UPDATE contest_rooms SET starts_at=? WHERE id=?').run(start, id);
  const ids = (await roomView(id, honest)).problems!.map((p) => p.id);
  submit(honest.id, ids[0], 'wrong_answer', start + 30 * MIN);
  // Solved on the plain problem pages without entering, then entered once it went well.
  for (const [i, pid] of ids.entries()) submit(sneaky.id, pid, 'accepted', start + (5 + i) * MIN);
  const entered = await ok(sneaky, 'POST', `contests/${id}/join`, { displayName: 'Sneaky' });
  assert.equal(entered.me?.virtual, true);
  assert.equal(entered.standings!.live.some((r) => r.name === 'Sneaky'), false);
  assert.equal(entered.standings!.virtual.find((r) => r.name === 'Sneaky')?.solved, 0);
  await settleWeeklies(start + 90 * MIN + RATE_GRACE);
  const rated = sqlite().prepare('SELECT user_id FROM contest_ratings WHERE room_id=?').pluck().all(id);
  assert.deepEqual(rated, [honest.id]);
});

void test('private rooms: picked, drawn or replayed problems, invite codes, duel cap, nothing to strangers', async () => {
  const startsAt = Date.now();
  assert.equal(
    await status(amy, 'POST', 'contests', { kind: 'mashup', title: 'X', displayName: 'A', startsAt, durationMin: 60, problems: ['oa-hiddenco-1'] }),
    400,
  );
  assert.equal(
    await status(amy, 'POST', 'contests', { kind: 'mashup', title: 'X', displayName: 'A', startsAt, durationMin: 60 }),
    400,
  );
  const picked = await ok(amy, 'POST', 'contests', {
    kind: 'mashup',
    title: 'Friday mashup',
    displayName: 'Amy',
    startsAt: startsAt + 3600000,
    durationMin: 60,
    problems: ['lc-1', 'oa-acme-1'],
  });
  assert.equal(picked.visibility, 'private');
  assert.equal(picked.problems, null);
  assert.match(picked.inviteCode ?? '', /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(await status(stranger, 'GET', `contests/${picked.id}`), 404);
  assert.equal(await status(stranger, 'POST', `contests/${picked.id}/join`, { displayName: 'S' }), 404);
  const preview = await ok<{ title: string; full: boolean }>(stranger, 'GET', `contests/preview?code=${picked.inviteCode}`);
  assert.equal(preview.title, 'Friday mashup');
  // Codes forgive case, spaces and dashes.
  const typed = `${picked.inviteCode!.slice(0, 4).toLowerCase()}- ${picked.inviteCode!.slice(4)}`;
  const joined = await ok(stranger, 'POST', 'contests/join', { code: typed, displayName: 'Stan' });
  assert.equal(joined.me?.name, 'Stan');
  assert.equal(joined.me?.virtual, false, 'before the start: live');
  assert.equal(joined.entrants, 2);

  const replay = await ok(bob, 'POST', 'contests', {
    kind: 'duel',
    title: 'Replay w300',
    displayName: 'Bob',
    startsAt,
    durationMin: 30,
    replay: 'w300',
  });
  sqlite().prepare('UPDATE contest_rooms SET starts_at=? WHERE id=?').run(startsAt - 10 * MIN, replay.id);
  // Alone in a duel: no clock and no questions, however long ago it was set to start.
  const alone = await roomView(replay.id, bob);
  assert.equal(alone.phase, 'upcoming');
  assert.equal(alone.waiting, true);
  assert.equal(alone.problems, null);
  // The opponent starts it: both race live from that moment.
  const started = await ok(cat, 'POST', 'contests/join', { code: replay.inviteCode, displayName: 'Cat' });
  assert.equal(started.phase, 'running');
  assert.equal(started.me?.virtual, false);
  assert.ok(started.startsAt >= startsAt);
  const live = await roomView(replay.id, bob);
  assert.equal(live.waiting, false);
  assert.equal(live.me?.start, started.startsAt);
  assert.deepEqual(
    live.problems?.map((p) => p.id),
    ['lc-2325', 'lc-2326', 'lc-2327', 'lc-2328'],
  );
  assert.equal(await status(dan, 'POST', 'contests/join', { code: replay.inviteCode, displayName: 'Dan' }), 409);

  const drawn = await ok(cat, 'POST', 'contests', {
    kind: 'mashup',
    title: 'Random',
    displayName: 'Cat',
    startsAt,
    durationMin: 45,
    draw: { questions: 3, source: 'lc' },
  });
  const view = await roomView(drawn.id, cat);
  assert.equal(view.problems?.length, 3);
  assert.ok(view.problems!.every((p) => p.id.startsWith('lc-')));
  // A mashup that has started: friends joining now run it virtually.
  assert.equal((await ok(amy, 'POST', 'contests/join', { code: view.inviteCode, displayName: 'Amy' })).me?.virtual, true);

  // The picker never offers a hidden company's problem.
  const found = await ok<{ items: { id: string }[] }>(amy, 'GET', 'contests/search?q=1');
  assert.ok(found.items.some((i) => i.id === 'lc-1'));
  assert.ok(!found.items.some((i) => i.id.includes('hiddenco')));
  assert.equal(await status(null, 'GET', 'contests/search?q=1'), 401);
  const mine = await contestLobby(stranger);
  assert.ok(mine.mine.some((r) => r.id === picked.id));
  assert.equal(mine.me?.name, 'Stan');
});

void test('a public profile shows the contest curve and badges only once the learner opts in', async () => {
  const { publicProfile } = await import('../lib/server/learner-cloud');
  await ok(amy, 'POST', 'profile', { handle: 'amy-races', visible: true });
  const plain = publicProfile('amy-races', new Map())!;
  assert.deepEqual(plain.contest, []);
  assert.equal(plain.badges.some((b) => b.group === 'contest'), false);
  await ok(amy, 'POST', 'profile', { handle: 'amy-races', visible: true, showContest: true });
  const shown = publicProfile('amy-races', new Map())!;
  assert.deepEqual(shown.contest.map((c) => c.week), [WEEK]);
  assert.ok(shown.badges.some((b) => b.group === 'contest'));
  // Hiding the page drops the opt-in with it.
  await ok(amy, 'POST', 'profile', { handle: 'amy-races', visible: false, showContest: true });
  assert.equal(sqlite().prepare('SELECT show_contest FROM user_profiles WHERE user_id=?').pluck().get(amy.id), 0);
});
