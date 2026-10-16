/**
 * Contest rooms, the weekly and the starter: their schedules, calendar and draws, ICPC standings,
 * Elo-style ratings, ranked duel ratings and rating bands. Pure and client-safe;
 * lib/server/contests.ts feeds it rows.
 */
import { calendar, escapeText, utcStamp, vevent } from './ics';
import type { RatingBand } from './lc-rating';
import { seededRandom } from './mock-oa';

const MINUTE = 60000,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR,
  WEEK = 7 * DAY;

// ---------------------------------------------------------------- the weekly contest

/** Monday 2026-10-12 00:00 Beijing time: week 1. */
export const WEEKLY_EPOCH = Date.UTC(2026, 9, 11, 16);
/**
 * Sunday 09:00–10:30 Beijing time, i.e. Saturday evening in the Americas, and clear of the
 * LeetCode weekly at 10:30. ponytail: one fixed slot; move it here.
 */
export const WEEKLY_OFFSET = 6 * DAY + 9 * HOUR;
export const WEEKLY_MINUTES = 90;
/** The weekly's number for a moment: week 1 starts at WEEKLY_EPOCH. */
export const weekNumber = (now: number) => Math.floor((now - WEEKLY_EPOCH) / WEEK) + 1;
export const weeklyStart = (week: number) => WEEKLY_EPOCH + (week - 1) * WEEK + WEEKLY_OFFSET;
export const weeklyId = (week: number) => `weekly-${week}`;
/** Late verdicts land before a finished weekly is rated. */
export const RATE_GRACE = 15 * MINUTE;
export const weeklyTitle = (week: number, zh: boolean, kind = 'weekly') =>
  kind === 'starter'
    ? zh
      ? `CSWork 入门赛 第 ${week} 期`
      : `CSWork Starter #${week}`
    : zh
      ? `CSWork 周赛 第 ${week} 期`
      : `CSWork Weekly #${week}`;

/** The starter: Wednesday 20:00–21:00 Beijing time of the same week, three easier problems. */
export const STARTER_OFFSET = 2 * DAY + 20 * HOUR;
export const STARTER_MINUTES = 60;
export const starterStart = (week: number) => WEEKLY_EPOCH + (week - 1) * WEEK + STARTER_OFFSET;
export const starterId = (week: number) => `starter-${week}`;
/** Codeforces Div. 3 rule: a starter rates only entrants below this before it; the rest race unrated. */
export const STARTER_RATED_BELOW = 1700;

