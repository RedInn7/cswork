import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import {
  drawWeekly,
  duelWinner,
  eloRatings,
  entryWindow,
  rankRows,
  RATE_GRACE,
  standings,
  START_RATING,
  weeklyId,
  weeklyStart,
  weekNumber,
  weeklyTitle,
  WEEKLY_MINUTES,
  type ContestEntry,
  type ContestSubmission,
  type Standing,
} from '@/lib/contest';
export { RATE_GRACE } from '@/lib/contest';
import { drawMock, LADDER, seededRandom } from '@/lib/mock-oa';
import type { ProblemSummary } from '@/lib/problems';
import type { Person } from './auth';
import { hiddenCompanies } from './env';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { lcRating, lcRatingOf } from './lc-ratings';
import { mockCatalogue, mockPool } from './mock-oa';
import { readJson } from './my-practice';
import { listProblemSummaries } from './oj-problems';
import { ratedJudgeable } from './study-library';
export { ratingHistory } from './contest-ratings';
import { code as inviteCode, newCode, plain } from './study-groups';

/**
 * Contest rooms (db/contests-schema.ts): the weekly site contest, created lazily the first time
 * anyone opens /contest in a week, and learners' own mashups and 1v1 duels. Standings are read
 * from judge submissions inside each entrant's window (ICPC: solved, then AC time + 5 minutes
 * per earlier wrong verdict); nothing about judging changes. Weeklies are rated once, on the
 * first read after the window and a grace period. Scoreboards carry display names chosen on
 * joining, never account ids; a private room reads as missing to anyone not in it.
 */
const MINUTE = 60000;
/** A weekly avoids problems used by this many earlier weeklies. */
const RECENT_WEEKLIES = 26;
export const ROOM_CAP: Record<string, number> = { mashup: 100, duel: 2 };
export const ROOMS_PER_DAY = 10;
/** Scoreboard rows per table; the reader's own row is always added. */
export const BOARD_ROWS = 200;
const problemId = z.string().regex(/^(?:oa-[a-z0-9-]{1,180}|lc-\d{1,6})$/);
const displayName = plain(24);
const roomId = /^[A-Za-z0-9_-]{1,24}$/;

type RoomRow = {
  id: string;
  owner_id: string | null;
  title: string;
  kind: 'weekly' | 'mashup' | 'duel';
  problem_ids_json: string;
  starts_at: number;
  duration_min: number;
  invite_code: string | null;
  visibility: 'public' | 'private';
  rated_at: number | null;
  created_at: number;
};
type EntryRow = { user_id: string; display_name: string; joined_at: number; virtual_start: number | null };

// ponytail: swappable sources so tests need no judge packages; production never reassigns them.
let summaryCache: { at: number; value: Promise<ProblemSummary[]> } | null = null;
export const contestSources = {
  /** Published problems anyone may judge (5-minute snapshot). */
  summaries(): Promise<ProblemSummary[]> {
    if (!summaryCache || Date.now() - summaryCache.at > 300000) {
      const value = listProblemSummaries(null);
      summaryCache = { at: Date.now(), value };
      value.catch(() => {
        if (summaryCache?.value === value) summaryCache = null;
      });
    }
    return summaryCache.value;
  },
  /** Judgeable LeetCode problems with a contest rating: the weekly's pool. */
  rated: () => ratedJudgeable(),
};

/** Coding problems a room may hold, hidden companies left out, with their summaries. */
async function judgeable() {
  const list = await contestSources.summaries();
  const byId = new Map(list.map((p) => [p.id, p]));
  const catalogue = mockCatalogue(list);
  return { byId, catalogue, ids: new Set(mockPool(catalogue, null, 'mixed').map((item) => item.id)) };
}
const hiddenOa = (id: string, hidden: ReadonlySet<string>) =>
  [...hidden].some((slug) => id.startsWith(`oa-${slug}-`));
