import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BlockedList } from '@/components/job-blocked';
import { JobList } from '@/components/job-list';
import { JobSearchSave } from '@/components/job-search-save';
import { DEFAULT_SEARCH, matchesSearch, ROLE_CATEGORIES, ROLE_NAMES, roleCategory, searchFromQuery, searchQuery, sortTerms, termKey, termLabel, termOf } from '@/lib/job-tags';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { H1B, h1bCompany } from '@/lib/server/h1b';
import { freshOpenings, viewerJobSearch } from '@/lib/server/job-openings';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { OpeningsSource } from '../../company/jobs';
import '../../company/jobs.css';

const copy = {
  en: {
    title: 'Intern and New-Grad Openings at Tech Companies · CSWork',
    description:
      'Open internships and new-grad roles at the companies CSWork covers, from their public job boards, synced daily. Filter by role, term, place, company and posted pay, and add one to your application tracker.',
    kicker: 'INTERN & NEW-GRAD OPENINGS',
    h1: 'Who is hiring interns and new grads right now.',
    lead: 'Roles from the job boards of companies with a CSWork company page, newest first. Each links to the posting; “Add to tracker” fills in a new card on your application board.',
    empty: 'No openings match. Try fewer filters.',
    none: 'No openings have been synced yet.',
  },
  zh: {
    title: '实习和新毕业生岗位：科技公司在招职位 · CSWork',
    description: 'CSWork 收录公司在招的实习和新毕业生岗位，来自公司的公开招聘页，每天同步。可按方向、学期、地点、公司和公开薪资筛选，一键加入投递追踪。',
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

/** Companies whose latest fiscal year has new-employment H-1B approvals: slug → [year, count]. Empty until the data is built. */
function sponsors(slugs: Iterable<string>) {
  const fy = H1B.fiscalYears.at(-1);
  const out: Record<string, [number, number]> = {};
  for (const slug of slugs) {
    const year = fy === undefined ? undefined : h1bCompany(slug)?.years.find((y) => y.fy === fy);
    if (year && year.newApproved > 0) out[slug] = [year.fy, year.newApproved];
  }
  return out;
}

/**
 * /career/jobs: every company's open intern and new-grad roles (lib/server/job-openings.ts). Opened
 * with no query, a signed-in learner's saved search applies (?all=1 skips it); without one, the role
 * named in their profile picks the default role filter. Companies the learner blocked are left out.
 */
export default async function JobsPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const query = await searchParams;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const mine = viewer ? viewerJobSearch(viewer.id) : null;
  const bare = !Object.keys(query).length;
  const applied = bare ? (mine?.saved ?? null) : null;
  let search = applied ?? searchFromQuery((name) => one(query[name]));
  const profileRole = bare && !applied && mine?.targetRole ? roleCategory(mine.targetRole) : 'other';
  if (profileRole !== 'other') search = { ...search, role: profileRole };
  if (one(query.all) === '1' && !one(query.role)) search = { ...DEFAULT_SEARCH, role: 'all' };
  const { names, items: all } = listed();
  const blocked = new Set(mine?.blocked);
  const items = all.filter((o) => !blocked.has(o.companySlug));
  const companies = [...new Set(items.map((o) => o.companySlug))]
    .map((slug) => ({ slug, name: names.get(slug)! }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const terms = sortTerms([...items.map((o) => termKey(termOf(o.title))), search.term]);
  // Shown only once the H-1B data is built, and never part of a saved search.
  const h1bOn = H1B.fiscalYears.length > 0,
    h1bOnly = h1bOn && one(query.h1b) === '1';
  const sponsoring = h1bOnly ? sponsors(companies.map((co) => co.slug)) : {};
  const shown = items.filter((o) => matchesSearch(o, search) && (!h1bOnly || Object.hasOwn(sponsoring, o.companySlug)));
  const page = shown.slice(0, SHOWN);
  const savedQuery = mine?.saved ? String(searchQuery(mine.saved)) : null;
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
      <p className="job-calendar-link">
        <a href="/career/jobs/calendar">{zh ? '各公司什么时候开放：招聘日历' : 'When companies open roles: the hiring calendar'}</a>
      </p>
      {/* Everything blocked still shows the filters and the blocked list. */}
      {all.length ? (
        <>
          {applied && (
            <p className="job-search-applied" role="note">
              {zh ? '已套用你保存的筛选。' : 'Showing your saved search.'} <a href="/career/jobs?all=1">{zh ? '看全部' : 'See all openings'}</a>
            </p>
          )}
          {profileRole !== 'other' && (
            <p className="job-search-applied" role="note">
              {zh
                ? `按你资料里的目标岗位，先只看「${ROLE_NAMES[profileRole][0]}」方向。`
                : `Showing ${ROLE_NAMES[profileRole][1]} roles, from the target role in your profile.`}{' '}
              <a href="/career/jobs?all=1">{zh ? '看全部' : 'See all openings'}</a>
            </p>
          )}
          <form className="job-filters" method="get" action="/career/jobs" role="search" aria-label={zh ? '筛选岗位' : 'Filter openings'}>
            <label>
              {zh ? '类型' : 'Kind'}
              <select name="kind" defaultValue={search.kind}>
                <option value="">{zh ? '全部' : 'All'}</option>
                <option value="intern">{zh ? '实习' : 'Intern'}</option>
                <option value="new-grad">{zh ? '新毕业生' : 'New grad'}</option>
              </select>
            </label>
            <label>
              {zh ? '方向' : 'Role'}
              <select name="role" defaultValue={search.role}>
                <option value="tech">{zh ? '技术岗' : 'Tech roles'}</option>
                <option value="all">{zh ? '全部方向' : 'All roles'}</option>
                {ROLE_CATEGORIES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_NAMES[role][zh ? 0 : 1]}
                  </option>
                ))}
              </select>
            </label>
            {terms.length > 0 && (
              <label>
                {zh ? '学期' : 'Term'}
                <select name="term" defaultValue={search.term}>
                  <option value="">{zh ? '全部学期' : 'Any term'}</option>
                  {terms.map((term) => (
                    <option key={term} value={term}>
                      {termLabel(term, zh)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {zh ? '地点关键字' : 'Place'}
              <input name="q" type="search" maxLength={60} defaultValue={search.q} placeholder={zh ? '如 New York、Remote' : 'e.g. New York, Remote'} />
            </label>
            <label>
              {zh ? '公司' : 'Company'}
              <select name="company" defaultValue={search.company}>
                <option value="">{zh ? '全部公司' : 'All companies'}</option>
                {companies.map((co) => (
                  <option key={co.slug} value={co.slug}>
                    {co.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="job-filters-check">
              <input type="checkbox" name="paid" value="1" defaultChecked={search.paid} />
              {zh ? '只看标了薪资的' : 'Posted pay only'}
            </label>
            <label className="job-filters-check">
              <input type="checkbox" name="sponsor" value="1" defaultChecked={search.sponsorOk} />
              {zh ? '隐藏写明不担保/需身份的岗位' : 'Hide roles that rule out sponsorship or need citizenship or clearance'}
            </label>
            {h1bOn && (
              <label className="job-filters-check">
                <input type="checkbox" name="h1b" value="1" defaultChecked={h1bOnly} />
                {zh ? '担保过 H-1B' : 'Has sponsored H-1B'}
              </label>
            )}
            <div className="resume-actions">
              <button type="submit">{zh ? '筛选' : 'Filter'}</button>
            </div>
          </form>
          {mine ? (
            <>
              <JobSearchSave
                key={String(searchQuery(search))}
                zh={zh}
                search={search}
                saved={savedQuery === null ? 'none' : savedQuery === String(searchQuery(search)) ? 'this' : 'other'}
              />
              <BlockedList zh={zh} blocked={mine.blocked} names={Object.fromEntries(mine.blocked.map((slug) => [slug, names.get(slug) ?? slug]))} />
            </>
          ) : (
            <p className="job-search-applied">
              <a href="/?view=account">
                {zh ? '登录后可以保存筛选，有新岗位时站内通知你；也可屏蔽公司' : 'Sign in to save this search and hear about new matches, or to block companies'}
              </a>
            </p>
          )}
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
            <JobList
              items={page}
              names={Object.fromEntries(page.map((o) => [o.companySlug, names.get(o.companySlug)!]))}
              zh={zh}
              withCompany
              signedIn={!!viewer}
              blocked={mine?.blocked}
              h1b={sponsors(page.map((o) => o.companySlug))}
            />
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
