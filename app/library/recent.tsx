import Link from 'next/link';
import { oaProblemPath } from '@/lib/oa-company-brands';
import { seoMetadata, SITE_NAME } from '@/lib/seo';
import { recentAdditions } from '@/lib/server/company-insights';
import { memberExperiencePath, memberIdOf } from '@/lib/server/experience-submissions';
import { requestLocale } from '@/lib/server/locale';
import { PUBLIC_LIBRARY_TYPES, type PublicLibraryType } from '@/lib/server/public-library';

/** /library?view=recent: what the last 30 days added (lib/server/company-insights.ts). */
const DAYS = 30;
const TYPES_ZH: Record<string, string> = {
  algorithm: '算法教程',
  coding_question: '编程题',
  interview_question: '面试题',
  experience: '面经',
  concept: '概念',
  article: '文章',
  cheatsheet: '速查表',
};
const typeName = (type: string, zh: boolean) =>
  zh ? (TYPES_ZH[type] ?? type) : (PUBLIC_LIBRARY_TYPES[type as PublicLibraryType] ?? type);
const title = (zh: boolean) => (zh ? `最近 ${DAYS} 天新增` : `Added in the last ${DAYS} days`);

export async function recentMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: `${title(zh)} | ${SITE_NAME}`,
      description: zh
        ? '最近新增的面经、面试题、学员投稿和可在线评测的 OA 真题。'
        : 'The latest interview experiences, questions, member posts and judgeable OA problems on CSWork.',
      path: '/library?view=recent',
    }),
    // A rolling list of pages that are indexed on their own.
    robots: { index: false, follow: true },
  };
}

export async function RecentView() {
  const zh = (await requestLocale()) === 'zh';
  const recent = await recentAdditions(undefined, DAYS);
  const libraryTotal = Object.values(recent.libraryCounts).reduce((a, b) => a + b, 0);
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
  return (
    <div lang={zh ? 'zh-CN' : 'en'}>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{zh ? '上新' : 'JUST ADDED'}</p>
        <h1>{title(zh)}</h1>
        <p>
          {zh
            ? `自 ${day(recent.since)} 起：内容库 ${libraryTotal} 篇、学员面经 ${recent.membersTotal} 篇、新上线 OA 真题 ${recent.oaTotal} 道。`
            : `Since ${day(recent.since)}: ${libraryTotal} library pages, ${recent.membersTotal} member experiences and ${recent.oaTotal} new judgeable OA problems.`}
        </p>
      </div>
      <nav className="public-library-filters" aria-label={zh ? '内容库分类' : 'Library topics'}>
        <Link href="/library" prefetch={false}>
          {zh ? '全部内容' : 'All topics'}
        </Link>
        <a href="/library?view=recent" aria-current="page">
          {zh ? '最近新增' : 'Recently added'}
        </a>
        {Object.entries(recent.libraryCounts).map(([type, n]) => (
          <a key={type} href={`/library?type=${type}`}>
            {typeName(type, zh)} <span className="recent-n">{n}</span>
          </a>
        ))}
      </nav>

      {!!recent.oa.length && (
        <section className="recent-section" aria-labelledby="recent-oa">
          <h2 id="recent-oa">{zh ? '新上线的 OA 真题' : 'New judgeable OA problems'}</h2>
          <ol className="public-library-list">
            {recent.oa.map((p) => (
              <li key={p.id}>
                <p className="public-library-label">
                  {p.company} · #{p.number} · {day(p.at)}
                </p>
                <h3>
                  <a href={oaProblemPath(p.companySlug, p.id)}>{p.title}</a>
                </h3>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!recent.members.length && (
        <section className="recent-section" aria-labelledby="recent-members">
          <h2 id="recent-members">{zh ? '审核通过的学员面经' : 'Approved member experiences'}</h2>
          <ol className="public-library-list">
            {recent.members.map((m) => (
              <li key={m.slug}>
                <p className="public-library-label">
                  {m.company.name} · {day(m.publishedAt)}
                </p>
                <h3>
                  <a href={memberExperiencePath(memberIdOf(m.slug)!)}>{m.title}</a>
                </h3>
                {m.summary && <p>{m.summary}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="recent-section" aria-labelledby="recent-library">
        <h2 id="recent-library">{zh ? '内容库新增' : 'New in the library'}</h2>
        {recent.library.length ? (
          <ol className="public-library-list">
            {recent.library.map((item) => (
              <li key={`${item.type}/${item.slug}`}>
                <p className="public-library-label">
                  {typeName(item.type, zh)}
                  {item.company ? ` · ${item.company}` : ''} · {day(item.at)}
                </p>
                <h3>
                  <a href={item.path}>{item.title}</a>
                </h3>
              </li>
            ))}
          </ol>
        ) : (
          <p className="public-library-empty">{zh ? '这段时间没有新增内容。' : 'Nothing new in this period.'}</p>
        )}
      </section>
    </div>
  );
}