/** The room's problems still shown here: unpublished and hidden-company ones drop out. */
async function roomProblems(row: RoomRow, found?: Awaited<ReturnType<typeof judgeable>>) {
  const { byId } = found ?? (await judgeable());
  const hidden = hiddenCompanies();
  return (JSON.parse(row.problem_ids_json) as string[]).filter((id) => byId.has(id) && !hiddenOa(id, hidden));
}
const endOf = (row: RoomRow) => row.starts_at + row.duration_min * MINUTE;
const weekOf = (row: RoomRow) => (row.kind === 'weekly' ? Number(row.id.slice(7)) : null);

// ---------------------------------------------------------------- the weekly contest

/** This week's weekly, drawn on first sight; null before week 1 or with too small a pool. */
export function ensureWeekly(now = Date.now()) {
  const week = weekNumber(now);
  if (week < 1) return null;
  const db = sqlite(),
    id = weeklyId(week);
  const found = db.prepare('SELECT * FROM contest_rooms WHERE id=?').get(id) as RoomRow | undefined;
  if (found) return found;
  const used = new Set(
    (
      db
        .prepare("SELECT problem_ids_json FROM contest_rooms WHERE kind='weekly' ORDER BY starts_at DESC LIMIT ?")
        .pluck()
        .all(RECENT_WEEKLIES) as string[]
    ).flatMap((ids) => JSON.parse(ids) as string[]),
  );
  const ids = drawWeekly(contestSources.rated(), week, used);
  if (!ids) return null;
  // Two first visitors draw the same set; the second insert is a no-op.
  db.prepare(
    `INSERT OR IGNORE INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
    VALUES(?,NULL,?,'weekly',?,?,?,'public',?)`,
  ).run(id, weeklyTitle(week, false), JSON.stringify(ids), weeklyStart(week), WEEKLY_MINUTES, now);
  return db.prepare('SELECT * FROM contest_rooms WHERE id=?').get(id) as RoomRow;
}

function roomStandings(row: RoomRow, ids: readonly string[], now: number) {
  const db = sqlite();
  const entries = (
    db
      .prepare('SELECT user_id,display_name,joined_at,virtual_start FROM contest_entries WHERE room_id=?')
      .all(row.id) as EntryRow[]
  ).map(
    (e): ContestEntry => ({
      userId: e.user_id,
      name: e.display_name,
      joinedAt: e.joined_at,
      virtualStart: e.virtual_start,
    }),
  );
  const submissions =
    ids.length && entries.length
      ? (db
          .prepare(
            `SELECT user_id,problem_id,status,created_at FROM submissions
            WHERE mode='judge' AND created_at>=? AND problem_id IN (${ids.map(() => '?').join(',')})
              AND user_id IN (SELECT user_id FROM contest_entries WHERE room_id=?)`,
          )
          .all(row.starts_at, ...ids, row.id) as ContestSubmission[])
      : [];
  return {
    entries,
    ...standings({ startsAt: row.starts_at, durationMin: row.duration_min, problemIds: ids }, entries, submissions, now),
  };
}

/**
 * Rates every finished weekly not yet rated, oldest first, so each starts from the ratings
 * before it. Live entrants with a submission in the window are rated; the guard on rated_at
 * makes a second (or concurrent) call a no-op.
 */
export async function settleWeeklies(now = Date.now()) {
  const db = sqlite();
  const due = db
    .prepare(
      `SELECT * FROM contest_rooms WHERE kind='weekly' AND rated_at IS NULL AND starts_at+duration_min*${MINUTE}+?<=?
      ORDER BY starts_at`,
    )
    .all(RATE_GRACE, now) as RoomRow[];
  for (const row of due) {
    const ids = await roomProblems(row);
    db.transaction(() => {
      if (!db.prepare('UPDATE contest_rooms SET rated_at=? WHERE id=? AND rated_at IS NULL').run(now, row.id).changes)
        return;
      const rated = rankRows(roomStandings(row, ids, Infinity).live.filter((s) => s.tried));
      const prior = db.prepare(
        `SELECT r.after,(SELECT COUNT(*) FROM contest_ratings x JOIN contest_rooms y ON y.id=x.room_id
            WHERE x.user_id=r.user_id AND y.starts_at<@at) AS contests
        FROM contest_ratings r JOIN contest_rooms c ON c.id=r.room_id
        WHERE r.user_id=@user AND c.starts_at<@at ORDER BY c.starts_at DESC LIMIT 1`,
      );
      const players = rated.map((s) => {
        const before = prior.get({ user: s.userId, at: row.starts_at }) as { after: number; contests: number } | undefined;
        return { rating: before?.after ?? START_RATING, contests: before?.contests ?? 0, rank: s.rank };
      });
      const after = eloRatings(players);
      const insert = db.prepare(
        'INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES(?,?,?,?,?,?,?,?)',
      );
      rated.forEach((s, i) =>
        insert.run(s.userId, row.id, players[i].rating, after[i], s.rank, rated.length, s.solved, now),
      );
    })();
  }
}

