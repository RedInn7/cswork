import '../library/library.css';
import '../oa/oa.css';
import './daily.css';
import '../lc-rating.css';
import '../daily-month.css';
import { Suspense } from 'react';
import { oaStatementMarkdown } from '@/lib/oa-verified-statement';
import { seoMetadata } from '@/lib/seo';
import { HttpError } from '@/lib/server/http';
import { dailyProblem } from '@/lib/server/daily-problem';
import { withFeed } from '@/lib/server/feeds';
import { requestLocale } from '@/lib/server/locale';
import { oaEnglishStatement } from '@/lib/server/oa-judge';
import { getPublicOaProblem } from '@/lib/server/oj-problems';
import { LibraryPageView } from '../library/page-view';
import { DailyView } from './view';

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  const metadata = seoMetadata({
    title: zh ? '每日一题 · cswork' : 'Daily problem · cswork',
    description: zh
      ? '每天一道题，所有人同一道：单号日练 500 路算法题，双号日练热门公司的 OA 真题。'
      : 'One problem a day, the same for everyone: Line 500 on odd dates, a hot company’s OA on even dates.',
    path: '/daily',
  });
  return withFeed(metadata, '/feeds/daily.xml', zh);
}

export default async function DailyPage() {
  const locale = await requestLocale();
  const daily = await dailyProblem().catch(() => null);
  // OA statements are public, exactly as on /oa/<company>/<id>; LeetCode stays title and stop only.
  const judged =
    daily?.kind === 'oa'
      ? await getPublicOaProblem(daily.id).catch((error: unknown) => {
          if (error instanceof HttpError) return null;
          throw error;
        })
      : null;
  // Statements are English whatever the site language.
  const english = judged ? oaEnglishStatement(daily!.id) : undefined;
  return (
    <>
      <DailyView
        daily={daily}
        zh={locale === 'zh'}
        statement={judged ? oaStatementMarkdown(english || judged, judged.samples, locale) : ''}
        statementLang={english ? 'en' : 'zh-CN'}
      />
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </>
  );
}
