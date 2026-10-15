// Ranked 1v1 duels: the queue and its widening window, problems neither side has solved, lazy
// two-player Elo settlement once, records and streaks, the per-pair daily cap.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import { duelBand, duelElo, duelWindow } from '../lib/contest';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-duels-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { contestSources, roomView, settleDuels } = await import('../lib/server/contests');
const { duelRecord } = await import('../lib/server/contest-ratings');
const { DUEL_PAIR_DAILY } = await import('../lib/server/duels');

const MIN = 60000;
const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
const amy = person('d-amy');
const bob = person('d-bob');
const cat = person('d-cat');

// Fourteen problems around 1500, and one far above.
const RATED: [string, number][] = [...Array.from({ length: 14 }, (_, i): [string, number] => [`lc-${10 + i}`, 1430 + i * 10]), ['lc-99', 2600]];
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
async function ok<T>(p: Person | null, method: string, path: string, body?: unknown) {
  const response = await call(p, method, path, body);
  assert.equal(response.status, 200, path);
  return (await response.json()) as T;
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
type Queue = { state: 'idle' } | { state: 'waiting'; rating: number; window: number } | { state: 'matched'; roomId: string };
const queue = (p: Person, name: string) => ok<Queue>(p, 'POST', 'contests/duel/queue', { displayName: name });
const poll = (p: Person) => ok<Queue>(p, 'GET', 'contests/duel/queue');
let n = 0;
function submit(user: string, problem: string, state: string, at: number) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','',?,0,4,'judge',?,?)`,
    )
    .run(`ds${++n}`, user, problem, state, at, at);
}
const roomIds = (id: string) =>
  JSON.parse(sqlite().prepare('SELECT problem_ids_json FROM contest_rooms WHERE id=?').pluck().get(id) as string) as string[];

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('two-player Elo with K = 32, the widening window, the ladder bands', () => {
  assert.deepEqual(duelElo(1500, 1500, 1), [1516, 1484]);
  assert.deepEqual(duelElo(1500, 1500, 0.5), [1500, 1500]);
  // The favourite gains little for a win and drops more for a draw.
  const [strong] = duelElo(1800, 1400, 1);
  assert.ok(strong - 1800 < 4);
  assert.deepEqual(duelElo(1800, 1400, 0.5), [1787, 1413]);
  assert.equal(duelWindow(0), 200);
  assert.equal(duelWindow(29999), 200);
  assert.equal(duelWindow(65000), 400);
  assert.equal(duelBand(1500).en, 'Challenger');
  assert.equal(duelBand(1500).color, 'green');
  assert.equal(duelBand(1000).zh, '见习');
});

let first = '';
void test('the queue matches two learners into a ranked duel on problems neither has solved', async () => {
  // Gone 11 minutes: the periodic cleanup on the first rate-limited request drops the row.
  sqlite()
    .prepare("INSERT INTO duel_queue(user_id,display_name,rating,created_at,seen_at) VALUES('d-gone','Gone',1500,?,?)")
    .run(Date.now() - 11 * MIN, Date.now() - 11 * MIN);
  assert.equal(await status(person('d-new', { verified: false }), 'POST', 'contests/duel/queue', { displayName: 'N' }), 403);
  assert.equal(await status(null, 'GET', 'contests/duel/queue'), 401);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM duel_queue').pluck().get(), 0);
  submit(amy.id, 'lc-12', 'accepted', Date.now() - 86400000);
  assert.deepEqual(await poll(amy), { state: 'idle' });
  const waiting = await queue(amy, 'Amy');
  assert.equal(waiting.state, 'waiting');
  assert.equal(waiting.state === 'waiting' && waiting.rating, 1500);
  // Queueing again is the same place in the queue.
  assert.equal((await queue(amy, 'Amy')).state, 'waiting');
  const matched = await queue(bob, 'amy');
  assert.equal(matched.state, 'matched');
  first = matched.state === 'matched' ? matched.roomId : '';
  // The waiting side finds the room on its next poll.
  assert.deepEqual(await poll(amy), { state: 'matched', roomId: first });
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM duel_queue').pluck().get(), 0);
  const ids = roomIds(first);
  assert.equal(ids.length, 2);
  assert.ok(!ids.includes('lc-12'), 'amy solved it already');
  assert.ok(!ids.includes('lc-99'), 'far from 1500');
  const view = await roomView(first, amy);
  assert.equal(view.kind, 'duel');
  assert.equal(view.ranked, true);
  assert.equal(view.phase, 'running');
  assert.equal(view.inviteCode, null);
  assert.equal(view.me?.virtual, false);
  // Same names fold together: the second gets a suffix.
  assert.deepEqual(view.standings!.live.map((r) => r.name).sort(), ['Amy', 'amy #2']);
  assert.equal(await status(cat, 'GET', `contests/${first}`), 404);
  // In a duel: queueing again just points back at it.
  assert.deepEqual(await queue(bob, 'Bob'), { state: 'matched', roomId: first });
});

