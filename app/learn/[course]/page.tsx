import { notFound } from 'next/navigation';
import { CourseRating } from '@/components/course-rating';
import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { beginnerCourse, learnKey, learnPath } from '@/lib/server/beginner-courses';
import { requestLocale } from '@/lib/server/locale';
import { chapterMinutes, minutesLabel, sdSummary, totalMinutes } from '@/lib/server/system-design-course';
import { SdContinue, SdReadCheck, SdReadCount } from '../../system-design/reader';

type Props = { params: Promise<{ course: string }> };

async function load(params: Props['params']) {
  const course = beginnerCourse((await params).course);
  if (!course) notFound();
  return { course, zh: (await requestLocale()) === 'zh' };
}

export async function generateMetadata({ params }: Props) {
  const { course, zh } = await load(params);
  return seoMetadata({
    title: `${zh ? course.titleZh : course.titleEn} | ${SITE_NAME}`,
    description: zh ? course.summaryZh : course.summaryEn,
    path: learnPath(course.slug),
  });
}

/** A crash course's index: its chapters with read ticks, the reading count and the course rating. */
export default async function LearnCourse({ params }: Props) {
  const { course, zh } = await load(params);
  const title = zh ? course.titleZh : course.titleEn;
  const chapterTitle = (chapter: (typeof course.chapters)[number]) => (zh ? chapter.titleZh : chapter.titleEn);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: zh ? '入门速成课' : 'Beginner courses', path: learnPath() },
            { name: title, path: learnPath(course.slug) },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd(
            title,
            course.chapters.map((chapter) => ({ name: chapterTitle(chapter), path: learnPath(course.slug, chapter.slug) })),
          ),
        }}
      />
      <div className="public-library-intro sd-intro">
        <p className="public-library-eyebrow">{zh ? '入门 · 速成课' : 'BEGINNER · CRASH COURSE'}</p>
        <h1>{title}</h1>
        <p>{zh ? course.summaryZh : course.summaryEn}</p>
        <p className="sd-total">
          {zh ? '全部读完' : 'Reading time: '}
          {minutesLabel(totalMinutes(course.chapters, zh), zh)}
        </p>
        <SdReadCount slugs={course.chapters.map((chapter) => learnKey(course.slug, chapter.slug))} />
        <SdContinue
          chapters={course.chapters.map((chapter) => ({
            slug: learnKey(course.slug, chapter.slug),
            title: chapterTitle(chapter),
            href: learnPath(course.slug, chapter.slug),
          }))}
        />
        <CourseRating courseId={`sd:${course.slug}`} zh={zh} />
      </div>
      <ol className="sd-sheets">
        {course.chapters.map((chapter, i) => (
          <li key={chapter.slug} style={{ '--i': i } as React.CSSProperties}>
            <a href={learnPath(course.slug, chapter.slug)}>
              <span className="sd-sheet-no">{zh ? `第 ${i + 1} 节` : `Lesson ${i + 1}`}</span>
              <span className="sd-sheet-title">{chapterTitle(chapter)}</span>
              <span className="sd-sheet-summary">{sdSummary(zh ? chapter.bodyZh : chapter.bodyEn)}</span>
              <span className="sd-sheet-meta">
                <span>
                  {minutesLabel(chapterMinutes(chapter, zh), zh)} ·{' '}
                  {zh ? `${chapter.quiz.length} 道测验 · ${chapter.homework.length} 道练习` : `${chapter.quiz.length}-question quiz · ${chapter.homework.length} problems`}
                </span>
                <SdReadCheck slug={learnKey(course.slug, chapter.slug)} />
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
