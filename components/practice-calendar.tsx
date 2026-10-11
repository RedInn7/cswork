'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useT } from '@/lib/i18n';

type Activity = { problem_id: string; created_at: number };

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
 * Dates are computed after mount so server and browser time zones never disagree.
 */
export function PracticeCalendar({
  activity,
  signedIn,
}: {
  activity: Activity[];
  signedIn: boolean;
}) {
  const locale = useLocale();
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Re-read the clock on focus so a page left open past midnight shows the new day.
    const tick = () => setNow(Date.now());
    tick();
    window.addEventListener('focus', tick);
    return () => window.removeEventListener('focus', tick);
  }, []);
  // Narrow screens scroll the grid; start at the newest week, not the oldest.
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [now]);

  const dayStamp = now === null ? null : new Date(now).toDateString();
  const { cells, months, streak, total } = useMemo(() => {
    const solvedByDay = new Map<string, Set<string>>();
    for (const { problem_id, created_at } of activity) {
      const key = dayKey(created_at);
      const set = solvedByDay.get(key) ?? new Set<string>();
      set.add(problem_id);
      solvedByDay.set(key, set);
    }
    const count = (time: number) => solvedByDay.get(dayKey(time))?.size ?? 0;
    const cells: { time: number; count: number; future: boolean }[] = [];
    const months: { column: number; label: string }[] = [];
    let streak = 0;
    const seen = new Set<string>();
    if (dayStamp !== null) {
      const today = new Date(dayStamp);
      const weekday = (today.getDay() + 6) % 7; // Monday = 0
      const todayIndex = weekday + (WEEKS - 1) * 7;
      const start = today.getTime() - todayIndex * DAY;
      for (let i = 0; i < WEEKS * 7; i++) {
        // Noon avoids daylight-saving edges when stepping by whole days.
        const time = start + i * DAY + DAY / 2;
        const future = i > todayIndex;
        cells.push({ time, count: future ? 0 : count(time), future });
        for (const id of future ? [] : (solvedByDay.get(dayKey(time)) ?? []))
          seen.add(id);
        const date = new Date(time);
        if (i % 7 === 0 && (i === 0 || date.getDate() <= 7))
          months.push({
            column: i / 7,
            label:
              locale === 'zh'
                ? `${date.getMonth() + 1}月`
                : date.toLocaleString('en-US', { month: 'short' }),
          });
      }
      // A label in the first column collides with the next month's if it starts within 3 weeks.
      if (months.length > 1 && months[1].column < 3) months.shift();
      // A streak survives until the end of today even if today has no AC yet.
      let day = today.getTime() + DAY / 2;
      if (count(day) === 0) day -= DAY;
      while (count(day) > 0) {
        streak++;
        day -= DAY;
      }
    }
    return { cells, months, streak, total: seen.size };
  }, [activity, dayStamp, locale]);

  return (
    <section
      className="practice-calendar"
      aria-label={t('刷题日历', 'Practice calendar')}
    >
      <header>
        <h3>{t('刷题日历', 'Practice calendar')}</h3>
        {signedIn ? (
          locale === 'zh' ? (
            <p>
              近半年通过 <strong>{total}</strong> 题
              <span aria-hidden="true"> · </span>
              连续 <strong>{streak}</strong> 天
            </p>
          ) : (
            <p>
              <strong>{total}</strong> solved in the last 6 months
              <span aria-hidden="true"> · </span>
              <strong>{streak}</strong>-day streak
            </p>
          )
        ) : (
          <p>
            {t(
              '登录后自动记录每天通过的题目',
              'Sign in to track the problems you solve each day',
            )}
          </p>
        )}
      </header>
      <div className="practice-calendar-body" ref={scroller}>
        <div className="practice-calendar-months" aria-hidden="true">
          {months.map((m) => (
            <span key={m.column} style={{ gridColumn: m.column + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="practice-calendar-grid" role="presentation">
          {(now === null
            ? Array.from({ length: WEEKS * 7 }, () => null)
            : cells
          ).map((cell, i) =>
            cell ? (
              <span
                key={i}
                data-level={cell.future ? undefined : level(cell.count)}
                data-future={cell.future || undefined}
                title={
                  cell.future
                    ? undefined
                    : t(
                        `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : '没有通过记录'}`,
                        `${new Date(cell.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${cell.count ? `${cell.count} solved` : 'Nothing solved'}`,
                      )
                }
              />
            ) : (
              <span key={i} data-level={0} />
            ),
          )}
        </div>
      </div>
      <footer aria-hidden="true">
        {t('少', 'Less')}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} data-level={l} />
        ))}
        {t('多', 'More')}
      </footer>
    </section>
  );
}
