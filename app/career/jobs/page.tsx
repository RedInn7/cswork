import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { freshOpenings } from '@/lib/server/job-openings';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { OpeningList, OpeningsSource } from '../../company/jobs';
import '../../company/jobs.css';

const copy = {
  en: {
    title: 'Intern and New-Grad Openings at Tech Companies · CSWork',
    description:
      'Open internships and new-grad roles at the companies CSWork covers, from their public job boards, synced daily. Filter by kind, place and company, and add one to your application tracker.',
    kicker: 'INTERN & NEW-GRAD OPENINGS',
    h1: 'Who is hiring interns and new grads right now.',
    lead: 'Roles from the job boards of companies with a CSWork company page, newest first. Each links to the posting; “Add to tracker” fills in a new card on your application board.',
    empty: 'No openings match. Try fewer filters.',
    none: 'No openings have been synced yet.',
  },
  zh: {
    title: '实习和新毕业生岗位：科技公司在招职位 · CSWork',
    description: 'CSWork 收录公司在招的实习和新毕业生岗位，来自公司的公开招聘页，每天同步。可按类型、地点和公司筛选，一键加入投递追踪。',
    kicker: '实习 · 新毕业生岗位',
    h1: '现在哪些公司在招实习生和应届生。',
    lead: '有 CSWork 公司页的公司，从它们的招聘页同步，最新的在前。点标题去看原岗位；“加入投递追踪”会在你的投递看板里预填一张新卡片。',
    empty: '没有符合条件的岗位，试试少选几个筛选条件。',
    none: '还没有同步到岗位。',
  },
};
const SHOWN = 200;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '');

/** Fresh openings at companies with a company page (hidden ones are not), and those companies' names. */
function listed() {
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  return { names, items: freshOpenings().filter((o) => names.has(o.companySlug)) };
}

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/jobs' }),
    // An empty list is no landing page.
    ...(listed().items.length ? {} : { robots: { index: false, follow: true } }),
  };
}

/** /career/jobs: every company's open intern and new-grad roles (lib/server/job-openings.ts). */
export default async function JobsPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const query = await searchParams;
  const kind = (['intern', 'new-grad'] as const).find((k) => k === one(query.kind)) ?? '';
  const place = one(query.q).slice(0, 60);
  const company = one(query.company);
  const { names, items } = listed();
  const companies = [...new Set(items.map((o) => o.companySlug))]
    .map((slug) => ({ slug, name: names.get(slug)! }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const needle = place.toLowerCase();
  const shown = items.filter(
    (o) =>
      (!kind || o.kind === kind) && (!company || o.companySlug === company) && (!needle || o.location.toLowerCase().includes(needle)),
  );
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '实习和新毕业生岗位' : 'Intern & new-grad roles'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      {items.length ? (
        <>
          <form className="job-filters" method="get" action="/career/jobs" role="search" aria-label={zh ? '筛选岗位' : 'Filter openings'}>
            <label>
              {zh ? '类型' : 'Kind'}
              <select name="kind" defaultValue={kind}>
                <option value="">{zh ? '全部' : 'All'}</option>
                <option value="intern">{zh ? '实习' : 'Intern'}</option>
                <option value="new-grad">{zh ? '新毕业生' : 'New grad'}</option>
              </select>
            </label>
            <label>
              {zh ? '地点关键字' : 'Place'}
              <input name="q" type="search" maxLength={60} defaultValue={place} placeholder={zh ? '如 New York、Remote' : 'e.g. New York, Remote'} />
            </label>
            <label>
              {zh ? '公司' : 'Company'}
              <select name="company" defaultValue={company}>
                <option value="">{zh ? '全部公司' : 'All companies'}</option>
                {companies.map((co) => (
                  <option key={co.slug} value={co.slug}>
                    {co.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="resume-actions">
              <button type="submit">{zh ? '筛选' : 'Filter'}</button>
            </div>
          </form>
          <p className="job-count">
            {shown.length > SHOWN
              ? zh
                ? `共 ${shown.length} 个岗位，显示最新的 ${SHOWN} 个`
                : `${shown.length} openings; the newest ${SHOWN} are shown`
              : zh
                ? `共 ${shown.length} 个岗位`
                : `${shown.length} ${shown.length === 1 ? 'opening' : 'openings'}`}
          </p>
          {shown.length ? (
            <OpeningList items={shown.slice(0, SHOWN)} names={names} zh={zh} withCompany />
          ) : (
            <div className="resume-off">
              <p>{c.empty}</p>
            </div>
          )}
          <OpeningsSource zh={zh} />
        </>
      ) : (
        <div className="resume-off">
          <p>{c.none}</p>
        </div>
      )}
    </>
  );
}
