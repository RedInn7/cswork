import Link from 'next/link';
import { cache } from 'react';
import { oaCompanyName, oaCompanyPath, oaProblemPath } from '@/lib/oa-company-brands';
import { breadcrumbJsonLd, oaPageTitle, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { oaReadyProblems } from '@/lib/server/oa-judge';
import { oaLibrary } from '@/lib/server/oa-library';
import { shownMockPresets } from '@/lib/server/mock-oa-presets';
import { OaCompanyMark, oaExamTag } from './parts';

const load = cache(async () => {
  const locale = await requestLocale();
  const problems = await oaReadyProblems();
  const readySet = new Set(problems.keys());
  const companies = oaLibrary().companies(readySet);
  // Newest judgeable problems: this week's, or the last few when none went online this week.
  const newest = oaLibrary().list(new URLSearchParams('sort=new&ready=1'), readySet, {
    addedAt: new Map([...problems].map(([id, meta]) => [id, meta.firstAt])),
  });
  const fresh = newest.items.slice(0, newest.newThisWeek || 8);
  const total = companies.reduce((sum, c) => sum + c.count, 0);
  const ready = companies.reduce((sum, c) => sum + c.ready, 0);
  const lead =
    locale === 'zh'
      ? `收录 ${companies.length} 家公司的 ${total} 道 OA 真题，其中 ${ready} 道可以在线运行样例、提交评测，支持 Python、Java、C++ 和 Go。`
      : `${total} online assessment questions from ${companies.length} companies. ${ready} of them run and judge online in Python, Java, C++ and Go.`;
  // A company's researched OA format, by its slug or an alias.
  const formats = new Map(
    shownMockPresets().flatMap((p) => [p.slug, ...p.aliases].map((slug) => [slug, p] as const)),
  );
  return { locale, companies, total, ready, lead, fresh, week: newest.newThisWeek, formats };
});

export async function generateMetadata() {
  const { locale, lead } = await load();
  return seoMetadata({ title: oaPageTitle(locale), description: lead, path: '/oa' });
}

export default async function OaIndex() {
  const { locale, companies, total, ready, lead, fresh, week, formats } = await load();
  const zh = locale === 'zh';
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
          ]),
        }}
      />
      <div className="public-library-intro">
        <p className="public-library-eyebrow">
          {zh ? 'OA 真题 · 在线判题' : 'ONLINE ASSESSMENTS · JUDGED ONLINE'}
        </p>
        <h1>{zh ? '按公司刷 OA 真题。' : 'Real OA questions, company by company.'}</h1>
        <p>{lead}</p>
      </div>
      <dl className="oa-public-stats">
        <div>
          <dt>{zh ? '题目' : 'Problems'}</dt>
          <dd>{total.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>{zh ? '可在线判题' : 'Judge-ready'}</dt>
          <dd>{ready.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>{zh ? '公司' : 'Companies'}</dt>
          <dd>{companies.length}</dd>
        </div>
      </dl>
      <p className="oa-public-actions">
        <Link className="oa-public-cta is-quiet" href="/oa/mcq" prefetch={false}>
          {zh ? 'OA 选择题练习（CS 基础 · 读代码 · 数学逻辑）' : 'OA multiple-choice practice (CS · code output · quant)'}
        </Link>
        <Link className="oa-public-cta is-quiet" href="/oa/drills" prefetch={false}>
          {zh ? '调试与代码评审练习（找出埋入的 bug）' : 'Debugging and code-review drills (find the planted bug)'}
        </Link>
      </p>
      {!!fresh.length && (
        <details className="oa-public-fresh">
          <summary>
            <span className="oa-public-fresh-dot" aria-hidden="true" />
            {week
              ? zh
                ? `本周新增 ${week} 道可在线判题的 OA 题`
                : `${week} judge-ready OA ${week === 1 ? 'problem' : 'problems'} added this week`
              : zh
                ? '最近上新'
                : 'Recently added'}
          </summary>
          <ol className="oa-public-list">
            {fresh.map((item) => {
              const day = item.addedAt ? new Date(item.addedAt).toISOString().slice(0, 10) : '';
              return (
                <li key={item.id}>
                  <a href={oaProblemPath(item.companySlug, item.id)}>
                    <span className="oa-public-number">#{item.number}</span>
                    <span className="oa-public-title">
                      {oaCompanyName(item.companySlug, item.companyName, locale)} · {item.title}
                    </span>
                    {day && (
                      <time className="oa-public-chip" dateTime={day}>
                        {zh ? `${day.slice(5)} 上线` : `Added ${day}`}
                      </time>
                    )}
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="oa-public-fresh-more">
            <a href="/?view=problems&library=oa&sort=new">
              {zh ? '在练习工作台按上线时间查看全部' : 'See all, newest first, in the workspace'}{' '}
              <span aria-hidden="true">→</span>
            </a>
          </p>
        </details>
      )}
      <h2 className="oa-public-section">{zh ? '选择公司' : 'Choose a company'}</h2>
      <ul className="oa-public-companies">
        {companies.map((company, index) => {
          const name = oaCompanyName(company.slug, company.name, locale);
          const format = formats.get(company.slug);
          return (
            <li key={company.slug} style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
              <a href={oaCompanyPath(company.slug)}>
                <OaCompanyMark slug={company.slug} name={name} />
                <span className="oa-public-company-name">{name}</span>
                <span className="oa-public-company-count">
                  {zh
                    ? `${company.count} 题 · ${company.ready} 可判`
                    : `${company.count} ${company.count === 1 ? 'problem' : 'problems'} · ${company.ready} ready`}
                </span>
                {format && <span className="oa-public-format">{oaExamTag(format, zh)}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