/** The weekly and the starter: public, rated on one shared Elo. Everything else is a private room. */
export const isRatedKind = (kind: string): kind is 'weekly' | 'starter' => kind === 'weekly' || kind === 'starter';
/** weekly-<n> and starter-<n> give n; any other room id null. */
export function roomWeek(id: string) {
  const m = /^(?:weekly|starter)-(\d{1,6})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Q1–Q4 by contest rating (zerotrac): [from, to] inclusive. */
export const WEEKLY_SLOTS: readonly (readonly [number, number])[] = [
  [1200, 1400],
  [1500, 1700],
  [1800, 2000],
  [2100, Infinity],
];
/** The starter's Q1–Q3: a slot below the weekly's each. */
export const STARTER_SLOTS: readonly (readonly [number, number])[] = [
  [1000, 1199],
  [1200, 1400],
  [1500, 1700],
];

/**
 * One judgeable problem per slot (the weekly's four by default), the same for the same seed and
 * pool. Per slot: a problem in range that recent contests have not used, else any in range, else
 * the nearest rating. Null when the pool has fewer problems than slots.
 */
export function drawWeekly(
  pool: readonly { id: string; rating: number }[],
  seed: number,
  used: ReadonlySet<string> = new Set(),
  slots = WEEKLY_SLOTS,
) {
  const random = seededRandom(seed);
  const sorted = [...new Map(pool.map((p) => [p.id, p])).values()].sort((a, b) => a.id.localeCompare(b.id));
  if (sorted.length < slots.length) return null;
  const picked: string[] = [];
  for (const [from, to] of slots) {
    const left = sorted.filter((p) => !picked.includes(p.id));
    const fits = left.filter((p) => p.rating >= from && p.rating <= to);
    const fresh = fits.filter((p) => !used.has(p.id));
    let candidates = fresh.length ? fresh : fits;
    if (!candidates.length) {
      const mid = to === Infinity ? from + 150 : (from + to) / 2;
      const nearest = Math.min(...left.map((p) => Math.abs(p.rating - mid)));
      candidates = left.filter((p) => Math.abs(p.rating - mid) === nearest);
    }
    picked.push(candidates[Math.floor(random() * candidates.length)].id);
  }
  return picked;
}

type IcsContest = { id: string; start: number; minutes: number; title: string; url: string; recurring?: boolean };
/**
 * Contests as an .ics file, each reminded 30 minutes before. `recurring` repeats it every week
 * from `start`: Beijing time has no daylight saving, so a fixed UTC start stays on its local hour.
 * `name` titles a subscribed calendar.
 */
export const contestIcs = (contests: readonly IcsContest[], name?: string, now = Date.now()) =>
  calendar(
    ['VERSION:2.0', 'PRODID:-//CSWork//Contests//EN', 'CALSCALE:GREGORIAN', ...(name ? [`X-WR-CALNAME:${escapeText(name)}`] : [])],
    contests.map((c) =>
      vevent(
        `cswork-${c.id}@cswork`,
        now,
        [
          `DTSTART:${utcStamp(c.start)}`,
          `DTEND:${utcStamp(c.start + c.minutes * MINUTE)}`,
          ...(c.recurring ? ['RRULE:FREQ=WEEKLY'] : []),
          `SUMMARY:${escapeText(c.title)}`,
          `DESCRIPTION:${escapeText(c.url)}`,
          `URL:${c.url}`,
        ],
        { trigger: '-PT30M', note: c.title },
      ),
    ),
  );

/** Room kinds as [zh, en]. */
export const CONTEST_KINDS = {
  weekly: ['周赛', 'Weekly'],
  starter: ['入门赛', 'Starter'],
  mashup: ['自选赛', 'Mashup'],
  duel: ['1v1 对战', '1v1 duel'],
} as const satisfies Record<string, readonly [string, string]>;

// ---------------------------------------------------------------- standings (ICPC rules)

/** Each wrong verdict before a problem's first AC adds 5 minutes. */
export const PENALTY_MS = 5 * MINUTE;
/**
 * Verdicts still on their way: lib/oj-client.ts's activeStatuses, copied because that module
 * pulls the client-only i18n into the server code that scores rooms.
 */
const PENDING = new Set(['pending', 'submitting', 'queued', 'compiling', 'running', 'judging', 'processing']);
/** Verdicts that cost a penalty: compile errors and judge faults do not. */
export const PENALIZED = new Set(['wrong_answer', 'time_limit', 'memory_limit', 'output_limit', 'runtime_error']);

export type ContestSubmission = { user_id: string; problem_id: string; status: string; created_at: number };
export type ContestEntry = { userId: string; name: string; joinedAt: number; virtualStart: number | null };
export type ContestRoomTimes = { startsAt: number; durationMin: number };
export type Cell = {
  solved: boolean;
  /** First AC, ms after the entrant's start. */
  at: number | null;
  wrong: number;
  pending: boolean;
};
export type Standing = {
  userId: string;
  name: string;
  virtual: boolean;
  solved: number;
  /** AC times plus PENALTY_MS per wrong attempt before them. */
  penalty: number;
  /** When the last problem fell, for an entrant who solved them all. */
  finishedAt: number | null;
  /** Any submission in the window: rated weeklies count only these entrants. */
  tried: boolean;
  cells: Cell[];
  rank: number;
};

/** A live entrant runs on the room's clock; a virtual one from their own start. */
export function entryWindow(room: ContestRoomTimes, entry: Pick<ContestEntry, 'virtualStart'>) {
  const start = entry.virtualStart ?? room.startsAt;
  return { start, end: start + room.durationMin * MINUTE };
}

/** Same solved and penalty share a rank (1, 2, 2, 4); names only order the tie. */
export function rankRows<T extends { solved: number; penalty: number; name: string }>(rows: readonly T[]) {
  const sorted = [...rows].sort(
    (a, b) => b.solved - a.solved || a.penalty - b.penalty || a.name.localeCompare(b.name),
  );
  const ranked: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const prev = ranked[i - 1];
    ranked.push({
      ...row,
      rank: prev && prev.solved === row.solved && prev.penalty === row.penalty ? prev.rank : i + 1,
    });
  });
  return ranked;
}

