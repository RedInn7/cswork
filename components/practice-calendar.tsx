'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Activity = { problem_id: string; created_at: number };
export type PracticeCell = { time: number; count: number; future: boolean };
export type PracticeStats = {
  cells: PracticeCell[];
  months: { column: number; label: string }[];
  /** Consecutive AC days ending today, or yesterday while today has none yet. */
  streak: number;
  /** Longest run of AC days inside the grid. */
  best: number;
  /** Distinct problems accepted today. */
  today: number;
  /** Distinct problems accepted inside the grid. */
  total: number;
  todayIndex: number;
};
type T = (zh: string, en: string) => string;

const WEEKS = 26; // The server sends 183 days of activity to cover the grid.
const DAY = 86400000;

function dayKey(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function level(count: number) {
  return count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
}

/**
 * Half a year of accepted problems, one cell per local day (weeks start on Monday).
 * `dayStamp` is `Date#toDateString()` of the local day the grid ends on.
 */
export function practiceStats(
  activity: Activity[],
  dayStamp: string,
  english: boolean,
): PracticeStats {
  const solvedByDay = new Map<string, Set<string>>();
  for (const { problem_id, created_at } of activity) {
    const key = dayKey(created_at);
    const set = solvedByDay.get(key) ?? new Set<string>();
    set.add(problem_id);
    solvedByDay.set(key, set);
  }
  const count = (time: number) => solvedByDay.get(dayKey(time))?.size ?? 0;
  const cells: PracticeCell[] = [];
  const months: { column: number; label: string }[] = [];
  const seen = new Set<string>();
  const today = new Date(dayStamp);
  const weekday = (today.getDay() + 6) % 7; // Monday = 0
  const todayIndex = weekday + (WEEKS - 1) * 7;
  const start = today.getTime() - todayIndex * DAY;
  let best = 0;
  let run = 0;
  for (let i = 0; i < WEEKS * 7; i++) {
    // Noon avoids daylight-saving edges when stepping by whole days.
    const time = start + i * DAY + DAY / 2;
    const future = i > todayIndex;
    const cell = { time, count: future ? 0 : count(time), future };
    cells.push(cell);
    if (!future) {
      run = cell.count ? run + 1 : 0;
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
  let day = today.getTime() + DAY / 2;
  if (count(day) === 0) day -= DAY;
  while (count(day) > 0) {
    streak++;
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
  };
}

/**
 * Stats for the local day, or null before mount so server and browser time
 * zones never disagree. Re-reads the clock on focus so a page left open past
 * midnight shows the new day.
 */
export function usePracticeStats(activity: Activity[], english: boolean) {
  const [dayStamp, setDayStamp] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setDayStamp(new Date().toDateString());
    tick();
    window.addEventListener('focus', tick);
    return () => window.removeEventListener('focus', tick);
  }, []);
  return useMemo(
    () =>
      dayStamp === null ? null : practiceStats(activity, dayStamp, english),
    [activity, dayStamp, english],
  );
}

function nudge(stats: PracticeStats, signedIn: boolean, target: number, t: T) {
  const { streak, today, total } = stats;
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
                  title={
                    cell.future
                      ? undefined
                      : t(
                          `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : '没有通过记录'}`,
                          `${new Date(cell.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${cell.count ? `${cell.count} solved` : 'Nothing solved'}`,
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
        {t('少', 'Less')}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} data-level={l} />
        ))}
        {t('多', 'More')}
      </footer>
      {stats && (
        <p className="route-nudge" data-risk={risk || undefined}>
          {nudge(stats, signedIn, target, t)}
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
