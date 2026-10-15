'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { usePracticeStats, type Activity, type PracticeCell } from '@/components/practice-calendar';
import { yearRecap } from '@/lib/year-recap';

const LEVEL = (count: number) => (count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4);
const shortDay = (time: number, zh: boolean) =>
  zh
    ? `${new Date(time).getMonth() + 1}月${new Date(time).getDate()}日`
    : new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Solved problems in the reader's time zone (so it renders after mount), the practice
 * calendar's grid without its personal nudges: the last half year, or with `year` that
 * calendar year (53 or 54 weeks).
 */
export function ProfileHeatmap({ activity, zh, year }: { activity: Activity[]; zh: boolean; year?: number }) {
  return year ? <YearHeatmap activity={activity} zh={zh} year={year} /> : <HalfYearHeatmap activity={activity} zh={zh} />;
}

function HalfYearHeatmap({ activity, zh }: { activity: Activity[]; zh: boolean }) {
  const stats = usePracticeStats(activity, !zh);
  const t = (a: string, b: string) => (zh ? a : b);
  // Before mount: blank cells, so server and browser time zones never disagree.
  const cells: (PracticeCell | null)[] = stats?.cells ?? Array.from({ length: 26 * 7 }, () => null);
  return (
    <HeatmapFrame
      zh={zh}
      cells={cells}
      months={stats?.months}
      summary={
        stats &&
        t(
          `近半年通过 ${stats.total} 题 · 最长连续 ${stats.best} 天`,
          `${stats.total} solved in 6 months · best streak ${stats.best} days`,
        )
      }
    />
  );
}

function YearHeatmap({ activity, zh, year }: { activity: Activity[]; zh: boolean; year: number }) {
  const t = (a: string, b: string) => (zh ? a : b);
  // The reader's local day once mounted; days after it are still ahead.
  const today = useSyncExternalStore(noop, () => new Date().toDateString(), () => null);
  const now = today === null ? null : new Date(today).getTime();
  // Before mount: the year's layout (the same in every time zone) with blank cells.
  const recap = useMemo(() => yearRecap(now === null ? [] : activity, year, now ?? Infinity, !zh), [activity, year, now, zh]);
  const busiest = recap.busiest;
  return (
    <HeatmapFrame
      zh={zh}
      year={year}
      weeks={recap.weeks}
      cells={now === null ? recap.cells.map(() => null) : recap.cells}
      out={recap.cells.map((c) => !c)}
      months={recap.months}
      summary={
        now !== null &&
        t(
          `${year} 年通过 ${recap.total} 题 · 最长连续 ${recap.best} 天${busiest ? ` · 最忙的一天 ${shortDay(busiest.time, true)}（${busiest.count} 题）` : ''}`,
          `${recap.total} solved in ${year} · best streak ${recap.best} days${busiest ? ` · busiest day ${shortDay(busiest.time, false)} (${busiest.count})` : ''}`,
        )
      }
    />
  );
}

function HeatmapFrame({
  zh,
  cells,
  months,
  summary,
  year,
  weeks,
  out,
}: {
  zh: boolean;
  cells: ({ time: number; count: number; future: boolean } | null)[];
  months?: { column: number; label: string }[];
  summary: React.ReactNode;
  year?: number;
  weeks?: number;
  /** Cells outside the year: kept for the grid, never drawn. */
  out?: boolean[];
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <section
      className="learner-heatmap"
      aria-labelledby="learner-heatmap-title"
      data-year={year}
      style={weeks ? ({ '--weeks': weeks } as React.CSSProperties) : undefined}
    >
      <h2 id="learner-heatmap-title" className="lists-public-h2">
        {year ? t(`${year} 年刷题热力图`, `${year} practice heatmap`) : t('刷题热力图', 'Practice heatmap')}
        {summary && <small>{summary}</small>}
      </h2>
      <div className="learner-heatmap-body">
        <div className="learner-heatmap-months" aria-hidden="true">
          {months?.map((m) => (
            <span key={m.column} style={{ gridColumn: m.column + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="learner-heatmap-grid" role="presentation">
          {cells.map((cell, i) => (
            <span
              key={i}
              data-out={out?.[i] || undefined}
              data-level={cell && !cell.future ? LEVEL(cell.count) : cell ? undefined : 0}
              data-future={cell?.future || undefined}
              title={
                cell && !cell.future
                  ? t(
                      `${shortDay(cell.time, true)} · ${cell.count ? `通过 ${cell.count} 题` : '没有通过记录'}`,
                      `${shortDay(cell.time, false)} · ${cell.count ? `${cell.count} solved` : 'Nothing solved'}`,
                    )
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const noop = () => () => {};
const localDay = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** A date in the reader's time zone, as the heatmap counts it; blank in the server's HTML. */
export function LocalDay({ time, className }: { time: number; className?: string }) {
  const day = useSyncExternalStore(noop, () => localDay(time), () => '');
  return (
    <time dateTime={new Date(time).toISOString()} className={className}>
      {day}
    </time>
  );
}