/** Current ratings, highest first: weekly display names only, never accounts. */
export async function leaderboard(p: Person | null, max = 100, now = Date.now()) {
  await settleWeeklies(now);
  const rows = sqlite()
    .prepare(
      `SELECT r.user_id,r.after AS rating,e.display_name AS name,
        (SELECT COUNT(*) FROM contest_ratings x WHERE x.user_id=r.user_id) AS contests
      FROM contest_ratings r JOIN contest_rooms c ON c.id=r.room_id
      LEFT JOIN contest_entries e ON e.room_id=r.room_id AND e.user_id=r.user_id
      WHERE c.starts_at=(SELECT MAX(c2.starts_at) FROM contest_ratings r2 JOIN contest_rooms c2 ON c2.id=r2.room_id
        WHERE r2.user_id=r.user_id)
      ORDER BY r.after DESC,c.starts_at,r.user_id LIMIT ?`,
    )
    .all(max) as { user_id: string; rating: number; name: string | null; contests: number }[];
  let rank = 0;
  return rows.map((r, i) => {
    if (!i || rows[i - 1].rating !== r.rating) rank = i + 1;
    return { rank, name: r.name ?? '—', rating: r.rating, contests: r.contests, me: r.user_id === p?.id };
  });
}

// ---------------------------------------------------------------- rooms

function readable(id: string, p: Person | null) {
  const db = sqlite();
  const row = roomId.test(id)
    ? (db.prepare('SELECT * FROM contest_rooms WHERE id=?').get(id) as RoomRow | undefined)
    : undefined;
  const entry =
    row && p
      ? (db
          .prepare('SELECT user_id,display_name,joined_at,virtual_start FROM contest_entries WHERE room_id=? AND user_id=?')
          .get(row.id, p.id) as EntryRow | undefined)
      : undefined;
  if (!row || (row.visibility !== 'public' && !entry && p?.role !== 'teacher')) throw new HttpError(404, '比赛不存在');
  return { row, entry };
}
const entrantCount = (room: string) =>
  (sqlite().prepare('SELECT COUNT(*) AS n FROM contest_entries WHERE room_id=?').get(room) as { n: number }).n;

/** For lists: no problems, no names. */
function card(row: RoomRow & { entrants?: number }) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    week: weekOf(row),
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    entrants: row.entrants ?? entrantCount(row.id),
  };
}

/**
 * A room as its reader may see it. Problems: never before the start; during the live window to
 * entrants; after it to anyone who can open the room. Standings from the start, in two tables
 * (live, virtual), top BOARD_ROWS plus the reader's own row.
 */
