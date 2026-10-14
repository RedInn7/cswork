import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { monthDays } from '@/lib/achievements';
import { beijingDate } from '@/lib/daily-problem';
import { aiBonusLeft, aiEnabled, AI_BONUS_PER_DAY, AI_PACK_USES } from './ai-tutor';
import type { Person } from './auth';
import { dailyIdOn } from './daily-problem';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';

/**
 * Practice points in point_ledger (db/points-schema.ts). Earned for practice, spent on
 * streak freezes and AI calls; never on reading access, and there is no shop. Every award
 * names its event in (reason, ref), which the table keeps unique, so replays pay nothing.
 * Days are Beijing dates, like the daily problem; daily caps count today's awards.
 */
export const POINTS = {
  /** The first AC of a day. */
  acDay: 10,
  /** That day's daily problem accepted on its day, on top. */
  daily: 20,
  /** A problem's first-ever AC; at most firstAcCap a day from these. */
  firstAc: 5,
  firstAcCap: 100,
  /** Every 7th day in a row with an AC. */
  streak: 50,
  /** A Beijing month's dailyMonthDays-th daily problem, and again when every day of it is done. */
  dailyMonth: 100,
  dailyMonthDays: 25,
  streakDays: 7,
  /** An interview report approved; taken back if it is withdrawn, rejected or reported down. */
  experience: 100,
  /** Each upvote on a solution post, at most upvoteCap a day, from verified accounts 7+ days old. */
  upvote: 2,
  upvoteCap: 40,
  voterAgeDays: 7,
} as const;
export const PRICES = { freeze: 100, ai: 50 } as const;
/** Streak freezes a learner may buy per (Beijing) month, on top of the free ones. */
export const FREEZES_PER_MONTH_BUYABLE = 3;
const DAY = 86400000;
const startOfDay = (now: number) => Date.parse(`${beijingDate(now)}T00:00:00+08:00`);

const insert = () =>
  sqlite().prepare(
    'INSERT INTO point_ledger(id,user_id,delta,reason,ref_id,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING',
  );
/**
 * Pays `delta` once for (reason, ref); with `cap`, only what is left of today's cap for
 * this reason. A capped-out event is still recorded (as 0) so it never pays later.
 */
export function award(userId: string, reason: string, ref: string, delta: number, now = Date.now(), cap?: number) {
  const db = sqlite();
  return db.transaction(() => {
    let amount = delta;
    if (cap !== undefined) {
      const got = db
        .prepare('SELECT COALESCE(SUM(delta),0) FROM point_ledger WHERE user_id=? AND reason=? AND created_at>=?')
        .pluck()
        .get(userId, reason, startOfDay(now)) as number;
      amount = Math.max(0, Math.min(delta, cap - got));
    }
    return insert().run(randomUUID(), userId, amount, reason, ref, now).changes ? amount : 0;
  })();
}

/**
 * Moves the net of (reason, key) to `target`, e.g. a report's 100 points on approval and
 * back to 0 when it comes down: each change is one more row, ref `key#n`.
 */
export function settleTo(userId: string, reason: string, key: string, target: number, now = Date.now()) {
  const db = sqlite();
  return db.transaction(() => {
    const rows = db
      .prepare('SELECT delta FROM point_ledger WHERE user_id=? AND reason=? AND ref_id>? AND ref_id<?')
      .pluck()
      .all(userId, reason, `${key}#`, `${key}$`) as number[];
    const have = rows.reduce((sum, n) => sum + n, 0);
    if (have === target) return 0;
    insert().run(randomUUID(), userId, target - have, reason, `${key}#${rows.length}`, now);
    return target - have;
  })();
}

export const balance = (userId: string) =>
  sqlite().prepare('SELECT COALESCE(SUM(delta),0) FROM point_ledger WHERE user_id=?').pluck().get(userId) as number;

