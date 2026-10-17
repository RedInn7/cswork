import type { Metadata } from 'next';
import { hiringCycle } from '@/lib/job-tags';
import { companyHubPath } from '@/lib/oa-company-brands';
import { seoMetadata } from '@/lib/seo';
import { jobSeasons, seasonsSince, type JobSeason } from '@/lib/server/job-seasons';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { seasonDay } from '../../../company/jobs';
import '../../../company/jobs.css';

const copy = {
  en: {
    title: 'Campus Hiring Calendar: When Tech Companies Open Intern and New-Grad Roles · CSWork',
    description:
      'When each company’s intern and new-grad roles first showed up on its public job board this season, week by week, and which ones opened around now last year.',
    kicker: 'CAMPUS HIRING CALENDAR',
    h1: 'When each company opens its intern and new-grad roles.',
    lead: 'Companies by the week we first saw this season’s roles on their job boards, newest first. A season is the year the job starts: roles that open from July on usually start the next year.',
    empty: 'Nothing recorded yet: the calendar fills in as the daily sync sees new roles.',
  },
  zh: {
    title: '招聘日历：科技公司什么时候开放实习和新毕业生岗位 · CSWork',
    description: '本季各公司的实习和新毕业生岗位在公开招聘页上第一次出现的时间，按周排列；以及去年这个时候开放、今年可能快开了的公司。',
    kicker: '招聘日历',
    h1: '各公司的实习和新毕业生岗位什么时候开放。',
    lead: '按我们同步招聘页时第一次看到本季岗位的那一周排列，新的在前。一季按入职年份算：7 月以后开放的岗位一般是第二年入职。',
    empty: '还没有记录：每天同步看到新岗位后，这里会慢慢填满。',
  },
};
const KINDS = [
  ['intern', '实习', 'Intern'],
  ['new-grad', '新毕业生', 'New grad'],
] as const;
const DAY = 86400000;
const SOON = 21 * DAY;
/** Monday 00:00 UTC of the week `at` falls in. */
const weekOf = (at: number) => {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
};
/** The same month and day a year later. */
const yearOn = (at: number) => {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
};

/** Seasons of companies with a company page (hidden ones are not), this cycle and the one before. */
function calendar(now: number) {
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  const cycle = hiringCycle(now);
  const rows = jobSeasons(cycle - 1).filter((s) => names.has(s.companySlug));
  const current = rows.filter((s) => s.cycle === cycle);
  const has = new Set(current.map((s) => `${s.companySlug}:${s.kind}`));
  // Last season's real opening date (not a first sync) a year on, within the next three weeks, and nothing yet this season.
  const soon = rows.filter((s) => s.cycle === cycle - 1 && !s.firstSync && !has.has(`${s.companySlug}:${s.kind}`) && yearOn(s.firstSeenAt) >= now - DAY && yearOn(s.firstSeenAt) <= now + SOON);
  const dated = current.filter((s) => !s.firstSync);
  const weeks = [...Map.groupBy(dated, (s) => weekOf(s.firstSeenAt))].sort((a, b) => b[0] - a[0]);
  return { names, cycle, soon, weeks, firstSync: current.filter((s) => s.firstSync), any: rows.length > 0 };
}

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/jobs/calendar' }),
    // An empty calendar is no landing page.
    ...(calendar(Date.now()).any ? {} : { robots: { index: false, follow: true } }),
  };
}

/** Companies in two columns, intern and new grad, each with the day it opened (or would, `soon`). */
function Columns({ seasons, names, zh, soon = false }: { seasons: JobSeason[]; names: ReadonlyMap<string, string>; zh: boolean; soon?: boolean }) {
  return (
    <div className="job-calendar-cols">
      {KINDS.map(([kind, zhName, enName]) => {
        const list = seasons.filter((s) => s.kind === kind).sort((a, b) => names.get(a.companySlug)!.localeCompare(names.get(b.companySlug)!));
        return (
          <section key={kind} aria-label={zh ? zhName : enName}>
            <h3>{zh ? zhName : enName}</h3>
            {list.length ? (
              <ul>
                {list.map((s) => (
                  <li key={s.companySlug}>
                    <a href={`${companyHubPath(s.companySlug)}#jobs`}>{names.get(s.companySlug)}</a>{' '}
                    <span>
                      {soon
                        ? zh
                          ? `去年 ${seasonDay(s.firstSeenAt, zh)}`
                          : `last year ${seasonDay(s.firstSeenAt, zh)}`
                        : s.firstSync
                          ? zh
                            ? `峰值 ${s.peak} 个`
                            : `up to ${s.peak}`
                          : seasonDay(s.firstSeenAt, zh)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{zh ? '无' : 'None'}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** /career/jobs/calendar: when each company's roles first showed up this season (lib/server/job-seasons.ts). */
export default async function JobCalendarPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const now = Date.now();
  const { names, cycle, soon, weeks, firstSync, any } = calendar(now);
  const since = seasonsSince();
  // This week's openings go first, above "opening soon".
  const top = weeks[0]?.[0] === weekOf(now) ? 1 : 0;
  const day = (at: number) => new Date(at).toISOString().slice(0, 10);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <a href="/career/jobs">{zh ? '实习和新毕业生岗位' : 'Intern & new-grad roles'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '招聘日历' : 'Hiring calendar'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      {any && since !== null ? (
        <div className="job-calendar">
          <p className="job-openings-note">
            {zh
              ? `本季指 ${cycle} 年入职。记录从 ${day(since)} 开始积累，在那之前已经开放的岗位记为「首次同步时已在招」，不是真实的开放日期。往年的数据要等记满一季才有，这里不估算。`
              : `This season means a ${cycle} start. Records begin on ${day(since)}; roles already up then are listed as “up at our first sync”, which is no opening date. Past seasons appear once a full season is recorded; nothing here is estimated.`}
          </p>
          {weeks.length === 0 && (
            <p className="job-openings-note">{zh ? '本季还没有在首次同步之后新出现的岗位。' : 'No roles have appeared this season since our first sync.'}</p>
          )}
          {weeks.slice(0, top).map(([week, seasons]) => (
            <section key={week} className="job-calendar-section" aria-labelledby="this-week">
              <h2 id="this-week">{zh ? '本周新开放' : 'New this week'}</h2>
              <Columns seasons={seasons} names={names} zh={zh} />
            </section>
          ))}
          {soon.length > 0 && (
            <section className="job-calendar-section" aria-labelledby="soon">
              <h2 id="soon">{zh ? '快开了：去年这时候开放、今年还没出现' : 'Opening soon: up around now last year, not yet this year'}</h2>
              <Columns seasons={soon} names={names} zh={zh} soon />
            </section>
          )}
          {weeks.slice(top).map(([week, seasons]) => (
            <section key={week} className="job-calendar-section" aria-labelledby={`week-${week}`}>
              <h2 id={`week-${week}`}>{zh ? `${seasonDay(week, zh)}那一周` : `Week of ${seasonDay(week, zh)}`}</h2>
              <Columns seasons={seasons} names={names} zh={zh} />
            </section>
          ))}
          {firstSync.length > 0 && (
            <section className="job-calendar-section" aria-labelledby="first-sync">
              <h2 id="first-sync">{zh ? '首次同步时已在招（实际开放可能更早）' : 'Already up at our first sync (they may have opened earlier)'}</h2>
              <Columns seasons={firstSync} names={names} zh={zh} />
            </section>
          )}
        </div>
      ) : (
        <div className="resume-off">
          <p>{c.empty}</p>
        </div>
      )}
    </>
  );
}
