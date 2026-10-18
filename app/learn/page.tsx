import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { beginnerCourses, learnPath } from '@/lib/server/beginner-courses';
import { requestLocale } from '@/lib/server/locale';
import { minutesLabel, totalMinutes } from '@/lib/server/system-design-course';

const COPY = {
  zh: {
    title: `入门速成课：Big-O、Python、C++、Java、Go、SQL、操作系统与计算机网络 | ${SITE_NAME}`,
    description:
      '八门免费的入门速成课：Big-O 与数据结构从复杂度讲到图和回溯；Python、C++ STL、Java 集合、Go 标准库四门语言课讲清刷题最常用的工具和常见坑，C++、Java、Go 三门末尾附速查表；SQL 面试课从 NULL 讲到窗口函数和常见题型；操作系统、计算机网络两门图解课配模拟器和要点卡，覆盖后端面试和校招常考的基础知识。每节有小测验，读完全部章节可获得结业证书。',
    eyebrow: '入门 · 速成课',
    heading: '从零开始，把刷题的地基打牢。',
    crumb: '入门速成课',
    chapters: (n: number) => `${n} 节`,
  },
  en: {
    title: `Beginner Crash Courses: Big-O, Python, C++, Java, Go, SQL, Operating Systems and Networking | ${SITE_NAME}`,
    description:
      'Eight free crash courses: Big-O and data structures, from complexity to graphs and backtracking; Python, the C++ STL, Java collections and the Go standard library for coding interviews, each covering the tools and traps that matter most, the C++, Java and Go courses ending with a cheat sheet; SQL for interviews, from NULL to window functions and the classic question types; and illustrated courses on operating systems and computer networking, with simulators and key-point review cards for the fundamentals backend interviews ask about. Each lesson has a quiz, and reading every chapter earns a certificate.',
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
              <span className="sd-sheet-no">
                {c.chapters(course.chapters.length)} ·{' '}
                {minutesLabel(totalMinutes(course.chapters, zh), zh)}
              </span>
              <span className="sd-sheet-title">{zh ? course.titleZh : course.titleEn}</span>
              <span className="sd-sheet-summary">{zh ? course.summaryZh : course.summaryEn}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
