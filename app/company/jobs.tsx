import { headers } from 'next/headers';
import { JobList } from '@/components/job-list';
import { hiringCycle } from '@/lib/job-tags';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { freshOpenings, type Opening } from '@/lib/server/job-openings';
import { jobSeasons, type JobSeason } from '@/lib/server/job-seasons';

// Styles: app/company/jobs.css, imported by the pages that show these.
const SHOWN = 12;
const KIND: Record<Opening['kind'], [string, string]> = { intern: ['实习', 'intern'], 'new-grad': ['新毕业生', 'new-grad'] };

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "8 月 4 日" / "Aug 4" (UTC, as the sync records it). */
export const seasonDay = (at: number, zh: boolean) => (zh ? `${new Date(at).getUTCMonth() + 1} 月 ${new Date(at).getUTCDate()} 日` : SHORT.format(at));

/** Whether the viewer is signed in, for the "on your tracker" marks. */
export async function signedIn() {
  return !!(await person(new Request(origin(), { headers: await headers() })).catch(() => null));
}

/** Where the list comes from, that pay is only what some boards publish, and that the posting itself is what counts. */
export function OpeningsSource({ zh }: { zh: boolean }) {
  return (
    <p className="job-openings-note">
      {zh
        ? '来自公司在 Greenhouse、Lever、Ashby 上的公开招聘页，每天同步一次，只列标题里写明实习、新毕业生或入门级的岗位。薪资只来自 Lever 和 Ashby 招聘页上公司自己公开的范围，Greenhouse 的列表没有薪资；方向和学期按标题判断。投递前请以公司页面上的岗位要求为准。'
        : 'From the companies’ public job boards on Greenhouse, Lever and Ashby, synced daily; only roles whose titles say intern, new grad or entry level are listed. Pay is the range a company chose to publish on its Lever or Ashby board; Greenhouse lists carry none. Role and term are read from the title. Check the posting on the company’s page before you apply.'}
    </p>
  );
}

/** One line per kind: when this season's roles first showed up and whether they are still open, and last season's start. */
export function seasonLines(seasons: JobSeason[], items: ReturnType<typeof freshOpenings>, now: number, zh: boolean) {
  const cycle = hiringCycle(now);
  return (['intern', 'new-grad'] as const).flatMap((kind) => {
    const current = seasons.find((s) => s.kind === kind && s.cycle === cycle);
    const last = seasons.find((s) => s.kind === kind && s.cycle === cycle - 1);
    if (!current && !last) return [];
    const name = KIND[kind][zh ? 0 : 1];
    // This season's only: last season's posting still up says nothing about this one.
    const open = items.filter((o) => o.kind === kind && hiringCycle(o.firstSeenAt, o.title) === cycle).length;
    const parts: string[] = [];
    if (current) {
      parts.push(
        (zh
          ? `本季${name}岗位（${cycle} 年入职）${seasonDay(current.firstSeenAt, zh)}首次出现`
          : `This season's ${name} roles (${cycle} start) first appeared ${seasonDay(current.firstSeenAt, zh)}`) +
          (current.firstSync ? (zh ? '（首次同步时已在招，实际开放可能更早）' : ' (already up at our first sync; they may have opened earlier)') : ''),
      );
      // Closed only when the board's latest fetch no longer had them: a board that fails to load says nothing.
      if (open) parts.push(zh ? `现在 ${open} 个在招` : `${open} open now`);
      else if (current.boardSeenAt !== null && current.lastSeenAt < current.boardSeenAt)
        parts.push(zh ? `${seasonDay(current.lastSeenAt, zh)}后已全部下线` : `all closed since ${seasonDay(current.lastSeenAt, zh)}`);
    } else parts.push(zh ? `本季${name}岗位（${cycle} 年入职）还没有出现` : `No ${name} roles yet this season (${cycle} start)`);
    if (last)
      parts.push(
        last.firstSync
          ? zh
            ? `上一季：${seasonDay(last.firstSeenAt, zh)}首次同步时已在招`
            : `Last season: already up at our first sync on ${seasonDay(last.firstSeenAt, zh)}`
          : zh
            ? `上一季：${seasonDay(last.firstSeenAt, zh)}首次出现`
            : `Last season: first appeared ${seasonDay(last.firstSeenAt, zh)}`,
      );
    return [{ kind, text: parts.join(' · ') }];
  });
}

/** The company page's open intern and new-grad roles and their seasons; nothing when there are neither. */
export async function JobOpenings({ slug, name, zh, now = Date.now() }: { slug: string; name: string; zh: boolean; now?: number }) {
  const items = freshOpenings(now, slug);
  const seasons = seasonLines(jobSeasons(hiringCycle(now) - 1, slug), items, now, zh);
  if (!items.length && !seasons.length) return null;
  return (
    <section className="company-hub-section" aria-labelledby="jobs">
      <div className="company-hub-section-head">
        <h2 id="jobs">
          {zh ? '在招的实习和新毕业生岗位' : 'Open intern and new-grad roles'} <small>{zh ? `${items.length} 个` : items.length}</small>
        </h2>
        <a href={items.length > SHOWN ? `/career/jobs?${new URLSearchParams({ company: slug, role: 'all' })}` : '/career/jobs'}>
          {items.length > SHOWN ? (zh ? `查看全部 ${items.length} 个` : `View all ${items.length}`) : zh ? '各公司岗位' : 'All companies'}{' '}
          <span aria-hidden="true">→</span>
        </a>
      </div>
      {seasons.length > 0 && (
        <ul className="job-seasons">
          {seasons.map((s) => (
            <li key={s.kind}>{s.text}</li>
          ))}
          <li>
            <a href="/career/jobs/calendar">{zh ? '各公司什么时候开放：招聘日历' : 'When companies open roles: the hiring calendar'}</a>
          </li>
        </ul>
      )}
      {items.length > 0 && (
        <>
          <JobList items={items.slice(0, SHOWN)} names={{ [slug]: name }} zh={zh} signedIn={await signedIn()} />
          <OpeningsSource zh={zh} />
        </>
      )}
    </section>
  );
}
