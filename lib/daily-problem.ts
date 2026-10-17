// Daily problem: one problem per Beijing day, the same for everyone. Client-safe.
import { seededRandom } from './mock-oa';

export type DailyProblem = {
  /** Beijing date, YYYY-MM-DD. */
  date: string;
  id: string;
  kind: 'lc' | 'oa';
  title: string;
  titleEn?: string;
  difficulty: string;
  /** Line 500 stop slug (lc). */
  stop?: string;
  /** The OA's company (oa). */
  company?: { slug: string; name: string };
  /** The viewer's accepted submissions of each day's problem on its own Beijing day. */
  done: number[];
};

const DAY = 86400000;
const BEIJING = 8 * 3600000; // UTC+8, no daylight saving.

/** YYYY-MM-DD of `time` in Beijing. */
export const beijingDate = (time: number) =>
  new Date(time + BEIJING).toISOString().slice(0, 10);

/** FNV-1a, a stable 32-bit seed from text. */
export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The day's problem: odd dates draw from Line 500, even dates from the hot companies'
 * OAs (either pool stands in when the other is empty). Rendezvous draw: every candidate
 * scores seededRandom(date|id) and the top score wins, so publishing a problem only
 * moves the days it now wins instead of reshuffling every past day.
 */
export function dailyPick(
  date: string,
  line: readonly string[],
  oa: readonly string[],
): string | null {
  const odd = Number(date.slice(8)) % 2 === 1;
  const first = odd ? line : oa;
  const pool = first.length ? first : odd ? oa : line;
  let best: string | null = null;
  let top = -1;
  for (const id of pool) {
    const score = seededRandom(hash(`${date}|${id}`))();
    if (score > top) {
      top = score;
      best = id;
    }
  }
  return best;
}

/** Days in a row the daily problem was solved, ending today, or yesterday while today's is open. */
export function dailyStreak(done: readonly number[], now: number) {
  const days = new Set(done.map(beijingDate));
  let time = now;
  if (!days.has(beijingDate(time))) time -= DAY;
  let streak = 0;
  while (days.has(beijingDate(time))) {
    streak++;
    time -= DAY;
  }
  return streak;
}

/** Solved the day's problem on its own day. */
export const dailySolved = (daily: Pick<DailyProblem, 'date' | 'done'>) =>
  daily.done.some((time) => beijingDate(time) === daily.date);
