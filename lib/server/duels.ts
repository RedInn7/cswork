import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { DUEL_MINUTES, duelWindow } from '@/lib/contest';
import type { Person } from './auth';
import { duelRating, duelRecord } from './contest-ratings';
import { contestSources, displayName, enter, fold, insertRoom, judgeable, requireVerified, settleDuels } from './contests';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { HANDLE } from './learner-cloud';
import { readJson } from './my-practice';

/**
 * Ranked 1v1 duels (db/duels-schema.ts). A verified learner queues under a contest name; the
 * longest-waiting learner within duelWindow of their duel rating (the window widens with the
 * longer wait of the two) becomes the opponent, and both enter a private duel room (no owner, no
 * invite code) of two problems near their average duel rating that neither has accepted.
 * Duel ratings start at START_RATING, apart from the weekly's; contests.ts settles each duel.
 * The waiting side learns of the match by polling. A pair is matched at most DUEL_PAIR_DAILY
 * times a day, so two accounts can't farm each other.
 */
const DAY = 86400000;
export const DUEL_PAIR_DAILY = 3;
/** A queued learner who hasn't polled for this long has left the page: never matched. */
const QUEUE_STALE = 30000;
/** ...and after this long, out of the queue (here and in http.ts limit(): the privacy page promises it). */
const QUEUE_DROP = 600000;
/** Problems drawn from this many unsolved ones nearest the pair's rating. */
const NEAREST = 12;

type QueueRow = { user_id: string; display_name: string; rating: number; created_at: number; seen_at: number };

/** The learner's ranked duel still undecided and running, if any. */
function activeDuel(userId: string, now: number) {
  return (
    (sqlite()
      .prepare(
        `SELECT c.id FROM contest_entries e JOIN contest_rooms c ON c.id=e.room_id
        WHERE e.user_id=? AND c.kind='duel' AND c.owner_id IS NULL AND c.rated_at IS NULL AND c.starts_at+c.duration_min*60000>?
        ORDER BY c.starts_at DESC LIMIT 1`,
      )
      .pluck()
      .get(userId, now) as string | undefined) ?? null
  );
}

const pairToday = (a: string, b: string, now: number) =>
  (
    sqlite()
      .prepare(
        `SELECT COUNT(*) AS n FROM contest_entries x JOIN contest_entries y ON y.room_id=x.room_id AND y.user_id=@b
        JOIN contest_rooms c ON c.id=x.room_id
        WHERE x.user_id=@a AND c.kind='duel' AND c.owner_id IS NULL AND c.created_at>@since`,
      )
      .get({ a, b, since: now - DAY }) as { n: number }
  ).n;

/** Two problems near `rating` that neither learner has accepted, easier first; null if too few. */
function drawDuel(pool: readonly { id: string; rating: number }[], users: readonly string[], rating: number) {
  const solved = new Set(
    sqlite()
      .prepare(
        `SELECT DISTINCT problem_id FROM submissions WHERE user_id IN (?,?) AND mode='judge' AND status='accepted'`,
      )
      .pluck()
      .all(...users) as string[],
  );
  const near = pool
    .filter((p) => !solved.has(p.id))
    .sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating) || a.id.localeCompare(b.id))
    .slice(0, NEAREST);
  if (near.length < 2) return null;
  const first = near.splice(randomInt(near.length), 1)[0];
  const second = near[randomInt(near.length)];
  return [first, second].sort((a, b) => a.rating - b.rating).map((p) => p.id);
}

/**
 * Matches the queued reader with the longest-waiting fitting opponent, in one transaction: both
 * leave the queue, the opponent opens the room and the reader's entry starts the clock. The room
 * id, or null while nobody fits.
 */