export async function roomView(id: string, p: Person | null, now = Date.now()) {
  if (id.startsWith('weekly-')) await settleWeeklies(now);
  const { row, entry } = readable(id, p);
  const found = await judgeable();
  const ids = await roomProblems(row, found);
  const { byId } = found;
  const end = endOf(row);
  const phase = now < row.starts_at ? 'upcoming' : now < end ? 'running' : 'ended';
  const board = phase === 'upcoming' ? null : roomStandings(row, ids, now);
  const ratings =
    row.kind === 'weekly' && row.rated_at
      ? new Map(
          (
            sqlite()
              .prepare('SELECT user_id,before,after FROM contest_ratings WHERE room_id=?')
              .all(row.id) as { user_id: string; before: number; after: number }[]
          ).map((r) => [r.user_id, r]),
        )
      : null;
  const shown = (list: Standing[]) =>
    list
      .filter((s, i) => i < BOARD_ROWS || s.userId === p?.id)
      .map((s) => {
        const rating = ratings?.get(s.userId);
        return {
          rank: s.rank,
          name: s.name,
          solved: s.solved,
          penalty: s.penalty,
          finishedAt: s.finishedAt,
          cells: s.cells,
          me: s.userId === p?.id,
          rating: rating ? { before: rating.before, after: rating.after } : null,
        };
      });
  const own = entry
    ? entryWindow({ startsAt: row.starts_at, durationMin: row.duration_min }, { virtualStart: entry.virtual_start })
    : null;
  const entrants = board?.entries.length ?? entrantCount(row.id);
  const cap = ROOM_CAP[row.kind] ?? null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    week: weekOf(row),
    visibility: row.visibility,
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    endsAt: end,
    phase,
    now,
    entrants,
    cap,
    // Entrants pass a private room on; nobody needs a code for the public weekly.
    inviteCode: entry && row.visibility === 'private' ? row.invite_code : null,
    owner: !!p && row.owner_id === p.id,
    problemCount: ids.length,
    problems:
      phase === 'ended' || (phase === 'running' && entry)
        ? ids.map((pid) => {
            const s = byId.get(pid);
            return { id: pid, title: s?.title ?? pid, titleEn: s?.titleEn ?? null, difficulty: s?.difficulty ?? null, rating: lcRating(pid) };
          })
        : null,
    standings: board ? { live: shown(board.live), virtual: shown(board.virtual) } : null,
    winner: row.kind === 'duel' && board ? (duelWinner(board.live)?.name ?? null) : null,
    rated: !!row.rated_at,
    me: entry && own ? { name: entry.display_name, virtual: entry.virtual_start !== null, ...own } : null,
    canJoin: !!p && !entry && row.visibility === 'public' && (cap === null || entrants < cap),
    // The name the reader last raced under, to prefill the join form.
    suggestedName:
      p && !entry
        ? ((sqlite()
            .prepare('SELECT display_name FROM contest_entries WHERE user_id=? ORDER BY joined_at DESC LIMIT 1')
            .pluck()
            .get(p.id) as string | undefined) ?? '')
        : '',
  };
}
export type RoomView = Awaited<ReturnType<typeof roomView>>;

/** /contest: this week's weekly, past ones, and the reader's rooms. */
export async function contestLobby(p: Person | null, now = Date.now()) {
  const weekly = ensureWeekly(now);
  await settleWeeklies(now);
  const db = sqlite();
  const withCount = `c.*,(SELECT COUNT(*) FROM contest_entries x WHERE x.room_id=c.id) AS entrants`;
  const past = db
    .prepare(`SELECT ${withCount} FROM contest_rooms c WHERE kind='weekly' AND starts_at+duration_min*${MINUTE}<=? ORDER BY starts_at DESC LIMIT 12`)
    .all(now) as (RoomRow & { entrants: number })[];
  const mine = p
    ? (db
        .prepare(
          `SELECT ${withCount} FROM contest_entries e JOIN contest_rooms c ON c.id=e.room_id WHERE e.user_id=?
          ORDER BY c.starts_at DESC LIMIT 30`,
        )
        .all(p.id) as (RoomRow & { entrants: number })[])
    : [];
  const last = p
    ? (db
        .prepare(
          `SELECT (SELECT display_name FROM contest_entries WHERE user_id=@u ORDER BY joined_at DESC LIMIT 1) AS name,
            (SELECT r.after FROM contest_ratings r JOIN contest_rooms c ON c.id=r.room_id WHERE r.user_id=@u
              ORDER BY c.starts_at DESC LIMIT 1) AS rating`,
        )
        .get({ u: p.id }) as { name: string | null; rating: number | null })
    : null;
  return {
    now,
    weekly: weekly ? card(weekly) : null,
    nextWeekly: weeklyStart(weekNumber(now) + 1),
    past: past.filter((r) => r.id !== weekly?.id).map(card),
    mine: mine.map(card),
    me: p ? { signedIn: true, verified: p.verified || p.role === 'teacher', name: last?.name ?? '', rating: last?.rating ?? null } : null,
    replays: p ? replays() : [],
  };
}