/** Days in a row with an AC, ending on `day` (Beijing). ponytail: freezes do not extend it here. */
function streakTo(userId: string, day: string) {
  const end = Date.parse(`${day}T00:00:00+08:00`) + DAY;
  const days = new Set(
    (
      sqlite()
        .prepare(
          "SELECT created_at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 20000",
        )
        .pluck()
        .all(userId, end - 400 * DAY, end) as number[]
    ).map(beijingDate),
  );
  let n = 0;
  while (days.has(beijingDate(end - (n + 1) * DAY + DAY / 2))) n++;
  return n;
}

/**
 * Beijing dates whose daily problem the learner solved on its day, oldest first, from `since`
 * (a date or month prefix). The ledger is the record: days from before points began are not in it.
 */
export const dailyDays = (userId: string, since = '') =>
  sqlite()
    .prepare("SELECT ref_id FROM point_ledger WHERE user_id=? AND reason='daily' AND ref_id>=? ORDER BY ref_id")
    .pluck()
    .all(userId, since) as string[];

/** The month bonuses after a daily problem on `day`: its 25th day, then the whole month. */
function awardDailyMonth(userId: string, day: string, now: number) {
  const month = day.slice(0, 7);
  const done = dailyDays(userId, month).filter((d) => d.startsWith(month)).length;
  let total = 0;
  if (done >= POINTS.dailyMonthDays)
    total += award(userId, 'daily-month', `${month}:${POINTS.dailyMonthDays}`, POINTS.dailyMonth, now);
  if (done >= monthDays(month))
    total += award(userId, 'daily-month', `${month}:all`, POINTS.dailyMonth, now);
  return total;
}

/** ACs older than this earn nothing when their verdict is read: history from before points never pays. */
export const AWARD_WINDOW = 2 * DAY;
/** Points for one accepted formal submission; safe to call again for the same one. */
export async function awardAccepted(
  s: { id: string; user_id: string; problem_id: string; mode: string; status: string; created_at: number },
  now = Date.now(),
) {
  if (s.mode !== 'judge' || s.status !== 'accepted' || now - s.created_at > AWARD_WINDOW) return 0;
  const day = beijingDate(s.created_at);
  let total = 0;
  const newDay = award(s.user_id, 'ac-day', day, POINTS.acDay, now);
  total += newDay;
  // The problem's first AC ever, not one of a later practice round.
  const first = sqlite()
    .prepare(
      "SELECT id FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted' ORDER BY created_at,id LIMIT 1",
    )
    .pluck()
    .get(s.user_id, s.problem_id);
  if (first === s.id)
    total += award(s.user_id, 'first-ac', s.problem_id, POINTS.firstAc, now, POINTS.firstAcCap);
  // The AC's own day's problem: a verdict read just past Beijing midnight still pays.
  if ((await dailyIdOn(day, now).catch(() => null)) === s.problem_id) {
    const paid = award(s.user_id, 'daily', day, POINTS.daily, now);
    total += paid;
    if (paid) total += awardDailyMonth(s.user_id, day, now);
  }
  if (newDay) {
    const run = streakTo(s.user_id, day);
    if (run && run % POINTS.streakDays === 0) total += award(s.user_id, 'streak', day, POINTS.streak, now);
  }
  return total;
}

/** An upvote on `authorId`'s post: verified voters with accounts a week old, capped daily. */
export function awardUpvote(authorId: string, voter: Person, postId: string, now = Date.now()) {
  if (!voter.verified || voter.id === authorId) return 0;
  const created = sqlite().prepare('SELECT created_at FROM "user" WHERE id=?').pluck().get(voter.id) as
    | number
    | undefined;
  if (!created || now - created < POINTS.voterAgeDays * DAY) return 0;
  return award(authorId, 'upvote', `${postId}:${voter.id}`, POINTS.upvote, now, POINTS.upvoteCap);
}

/** An interview report's points follow its state: approved and shown 100, otherwise 0. */
export function settleExperience(submissionId: string, shown: boolean, now = Date.now()) {
  const author = sqlite().prepare('SELECT user_id FROM experience_submissions WHERE id=?').pluck().get(submissionId) as
    | string
    | undefined;
  return author ? settleTo(author, 'experience', submissionId, shown ? POINTS.experience : 0, now) : 0;
}

