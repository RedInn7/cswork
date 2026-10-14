'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Snowflake } from 'lucide-react';
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
};
export type PracticeStats = {
  cells: PracticeCell[];
  months: { column: number; label: string }[];
  /** Consecutive AC days ending today, or yesterday while today has none yet; freezes bridge gaps. */
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
type T = (zh: string, en: string) => string;

const WEEKS = 26; // The server sends 183 days of activity to cover the grid.
const DAY = 86400000;
/** Streak freezes each calendar month; used up automatically, oldest gap first. */
export const FREEZES_PER_MONTH = 2;
// Freezes bought with points (bootstrap purchasedFreezes) come after the free ones and cover
// a gap from the day before the purchase (the rescue) to the end of the purchase's month.

function dayKey(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function level(count: number) {
  return count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
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
 */
export function practiceStats(
  activity: readonly Activity[],
  dayStamp: string,
  english: boolean,
  daily: readonly number[] = [],
  weeks = WEEKS,
  bought: readonly number[] = [],
): PracticeStats {
  const solvedByDay = new Map<string, Set<string>>();
  for (const { problem_id, created_at } of activity) {
    const key = dayKey(created_at);
    const set = solvedByDay.get(key) ?? new Set<string>();
    set.add(problem_id);
    solvedByDay.set(key, set);
  }
  const count = (time: number) => solvedByDay.get(dayKey(time))?.size ?? 0;
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
  // Today is not over, so the last day a freeze can cover is yesterday.
  for (let i = 1; i < todayIndex; i++) {
    const time = noon(i);
    if (!count(time) && count(time - DAY) && count(time + DAY) && freeze(time, true)) frozen.add(dayKey(time));
  }
  let best = 0;
  let run = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const time = noon(i);
    const future = i > todayIndex;
    const cell: PracticeCell = { time, count: future ? 0 : count(time), future };
    if (frozen.has(dayKey(time))) cell.frozen = true;
    if (!future && dailyDays.has(dayKey(time))) cell.daily = true;
    cells.push(cell);
    if (!future) {
      run = cell.count ? run + 1 : cell.frozen ? run : 0;
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
  if (count(day) === 0) day -= DAY;
  // An empty yesterday after an AC day: today's first AC will freeze it.
  const rescue = !count(day) && day < noon(todayIndex) && count(day - DAY) > 0 && freeze(day, false);
  if (rescue) day -= DAY;
  while (count(day) > 0 || frozen.has(dayKey(day))) {
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
    rescue,
  };
}

/**
 * Stats for the local day, or null before mount so server and browser time
 * zones never disagree. Re-reads the clock on focus so a page left open past
 * midnight shows the new day.
 */
export function usePracticeStats(
  activity: readonly Activity[],
  english: boolean,
  daily?: readonly number[],
  bought?: readonly number[],
) {
  const [dayStamp, setDayStamp] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setDayStamp(new Date().toDateString());
    tick();
    window.addEventListener('focus', tick);
    return () => window.removeEventListener('focus', tick);
  }, []);
  return useMemo(
    () =>
      dayStamp === null ? null : practiceStats(activity, dayStamp, english, daily, WEEKS, bought),
    [activity, dayStamp, english, daily, bought],
  );
}

function nudge(stats: PracticeStats, signedIn: boolean, target: number, t: T) {
  const { streak, today, total, rescue } = stats;
  if (!signedIn)
    return t(
      '登录后，每天通过的题都会点亮一格。',
      'Sign in and every day you solve lights up a dot.',
    );
  if (!target)
    return t(
      '今天按计划不排练习题，留给 OA。',
      'No practice planned today: it’s for the OA.',
    );
  if (today >= target)
    return t(
      `今日行程完成，连续第 ${streak} 天。`,
      `Today’s trip is done. Day ${streak} of your streak.`,
    );
  if (today > 0)
    return t(
      `今天已通过 ${today} 题，再刷 ${target - today} 题完成今日行程。`,
      `${today} solved today. ${target - today} more to finish today’s trip.`,
    );
  if (rescue)
    return t(
      `昨天断了一天：今天刷一题，自动用一次保护日接上连续 ${streak} 天。`,
      `You missed yesterday. Solve one today and a streak freeze keeps your ${streak}-day streak.`,
    );
  if (streak > 0)
    return t(
      `今天还没有通过记录，刷一题保住连续 ${streak} 天。`,
      `Nothing solved yet today. Solve one to keep your ${streak}-day streak.`,
    );
  if (total > 0)
    return t(
      '今天刷一题，重新开始连续记录。',
      'Solve one today to start a new streak.',
    );
  return t(
    '通过第一题，点亮第一格。',
    'Solve your first problem to light the first dot.',
  );
}

/** Presentational half-year calendar; pass `usePracticeStats` output as `stats`. */
export function PracticeCalendar({
  stats,
  signedIn,
  target,
  t,
  lineTotal,
}: {
  stats: PracticeStats | null;
  signedIn: boolean;
  /** Daily target for the nudge and the signed-out pace line; 0 on a planned OA day. */
  target: number;
  t: T;
  /** Problems on the whole line; when signed out, adds the pace pitch. */
  lineTotal?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Narrow screens scroll the grid; start at the newest week, not the oldest.
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [stats]);
  const risk = !!stats && stats.streak > 0 && stats.today === 0;
  const weeks = lineTotal && target ? Math.ceil(lineTotal / target / 7) : 0;

  return (
    <section
      className="practice-calendar"
      aria-label={t('刷题日历', 'Practice calendar')}
    >
      <h3>{t('刷题日历', 'Practice calendar')}</h3>
      <dl className="route-stats">
        <div>
          <dt>{t('连续天数', 'Day streak')}</dt>
          <dd>
            <span className="route-led" data-risk={risk || undefined}>
              {stats?.streak ?? 0}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t('近半年最长', 'Best in 6 months')}</dt>
          <dd>{stats?.best ?? 0}</dd>
        </div>
        <div>
          <dt>{t('近半年通过', 'Solved in 6 months')}</dt>
          <dd>{stats?.total ?? 0}</dd>
        </div>
      </dl>
      <div className="practice-calendar-body" ref={scroller}>
        <div className="practice-calendar-months" aria-hidden="true">
          {stats?.months.map((m) => (
            <span key={m.column} style={{ gridColumn: m.column + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="practice-calendar-grid" role="presentation">
          {stats
            ? stats.cells.map((cell, i) => (
                <span
                  key={i}
                  data-level={cell.future ? undefined : level(cell.count)}
                  data-future={cell.future || undefined}
                  data-today={i === stats.todayIndex || undefined}
                  data-frozen={cell.frozen || undefined}
                  data-daily={cell.daily || undefined}
                  title={
                    cell.future
                      ? undefined
                      : t(
                          `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : cell.frozen ? '已用保护日' : '没有通过记录'}${cell.daily ? ' · 完成每日一题' : ''}`,
                          `${new Date(cell.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${cell.count ? `${cell.count} solved` : cell.frozen ? 'Streak freeze used' : 'Nothing solved'}${cell.daily ? ' · Daily problem solved' : ''}`,
                        )
                  }
                />
              ))
            : Array.from({ length: WEEKS * 7 }, (_, i) => (
                <span key={i} data-level={0} />
              ))}
        </div>
      </div>
      <footer aria-hidden="true">
        <span className="practice-legend-keys">
          <span data-level={4} data-daily />
          {t('每日一题', 'Daily')}
          <span data-level={0} data-frozen />
          {t('保护日', 'Freeze')}
        </span>
        {t('少', 'Less')}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} data-level={l} />
        ))}
        {t('多', 'More')}
      </footer>
      {stats && (
        <p className="route-nudge" data-risk={risk || undefined}>
          {nudge(stats, signedIn, target, t)}
          {signedIn && stats.total > 0 && (
            <span className="route-freeze">
              <Snowflake size={12} aria-hidden="true" />
              {t(
                `本月还剩 ${stats.freezesLeft} 次断签保护`,
                `${stats.freezesLeft} streak ${stats.freezesLeft === 1 ? 'freeze' : 'freezes'} left this month`,
              )}
            </span>
          )}
        </p>
      )}
      {!signedIn && weeks > 0 && (
        <p className="route-pace">
          {t(
            `每天 ${target} 题，约 ${weeks} 周走完全线 ${lineTotal} 题。`,
            `${target} a day covers all ${lineTotal} in about ${weeks} weeks.`,
          )}
        </p>
      )}
    </section>
  );
}
