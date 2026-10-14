'use client';
import { usePracticeStats, type Activity } from '@/components/practice-calendar';

const LEVEL = (count: number) => (count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4);

/**
 * Half a year of solved problems in the reader's time zone (so it renders after mount),
 * the practice calendar's grid without its personal nudges.
 */
export function ProfileHeatmap({ activity, zh }: { activity: Activity[]; zh: boolean }) {
  const stats = usePracticeStats(activity, !zh);
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <section className="learner-heatmap" aria-labelledby="learner-heatmap-title">
      <h2 id="learner-heatmap-title" className="lists-public-h2">
        {t('刷题热力图', 'Practice heatmap')}
        {stats && (
          <small>
            {t(
              `近半年通过 ${stats.total} 题 · 最长连续 ${stats.best} 天`,
              `${stats.total} solved in 6 months · best streak ${stats.best} days`,
            )}
          </small>
        )}
      </h2>
      <div className="learner-heatmap-body">
        <div className="learner-heatmap-months" aria-hidden="true">
          {stats?.months.map((m) => (
            <span key={m.column} style={{ gridColumn: m.column + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="learner-heatmap-grid" role="presentation">
          {(stats?.cells ?? Array.from({ length: 26 * 7 }, () => null)).map((cell, i) => (
            <span
              key={i}
              data-level={cell && !cell.future ? LEVEL(cell.count) : cell ? undefined : 0}
              data-future={cell?.future || undefined}
              title={
                cell && !cell.future
                  ? t(
                      `${new Date(cell.time).getMonth() + 1}月${new Date(cell.time).getDate()}日 · ${cell.count ? `通过 ${cell.count} 题` : '没有通过记录'}`,
                      `${new Date(cell.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${cell.count ? `${cell.count} solved` : 'Nothing solved'}`,
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