/** Freeze purchases this learner made, newest first: the practice calendar adds them per month. */
export const purchasedFreezes = (userId: string, since = Date.now() - 400 * DAY) =>
  sqlite()
    .prepare("SELECT created_at FROM point_ledger WHERE user_id=? AND reason='freeze' AND created_at>=? ORDER BY created_at DESC")
    .pluck()
    .all(userId, since) as number[];

/** Spends points on a streak freeze (3 a month) or an AI pack; returns the new summary. */
export function spend(userId: string, item: 'freeze' | 'ai', now = Date.now()) {
  const db = sqlite();
  db.transaction(() => {
    if (balance(userId) < PRICES[item]) throw new HttpError(409, '积分不足');
    let ref: string;
    if (item === 'freeze') {
      const month = beijingDate(now).slice(0, 7);
      const bought = db
        .prepare("SELECT COUNT(*) FROM point_ledger WHERE user_id=? AND reason='freeze' AND ref_id>? AND ref_id<?")
        .pluck()
        .get(userId, `${month}#`, `${month}$`) as number;
      if (bought >= FREEZES_PER_MONTH_BUYABLE) throw new HttpError(409, '本月的补签卡已经买满 3 张');
      ref = `${month}#${bought + 1}`;
    } else {
      if (!aiEnabled()) throw new HttpError(404, '接口不存在');
      ref = randomUUID();
    }
    insert().run(randomUUID(), userId, -PRICES[item], item === 'freeze' ? 'freeze' : 'ai-pack', ref, now);
  })();
  return summary(userId, now);
}

// Refs shown back to the owner: dates and problem ids. Voters and report ids stay server-side.
const SHOWN_REF = new Set(['ac-day', 'daily', 'daily-month', 'first-ac', 'streak']);
function summary(userId: string, now = Date.now()) {
  const month = beijingDate(now).slice(0, 7);
  const bought = purchasedFreezes(userId);
  const ledger = (
    sqlite()
      .prepare(
        'SELECT delta,reason,ref_id AS ref,created_at AS createdAt FROM point_ledger WHERE user_id=? AND delta<>0 ORDER BY created_at DESC,rowid DESC LIMIT 30',
      )
      .all(userId) as { delta: number; reason: string; ref: string; createdAt: number }[]
  ).map(({ ref, ...row }) => (SHOWN_REF.has(row.reason) ? { ...row, ref } : row));
  return {
    balance: balance(userId),
    ledger,
    prices: PRICES,
    rules: POINTS,
    freezes: {
      boughtThisMonth: bought.filter((t) => beijingDate(t).startsWith(month)).length,
      monthlyMax: FREEZES_PER_MONTH_BUYABLE,
      // For the calendar right after a purchase, before the bootstrap refreshes.
      purchased: bought,
    },
    ai: aiEnabled() ? { bonus: aiBonusLeft(userId), packUses: AI_PACK_USES, perDay: AI_BONUS_PER_DAY } : null,
  };
}

/**
 * GET oj/points: balance, recent ledger, prices; GET oj/points/daily: the daily problems solved
 * over the last 13 months (the month calendar); POST oj/points/redeem {item}.
 */
export async function handlePoints(request: Request, p: Person, action?: string) {
  if (request.method === 'GET' && !action) {
    await limit(p, 'oj-read', 240);
    return json(summary(p.id));
  }
  if (request.method === 'GET' && action === 'daily') {
    await limit(p, 'oj-read', 240);
    return json({ days: dailyDays(p.id, beijingDate(Date.now() - 400 * DAY).slice(0, 7)) });
  }
  if (request.method === 'POST' && action === 'redeem') {
    await limit(p, 'points-redeem', 20);
    const { item } = z.object({ item: z.enum(['freeze', 'ai']) }).strict().parse(await readJson(request, 200));
    return json(spend(p.id, item));
  }
  throw new HttpError(404, '接口不存在');
}
