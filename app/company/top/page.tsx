import Link from 'next/link';
import { breadcrumbJsonLd, seoMetadata, SITE_NAME } from '@/lib/seo';
import { companyHubPath } from '@/lib/oa-company-brands';
import { topProblems } from '@/lib/server/company-insights';
import { requestLocale } from '@/lib/server/locale';
import { OaDifficulty } from '../../oa/parts';
import { SaveAsList } from '../save-list';

/** /company/top: the 100 LeetCode problems reported most across every company (lib/server/company-insights.ts). */
const PATH = '/company/top';
const SHOWN_COMPANIES = 3;
const title = (zh: boolean) => (zh ? '全站高频 Top 100：各公司面试最常考的 LeetCode 题' : 'Top 100 LeetCode Problems Companies Ask Most');
const lead = (zh: boolean) =>
  zh
    ? '按面经报告次数加上近 6 个月学员「被问到」的上报数排序，每题列出考过它的公司和最近一次的考察月份。都是报告次数，不是出题概率。'
    : 'Ranked by interview reports plus learners’ “I was asked this” reports from the last six months, with the companies that asked each problem and the latest month it came up. Counts of reports, not odds.';

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({ title: `${title(zh)} | ${SITE_NAME}`, description: lead(zh), path: PATH });
}

export default async function TopProblemsPage() {
  const zh = (await requestLocale()) === 'zh';
  const top = topProblems(100);
  const judgeable = top.flatMap((p) => (p.judgeProblemId ? [p.judgeProblemId] : []));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: zh ? '全站高频 Top 100' : 'Top 100', path: PATH },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/" prefetch={false}>
          CSWork
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '全站高频 Top 100' : 'Top 100'}</span>
      </nav>
      <header className="facet-head">
        <p className="public-library-eyebrow">{zh ? '全站 · 所有公司' : 'ALL COMPANIES'}</p>
        <h1>{title(zh)}</h1>
        <p className="public-library-summary">{lead(zh)}</p>
      </header>
      {!!judgeable.length && (
        <SaveAsList
          ids={judgeable}
          zh={zh}
          title={zh ? '全站高频 Top 100' : 'CSWork Top 100'}
          description={zh ? '各公司面试最常考的 LeetCode 题（来自 /company/top）' : 'The LeetCode problems companies ask most (from /company/top)'}
        />
      )}
      {top.length ? (
        <ol className="company-hub-lc top-list">
          {top.map((p, index) => {
            const name = zh ? p.titleZh || p.titleEn : p.titleEn || p.titleZh;
            const more = p.companies.length - SHOWN_COMPANIES;
            const body = (
              <>
                <span className="company-hub-rank" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="company-hub-lc-title">
                  <span className="oa-public-number">LC {p.number}</span> {name}
                </span>
                <span className="company-hub-freq">
                  <span aria-hidden="true">
                    ×{p.score} · {p.last}
                  </span>
                  <span className="sr-only">
                    {zh ? `${p.score} 次报告，最近 ${p.last}` : `${p.score} ${p.score === 1 ? 'report' : 'reports'}, latest ${p.last}`}
                  </span>
                </span>
                <OaDifficulty difficulty={p.difficulty} locale={zh ? 'zh' : 'en'} />
              </>
            );
            return (
              <li key={p.id}>
                {p.judgeProblemId ? (
                  <a href={`/?${new URLSearchParams({ view: 'problem', problem: p.judgeProblemId })}`}>{body}</a>
                ) : (
                  <div>{body}</div>
                )}
                <p className="top-companies">
                  <span className="sr-only">{zh ? '考过的公司：' : 'Asked by: '}</span>
                  {p.companies.slice(0, SHOWN_COMPANIES).map((c) =>
                    c.hub ? (
                      <a key={c.slug} href={companyHubPath(c.slug)}>
                        {c.name} <b>{c.n}</b>
                      </a>
                    ) : (
                      <span key={c.slug} className="top-company">
                        {c.name} <b>{c.n}</b>
                      </span>
                    ),
                  )}
                  {more > 0 && <span className="top-more">{zh ? `另 ${more} 家` : `+${more} more`}</span>}
                  {!!p.learnerReports && (
                    <span className="top-learners">{zh ? `含学员上报 ${p.learnerReports} 次` : `incl. ${p.learnerReports} learner ${p.learnerReports === 1 ? 'report' : 'reports'}`}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="public-library-empty">{zh ? '还没有足够的报告。' : 'Not enough reports yet.'}</p>
      )}
    </>
  );
}
