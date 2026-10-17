'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Snowflake } from 'lucide-react';
import { practiceStats, WEEKS, type Activity, type Covered, type PracticeStats } from '@/lib/practice-stats';

export { FREEZES_PER_MONTH, practiceStats, type Activity, type PracticeCell, type PracticeStats } from '@/lib/practice-stats';

type T = (zh: string, en: string) => string;

export function level(count: number) {
  return count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
}

/**
 * Stats for the local day, or null before mount so server and browser time
 * zones never disagree. Re-reads the clock on focus so a page left open past
 * midnight shows the new day. `covered`: components/daily-goal.tsx useCoveredDays.
 */
export function usePracticeStats(
  activity: readonly Activity[],
  english: boolean,
  daily?: readonly number[],
  bought?: readonly number[],
  covered?: readonly Covered[],
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
      dayStamp === null ? null : practiceStats(activity, dayStamp, english, daily, WEEKS, bought, covered),
    [activity, dayStamp, english, daily, bought, covered],
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
  const covered = streak > 0 && stats.cells[stats.todayIndex].covered;
  if (covered === 'rest')
    return t(
      `今天是休息日，连续 ${streak} 天不会断。`,
      `Today is a rest day: your ${streak}-day streak holds.`,
    );
  if (covered === 'goal')
    return t(
      `今日经验已达标，连续 ${streak} 天保住了；刷一题还能多算一天。`,
      `Today’s XP goal is met, so your ${streak}-day streak holds. Solve one to add a day.`,
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
  const risk = !!stats && stats.streak > 0 && stats.today === 0 && !stats.cells[stats.todayIndex].covered;
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
                  data-covered={cell.covered}
                  title={
                    cell.future
                      ? undefined
                      : t(
                          `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : cell.frozen ? '已用保护日' : cell.covered === 'rest' ? '休息日' : cell.covered ? '经验已达标' : '没有通过记录'}${cell.daily ? ' · 完成每日一题' : ''}`,
                          `${new Date(cell.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${cell.count ? `${cell.count} solved` : cell.frozen ? 'Streak freeze used' : cell.covered === 'rest' ? 'Rest day' : cell.covered ? 'XP goal met' : 'Nothing solved'}${cell.daily ? ' · Daily problem solved' : ''}`,
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
          {stats?.cells.some((c) => c.covered) && (
            <>
              <span data-level={0} data-covered="goal" />
              {t('经验达标', 'XP goal')}
              <span data-level={0} data-covered="rest" />
              {t('休息', 'Rest')}
            </>
          )}
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