void test('the first to solve everything wins; the duel is rated once, on its own ladder', async () => {
  // Twenty minutes in.
  const start = Date.now() - 20 * MIN;
  sqlite().prepare('UPDATE contest_rooms SET starts_at=? WHERE id=?').run(start, first);
  const ids = roomIds(first);
  submit(bob.id, ids[0], 'accepted', start + 3 * MIN);
  submit(amy.id, ids[0], 'accepted', start + 4 * MIN);
  // Bob's last one still judging: not decided yet.
  submit(bob.id, ids[1], 'judging', start + 6 * MIN);
  assert.equal((await roomView(first, amy)).rated, false);
  sqlite().prepare("UPDATE submissions SET status='accepted' WHERE status='judging'").run();
  const done = await roomView(first, amy);
  assert.equal(done.rated, true);
  assert.equal(done.winner, 'amy #2');
  assert.deepEqual(
    done.standings!.live.map((r) => [r.name, r.rating]),
    [
      ['amy #2', { before: 1500, after: 1516 }],
      ['Amy', { before: 1500, after: 1484 }],
    ],
  );
  await roomView(first, bob);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM duel_results').pluck().get(), 1);
  assert.deepEqual(duelRecord(bob.id), {
    rating: 1516,
    band: duelBand(1516),
    played: 1,
    wins: 1,
    losses: 0,
    draws: 0,
    streak: 1,
    best: 1,
  });
  assert.equal(duelRecord(amy.id).losses, 1);
  // The weekly rating is untouched.
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM contest_ratings').pluck().get(), 0);
});

void test('a duel nobody finishes is a draw once its window closes', async () => {
  // Problems the first duel can never draw (amy solved lc-12, lc-99 is far off): Bob's accepted
  // ones from it fall inside this window and would finish this duel for him.
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES('draw1',NULL,'Ranked duel','duel','["lc-12","lc-99"]',?,30,'private',?)`,
    )
    .run(Date.now() - 40 * MIN, Date.now() - 40 * MIN);
  const entry = sqlite().prepare(
    "INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES('draw1',?,?,?,NULL)",
  );
  entry.run(bob.id, 'Bob', Date.now() - 40 * MIN);
  entry.run(cat.id, 'Cat', Date.now() - 40 * MIN);
  submit(cat.id, 'lc-12', 'accepted', Date.now() - 35 * MIN);
  await settleDuels();
  const row = sqlite().prepare("SELECT * FROM duel_results WHERE room_id='draw1'").get() as {
    winner: string | null;
    a_user: string;
    a_before: number;
    a_after: number;
  };
  assert.equal(row.winner, null);
  assert.equal(row.a_user, bob.id);
  // Bob was the stronger side, so a draw costs him.
  assert.equal(row.a_before, 1516);
  assert.ok(row.a_after < 1516);
  // A settlement that read the clock first may still insert last: insertion order decides.
  sqlite().prepare("UPDATE duel_results SET created_at=0 WHERE room_id='draw1'").run();
  const record = duelRecord(bob.id);
  assert.deepEqual([record.rating, record.wins, record.draws, record.streak, record.best], [row.a_after, 1, 1, 0, 1]);
});

void test('a pair is matched at most DUEL_PAIR_DAILY times a day; a stale waiter is never matched', async () => {
  for (let i = 1; i < DUEL_PAIR_DAILY; i++) {
    const id = `cap${i}`;
    sqlite()
      .prepare(
        `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
        VALUES(?,NULL,'Ranked duel','duel','[]',?,30,'private',?,?)`,
      )
      .run(id, Date.now() - 60 * MIN, Date.now(), Date.now() - 60 * MIN);
    const entry = sqlite().prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES(?,?,?,?)');
    entry.run(id, amy.id, 'Amy', Date.now());
    entry.run(id, bob.id, 'Bob', Date.now());
  }
  assert.equal((await queue(amy, 'Amy')).state, 'waiting');
  assert.equal((await queue(bob, 'Bob')).state, 'waiting');
  assert.equal((await poll(amy)).state, 'waiting');
  await ok(bob, 'POST', 'contests/duel/leave', {});
  // Amy stops polling: Cat never lands in a room with her.
  sqlite().prepare('UPDATE duel_queue SET seen_at=? WHERE user_id=?').run(Date.now() - 60000, amy.id);
  assert.equal((await queue(cat, 'Cat')).state, 'waiting');
  // Back on the page: matched.
  const matched = await poll(amy);
  assert.equal(matched.state, 'matched');
  await ok(cat, 'POST', 'contests/duel/leave', {});
});

void test('records read from a profile only where it shows contests', async () => {
  assert.equal((await call(bob, 'POST', 'profile', { handle: 'bob-duels', visible: true })).status, 200);
  assert.equal(await status(null, 'GET', 'contests/duel/record?user=bob-duels'), 404);
  assert.equal((await call(bob, 'POST', 'profile', { handle: 'bob-duels', visible: true, showContest: true })).status, 200);
  const record = await ok<{ wins: number; band: { en: string } }>(null, 'GET', 'contests/duel/record?user=Bob-Duels');
  assert.equal(record.wins, 1);
  assert.equal((await ok<{ losses: number }>(amy, 'GET', 'contests/duel/record')).losses, 1);
  assert.equal(await status(null, 'GET', 'contests/duel/record'), 401);
  const { publicProfile } = await import('../lib/server/learner-cloud');
  assert.equal(publicProfile('bob-duels', new Map())!.duel?.wins, 1);
});

void test('matched by the opponent while the poll awaits the problem list: matched, not idle', async () => {
  const dan = person('d-dan');
  const eve = person('d-eve');
  assert.equal((await queue(dan, 'Dan')).state, 'waiting');
  const summaries = contestSources.summaries;
  const eves: Promise<Queue>[] = [];
  // Eve's whole POST runs inside Dan's poll, between its activeDuel check and its match.
  contestSources.summaries = async () => {
    if (!eves.length) {
      eves.push(queue(eve, 'Eve'));
      assert.equal((await eves[0]).state, 'matched');
    }
    return summaries();
  };
  try {
    assert.deepEqual(await poll(dan), await eves[0]);
  } finally {
    contestSources.summaries = summaries;
  }
});
