'use client';
import { useMemo, useState } from 'react';
import type { PracticeHistoryItem } from '@/lib/practice-review';
import { STOP_NAMES } from '@/lib/route-stops';
import { yearRecap } from '@/lib/year-recap';
import '@/app/learner-cloud.css';

/**
 * My progress: one local year of the practice history already loaded (no request of its own):
 * problems solved, active days, the longest streak, the busiest day and the stops most worked on.
 * `handle`: the learner's visible profile; `publicYears`: the years its public recap page serves
 * (UTC, public problems only), so a local year with only course or private ACs gets no dead link.
 */
export function YearRecapCard({
  history,
  english,
  handle,
  publicYears,
  now,
}: {
  history: readonly PracticeHistoryItem[];
  english: boolean;
  handle: string | null;
  publicYears: readonly number[];
  /** When the history was read: days after it are still ahead. */
  now: number;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const years = useMemo(
    () => [...new Set(history.flatMap((i) => i.acAt.map((at) => new Date(at).getFullYear())))].sort((a, b) => b - a),
    [history],
  );
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked ?? years[0];
  const recap = useMemo(
    () =>
      year === undefined
        ? null
        : yearRecap(
            history.flatMap((i) => i.acAt.map((at) => ({ problem_id: i.problemId, created_at: at }))),
            year,
            now,
            english,
          ),
    [history, year, now, english],
  );
  const stops = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of history)
      if (item.stop && item.acAt.some((at) => new Date(at).getFullYear() === year))
        counts.set(item.stop, (counts.get(item.stop) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [history, year]);
  if (!recap) return null;
  const busiest = recap.busiest && new Date(recap.busiest.time);
  const meters: [string, string, string | number][] = [
    ['通过题数', 'Solved', recap.total],
    ['有通过的天数', 'Active days', recap.activeDays],
    ['最长连续', 'Best streak', t(`${recap.best} 天`, `${recap.best} ${recap.best === 1 ? 'day' : 'days'}`)],
    [
      '最忙的一天',
      'Busiest day',
      busiest
        ? t(
            `${busiest.getMonth() + 1}月${busiest.getDate()}日 · ${recap.busiest!.count} 题`,
            `${busiest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${recap.busiest!.count}`,
          )
        : '–',
    ],
  ];
  return (
    <section className="cloud-mocks year-recap" aria-labelledby="year-recap-title">
      <div className="cloud-head">
        <h2 id="year-recap-title">{t(`${year} 年度回顾`, `${year} in review`)}</h2>
        {years.length > 1 && (
          <select
            aria-label={t('选择年份', 'Choose a year')}
            value={year}
            onChange={(e) => setPicked(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {handle && publicYears.includes(year) && (
          <a href={`/u/${handle}/recap/${year}`}>{t('公开回顾页', 'Public recap')} →</a>
        )}
      </div>
      <dl className="year-recap-meters">
        {meters.map(([zh, en, value]) => (
          <div key={en}>
            <dt>{t(zh, en)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!!stops.length && (
        <p className="year-recap-stops">
          {t('刷得最多的站：', 'Stops most worked on: ')}
          {stops
            .map(([slug, n]) => `${STOP_NAMES[slug]?.[english ? 1 : 0] ?? slug} (${n})`)
            .join(t('、', ', '))}
        </p>
      )}
    </section>
  );
}
