import Link from 'next/link';
import { notFound } from 'next/navigation';
import { oaDifficulty } from '@/lib/server/oa-topics';
import { cache } from 'react';
import { REPORT_WINDOWS, reportWindow, WINDOW_NAMES } from '@/lib/report-windows';
import lcMapFile from '@/lib/content/company-lc-map.json';
import { ROUND_LABELS } from '@/lib/experience';
import { companyHubPath, oaCompanyPath, oaProblemPath } from '@/lib/oa-company-brands';
import { breadcrumbJsonLd, companyPageTitle, seoMetadata } from '@/lib/seo';
import { CompanyStatsCard, MemberStatsCard } from '@/components/company-stats-card';
import { CompanyFollowButton } from '@/components/company-follow-button';
import { companyHub } from '@/lib/server/company-hub';
import { rankInWindow, sourceDates } from '@/lib/server/company-insights';
import { companyStats } from '@/lib/server/company-stats';
import { companyFacets } from '@/lib/server/seo-facets';
import { CATEGORIES } from '@/components/company-stats-card';
import {
  companyMemberExperiences,
  memberExperiencePath,
  memberExperienceStats,
  memberIdOf,
} from '@/lib/server/experience-submissions';
import { library } from '@/lib/server/content-library';
import { requestLocale } from '@/lib/server/locale';
import { oaReadyProblems } from '@/lib/server/oa-judge';
import { publicLibraryPath } from '@/lib/server/public-library';
import { OaCompanyMark, OaDifficulty } from '../../oa/parts';
import { CompanyAsked } from '../asked-reports';
import { H1bPanel } from '../h1b';
import { Facts, QUESTION_LEVELS } from '../parts';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const OA_SHOWN = 8;
const LC_SHOWN = 10;
const load = cache(async (slug: string) => {
  const ready = await oaReadyProblems();
  const hub = companyHub(library(), slug, new Set(ready.keys()));
  if (!hub) notFound();
  const locale = await requestLocale();
  const zh = locale === 'zh';
  const { name, oa, experiences, questions } = hub.company;
  const parts = [
    oa && (zh ? `${oa} 道 OA 真题` : `${oa} online assessment ${oa === 1 ? 'problem' : 'problems'}`),
    questions && (zh ? `${questions} 道面试题` : `${questions} interview ${questions === 1 ? 'question' : 'questions'}`),
    experiences && (zh ? `${experiences} 篇面经` : `${experiences} interview ${experiences === 1 ? 'experience' : 'experiences'}`),
  ].filter(Boolean);
  const lead = zh
    ? `${name} 面试准备：${parts.join('、')}${hub.leetcode.length ? '，以及面经里出现最多的 LeetCode 题' : ''}。在 CSWork 在线写代码、提交评测，或来一场限时模拟。`
    : `Prepare for ${name}: ${parts.join(', ')}${hub.leetcode.length ? ', and the LeetCode problems candidates report most' : ''}. Code and submit online on CSWork, or take a timed mock.`;
  // Approved member posts lead the experiences, marked as such (lib/server/experience-submissions.ts).
  const members = companyMemberExperiences(hub.company.slug, 3);
  return {
    ...hub,
    experiences: [...members.items, ...hub.experiences].slice(0, 6),
    experienceTotal: hub.company.experiences + members.total,
    stats: companyStats(library(), hub.company.library),
    memberStats: memberExperienceStats(hub.company.slug),
    facets: companyFacets(library(), hub.company.slug),
    ready,
    locale,
    lead,
  };
});

export async function generateMetadata({ params }: Props) {
  const { company, locale, lead } = await load((await params).slug);
  return seoMetadata({
    title: companyPageTitle(locale, company.name),
    description: lead,
    path: companyHubPath(company.slug),
  });
}

