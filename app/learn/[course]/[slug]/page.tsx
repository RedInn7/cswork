import Link from 'next/link';
import { notFound } from 'next/navigation';
import { problemAppHref } from '@/lib/classic-lists';
import { keyPoints } from '@/lib/recall';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { beginnerCourse, learnKey, learnPath } from '@/lib/server/beginner-courses';
import { requestLocale } from '@/lib/server/locale';
import { sdSummary } from '@/lib/server/system-design-course';
import { PublicLibraryMarkdown, markdownToc } from '../../../library/markdown';
import { SdQuiz } from '../../../system-design/quiz';
import { SdMarkRead, SdReadCheck, SdRecall } from '../../../system-design/reader';

type Props = { params: Promise<{ course: string; slug: string }> };

async function load(params: Props['params']) {
  const { course: courseSlug, slug } = await params;
  const course = beginnerCourse(courseSlug);
  const chapter = course?.chapters.find((c) => c.slug === slug);
  if (!course || !chapter) notFound();
  return { course, chapter, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { course, chapter, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? chapter.titleZh : chapter.titleEn} · ${zh ? course.titleZh : course.titleEn} | ${SITE_NAME}`,
    description: sdSummary(zh ? chapter.bodyZh : chapter.bodyEn, 160),
    path: learnPath(course.slug, chapter.slug),
  });
}

/**
 * One lesson: the text, its quiz and practice problems, and "mark as read". The quiz answers and
 * the read mark use the system design course's reader under sd:<course>/<chapter> (learnKey).
 */
export default async function LearnChapter({ params }: Props) {
  const { course, chapter, zh } = await load(params);
  const t = (a: string, b: string) => (zh ? a : b);
  const at = course.chapters.indexOf(chapter);
  const prev = course.chapters[at - 1];
  const next = course.chapters[at + 1];
  const title = (c: typeof chapter) => (zh ? c.titleZh : c.titleEn);
  const courseTitle = zh ? course.titleZh : course.titleEn;
  const body = zh ? chapter.bodyZh : chapter.bodyEn;
  const toc = markdownToc(body);
  // A chapter that ends in "Key points" offers them as a review card.
  const points = keyPoints(body.split(/^## (?:要点|Key points)$/m)[1]);
  const keys = course.chapters.map((c) => learnKey(course.slug, c.slug));
  const tocList = (
    <ol>
      {toc.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`}>{section.text}</a>
        </li>
      ))}
      <li>
        <a href="#sd-quiz-title">{t('小测验', 'Quiz')}</a>
      </li>
      {chapter.homework.length > 0 && (
        <li>
          <a href="#learn-practice-title">{t('课后练习', 'Practice')}</a>
        </li>
      )}
    </ol>
  );
  return (
    <div className="sd-chapter-layout">
      <div className="sd-progress" aria-hidden="true" />
      <article className="public-library-article sd-chapter">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: breadcrumbJsonLd([
              { name: SITE_NAME, path: '/' },
              { name: courseTitle, path: learnPath(course.slug) },
              { name: title(chapter), path: learnPath(course.slug, chapter.slug) },
            ]),
          }}
        />
        <nav className="public-library-breadcrumb" aria-label={t('面包屑', 'Breadcrumb')}>
          <Link href="/learn" prefetch={false}>
            {t('入门速成课', 'Beginner courses')}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={learnPath(course.slug)} prefetch={false}>
            {courseTitle}
          </Link>
        </nav>
        <header className="public-library-article-header sd-chapter-header">
          <p className="sd-sheet-no">
            {t(`第 ${at + 1} 节 / 共 ${course.chapters.length} 节`, `Lesson ${at + 1} of ${course.chapters.length}`)}
          </p>
          <h1>{title(chapter)}</h1>
        </header>
        {toc.length > 1 && (
          <details className="sd-toc-top">
            <summary>{t('本页目录', 'On this page')}</summary>
            {tocList}
          </details>
        )}
        <div className="public-library-prose">
          <PublicLibraryMarkdown body={body} math={false} sectionIds wholePrograms />
        </div>
        <SdQuiz slug={learnKey(course.slug, chapter.slug)} quiz={chapter.quiz} zh={zh} />
        {points.length > 0 && (
          <SdRecall target={`sd:${learnKey(course.slug, chapter.slug)}`} title={title(chapter)} points={points} />
        )}
        {/* SQL lessons have no LeetCode homework: their text links to the SQL track instead. */}
        {chapter.homework.length > 0 && (
          <section className="learn-practice" aria-labelledby="learn-practice-title">
            <h2 id="learn-practice-title">{t('课后练习', 'Practice')}</h2>
            <p>{t('在题库里提交，判题结果会计入你的练习记录。', 'Submit in the problem bank; the verdicts count toward your practice history.')}</p>
            <ol>
              {chapter.homework.map((problem) => (
                <li key={problem.id}>
                  <a href={problemAppHref(problem.id)}>{zh ? problem.zh : problem.en}</a>
                  <span>{problem.id.replace('lc-', 'LeetCode ')}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <SdMarkRead slug={learnKey(course.slug, chapter.slug)} slugs={keys} />
        <nav className="sd-pager" aria-label={t('章节导航', 'Lessons')}>
          {prev ? (
            <a href={learnPath(course.slug, prev.slug)} rel="prev">
              <span>{t('上一节', 'Previous')}</span>
              {title(prev)}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={learnPath(course.slug, next.slug)} rel="next">
              <span>{t('下一节', 'Next')}</span>
              {title(next)}
            </a>
          ) : (
            <a href="/certify">
              <span>{t('学完了', 'Finished')}</span>
              {t('去考一项技能认证', 'Take a skill exam')}
            </a>
          )}
        </nav>
      </article>
      <aside className="sd-aside" aria-label={t('课程导航', 'Course navigation')}>
        {toc.length > 1 && (
          <nav className="sd-toc" aria-labelledby="sd-toc-title">
            <h2 id="sd-toc-title">{t('本页目录', 'On this page')}</h2>
            {tocList}
          </nav>
        )}
        <nav className="sd-outline" aria-labelledby="sd-outline-title">
          <h2 id="sd-outline-title">{courseTitle}</h2>
          <ol>
            {course.chapters.map((c) => (
              <li key={c.slug}>
                <a href={learnPath(course.slug, c.slug)} aria-current={c === chapter ? 'page' : undefined}>
                  {title(c)}
                </a>
                <SdReadCheck slug={learnKey(course.slug, c.slug)} quiet />
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </div>
  );
}