/**
 * Live and virtual standings, each ranked on its own. Only judge submissions on the room's
 * problems inside an entrant's window (and before `now`) count. `questions`: per question (Q1 is
 * 1), how many live entrants solved it and how many submitted to it at all; counts only, never
 * the problem, so a running room may show them.
 */
export function standings(
  room: ContestRoomTimes & { problemIds: readonly string[] },
  entries: readonly ContestEntry[],
  submissions: readonly ContestSubmission[],
  now = Infinity,
) {
  const byUser = new Map<string, ContestSubmission[]>();
  for (const s of submissions) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const questions = room.problemIds.map((_, i) => ({ q: i + 1, solved: 0, tried: 0 }));
  const rows = entries.map((entry) => {
    const { start, end } = entryWindow(room, entry);
    const mine = (byUser.get(entry.userId) ?? [])
      .filter((s) => s.created_at >= start && s.created_at <= Math.min(end, now) && s.status !== 'cancelled')
      .sort((a, b) => a.created_at - b.created_at);
    let solved = 0,
      penalty = 0,
      last = 0;
    const cells = room.problemIds.map((id): Cell => {
      let wrong = 0,
        pending = false;
      for (const s of mine) {
        if (s.problem_id !== id) continue;
        if (s.status === 'accepted') {
          const at = s.created_at - start;
          solved++;
          penalty += at + wrong * PENALTY_MS;
          last = Math.max(last, at);
          return { solved: true, at, wrong, pending: false };
        }
        if (PENALIZED.has(s.status)) wrong++;
        else if (PENDING.has(s.status)) pending = true;
      }
      return { solved: false, at: null, wrong, pending };
    });
    if (entry.virtualStart === null)
      room.problemIds.forEach((id, i) => {
        if (cells[i].solved) questions[i].solved++;
        if (mine.some((s) => s.problem_id === id)) questions[i].tried++;
      });
    return {
      userId: entry.userId,
      name: entry.name,
      virtual: entry.virtualStart !== null,
      solved,
      penalty,
      finishedAt: solved > 0 && solved === room.problemIds.length ? last : null,
      tried: mine.some((s) => room.problemIds.includes(s.problem_id)),
      cells,
    };
  });
  return {
    live: rankRows(rows.filter((r) => !r.virtual)) as Standing[],
    virtual: rankRows(rows.filter((r) => r.virtual)) as Standing[],
    questions,
  };
}

/** A duel goes to whoever solved every problem first; null until someone has. */
export function duelWinner(rows: readonly Standing[]) {
  const done = rows.filter((r) => r.finishedAt !== null);
  return done.length ? done.reduce((a, b) => (b.finishedAt! < a.finishedAt! ? b : a)) : null;
}

// ---------------------------------------------------------------- ratings

export const START_RATING = 1500;
/** 1 + the chance each other entrant finishes ahead of rating `r`. */
const expectedRank = (r: number, others: readonly number[]) =>
  1 + others.reduce((sum, o) => sum + 1 / (1 + 10 ** ((r - o) / 400)), 0);
