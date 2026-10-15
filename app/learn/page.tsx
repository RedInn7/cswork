import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { beginnerCourses, learnPath } from '@/lib/server/beginner-courses';
import { requestLocale } from '@/lib/server/locale';

const COPY = {
  zh: {
    title: `入门速成课：Big-O、数据结构与 Python 面试 | ${SITE_NAME}`,
    description:
      '两门免费的入门速成课：Big-O 与数据结构速成课从复杂度讲到图和回溯，Python 面试速成课讲清刷题最常用的内置工具和常见坑。每节有小测验和 Line 500 练习题，读完全部章节可获得结业证书。',
    eyebrow: '入门 · 速成课',
    heading: '从零开始，把刷题的地基打牢。',
    crumb: '入门速成课',
    chapters: (n: number) => `${n} 节`,
  },
  en: {
    title: `Beginner Crash Courses: Big-O, Data Structures and Python for Interviews | ${SITE_NAME}`,
    description:
      'Two free crash courses: Big-O and data structures, from complexity to graphs and backtracking, and Python for coding interviews, covering the built-in tools and traps that matter most. Each lesson has a quiz and Line 500 practice, and reading every chapter earns a certificate.',
    eyebrow: 'BEGINNER · CRASH COURSES',
    heading: 'Start from zero and build the foundation for coding interviews.',
    crumb: 'Beginner courses',
    chapters: (n: number) => `${n} lessons`,
  },
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: learnPath() });
}

export default async function LearnIndex() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: learnPath() },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd(
            c.heading,
            beginnerCourses.map((course) => ({ name: zh ? course.titleZh : course.titleEn, path: learnPath(course.slug) })),
          ),
        }}
      />
      <div className="public-library-intro sd-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
      </div>
      <ul className="sd-sheets learn-courses">
        {beginnerCourses.map((course, i) => (
          <li key={course.slug} style={{ '--i': i } as React.CSSProperties}>
            <a href={learnPath(course.slug)}>
              <span className="sd-sheet-no">{c.chapters(course.chapters.length)}</span>
              <span className="sd-sheet-title">{zh ? course.titleZh : course.titleEn}</span>
              <span className="sd-sheet-summary">{zh ? course.summaryZh : course.summaryEn}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
