'use client';

import { useEffect, useState } from 'react';

type Activity = { problem_id: string; created_at: number };

const WEEKS = 26;
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
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

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
  if (now !== null) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekday = (today.getDay() + 6) % 7; // Monday = 0
    const start = today.getTime() - (weekday + (WEEKS - 1) * 7) * DAY;
    for (let i = 0; i < WEEKS * 7; i++) {
      // Noon avoids daylight-saving edges when stepping by whole days.
      const time = start + i * DAY + DAY / 2;
      cells.push({ time, count: count(time), future: time > now });
      const date = new Date(time);
      if (i % 7 === 0 && (i === 0 || date.getDate() <= 7))
        months.push({ column: i / 7, label: `${date.getMonth() + 1}月` });
    }
    // A streak survives until the end of today even if today has no AC yet.
    let day = today.getTime() + DAY / 2;
    if (count(day) === 0) day -= DAY;
    while (count(day) > 0) {
      streak++;
      day -= DAY;
    }
  }
  const total = new Set(activity.map((a) => a.problem_id)).size;

  return (
    <section className="practice-calendar" aria-label="刷题日历">
      <header>
        <h3>刷题日历</h3>
        {signedIn ? (
          <p>
            近半年通过 <strong>{total}</strong> 题
            <span aria-hidden="true"> · </span>
            连续 <strong>{streak}</strong> 天
          </p>
        ) : (
          <p>登录后自动记录每天通过的题目</p>
        )}
      </header>
      <div className="practice-calendar-body">
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
                    : `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : '没有通过记录'}`
                }
              />
            ) : (
              <span key={i} data-level={0} />
            ),
          )}
        </div>
      </div>
      <footer aria-hidden="true">
        少
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} data-level={l} />
        ))}
        多
      </footer>
    </section>
  );
}
