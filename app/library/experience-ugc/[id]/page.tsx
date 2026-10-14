import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { cache } from 'react';
import Link from 'next/link';
import '../../../experience-submissions.css';
import '../../../discuss.css';
import { PublicLibraryMarkdown } from '../../markdown';
import { PostsPreview } from '../../../discuss/parts';
import { ReportExperience } from '@/components/experience-report';
import { EMPLOYMENT, RESULTS, ROUND_LABELS, seasonLabel, SENTIMENTS, SOURCES } from '@/lib/experience';
import { companyHubPath } from '@/lib/oa-company-brands';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { memberExperiencePath, readMember } from '@/lib/server/experience-submissions';
import { requestLocale } from '@/lib/server/locale';

type Props = { params: Promise<{ id: string }> };

/**
 * A member's interview experience (lib/server/experience-submissions.ts). Approved posts are
 * public and canonical here; pending and rejected ones open only for their author and teachers,
 * never indexed. Anyone else gets the same 404 as a missing post.
 */
const load = cache(async (id: string) => {
  let item = readMember(id, null);
  if (!item) {
    // Only a non-public post costs a session lookup.
    const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
    item = viewer ? readMember(id, viewer) : null;
  }
  if (!item) notFound();
  return { item, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { item, zh } = await load(id);
  return {
    ...seoMetadata({
      title: zh ? `${item.title} · ${item.company.name} 面经` : `${item.title} · ${item.company.name} interview experience`,
      description: item.summary || item.title,
      path: memberExperiencePath(id),
    }),
    ...(item.member.public ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function MemberExperiencePage({ params }: Props) {
  const { item, zh } = await load((await params).id);
  const { member } = item;
  const result = item.result ? RESULTS[item.result] : null;
  const rounds = item.rounds.map((r) => (Object.hasOwn(ROUND_LABELS, r) ? ROUND_LABELS[r][zh ? 0 : 1] : r));
  const d = item.details;
  const label = (map: Readonly<Record<string, [string, string]>>, value: string | null) =>
    value && Object.hasOwn(map, value) ? map[value][zh ? 0 : 1] : null;
  // The optional facts the author gave, in reading order.
  const details = [
    label(EMPLOYMENT, d.employment),
    d.season && seasonLabel(d.season, zh),
    label(SOURCES, d.channel),
    d.location,
    d.difficulty && (zh ? `难度 ${d.difficulty}/5` : `Difficulty ${d.difficulty}/5`),
    label(SENTIMENTS, d.sentiment),
    d.durationWeeks !== null && (zh ? `流程 ${d.durationWeeks} 周` : `${d.durationWeeks}-week process`),
  ].filter((x): x is string => !!x);
  return (
    <article className="public-library-article" lang={zh ? 'zh-CN' : 'en'}>
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/library" prefetch={false}>
          {zh ? '资料库' : 'Library'}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/?view=experiences" prefetch={false}>
          {zh ? '面经' : 'Interview experiences'}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={companyHubPath(item.company.slug)} prefetch={false}>
          {item.company.name}
        </Link>
      </nav>
      <header className="public-library-article-header">
        <p className="public-library-eyebrow">
          <span className="xs-badge">{zh ? '学员投稿' : 'Member submission'}</span> {item.company.name} · {item.role}
        </p>
        <h1>{item.title}</h1>
        <p className="public-library-facts">
          {result && <span data-tone={result.tone}>{zh ? result.zh : result.en}</span>}
          {!!rounds.length && <span>{rounds.join(' → ')}</span>}
          {item.interviewDate && (
            <span>{zh ? `面试于 ${item.interviewDate.slice(0, 7)}` : `Interviewed ${item.interviewDate.slice(0, 7)}`}</span>
          )}
          {details.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
          {d.verified && (
            <span className="xs-verified" title={zh ? '作者的邮箱已验证，不代表身份核验' : "The author's email is verified; not an identity check"}>
              {zh ? '已验证邮箱' : 'Verified email'}
            </span>
          )}
        </p>
        <p className="xs-byline">
          {member.handle ? (
            <span>
              {zh ? '作者 ' : 'By '}
              <a href={`/u/${member.handle}`}>@{member.handle}</a>
            </span>
          ) : (
            <span>{zh ? 'CSWork 学员分享，经老师审核' : 'Shared by a CSWork member, reviewed by a teacher'}</span>
          )}
        </p>
        {!member.public && (
          <output className="xs-notice" data-status={member.status}>
            {member.status === 'pending'
              ? zh
                ? '正在审核，只有你和老师能看到这一页。'
                : 'In review: only you and the teachers can see this page.'
              : zh
                ? '这篇面经没有公开。'
                : 'This post is not published.'}
            {member.note && (zh ? ` 审核意见：${member.note}` : ` Review note: ${member.note}`)}
          </output>
        )}
      </header>
      <div className="public-library-prose">
        <PublicLibraryMarkdown body={item.body} math={false} ugc />
      </div>
      {!!item.questions.length && (
        <section className="public-library-next xs-questions" aria-labelledby="xs-questions-h">
          <h2 id="xs-questions-h">{zh ? '被问到的题目' : 'Questions asked'}</h2>
          <ol>
            {item.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}
      {member.public && (
        <PostsPreview
          target={`exp:member.${member.id}`}
          zh={zh}
          title={zh ? '评论' : 'Comments'}
          appHref={`/?${new URLSearchParams({ view: 'content', type: 'experience', slug: `member.${member.id}` })}`}
        />
      )}
      <aside className="public-library-next">
        <h2>{zh ? `准备 ${item.company.name} 的面试` : `Preparing for ${item.company.name}?`}</h2>
        <p>
          {zh
            ? '看看这家公司的 OA 真题、高频题和更多面经，或者分享你自己的经历。'
            : 'See its OA problems, most reported questions and more experiences, or share your own.'}
        </p>
        <div className="xs-byline">
          <Link href={companyHubPath(item.company.slug)} prefetch={false}>
            {zh ? `${item.company.name} 公司主页 →` : `${item.company.name} company page →`}
          </Link>
          <Link href="/?view=progress&tab=share" prefetch={false}>
            {zh ? '投稿我的面经 →' : 'Share your experience →'}
          </Link>
          {member.public && !member.mine && <ReportExperience id={member.id} />}
        </div>
      </aside>
    </article>
  );
}
