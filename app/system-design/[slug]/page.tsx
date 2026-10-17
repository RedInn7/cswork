import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import coreSkills from '@/lib/content/core-skills.json';
import { problemAppHref } from '@/lib/classic-lists';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { SelectionAsk } from '@/components/command-palette';
import { SolutionPosts } from '@/components/solution-posts';
import {
  chapterMinutes,
  minutesLabel,
  sdCases,
  sdChapter,
  sdChapters,
  sdParts,
  sdPath,
  sdRequired,
  sdSummary,
} from '@/lib/server/system-design-course';
import { EstimationDrill } from '@/components/estimation-drill';
import { PublicLibraryMarkdown, markdownToc } from '../../library/markdown';
import { SdQuiz } from '../quiz';
import { SdMarkRead, SdReadCheck, SdReportIssue, SdTryFirst } from '../reader';

type Props = { params: Promise<{ slug: string }> };
type CoreProblem = { id: string; titleZh: string; titleEn: string; sdChapter?: string };
/** LLD chapters with a judged Core Skills problem (scripts/core-skills/build.ts sets sdChapter). */
const judged = new Map((coreSkills.problems as CoreProblem[]).filter((p) => p.sdChapter).map((p) => [p.sdChapter!, p]));

/** The signed-in reader: their "design it first" draft is a private note; they may join the discussion. */
async function viewerId() {
  return (await person(new Request(origin(), { headers: await headers() })).catch(() => null))?.id ?? null;
}

async function load(params: Props['params']) {
  const chapter = sdChapter((await params).slug);
  if (!chapter) notFound();
  return { chapter, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { chapter, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? chapter.titleZh : chapter.titleEn} · ${zh ? '系统设计面试课' : 'System Design Course'} | ${SITE_NAME}`,
    description: sdSummary(zh ? chapter.bodyZh : chapter.bodyEn, 160),
    path: sdPath(chapter.slug),
  });
}

export default async function SystemDesignChapter({ params }: Props) {
  const { chapter, zh } = await load(params);
  const t = (a: string, b: string) => (zh ? a : b);
  const at = sdChapters.indexOf(chapter);
  const prev = sdChapters[at - 1];
  const next = sdChapters[at + 1];
  const title = (c: typeof chapter) => (zh ? c.titleZh : c.titleEn);
  const body = zh ? chapter.bodyZh : chapter.bodyEn;
  const toc = markdownToc(body);
  const userId = await viewerId();
  const practice = judged.get(chapter.slug);
  const tocList = (
    <ol>
      {toc.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`}>{section.text}</a>
        </li>
      ))}
      {chapter.quiz.length > 0 && (
        <li>
          <a href="#sd-quiz-title">{t('章节测验', 'Chapter quiz')}</a>
        </li>
      )}
    </ol>
  );
  // Selected text can be saved to the learner's notes or a card (and asked about when AI is on).
  const prose = (
    <SelectionAsk className="public-library-prose" clip={{ target: `clip:sd/${chapter.slug}`, title: title(chapter), href: sdPath(chapter.slug) }}>
      <PublicLibraryMarkdown body={body} math={false} sectionIds />
    </SelectionAsk>
  );
  return (
    <div className="sd-chapter-layout">
      {/* Reading progress: drawn by CSS from the page's scroll position. */}
      <div className="sd-progress" aria-hidden="true" />
      <article className="public-library-article sd-chapter">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: breadcrumbJsonLd([
              { name: SITE_NAME, path: '/' },
              { name: t('系统设计', 'System design'), path: sdPath() },
              { name: title(chapter), path: sdPath(chapter.slug) },
            ]),
          }}
        />
        <nav className="public-library-breadcrumb" aria-label={t('面包屑', 'Breadcrumb')}>
          <Link href="/" prefetch={false}>
            {SITE_NAME}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={sdPath()} prefetch={false}>
            {t('系统设计', 'System design')}
          </Link>
        </nav>
        <header className="public-library-article-header sd-chapter-header">
          <p className="sd-sheet-no">
            {t(`第 ${at + 1} 章 / 共 ${sdChapters.length} 章`, `Chapter ${at + 1} of ${sdChapters.length}`)} ·{' '}
            {minutesLabel(chapterMinutes(chapter, zh), zh)}
          </p>
          <h1>{title(chapter)}</h1>
        </header>
        {toc.length > 1 && (
          <details className="sd-toc-top">
            <summary>{t('本页目录', 'On this page')}</summary>
            {tocList}
          </details>
        )}
        {sdCases.has(chapter.slug) ? (
          <SdTryFirst slug={chapter.slug} title={title(chapter)} userId={userId}>
            {prose}
          </SdTryFirst>
        ) : (
          prose
        )}
        {practice && (
          <p className="sd-practice">
            <a href={problemAppHref(practice.id)}>
              {t('动手实现（可判题）：', 'Build it yourself (judged): ')}
              {zh ? practice.titleZh : practice.titleEn}{' '}
              <span aria-hidden="true">→</span>
            </a>
          </p>
        )}
        {chapter.quiz.length > 0 && <SdQuiz slug={chapter.slug} quiz={chapter.quiz} zh={zh} />}
        {/* The framework's estimation section, practised (also at /system-design/estimation). */}
        {chapter.slug === 'framework' && <EstimationDrill zh={zh} />}
        <SdMarkRead slug={chapter.slug} slugs={sdRequired} />
        <nav className="sd-pager" aria-label={t('章节导航', 'Chapters')}>
          {prev ? (
            <a href={sdPath(prev.slug)} rel="prev">
              <span>{t('上一章', 'Previous')}</span>
              {title(prev)}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={sdPath(next.slug)} rel="next">
              <span>{t('下一章', 'Next')}</span>
              {title(next)}
            </a>
          ) : (
            <a href={sdPath()}>
              <span>{t('学完了', 'Finished')}</span>
              {t('回到课程目录', 'Back to all chapters')}
            </a>
          )}
        </nav>
        <SdReportIssue refId={`sd:${chapter.slug}`} />
        <section className="ct-community sd-discussion" aria-labelledby="sd-discussion-title">
          <h2 id="sd-discussion-title">{t('章节讨论', 'Chapter discussion')}</h2>
          <SolutionPosts problemId={`sd:${chapter.slug}`} english={!zh} signedIn={!!userId} />
        </section>
      </article>
      <aside className="sd-aside" aria-label={t('课程导航', 'Course navigation')}>
        {toc.length > 1 && (
          <nav className="sd-toc" aria-labelledby="sd-toc-title">
            <h2 id="sd-toc-title">{t('本页目录', 'On this page')}</h2>
            {tocList}
          </nav>
        )}
        <nav className="sd-outline" aria-labelledby="sd-outline-title">
          <h2 id="sd-outline-title">{t('全部章节', 'All chapters')}</h2>
          {sdParts.map((part) => (
            <section key={part.from}>
              <h3>{zh ? part.zh : part.en}</h3>
              <ol>
                {part.chapters.map((c) => (
                  <li key={c.slug}>
                    <a href={sdPath(c.slug)} aria-current={c === chapter ? 'page' : undefined}>
                      {title(c)}
                    </a>
                    <SdReadCheck slug={c.slug} quiet />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </nav>
      </aside>
    </div>
  );
}