const spa = (params: Record<string, string>) => `/?${new URLSearchParams(params)}`;
function SectionHead({ id, title, count, all, zh }: { id: string; title: string; count: string; all: string; zh: boolean }) {
  return (
    <div className="company-hub-section-head">
      <h2 id={id}>
        {title} <small>{count}</small>
      </h2>
      <a href={all}>
        {zh ? '查看全部' : 'View all'} <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

export default async function CompanyPage({ params, searchParams }: Props) {
  const period = reportWindow((await searchParams).window);
  const { company, oa, leetcode, experiences, experienceTotal, questions, mockOa, mockInterview, stats, memberStats, facets, ready, locale, lead } = await load(
    (await params).slug,
  );
  const zh = locale === 'zh';
  const ranked = rankInWindow(leetcode, period, sourceDates()).slice(0, LC_SHOWN);
  const most = Math.max(1, ...ranked.map((p) => p.n));
  // SPA lists filter by one library spelling: the employer's most used one.
  const spelling = company.library[0] ?? company.slug;
  const stops = [
    oa.length && { id: 'oa', label: zh ? 'OA 真题' : 'OA', n: company.oa },
    leetcode.length && { id: 'leetcode', label: zh ? '高频 LeetCode' : 'Top LeetCode', n: ranked.length },
    experiences.length && { id: 'experiences', label: zh ? '面经' : 'Experiences', n: experienceTotal },
    questions.length && { id: 'questions', label: zh ? '面试题' : 'Questions', n: company.questions },
  ].filter((s): s is { id: string; label: string; n: number } => !!s);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: company.name, path: companyHubPath(company.slug) },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/" prefetch={false}>
          CSWork
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{company.name}</span>
      </nav>
      <header className="oa-public-company-head">
        <OaCompanyMark slug={company.slug} name={company.name} />
        <div>
          <p className="public-library-eyebrow">{zh ? '公司面试准备' : 'COMPANY INTERVIEW PREP'}</p>
          <h1>{zh ? `${company.name} 面试题、OA 真题与面经` : `${company.name} interview questions, OA and experiences`}</h1>
          <p className="public-library-summary">{lead}</p>
        </div>
      </header>
      <div className="oa-public-actions">
        {mockOa && (
          <a className="oa-public-cta" href={`/mock-oa/${mockOa}`}>
            {zh ? `模拟 ${company.name} OA` : `Mock ${company.name} OA`}
          </a>
        )}
        {mockInterview && (
          <a className="oa-public-cta is-quiet" href={`/mock-interview/${mockInterview}`}>
            {zh ? '模拟面试抽题' : 'Mock interview'}
          </a>
        )}
        <a className="oa-public-cta is-quiet" href={`/discuss?${new URLSearchParams({ company: company.slug })}`}>
          {zh ? `讨论 ${company.name}` : `Discuss ${company.name}`}
        </a>
        <CompanyFollowButton slug={company.slug} name={company.name} zh={zh} />
      </div>
      {stops.length > 1 && (
        <nav className="company-hub-stops" aria-label={zh ? '本页内容' : 'On this page'}>
          <ol>
            {stops.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span className="company-hub-stop-n">{s.n}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {stats && <CompanyStatsCard stats={stats} locale={locale} />}
      {memberStats && <MemberStatsCard stats={memberStats} locale={locale} />}
      {!!facets.length && (
        <nav className="company-hub-facets" aria-labelledby="company-facets">
          <h2 id="company-facets">{zh ? '按岗位和题目类别' : 'By role and question category'}</h2>
          <ul>
            {facets.map((f) => (
              <li key={f.path}>
                <a href={f.path} data-kind={f.kind}>
                  {f.kind === 'cat' && Object.hasOwn(CATEGORIES, f.name) ? CATEGORIES[f.name][zh ? 0 : 1] : f.name} <b>{f.n}</b>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!!oa.length && (
        <section className="company-hub-section" aria-labelledby="oa">
          <SectionHead
            id="oa"
            title={zh ? 'OA 真题' : 'OA problems'}
            count={zh ? `${company.oa} 题` : `${company.oa}`}
            all={spa({ view: 'problems', library: 'oa', company: company.slug, ...(oa.some((i) => i.judgeStatus === 'ready') ? {} : { ready: '0' }) })}
            zh={zh}
          />
          <ol className="oa-public-list">
            {oa.slice(0, OA_SHOWN).map((item) => (
              <li key={item.id}>
                <a href={oaProblemPath(item.companySlug, item.id)}>
                  <span className="oa-public-number">#{item.number}</span>
                  <span className="oa-public-title">{item.title}</span>
                  {item.judgeStatus === 'ready' ? (
                    <OaDifficulty {...oaDifficulty(item.id, ready.get(item.id)?.difficulty)} locale={locale} />
                  ) : (
                    <span className="oa-public-chip" data-level="reading">
                      {zh ? '仅题面' : 'Statement only'}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ol>
          {oa.length > OA_SHOWN && (
            <p className="company-hub-more">
              <Link href={oaCompanyPath(company.slug)} prefetch={false}>
                {zh ? `${company.name} 全部 ${company.oa} 道 OA 真题` : `All ${company.oa} ${company.name} OA problems`}
              </Link>
            </p>
          )}
        </section>
      )}

      {!!leetcode.length && (
        <section className="company-hub-section" aria-labelledby="leetcode">
          <SectionHead
            id="leetcode"
            title={zh ? '高频 LeetCode 题' : 'Most reported LeetCode problems'}
            count={zh ? `按面经报告次数 · 数据更新至 ${lcMapFile.generated}` : `by interview reports · data as of ${lcMapFile.generated}`}
            all={spa({ view: 'problems', company: company.slug, sort: 'frequency', ...(period !== 'all' && { window: period }) })}
            zh={zh}
          />
          {/* Server-rendered filter links; the canonical page is the unfiltered one. */}
          <nav className="company-hub-windows" aria-label={zh ? '报告时间范围' : 'Reports from the last'}>
            {[...REPORT_WINDOWS, 'all' as const].map((w) => (
              <a
                key={w}
                href={`${companyHubPath(company.slug)}${w === 'all' ? '' : `?window=${w}`}#leetcode`}
                rel="nofollow"
                aria-current={w === period ? 'true' : undefined}
              >
                {WINDOW_NAMES[w][zh ? 0 : 1]}
              </a>
            ))}
          </nav>
          {ranked.length ? (
            <ol className="company-hub-lc">
              {ranked.map((p, index) => {
                const title = zh ? p.titleZh || p.titleEn : p.titleEn || p.titleZh;
                const body = (
                  <>
                    <span className="company-hub-rank" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="company-hub-lc-title">
                      <span className="oa-public-number">LC {p.number}</span> {title}
                      {/* Reports here against the most reported row on the page. */}
                      <span className="company-hub-bar" aria-hidden="true">
                        <span style={{ width: `${(100 * p.n) / most}%` }} />
                      </span>
                    </span>
                    <span className="company-hub-freq" title={zh ? `${p.n} 次面经报告，最近 ${p.last}` : `${p.n} reports, latest ${p.last}`}>
                      <span aria-hidden="true">
                        ×{p.n} · {p.last.slice(0, 7)}
                      </span>
                      <span className="sr-only">
                        {zh ? `${p.n} 次面经报告，最近 ${p.last.slice(0, 7)}` : `${p.n} ${p.n === 1 ? 'report' : 'reports'}, latest ${p.last.slice(0, 7)}`}
                      </span>
                    </span>
                    <OaDifficulty difficulty={p.difficulty} locale={locale} />
                  </>
                );
                return (
                  <li key={p.id}>
                    {/* Problems not judgeable here yet are listed without a link. */}
                    {p.judgeProblemId ? <a href={spa({ view: 'problem', problem: p.judgeProblemId })}>{body}</a> : <div>{body}</div>}
                    {!!p.refs.length && (
                      <details className="company-hub-sources">
                        <summary>{zh ? `来源 ${p.refs.length} 篇面经` : `${p.refs.length} source ${p.refs.length === 1 ? 'report' : 'reports'}`}</summary>
                        <ul>
                          {p.refs.map((r) => (
                            <li key={r.slug}>
                              <a href={publicLibraryPath(r.type, r.slug)}>{r.title}</a>
                              {r.date && <time dateTime={r.date}>{r.date.slice(0, 7)}</time>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="company-hub-more">{zh ? '这段时间没有面经报告。' : 'No reports in this period.'}</p>
          )}
        </section>
      )}

      <CompanyAsked slug={company.slug} zh={zh} />

      {!!experiences.length && (
        <section className="company-hub-section" aria-labelledby="experiences">
          <SectionHead
            id="experiences"
            title={zh ? '最新面经' : 'Latest interview experiences'}
            count={zh ? `${experienceTotal} 篇` : `${experienceTotal}`}
            all={spa({ view: 'experiences', company: spelling })}
            zh={zh}
          />
          <ul className="company-hub-cards">
            {experiences.map((item) => (
              <li key={item.slug}>
                {'member' in item && (
                  <span className="xs-badge">{zh ? '学员投稿' : 'Member submission'}</span>
                )}
                <a href={'member' in item ? memberExperiencePath(memberIdOf(item.slug)!) : publicLibraryPath(item.type, item.slug)}>
                  {item.title}
                </a>
                <Facts item={item} zh={zh} />
                {item.role && <p className="company-hub-role">{item.role}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!questions.length && (
        <section className="company-hub-section" aria-labelledby="questions">
          <SectionHead
            id="questions"
            title={zh ? '面试题' : 'Interview questions'}
            count={zh ? `${company.questions} 道` : `${company.questions}`}
            all={spa({ view: 'questions', company: spelling })}
            zh={zh}
          />
          <ol className="oa-public-list company-hub-questions">
            {questions.map((item) => {
              const level = item.difficulty && Object.hasOwn(QUESTION_LEVELS, item.difficulty) ? item.difficulty : null;
              return (
                <li key={`${item.type}:${item.slug}`}>
                  <a href={publicLibraryPath(item.type, item.slug)}>
                    <span className="oa-public-number">
                      {item.type === 'coding_question' ? (zh ? '编程' : 'Code') : zh ? '面试' : 'Q'}
                    </span>
                    <span className="oa-public-title">{item.title}</span>
                    {level ? (
                      <span className="oa-public-chip" data-level={level}>
                        {QUESTION_LEVELS[level][zh ? 0 : 1]}
                      </span>
                    ) : (
                      item.round && <span className="oa-public-chip">{Object.hasOwn(ROUND_LABELS, item.round) ? ROUND_LABELS[item.round][zh ? 0 : 1] : item.round}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <H1bPanel slug={company.slug} zh={zh} />
    </>
  );
}
