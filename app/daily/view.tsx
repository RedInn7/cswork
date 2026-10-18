import type { DailyProblem } from '@/lib/daily-problem';
import { oaProblemPath } from '@/lib/oa-company-brands';
import { ROUTE_SECTIONS, stopHref, topicName } from '@/lib/route-stops';
import { PublicLibraryMarkdown } from '../library/markdown';
import { OaCompanyMark } from '../oa/parts';
import { LevelPicks } from '@/components/level-picks';
import { DailyMonth } from '@/components/daily-month';

const LEVELS: Record<string, [level: string, zh: string, en: string]> = {
  简单: ['easy', '简单', 'Easy'],
  中等: ['medium', '中等', 'Medium'],
  困难: ['hard', '困难', 'Hard'],
  easy: ['easy', '简单', 'Easy'],
  medium: ['medium', '中等', 'Medium'],
  hard: ['hard', '困难', 'Hard'],
};
const STOP_ORDER = ROUTE_SECTIONS.flatMap((section) => section.slugs);

/** /daily: today's problem for everyone. OA statements are public; LeetCode shows title and stop. */
export function DailyView({
  daily,
  zh,
  statement = '',
  statementLang,
}: {
  daily: DailyProblem | null;
  zh: boolean;
  /** The OA statement as Markdown; empty for LeetCode. */
  statement?: string;
  statementLang?: string;
}) {
  const level = daily ? LEVELS[daily.difficulty.toLowerCase()] : undefined;
  const title = daily ? (zh ? daily.title : daily.titleEn || daily.title) : '';
  const stop = daily?.stop;
  const practice = stop ? stopHref(stop) : null;
  return (
    <div className="public-library oa-public daily-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <a className="public-library-brand" href="/">
          cswork<span> / {zh ? '每日一题' : 'daily'}</span>
        </a>
        <a href="/?view=problems">
          {zh ? '打开 500 路题单' : 'Open the Line 500 list'} <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main className="public-library-main" id="main-content">
        <article className="public-library-article oa-public-problem">
          <p className="daily-date">
            {zh ? '今日一题' : 'Daily problem'} · <time dateTime={daily?.date}>{daily?.date}</time>
            {zh ? '（北京时间）' : ' (Beijing time)'}
          </p>
          {daily ? (
            <>
              <header className="oa-public-ticket">
                <p className="oa-public-ticket-line">
                  {daily.company ? (
                    <>
                      <OaCompanyMark slug={daily.company.slug} name={daily.company.name} />
                      <span>{daily.company.name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="oa-public-number">OA</span>
                    </>
                  ) : (
                    <>
                      <span className="oa-public-number">
                        {zh ? '500 路' : 'LINE 500'}
                        {stop && STOP_ORDER.includes(stop)
                          ? ` · ${String(STOP_ORDER.indexOf(stop) + 1).padStart(2, '0')}`
                          : ''}
                      </span>
                      {stop && <span>{topicName(stop, zh)}</span>}
                    </>
                  )}
                </p>
                <h1>{title}</h1>
                {level && (
                  <p className="oa-public-ticket-status">
                    <span className="oa-public-chip" data-level={level[0]}>
                      {zh ? level[1] : level[2]}
                    </span>
                  </p>
                )}
                <div className="oa-public-actions">
                  <a
                    className="oa-public-cta"
                    href={`/?${new URLSearchParams({ view: 'problem', problem: daily.id })}`}
                  >
                    {zh ? '去做题' : 'Solve it'}
                  </a>
                  {daily.company && (
                    <a className="oa-public-cta is-quiet" href={oaProblemPath(daily.company.slug, daily.id)}>
                      {zh ? 'OA 题目页' : 'OA problem page'}
                    </a>
                  )}
                  {stop && (
                    <a className="oa-public-cta is-quiet" href={`/topics/${stop}`}>
                      {zh ? '本站代码模板' : 'This stop’s templates'}
                    </a>
                  )}
                  {practice && (
                    <a className="oa-public-cta is-quiet" href={practice}>
                      {zh ? '练这一站' : 'Practise this stop'}
                    </a>
                  )}
                </div>
              </header>
              {statement.trim() ? (
                <div className="public-library-prose" lang={statementLang}>
                  <PublicLibraryMarkdown body={statement} math={false} />
                </div>
              ) : (
                daily.kind === 'lc' && (
                  <p className="public-library-empty">
                    {zh
                      ? 'LeetCode 题面登录后在练习工作台查看，可直接提交判题。'
                      : 'Sign in to read the LeetCode statement in the workspace and submit there.'}
                  </p>
                )
              )}
            </>
          ) : (
            <p className="public-library-empty">
              {zh ? '今天的题还没准备好，稍后再来。' : 'Today’s problem isn’t ready yet. Check back soon.'}
            </p>
          )}
          <p className="daily-rule">
            {zh
              ? '每天北京时间 0 点换题，所有人同一道：单号日练 500 路，双号日练热门公司的 OA。当天做完，刷题日历上那一格会变成星星，每日一题的连续天数单独记。'
              : 'A new problem at midnight Beijing time, the same for everyone: odd dates ride Line 500, even dates bring a hot company’s OA. Solve it that day and your practice calendar shows a star; daily-problem streaks are counted on their own.'}
          </p>
        </article>
        {/* Signed in only: these panels ask the API and stay empty for guests. */}
        <LevelPicks english={!zh} />
        <DailyMonth english={!zh} />
      </main>
      <footer className="public-library-footer">
        <a href="/topics">
          {zh ? '代码模板速查' : 'Code templates'}
        </a>
        <a href="/guide/practice">
          {zh ? '怎么练习' : 'How to practise'}
        </a>
        <a href="/oa">
          {zh ? '公司 OA' : 'Company OAs'}
        </a>
        <a href="/library">
          {zh ? '面试资料库' : 'Library'}
        </a>
        {/* The page's <link rel="alternate"> feed (app/daily/page.tsx), in its language. */}
        <a href={zh ? '/feeds/daily.xml?lang=zh' : '/feeds/daily.xml'} type="application/atom+xml">
          {zh ? 'RSS 订阅' : 'RSS feed'}
        </a>
        <a href="/privacy">
          {zh ? '隐私' : 'Privacy'}
        </a>
      </footer>
    </div>
  );
}