/** How far one contest moves a rating: 1/2 at the first, falling toward 2/9. */
export const ratingWeight = (contests: number) => {
  let sum = 0;
  for (let i = 0; i <= contests; i++) sum += (5 / 7) ** i;
  return 1 / (1 + sum);
};

/**
 * Elo the LeetCode way: each entrant's expected rank comes from everyone's ratings
 * (logistic); the rating whose expected rank is the geometric mean of the expected and the
 * actual rank is the target, and the rating moves toward it by ratingWeight(contests).
 * `rank` is the shared standings rank (1, 2, 2, 4); a tie counts as the middle of the places it
 * covers (2.5 for the two 2s), else everyone tied at the bottom would gain.
 * ponytail: O(n² · 40); fine for hundreds of entrants, sort and bucket if it reaches thousands.
 */
export function eloRatings(players: readonly { rating: number; contests: number; rank: number }[]) {
  if (players.length < 2) return players.map((p) => p.rating);
  const tied = new Map<number, number>();
  for (const p of players) tied.set(p.rank, (tied.get(p.rank) ?? 0) + 1);
  return players.map((p, i) => {
    const others = players.flatMap((o, j) => (j === i ? [] : [o.rating]));
    const place = p.rank + (tied.get(p.rank)! - 1) / 2;
    const target = Math.sqrt(expectedRank(p.rating, others) * place);
    // expectedRank falls as the rating rises.
    let lo = 0,
      hi = 5000;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (expectedRank(mid, others) > target) lo = mid;
      else hi = mid;
    }
    return Math.round(p.rating + (lo - p.rating) * ratingWeight(p.contests));
  });
}

/** Rating bands, named after the line's trains. `color` reuses the problem-rating chip colours. */
export const CONTEST_BANDS = [
  { key: 'depot', zh: '车库', en: 'Depot', color: 'grey', from: 0 },
  { key: 'local', zh: '站站停', en: 'Local', color: 'green', from: 1400 },
  { key: 'express', zh: '快车', en: 'Express', color: 'cyan', from: 1600 },
  { key: 'rapid', zh: '直达', en: 'Rapid', color: 'blue', from: 1850 },
  { key: 'limited', zh: '特快', en: 'Limited', color: 'purple', from: 2100 },
  { key: 'bullet', zh: '高铁', en: 'Bullet', color: 'orange', from: 2400 },
  { key: 'maglev', zh: '磁浮', en: 'Maglev', color: 'red', from: 2700 },
] as const satisfies readonly { key: string; zh: string; en: string; color: RatingBand; from: number }[];
export type ContestBand = (typeof CONTEST_BANDS)[number];
export const contestBand = (rating: number): ContestBand =>
  CONTEST_BANDS.findLast((band) => rating >= band.from) ?? CONTEST_BANDS[0];

// ---------------------------------------------------------------- ranked duels

export const DUEL_MINUTES = 30;
/** Matched within this rating gap: 200 at first, 100 wider per 30 seconds waited. */
export const duelWindow = (waitedMs: number) => 200 + 100 * Math.floor(Math.max(0, waitedMs) / 30000);
/** Two-player Elo, K = 32: A scores 1, 0.5 or 0; B loses what A gains. */
export function duelElo(a: number, b: number, score: number) {
  const delta = Math.round(32 * (score - 1 / (1 + 10 ** ((b - a) / 400))));
  return [a + delta, b - delta] as const;
}
/** The duel ladder's own names on the contest bands' thresholds and colours. */
const DUEL_NAMES: Record<ContestBand['key'], readonly [string, string]> = {
  depot: ['见习', 'Rookie'],
  local: ['挑战者', 'Challenger'],
  express: ['斗士', 'Contender'],
  rapid: ['精英', 'Elite'],
  limited: ['大师', 'Master'],
  bullet: ['宗师', 'Grandmaster'],
  maglev: ['传奇', 'Legend'],
};
export function duelBand(rating: number) {
  const { key, color } = contestBand(rating);
  return { key, color, zh: DUEL_NAMES[key][0], en: DUEL_NAMES[key][1] };
}
