// Client-safe and pure: the practice calendar and the reminder worker (lib/server/reminders.ts) share it.
import { beijingDate } from '@/lib/daily-problem';

export type Activity = { problem_id: string; created_at: number };
export type PracticeCell = {
  time: number;
  count: number;
  future: boolean;
  /** A gap day a streak freeze covered. */
  frozen?: boolean;
  /** The daily problem was solved on this day. */
  daily?: boolean;
  /** No AC, but the XP goal was met ('goal') or it was a rest day or review break ('rest'). */
  covered?: 'goal' | 'rest';
};
/** A day kept alive without an AC (lib/server/study-days.ts): its local noon, and why. */
export type Covered = { time: number; rest: boolean };
export type PracticeStats = {
  cells: PracticeCell[];
  months: { column: number; label: string }[];
  /** Consecutive AC days ending today, or yesterday while today has none yet; freezes and covered days bridge gaps. */
  streak: number;
  /** Longest run of AC days inside the grid. */
  best: number;
  /** Distinct problems accepted today. */
  today: number;
  /** Distinct problems accepted inside the grid. */
  total: number;
  todayIndex: number;
  /** Streak freezes left this calendar month. */
  freezesLeft: number;
  /** Yesterday is a gap: today's first AC spends a freeze on it, and the streak counts on that. */
  rescue: boolean;
};
export const WEEKS = 26; // The server sends 183 days of activity to cover the grid.
const DAY = 86400000;
/** Streak freezes each calendar month; used up automatically, oldest gap first. */
export const FREEZES_PER_MONTH = 2;
// Freezes bought with points (bootstrap purchasedFreezes) come after the free ones and cover
// a gap from the day before the purchase (the rescue) to the end of the purchase's month.