/** Past LeetCode contests with at least two problems judgeable here, newest first. */
function replays() {
  const byContest = new Map<string, { code: string; count: number; newest: number }>();
  for (const { id } of contestSources.rated()) {
    const n = Number(id.slice(3)),
      r = lcRatingOf(n);
    if (!r) continue;
    const entry = byContest.get(r.contest) ?? { code: r.contest, count: 0, newest: 0 };
    entry.count++;
    entry.newest = Math.max(entry.newest, n);
    byContest.set(r.contest, entry);
  }
  return [...byContest.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.newest - a.newest)
    .map(({ code, count }) => ({ code, count }));
}

const createSchema = z
  .object({
    kind: z.enum(['mashup', 'duel']),
    title: plain(60),
    displayName,
    startsAt: z.number().int(),
    durationMin: z.number().int().min(15).max(180),
    problems: z.array(problemId).min(1).max(6).optional(),
    draw: z
      .object({ questions: z.number().int().min(1).max(4), source: z.enum(['mixed', 'oa', 'lc']).default('mixed') })
      .strict()
      .optional(),
    replay: z.string().regex(/^[wb]\d{1,4}$/).optional(),
  })
  .strict()
  .refine((d) => [d.problems, d.draw, d.replay].filter((x) => x !== undefined).length === 1);

function requireVerified(p: Person) {
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
}

