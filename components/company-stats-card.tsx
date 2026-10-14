import { RESULTS, ROUND_LABELS } from '@/lib/experience';
import type { CompanyStats, Share } from '@/lib/server/company-stats';

/** Question categories in the content library, [zh, en]. */
export const CATEGORIES: Record<string, [string, string]> = {
  'Coding & Algorithms': ['编程与算法', 'Coding & algorithms'],
  'Behavioral & Leadership': ['行为与领导力', 'Behavioral & leadership'],
  'System Design': ['系统设计', 'System design'],
  'ML System Design': ['机器学习系统设计', 'ML system design'],
  'Software Engineering Fundamentals': ['软件工程基础', 'SWE fundamentals'],
  'Data Manipulation (SQL/Python)': ['数据处理（SQL/Python）', 'Data manipulation (SQL/Python)'],
  'Analytics & Experimentation': ['分析与实验', 'Analytics & experimentation'],
  'Statistics & Math': ['统计与数学', 'Statistics & math'],
  'Machine Learning': ['机器学习', 'Machine learning'],
  'Product / Decision Making': ['产品与决策', 'Product & decisions'],
  'Product Design & Strategy': ['产品设计与策略', 'Product design & strategy'],
};
const pct = (n: number, of: number) => {
  const p = Math.round((n / Math.max(1, of)) * 100);
  return n > 0 && p === 0 ? '<1%' : `${p}%`;
};
// Bar widths take the exact share (a "<1%" label still draws a sliver).
const width = (n: number, of: number) => `${(n / Math.max(1, of)) * 100}%`;
const label = (map: Record<string, [string, string]>, value: string, zh: boolean) =>
  Object.hasOwn(map, value) ? map[value][zh ? 0 : 1] : value;

function Bars({ rows, of, name, zh }: { rows: Share[]; of: number; name: (v: string) => string; zh: boolean }) {
  return (
    <ol className="company-stats-bars">
      {rows.map((r) => (
        <li key={r.value}>
          <span className="company-stats-label" title={name(r.value)}>
            {name(r.value)}
          </span>
          <span className="company-stats-track" aria-hidden="true">
            <span style={{ width: width(r.n, of) }} />
          </span>
          <span className="company-stats-n">
            {pct(r.n, of)}
            <span className="sr-only">{zh ? `（${r.n} 篇）` : ` (${r.n})`}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * An employer's interview stats (lib/server/company-stats.ts) on its company and mock interview
 * pages. Outcomes are what posters reported, shown as shares of reports and never as a pass rate.
 */
export function CompanyStatsCard({ stats, locale }: { stats: CompanyStats; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  const s = stats;
  return (
    <section className="company-stats" aria-labelledby="company-stats-title">
      <header className="company-stats-head">
        <h2 id="company-stats-title">{zh ? '面试流程统计' : 'Interview process at a glance'}</h2>
        <p>
          {zh
            ? `基于 ${s.experiences} 篇面经`
            : `Based on ${s.experiences} interview ${s.experiences === 1 ? 'experience' : 'experiences'}`}
        </p>
      </header>
      <dl className="company-stats-figures">
        <div>
          <dt>{zh ? '面经' : 'Experiences'}</dt>
          <dd>{s.experiences}</dd>
        </div>
        <div>
          <dt>{zh ? '最近 6 个月' : 'Last 6 months'}</dt>
          <dd>{s.recent}</dd>
        </div>
        {!!s.questions && (
          <div>
            <dt>{zh ? '面试题' : 'Questions'}</dt>
            <dd>{s.questions}</dd>
          </div>
        )}
      </dl>
      <div className="company-stats-grid">
        {!!s.rounds.length && (
          <div className="company-stats-panel">
            <h3>{zh ? '轮次' : 'Rounds'}</h3>
            <p className="company-stats-note">{zh ? '提到该轮的面经占比' : 'Share of experiences mentioning each round'}</p>
            <Bars rows={s.rounds} of={s.experiences} name={(v) => label(ROUND_LABELS, v, zh)} zh={zh} />
          </div>
        )}
        {!!s.reported && (
          <div className="company-stats-panel">
            <h3>{zh ? '自述结果' : 'Reported outcomes'}</h3>
            <p className="company-stats-note">
              {zh
                ? `${s.experiences} 篇里有 ${s.reported} 篇写了结果；只代表发帖人自述，不是通过率。`
                : `${s.reported} of ${s.experiences} experiences give an outcome. Self-reported by posters, not a pass rate.`}
            </p>
            <div className="company-stats-stack" aria-hidden="true">
              {s.results.map((r) => (
                <span key={r.value} data-tone={RESULTS[r.value].tone} style={{ width: width(r.n, s.reported) }} />
              ))}
            </div>
            <ul className="company-stats-legend">
              {s.results.map((r) => (
                <li key={r.value} data-tone={RESULTS[r.value].tone}>
                  {zh ? RESULTS[r.value].zh : RESULTS[r.value].en} <b>{pct(r.n, s.reported)}</b>
                  <span className="sr-only">{zh ? `（${r.n} 篇）` : ` (${r.n})`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!s.categories.length && (
          <div className="company-stats-panel is-amber">
            <h3>{zh ? '题目类别' : 'Question categories'}</h3>
            <p className="company-stats-note">
              {zh ? `${s.questions} 道面试题的分布` : `Across ${s.questions} ${s.questions === 1 ? 'question' : 'questions'}`}
            </p>
            <Bars rows={s.categories} of={s.questions} name={(v) => label(CATEGORIES, v, zh)} zh={zh} />
          </div>
        )}
        {s.trend && (
          <div className="company-stats-panel is-wide">
            <h3>{zh ? '题型趋势' : 'Trend by quarter'}</h3>
            <p className="company-stats-note">
              {zh
                ? '每季度的面经篇数和各类面试题数（面经按面试日期，题目按收录日期）'
                : 'Experiences and questions per quarter (experiences by interview date, questions by posting date)'}
            </p>
            <table className="company-stats-trend">
              <caption className="sr-only">{zh ? '最近六个季度的面经与题目数量' : 'Experiences and questions over the last six quarters'}</caption>
              <thead>
                <tr>
                  <td />
                  {s.trend.quarters.map((q) => (
                    <th scope="col" key={q}>
                      {`${q.slice(5)} ’${q.slice(2, 4)}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.trend.series.map((row, index) => {
                  const max = Math.max(1, ...row.counts);
                  return (
                    <tr key={row.value} data-series={row.value === 'experience' ? 'experience' : index}>
                      <th scope="row" title={row.value}>
                        {row.value === 'experience' ? (zh ? '面经' : 'Experiences') : label(CATEGORIES, row.value, zh)}
                      </th>
                      {row.counts.map((n, i) => (
                        <td key={s.trend!.quarters[i]}>
                          <span className="company-stats-col" aria-hidden="true">
                            <span style={{ height: `${(n / max) * 100}%` }} />
                          </span>
                          <span className="company-stats-col-n">{n}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!s.roles.length && (
          <div className="company-stats-panel is-wide">
            <h3>{zh ? '岗位' : 'Roles'}</h3>
            <ul className="company-stats-roles">
              {s.roles.map((r) => (
                <li key={r.value}>
                  {r.value} <b>{r.n}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
