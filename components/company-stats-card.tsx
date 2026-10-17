import { RESULTS, ROUND_LABELS, SENTIMENTS, SOURCES } from '@/lib/experience';
import type { CompanyStats, Share } from '@/lib/server/company-stats';
import type { MemberStats, OaOutcomes } from '@/lib/server/experience-submissions';

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

const SENTIMENT_TONES: Record<string, string> = { pos: 'good', neutral: 'neutral', neg: 'bad' };

/**
 * What members' own posts about an employer add up to (lib/server/experience-submissions.ts):
 * average difficulty, how the process felt, how they applied and how long it took. Each figure
 * needs five posts that give it; the server leaves out the rest.
 */
export function MemberStatsCard({ stats, locale }: { stats: MemberStats; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  const s = stats;
  return (
    <section className="company-stats is-members" aria-labelledby="member-stats-title">
      <header className="company-stats-head">
        <h2 id="member-stats-title">{zh ? '学员投稿怎么说' : 'What members report'}</h2>
        <p>
          {zh
            ? `${s.posts} 篇学员投稿，只代表作者自述`
            : `${s.posts} member ${s.posts === 1 ? 'post' : 'posts'}, as their authors tell it`}
        </p>
      </header>
      <dl className="company-stats-figures">
        <div>
          <dt>{zh ? '学员面经' : 'Member posts'}</dt>
          <dd>{s.posts}</dd>
        </div>
        {s.difficulty && (
          <div>
            <dt>{zh ? `平均难度（${s.difficulty.n} 篇打分）` : `Average difficulty (${s.difficulty.n} rated)`}</dt>
            <dd>
              {s.difficulty.average.toFixed(1)}
              <small> / 5</small>
            </dd>
          </div>
        )}
        {s.weeks && (
          <div>
            <dt>{zh ? `流程时长中位数（${s.weeks.n} 篇）` : `Median process (${s.weeks.n} posts)`}</dt>
            <dd>
              {s.weeks.median}
              <small>{zh ? ' 周' : s.weeks.median === 1 ? ' week' : ' weeks'}</small>
            </dd>
          </div>
        )}
        {s.prep && (
          <div>
            <dt>{zh ? `拿到 Offer 的准备时长中位数（${s.prep.n} 篇）` : `Median prep among offers (${s.prep.n} posts)`}</dt>
            <dd>
              {s.prep.median}
              <small>{zh ? ' 周' : s.prep.median === 1 ? ' week' : ' weeks'}</small>
            </dd>
          </div>
        )}
      </dl>
      <div className="company-stats-grid">
        {s.sentiment && (
          <div className="company-stats-panel">
            <h3>{zh ? '面试体验' : 'How it felt'}</h3>
            <p className="company-stats-note">{zh ? `${s.sentiment.n} 篇给出了体验` : `${s.sentiment.n} posts say`}</p>
            <div className="company-stats-stack" aria-hidden="true">
              {s.sentiment.rows.map((r) => (
                <span key={r.value} data-tone={SENTIMENT_TONES[r.value]} style={{ width: width(r.n, s.sentiment!.n) }} />
              ))}
            </div>
            <ul className="company-stats-legend">
              {s.sentiment.rows.map((r) => (
                <li key={r.value} data-tone={SENTIMENT_TONES[r.value]}>
                  {label(SENTIMENTS, r.value, zh)} <b>{pct(r.n, s.sentiment!.n)}</b>
                  <span className="sr-only">{zh ? `（${r.n} 篇）` : ` (${r.n})`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.channel && (
          <div className="company-stats-panel is-amber">
            <h3>{zh ? '投递渠道' : 'How they applied'}</h3>
            <p className="company-stats-note">{zh ? `${s.channel.n} 篇给出了渠道` : `${s.channel.n} posts say`}</p>
            <Bars rows={s.channel.rows} of={s.channel.n} name={(v) => label(SOURCES, v, zh)} zh={zh} />
          </div>
        )}
        {s.oa && <OaPanel oa={s.oa} zh={zh} />}
      </div>
    </section>
  );
}

/** How many members' posts say an OA led to the next round, by whether they solved it all: counts, never a rate. */
function OaPanel({ oa, zh }: { oa: OaOutcomes; zh: boolean }) {
  const says = (moved: number) => (zh ? `${moved} 篇说进了下一轮` : `${moved} ${moved === 1 ? 'says' : 'say'} they moved on`);
  return (
    <div className="company-stats-panel is-wide">
      <h3>{zh ? 'OA 成绩和下一轮' : 'OA scores and the next round'}</h3>
      <ul className="company-stats-oa">
        {oa.all && (
          <li>
            {zh ? `全部 AC 的 ${oa.all.n} 篇里，` : `Of ${oa.all.n} posts that solved every problem, `}
            <b>{says(oa.all.moved)}</b>
          </li>
        )}
        {oa.partial && (
          <li>
            {zh ? `没有全部 AC 的 ${oa.partial.n} 篇里，` : `Of ${oa.partial.n} posts that left something unsolved, `}
            <b>{says(oa.partial.moved)}</b>
          </li>
        )}
      </ul>
      <p className="company-stats-note">
        {zh
          ? '只算填了 OA 题数、做出几道并说了进没进下一轮的投稿；全部 AC 指每题都做出，填了用例比例的还要是 100%。每组满 8 篇才显示。'
          : 'Counts posts that give the OA score and say whether they moved on. Solving every problem also means 100% of tests, when a post gives that. A group shows from 8 posts.'}
      </p>
      <p className="company-stats-note">{zh ? '自报样本，有偏差，不是通过率' : 'Self-reported and biased: not a pass rate'}</p>
    </div>
  );
}

/**
 * The OA outcomes summed over every company's member posts, for a company page whose own posts
 * are still too few (lib/server/experience-submissions.ts memberOaOutcomes).
 */
export function OaOutcomesCard({ oa, locale }: { oa: OaOutcomes; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  return (
    <section className="company-stats is-members" aria-labelledby="oa-site-title">
      <header className="company-stats-head">
        <h2 id="oa-site-title">{zh ? '全站学员投稿' : 'Member posts, all companies'}</h2>
        <p>{zh ? '这家公司的 OA 样本还不够，先看所有公司合计' : 'Too few OA posts for this company yet, so these add up every company'}</p>
      </header>
      <div className="company-stats-grid">
        <OaPanel oa={oa} zh={zh} />
      </div>
    </section>
  );
}
