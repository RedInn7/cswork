import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { NewsletterToggle } from '@/components/newsletter-toggle';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { readIssue, weekStart } from '@/lib/server/newsletter';
import { weekRange } from '../parts';

type Props = { params: Promise<{ week: string }> };
const load = cache(async (week: string) => {
  const issue = weekStart(week) !== null ? await readIssue(week) : null;
  if (!issue) notFound();
  return { issue, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props) {
  const { issue, zh } = await load((await params).week);
  const range = weekRange(issue.startsAt, zh);
  return seoMetadata({
    title: zh ? `CSWork 周报 ${issue.id}（${range}）` : `The CSWork weekly ${issue.id} (${range})`,
    description: zh
      ? `${range}：${issue.problems.length} 道新 OA 题、${issue.experiences.length} 篇学员面经、${issue.discussions.length} 个热门讨论和每日一题战报。`
      : `${range}: ${issue.problems.length} new OA problems, ${issue.experiences.length} member interview reports, ${issue.discussions.length} top discussions and the daily problem results.`,
    path: `/newsletter/${issue.id}`,
  });
}

export default async function IssuePage({ params }: Props) {
  const { issue, zh } = await load((await params).week);
  const t = (a: string, b: string) => (zh ? a : b);
  const most = Math.max(1, ...issue.daily.map((d) => d.solvers));
  const empty = <p className="newsletter-empty">{t('本周没有。', 'Nothing this week.')}</p>;
  return (
    <article className="newsletter-issue">
      <nav className="lists-public-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <Link href="/newsletter" prefetch={false}>
          {t('周报', 'Weekly')}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{issue.id}</span>
      </nav>
      <header className="lists-public-hero newsletter-masthead">
        <p className="lists-public-kicker">
          {t('CSWork 周报', 'The CSWork weekly')} · <span className="newsletter-week">{issue.id}</span>
        </p>
        <h1>{weekRange(issue.startsAt, zh)}</h1>
        <dl className="newsletter-tally">
          <div>
            <dt>{t('新题', 'New problems')}</dt>
            <dd>{issue.problems.length}</dd>
          </div>
          <div>
            <dt>{t('面经', 'Reports')}</dt>
            <dd>{issue.experiences.length}</dd>
          </div>
          <div>
            <dt>{t('讨论', 'Discussions')}</dt>
            <dd>{issue.discussions.length}</dd>
          </div>
          <div>
            <dt>{t('每日一题通过', 'Daily solves')}</dt>
            <dd>{issue.daily.reduce((sum, d) => sum + d.solvers, 0)}</dd>
          </div>
        </dl>
      </header>
      <div className="newsletter-columns">
        <section aria-labelledby="nl-problems">
          <h2 id="nl-problems" className="newsletter-h2">
            {t('本周新题', 'New problems')}
          </h2>
          {issue.problems.length ? (
            <ul className="newsletter-list">
              {issue.problems.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} prefetch={false}>
                    {p.title}
                  </Link>
                  <span>{p.companyName}</span>
                </li>
              ))}
            </ul>
          ) : (
            empty
          )}
        </section>
        <section aria-labelledby="nl-reports">
          <h2 id="nl-reports" className="newsletter-h2">
            {t('学员面经', 'Member interview reports')}
          </h2>
          {issue.experiences.length ? (
            <ul className="newsletter-list">
              {issue.experiences.map((e) => (
                <li key={e.href}>
                  <Link href={e.href} prefetch={false}>
                    {e.title}
                  </Link>
                  <span>{e.companyName}</span>
                </li>
              ))}
            </ul>
          ) : (
            empty
          )}
        </section>
        <section aria-labelledby="nl-discuss">
          <h2 id="nl-discuss" className="newsletter-h2">
            {t('热门讨论', 'Top discussions')}
          </h2>
          {issue.discussions.length ? (
            <ol className="newsletter-list">
              {issue.discussions.map((d) => (
                <li key={d.href}>
                  <Link href={d.href} prefetch={false}>
                    {d.title}
                  </Link>
                  <span>
                    {t(`${d.votes} 赞 · ${d.comments} 回复`, `${d.votes} upvote${d.votes === 1 ? '' : 's'} · ${d.comments} repl${d.comments === 1 ? 'y' : 'ies'}`)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            empty
          )}
        </section>
        <section aria-labelledby="nl-daily">
          <h2 id="nl-daily" className="newsletter-h2">
            {t('每日一题战报', 'Daily problem results')}
          </h2>
          {issue.daily.length ? (
            <table className="newsletter-daily">
              <thead>
                <tr>
                  <th scope="col">{t('日期', 'Date')}</th>
                  <th scope="col">{t('题目', 'Problem')}</th>
                  <th scope="col">{t('通过人数', 'Solved by')}</th>
                </tr>
              </thead>
              <tbody>
                {issue.daily.map((d) => (
                  <tr key={d.date}>
                    <td className="newsletter-week">{d.date.slice(5)}</td>
                    <td>
                      <Link href={d.href} prefetch={false}>
                        {(zh ? d.title : d.titleEn) || d.title}
                      </Link>
                    </td>
                    <td>
                      <span className="newsletter-bar" style={{ '--frac': d.solvers / most } as React.CSSProperties} aria-hidden="true" />
                      {d.solvers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            empty
          )}
        </section>
      </div>
      <section className="newsletter-cta" aria-label={t('订阅', 'Subscribe')}>
        <NewsletterToggle />
      </section>
    </article>
  );
}
