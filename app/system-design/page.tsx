import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { sdChapters, sdParts, sdPath, sdRequired, sdSummary } from '@/lib/server/system-design-course';
import { SdReadCheck, SdReadCount } from './reader';

const COPY = {
  zh: {
    title: `系统设计面试课：答题框架、经典案例与章节测验 | ${SITE_NAME}`,
    description:
      '一门免费的系统设计面试课：先学 45 分钟的七步答题框架，再用经典案例逐步练习需求澄清、容量估算、API、高层设计、深挖与权衡；另有面向对象设计、并发、ML 系统设计，以及 Kafka、Redis 等关键技术和通用设计模式的选读章节，每章附选择题测验。',
    eyebrow: '系统设计 · 课程',
    heading: '把模糊的题目，画成能落地的系统。',
    crumb: '系统设计',
    quiz: (n: number) => `${n} 道测验题`,
    chapter: (n: number) => `第 ${n} 章`,
  },
  en: {
    title: `System Design Interview Course: Framework, Case Studies & Quizzes | ${SITE_NAME}`,
    description:
      'A free system design interview course: learn a seven-step framework for the 45 minutes, then practise requirements, estimates, APIs, high-level design, deep dives and trade-offs on classic case studies, plus object-oriented design, concurrency, ML system design, and optional chapters on key technologies such as Kafka and Redis and on common design patterns, with a quiz after every chapter.',
    eyebrow: 'SYSTEM DESIGN · COURSE',
    heading: 'Turn a vague prompt into a system that works.',
    crumb: 'System design',
    quiz: (n: number) => `${n} quiz question${n === 1 ? '' : 's'}`,
    chapter: (n: number) => `Chapter ${n}`,
  },
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: sdPath() });
}

export default async function SystemDesignIndex() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  const title = (chapter: (typeof sdChapters)[number]) => (zh ? chapter.titleZh : chapter.titleEn);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: sdPath() },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd(
            c.heading,
            sdChapters.map((chapter) => ({ name: title(chapter), path: sdPath(chapter.slug) })),
          ),
        }}
      />
      <div className="public-library-intro sd-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
        <SdReadCount slugs={sdRequired} />
      </div>
      {sdParts.map((part) => (
        <section key={part.from} className="sd-part" aria-labelledby={`sd-part-${part.from}`}>
          <h2 id={`sd-part-${part.from}`}>{zh ? part.zh : part.en}</h2>
          <ol className="sd-sheets">
            {part.chapters.map((chapter, i) => (
              <li key={chapter.slug} style={{ '--i': i } as React.CSSProperties}>
                <a href={sdPath(chapter.slug)}>
                  <span className="sd-sheet-no">{c.chapter(sdChapters.indexOf(chapter) + 1)}</span>
                  <span className="sd-sheet-title">{title(chapter)}</span>
                  <span className="sd-sheet-summary">{sdSummary(zh ? chapter.bodyZh : chapter.bodyEn)}</span>
                  <span className="sd-sheet-meta">
                    {chapter.quiz.length > 0 && c.quiz(chapter.quiz.length)}
                    <SdReadCheck slug={chapter.slug} />
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
