import { companyHubPath } from '@/lib/oa-company-brands';
import { freshOpenings, type Opening } from '@/lib/server/job-openings';

// Styles: app/company/jobs.css, imported by the pages that show these.
const SHOWN = 12;
const KIND: Record<Opening['kind'], [string, string]> = { intern: ['实习', 'Intern'], 'new-grad': ['新毕业生', 'New grad'] };

/** The tracker's add form filled in with this opening; saved only once the learner confirms (components/application-tracker.tsx). */
export const trackerAddPath = (company: string, o: Opening) =>
  `/career/tracker?${new URLSearchParams({ add: '1', company, role: o.title, link: o.url })}`;

/** Openings as rows: the posting on the company's board, kind, place, date and an add-to-tracker link. */
export function OpeningList({ items, names, zh, withCompany = false }: { items: Opening[]; names: ReadonlyMap<string, string>; zh: boolean; withCompany?: boolean }) {
  return (
    <ul className="job-openings">
      {items.map((o) => {
        const company = names.get(o.companySlug) ?? o.companySlug;
        const day = o.postedAt === null ? null : new Date(o.postedAt).toISOString().slice(0, 10);
        return (
          <li key={o.id}>
            <a className="job-openings-title" href={o.url} rel="noopener noreferrer nofollow">
              {o.title}
            </a>
            <p className="job-openings-facts">
              {withCompany && <a href={`${companyHubPath(o.companySlug)}#jobs`}>{company}</a>}
              <span className="job-openings-kind" data-kind={o.kind}>
                {KIND[o.kind][zh ? 0 : 1]}
              </span>
              {o.location && <span>{o.location}</span>}
              {day && <time dateTime={day}>{zh ? `发布于 ${day}` : `Posted ${day}`}</time>}
            </p>
            <a className="job-openings-add" href={trackerAddPath(company, o)}>
              {zh ? '加入投递追踪' : 'Add to tracker'}
              <span className="sr-only">
                {zh ? '：' : ': '}
                {o.title}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Where the list comes from, and that the posting itself is what counts. */
export function OpeningsSource({ zh }: { zh: boolean }) {
  return (
    <p className="job-openings-note">
      {zh
        ? '来自公司在 Greenhouse、Lever、Ashby 上的公开招聘页，每天同步一次，只列标题里写明实习、新毕业生或入门级的岗位。投递前请以公司页面上的岗位要求为准。'
        : 'From the companies’ public job boards on Greenhouse, Lever and Ashby, synced daily; only roles whose titles say intern, new grad or entry level are listed. Check the posting on the company’s page before you apply.'}
    </p>
  );
}

/** The company page's open intern and new-grad roles; nothing when there are none. */
export function JobOpenings({ slug, name, zh, now = Date.now() }: { slug: string; name: string; zh: boolean; now?: number }) {
  const items = freshOpenings(now, slug);
  if (!items.length) return null;
  return (
    <section className="company-hub-section" aria-labelledby="jobs">
      <div className="company-hub-section-head">
        <h2 id="jobs">
          {zh ? '在招的实习和新毕业生岗位' : 'Open intern and new-grad roles'} <small>{zh ? `${items.length} 个` : items.length}</small>
        </h2>
        <a href={items.length > SHOWN ? `/career/jobs?${new URLSearchParams({ company: slug })}` : '/career/jobs'}>
          {items.length > SHOWN ? (zh ? `查看全部 ${items.length} 个` : `View all ${items.length}`) : zh ? '各公司岗位' : 'All companies'}{' '}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <OpeningList items={items.slice(0, SHOWN)} names={new Map([[slug, name]])} zh={zh} />
      <OpeningsSource zh={zh} />
    </section>
  );
}