function dayKey(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const monthOf = (time: number) => {
  const d = new Date(time);
  return d.getFullYear() * 12 + d.getMonth();
};

/**
 * Half a year of accepted problems, one cell per local day (weeks start on Monday).
 * `dayStamp` is `Date#toDateString()` of the local day the grid ends on. A day with no
 * AC between two AC days spends one of the month's streak freezes and keeps the streak
 * (it adds no day to it). `daily`: times the daily problem was solved, starred cells.
 * `bought`: when freezes were bought with points; each covers one gap after the month's
 * free ones, from the day before it was bought to the end of that local month, so it never
 * goes to a gap that broke a streak before the purchase.
 * `covered`: days the learner met their XP goal, rested or took a review break. Such a day keeps
 * the streak alive like an AC day but adds no day to it, and needs no freeze.
 * ponytail: two measures on purpose. The top bar, My progress, the bank's calendar and reminders
 * pass `covered`; badges, the Accepted dialog and the leaderboard count AC days only.
 */
export function practiceStats(
  activity: readonly Activity[],
  dayStamp: string,
  english: boolean,
  daily: readonly number[] = [],
  weeks = WEEKS,
  bought: readonly number[] = [],
  covered: readonly Covered[] = [],
): PracticeStats {
  const solvedByDay = new Map<string, Set<string>>();
  for (const { problem_id, created_at } of activity) {
    const key = dayKey(created_at);
    const set = solvedByDay.get(key) ?? new Set<string>();
    set.add(problem_id);
    solvedByDay.set(key, set);
  }
  const count = (time: number) => solvedByDay.get(dayKey(time))?.size ?? 0;
  const coveredDays = new Map(covered.map((c) => [dayKey(c.time), c.rest ? ('rest' as const) : ('goal' as const)]));
  const alive = (time: number) => count(time) > 0 || coveredDays.has(dayKey(time));
  // A daily problem belongs to its Beijing date (as dailyStreak counts it): star the local
  // cell with that date. ponytail: one that is still tomorrow here appears at local midnight.
  const dailyDays = new Set(daily.map((t) => dayKey(Date.parse(`${beijingDate(t)}T12:00`))));
  const cells: PracticeCell[] = [];
  const months: { column: number; label: string }[] = [];
  const seen = new Set<string>();
  const today = new Date(dayStamp);
  const weekday = (today.getDay() + 6) % 7; // Monday = 0
  const todayIndex = weekday + (weeks - 1) * 7;
  const start = today.getTime() - todayIndex * DAY;
  // Noon avoids daylight-saving edges when stepping by whole days.
  const noon = (i: number) => start + i * DAY + DAY / 2;
  const freeUsed = new Map<number, number>();
  const tokens = [...bought]
    .sort((a, b) => a - b)
    .map((time) => ({ from: new Date(time).setHours(0, 0, 0, 0) - DAY, month: monthOf(time), used: false }));
  // A freeze for the gap at `time` (a noon): a free one of its month, else the first unused
  // bought one that reaches it. `spend` false only asks.
  const freeze = (time: number, spend: boolean) => {
    const month = monthOf(time);
    const free = freeUsed.get(month) ?? 0;
    if (free < FREEZES_PER_MONTH) {
      if (spend) freeUsed.set(month, free + 1);
      return true;
    }
    const token = tokens.find((t) => !t.used && t.from <= time && month <= t.month);
    if (token && spend) token.used = true;
    return !!token;
  };
  const frozen = new Set<string>();
  // Today is not over, so the last day a freeze can cover is yesterday. A gap spends one only
  // when the run before it holds an AC: covered days alone have no streak to keep.
  let runHasAc = false;
  for (let i = 0; i < todayIndex; i++) {
    const time = noon(i);
    if (count(time)) runHasAc = true;
    else if (alive(time)) continue;
    else if (runHasAc && alive(time - DAY) && alive(time + DAY) && freeze(time, true)) frozen.add(dayKey(time));
    else runHasAc = false;
  }
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const time = noon(i);
    const future = i > todayIndex;
    const cell: PracticeCell = { time, count: future ? 0 : count(time), future };
    if (frozen.has(dayKey(time))) cell.frozen = true;
    if (!future && dailyDays.has(dayKey(time))) cell.daily = true;
    if (!future && !cell.count && coveredDays.has(dayKey(time))) cell.covered = coveredDays.get(dayKey(time));
    cells.push(cell);
    if (!future) {
      run = cell.count ? run + 1 : cell.frozen || cell.covered ? run : 0;
      best = Math.max(best, run);
      for (const id of solvedByDay.get(dayKey(time)) ?? []) seen.add(id);
    }
    const date = new Date(time);
    if (i % 7 === 0 && (i === 0 || date.getDate() <= 7))
      months.push({
        column: i / 7,
        label: english
          ? date.toLocaleString('en-US', { month: 'short' })
          : `${date.getMonth() + 1}月`,
      });
  }
  // A label in the first column collides with the next month's if it starts within 3 weeks.
  if (months.length > 1 && months[1].column < 3) months.shift();
  // A streak survives until the end of today even if today has no AC yet.
  let streak = 0;
  let day = noon(todayIndex);
  if (!alive(day)) day -= DAY;
  // An empty yesterday after an AC (or covered) day: today's first AC will freeze it.
  const rescue = !alive(day) && day < noon(todayIndex) && alive(day - DAY) && freeze(day, false);
  if (rescue) day -= DAY;
  while (alive(day) || frozen.has(dayKey(day))) {
    if (count(day)) streak++;
    day -= DAY;
  }
  return {
    cells,
    months,
    streak,
    // The streak may run past the grid's first day; the best is never shorter.
    best: Math.max(best, streak),
    today: cells[todayIndex].count,
    total: seen.size,
    todayIndex,
    freezesLeft:
      FREEZES_PER_MONTH -
      (freeUsed.get(monthOf(noon(todayIndex))) ?? 0) +
      tokens.filter((t) => !t.used && t.month === monthOf(noon(todayIndex))).length,
    // Covered days alone make no streak worth a rescue.
    rescue: rescue && streak > 0,
  };
}