async function match(p: Person, now: number) {
  const { byId } = await judgeable();
  const pool = contestSources.rated().filter((x) => byId.has(x.id));
  const db = sqlite();
  return db.transaction(() => {
    db.prepare('DELETE FROM duel_queue WHERE seen_at<?').run(now - QUEUE_DROP);
    const me = db.prepare('SELECT * FROM duel_queue WHERE user_id=?').get(p.id) as QueueRow | undefined;
    // Matched by the opponent's request while judgeable() was awaited: that room.
    if (!me) return activeDuel(p.id, now);
    const others = db
      .prepare('SELECT * FROM duel_queue WHERE user_id<>? AND seen_at>? ORDER BY created_at,user_id')
      .all(p.id, now - QUEUE_STALE) as QueueRow[];
    const them = others.find(
      (o) =>
        Math.abs(o.rating - me.rating) <= duelWindow(now - Math.min(o.created_at, me.created_at)) &&
        pairToday(p.id, o.user_id, now) < DUEL_PAIR_DAILY,
    );
    if (!them) return null;
    const ids = drawDuel(pool, [p.id, them.user_id], (me.rating + them.rating) / 2);
    if (!ids) throw new HttpError(409, '可判的题目不够，暂时无法匹配');
    db.prepare('DELETE FROM duel_queue WHERE user_id IN (?,?)').run(p.id, them.user_id);
    const room = insertRoom(
      { owner: null, title: 'Ranked duel', kind: 'duel', ids, startsAt: now, durationMin: DUEL_MINUTES },
      { userId: them.user_id, name: them.display_name, share: false },
      now,
    );
    // Contest names are unique per room.
    const name = fold(me.display_name) === fold(them.display_name) ? `${me.display_name.slice(0, 21)} #2` : me.display_name;
    return enter(room, p, name, now);
  })();
}

/** The reader's place: in a duel, waiting (with the rating window so far) or not queued. */
async function queueState(p: Person, now: number) {
  const roomId = activeDuel(p.id, now) ?? (await match(p, now));
  if (roomId) return { state: 'matched' as const, roomId };
  const me = sqlite().prepare('SELECT * FROM duel_queue WHERE user_id=?').get(p.id) as QueueRow | undefined;
  return me
    ? { state: 'waiting' as const, since: me.created_at, rating: me.rating, window: duelWindow(now - me.created_at) }
    : { state: 'idle' as const };
}
export type DuelQueueState = Awaited<ReturnType<typeof queueState>>;

/**
 * /api/oj/contests/duel/…: queue (POST to join, GET to poll every few seconds), POST leave, and
 * record (?user=<handle> for a visible profile that shows contests, else the reader's own).
 */
export async function handleDuels(request: Request, p: Person | null, path: string[]) {
  const [, , action, extra] = path;
  if (extra !== undefined || !['queue', 'leave', 'record'].includes(action)) throw new HttpError(404, '比赛接口不存在');
  const now = Date.now();
  if (action === 'record') {
    if (request.method !== 'GET') throw new HttpError(404, '比赛接口不存在');
    await limitReader(request, p, 'contest-read', 120);
    await settleDuels(now);
    const handle = new URL(request.url).searchParams.get('user')?.toLowerCase() ?? null;
    if (handle === null) {
      requirePerson(p);
      return json(duelRecord(p.id));
    }
    const userId = HANDLE.test(handle)
      ? (sqlite()
          .prepare('SELECT user_id FROM user_profiles WHERE handle=? AND visible=1 AND show_contest=1')
          .pluck()
          .get(handle) as string | undefined)
      : undefined;
    if (!userId) throw new HttpError(404, '主页不存在');
    return json(duelRecord(userId));
  }
  requirePerson(p);
  const db = sqlite();
  if (request.method === 'GET' && action === 'queue') {
    await limit(p, 'duel-poll', 40);
    db.prepare('UPDATE duel_queue SET seen_at=? WHERE user_id=?').run(now, p.id);
    return json(await queueState(p, now));
  }
  if (request.method !== 'POST') throw new HttpError(404, '比赛接口不存在');
  await limit(p, 'contest-write', 20);
  if (action === 'leave') {
    db.prepare('DELETE FROM duel_queue WHERE user_id=?').run(p.id);
    return json({ state: 'idle' });
  }
  requireVerified(p);
  const d = z.object({ displayName }).strict().parse(await readJson(request, 1000));
  // Earlier duels settle first: the queue holds the rating they left.
  await settleDuels(now);
  if (!activeDuel(p.id, now))
    db.prepare(
      `INSERT INTO duel_queue(user_id,display_name,rating,created_at,seen_at) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,seen_at=excluded.seen_at`,
    ).run(p.id, d.displayName, duelRating(p.id), now, now);
  return json(await queueState(p, now));
}
