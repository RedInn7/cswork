import Link from 'next/link';
import { NewsletterToggle } from '@/components/newsletter-toggle';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { issueList } from '@/lib/server/newsletter';
import { weekRange } from './parts';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? 'CSWork 周报 · 往期归档' : 'The CSWork weekly · Archive',
      description: zh
        ? '每周一封：新上线的 OA 题、学员面经、热门讨论和每日一题战报。往期全部公开。'
        : 'One email a week: new OA problems, member interview reports, top discussions and daily problem results. Every issue is public.',
      path: '/newsletter',
    }),
    // Confirmation and unsubscribe landings repeat the archive.
    ...(Object.keys(await searchParams).length ? { robots: { index: false, follow: true } } : {}),
  };
}

const NOTICES = {
  confirmed: ['订阅已确认，下周一见。', 'Subscription confirmed. See you on Monday.'],
  unsubscribed: ['已退订，不会再收到周报。', 'You’re unsubscribed and won’t get more issues.'],
  invalid: ['这个链接无效或已经用过了。', 'That link is invalid or was already used.'],
} as const;

export default async function NewsletterPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  const q = await searchParams;
  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find((key) => q[key] === '1');
  const issues = issueList();
  return (
    <article className="newsletter-index">
      <section className="lists-public-hero newsletter-hero">
        <p className="lists-public-kicker">{t('CSWork 周报', 'The CSWork weekly')}</p>
        <h1>{t('每周一封，只讲本周发生了什么', 'One email a week, about this week')}</h1>
        <p>
          {t(
            '新上线的 OA 真题、学员投稿的面经、讨论区最热的帖子，还有每天一道题有多少人做出来。全部来自站内数据，往期都在下面。',
            'New OA problems, interview reports from members, the busiest discussion threads, and how many people solved each daily problem. All from the site itself; every past issue is below.',
          )}
        </p>
        {notice && (
          <p className="newsletter-notice" role="status">
            {t(...NOTICES[notice])}
          </p>
        )}
        <NewsletterToggle />
      </section>
      <section aria-labelledby="newsletter-archive">
        <h2 id="newsletter-archive" className="newsletter-h2">
          {t('往期', 'Past issues')}
        </h2>
        {issues.length ? (
          <ol className="newsletter-issues">
            {issues.map((issue) => (
              <li key={issue.id}>
                <Link href={`/newsletter/${issue.id}`} prefetch={false}>
                  <span className="newsletter-week">{issue.id}</span>
                  <span>{weekRange(issue.startsAt, zh)}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="newsletter-empty">{t('第一期还在路上。', 'The first issue is on its way.')}</p>
        )}
      </section>
    </article>
  );
}