async function createRoom(p: Person, input: unknown, now = Date.now()) {
  requireVerified(p);
  const d = createSchema.parse(input);
  if (d.startsAt > now + 7 * 86400000) throw new HttpError(400, '开赛时间最多提前 7 天');
  const { ids: allowed, catalogue } = await judgeable();
  let ids: string[];
  if (d.problems) {
    ids = [...new Set(d.problems)];
    if (!ids.every((id) => allowed.has(id))) throw new HttpError(400, '有题目不能用于比赛');
  } else if (d.draw) {
    const drawn = drawMock({
      pool: mockPool(catalogue, null, d.draw.source),
      slots: LADDER[d.draw.questions],
      random: seededRandom(randomInt(2 ** 31)),
    });
    if (!drawn) throw new HttpError(409, '可判的题目不够，换个题源或减少题量');
    ids = drawn;
  } else {
    ids = contestSources
      .rated()
      .flatMap(({ id }) => {
        const r = lcRatingOf(Number(id.slice(3)));
        return r?.contest === d.replay && allowed.has(id) ? [{ id, q: r.q }] : [];
      })
      .sort((a, b) => a.q - b.q)
      .map((x) => x.id);
    if (!ids.length) throw new HttpError(404, '这场周赛没有可判的题目');
  }
  const db = sqlite();
  const id = randomBytes(9).toString('base64url');
  db.transaction(() => {
    const { n } = db
      .prepare('SELECT COUNT(*) AS n FROM contest_rooms WHERE owner_id=? AND created_at>?')
      .get(p.id, now - 86400000) as { n: number };
    if (n >= ROOMS_PER_DAY) throw new HttpError(429, '每天最多创建 10 个比赛房间');
    db.prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,invite_code,visibility,created_at)
      VALUES(?,?,?,?,?,?,?,?,'private',?)`,
    ).run(id, p.id, d.title, d.kind, JSON.stringify(ids), Math.max(now, d.startsAt), d.durationMin, newCode(), now);
    db.prepare(
      'INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,?,NULL)',
    ).run(id, p.id, d.displayName, now);
  })();
  return id;
}

/** Compared in JS: SQLite lower() folds ASCII only. */
const fold = (s: string) => s.normalize('NFKC').toLowerCase();

/** Joins live until the window ends, then as a virtual run from now. Idempotent. */
function enter(row: RoomRow, p: Person, name: string, now = Date.now()) {
  requireVerified(p);
  const db = sqlite();
  db.transaction(() => {
    if (db.prepare('SELECT 1 FROM contest_entries WHERE room_id=? AND user_id=?').get(row.id, p.id)) return;
    const names = db.prepare('SELECT display_name FROM contest_entries WHERE room_id=?').pluck().all(row.id) as string[];
    const cap = ROOM_CAP[row.kind];
    if (cap && names.length >= cap) throw new HttpError(409, '房间已满');
    if (names.some((n) => fold(n) === fold(name))) throw new HttpError(409, '这个昵称在本场已被使用');
    db.prepare(
      'INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,?,?)',
    ).run(row.id, p.id, name, now, now >= endOf(row) ? now : null);
  })();
  return row.id;
}

function byCode(value: unknown) {
  const parsed = inviteCode.safeParse(value);
  const row = parsed.success
    ? (sqlite().prepare('SELECT * FROM contest_rooms WHERE invite_code=?').get(parsed.data) as RoomRow | undefined)
    : undefined;
  if (!row) throw new HttpError(404, '邀请码无效');
  return row;
}

/** Problem picker: judgeable problems by number, id or title. */
async function search(q: string) {
  const { byId, ids } = await judgeable();
  const text = q.trim().toLowerCase().slice(0, 80);
  if (!text) return [];
  const number = /^\d{1,6}$/.test(text) ? `lc-${text}` : null;
  return [...ids]
    .map((id) => byId.get(id)!)
    .filter(
      (s) =>
        s.id === number ||
        s.id.includes(text) ||
        s.title.toLowerCase().includes(text) ||
        !!s.titleEn?.toLowerCase().includes(text),
    )
    .sort((a, b) => Number(b.id === number) - Number(a.id === number) || a.id.localeCompare(b.id, 'en', { numeric: true }))
    .slice(0, 20)
    .map((s) => ({ id: s.id, title: s.title, titleEn: s.titleEn ?? null, difficulty: s.difficulty, rating: lcRating(s.id) }));
}

/** /api/oj/contests/…: the weekly, standings and the leaderboard read signed out; the rest needs an account. */
export async function handleContests(request: Request, p: Person | null, path: string[]) {
  const [, id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '比赛接口不存在');
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    if (id === 'search' && !action) {
      requirePerson(p);
      await limit(p, 'contest-search', 60);
      return json({ items: await search(params.get('q') ?? '') });
    }
    if (id === 'preview' && !action) {
      requirePerson(p);
      // Invite codes are short: probing them costs the join budget.
      await limit(p, 'contest-join', 10);
      await limit(p, 'contest-join-hour', 60, 3600);
      const row = byCode(params.get('code') ?? '');
      return json({ ...card(row), full: !!ROOM_CAP[row.kind] && entrantCount(row.id) >= ROOM_CAP[row.kind] });
    }
    await limitReader(request, p, 'contest-read', 120);
    if (!id) return json(await contestLobby(p));
    if (id === 'leaderboard' && !action) return json({ items: await leaderboard(p) });
    if (action) throw new HttpError(404, '比赛接口不存在');
    return json(await roomView(id, p));
  }
  if (request.method !== 'POST') throw new HttpError(404, '比赛接口不存在');
  requirePerson(p);
  await limit(p, 'contest-write', 20);
  if (!id) return json(await roomView(await createRoom(p, await readJson(request, 4000)), p), 201);
  if (id === 'join' && !action) {
    await limit(p, 'contest-join', 10);
    await limit(p, 'contest-join-hour', 60, 3600);
    const d = z.object({ code: z.string(), displayName }).strict().parse(await readJson(request, 1000));
    return json(await roomView(enter(byCode(d.code), p, d.displayName), p));
  }
  if (action === 'join') {
    const { row } = readable(id, p);
    if (row.visibility !== 'public') throw new HttpError(404, '比赛不存在');
    const d = z.object({ displayName }).strict().parse(await readJson(request, 1000));
    return json(await roomView(enter(row, p, d.displayName), p));
  }
  throw new HttpError(404, '比赛接口不存在');
}
