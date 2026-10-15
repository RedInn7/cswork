import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { companyHubPath } from '@/lib/oa-company-brands';
import { approvalRate, H1B, h1bRanking } from '@/lib/server/h1b';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { H1bSource, h1bCount, h1bPercent } from '../../company/h1b';

const copy = {
  en: {
    title: 'H-1B Sponsors: Tech Company Approvals by Fiscal Year · CSWork',
    description:
      'H-1B petitions approved and denied at the companies CSWork covers, ranked by new-employment approvals in the latest fiscal year, from the public USCIS H-1B Employer Data Hub.',
    kicker: 'H-1B SPONSORS · USCIS DATA',
    h1: 'Which companies file H-1B petitions, and how many.',
    lead: 'New-employment and continuing petitions at the companies with a CSWork company page, ranked by new-employment approvals in the latest fiscal year. Each company page shows every year.',
    empty: 'The H-1B data has not been built on this site yet.',
  },
  zh: {
    title: 'H-1B 担保公司：科技公司各财年批准数 · CSWork',
    description: 'CSWork 收录公司的 H-1B 申请批准数和拒签数，按最近一个财年的新雇佣批准数排序，数据来自 USCIS 公开的 H-1B Employer Data Hub。',
    kicker: 'H-1B 担保 · USCIS 公开数据',
    h1: '哪些公司在办 H-1B，各办了多少。',
    lead: '有 CSWork 公司页的公司，按最近一个财年的新雇佣批准数排序，列出新雇佣和续签的批准、拒签数。各年明细见每家的公司页。',
    empty: '本站还没有生成 H-1B 数据。',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/h1b' }),
    // An empty table is no landing page.
    ...(H1B.fiscalYears.length ? {} : { robots: { index: false, follow: true } }),
  };
}

/** /career/h1b: company page employers by H-1B new-employment approvals (lib/server/h1b.ts). */
export default async function H1bPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const rows = h1bRanking(new Map(reportCompanies().map((r) => [r.slug, r.name])));
  const fy = H1B.fiscalYears.at(-1);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? 'H-1B 担保' : 'H-1B sponsors'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <H1bSource zh={zh} />
      </div>
      {rows.length ? (
        <div className="guide-table" role="region" aria-label={zh ? `FY${fy} H-1B 排名` : `FY${fy} H-1B ranking`} tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">{zh ? '公司' : 'Company'}</th>
                <th scope="col">{zh ? `FY${fy} 新雇佣批准` : `FY${fy} new: approved`}</th>
                <th scope="col">{zh ? '新雇佣拒签' : 'New: denied'}</th>
                <th scope="col">{zh ? '新雇佣批准率' : 'New: approval rate'}</th>
                <th scope="col">{zh ? '续签批准' : 'Continuing: approved'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <th scope="row">
                    <a href={`${companyHubPath(r.slug)}#h1b`}>{r.name}</a>
                  </th>
                  <td>{h1bCount(r.newApproved, zh)}</td>
                  <td>{h1bCount(r.newDenied, zh)}</td>
                  <td>{h1bPercent(approvalRate(r.newApproved, r.newDenied))}</td>
                  <td>{h1bCount(r.contApproved, zh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="resume-off">
          <p>{c.empty}</p>
        </div>
      )}
    </>
  );
}
