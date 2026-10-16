import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import {
  SD_ESTIMATION,
  chapterMinutes,
  minutesLabel,
  sdChapters,
  sdParts,
  sdPath,
  sdRequired,
  sdSummary,
  totalMinutes,
} from '@/lib/server/system-design-course';
import { SdContinue, SdReadCheck, SdReadCount } from './reader';

const COPY = {
  zh: {
    title: `系统设计面试课：答题框架、经典案例与章节测验 | ${SITE_NAME}`,
    description:
      '一门免费的系统设计面试课：先学 45 分钟的五步答题框架，再用经典案例逐步练习需求澄清、容量估算、API、高层设计、深挖与权衡；另有面向对象设计、并发、ML 系统设计，以及 Kafka、Redis 等关键技术、通用设计模式、LLD 案例库和 API 设计的选读章节，每章附选择题测验。',
    eyebrow: '系统设计 · 课程',
    heading: '把模糊的题目，画成能落地的系统。',
    crumb: '系统设计',
    quiz: (n: number) => `${n} 道测验题`,
    chapter: (n: number) => `第 ${n} 章`,
    total: (required: string, optional: string) => `必修章节${required}，选读章节${optional}。`,
    drill: '容量估算练习：10 个场景，算 QPS、存储、带宽和机器数',
  },
  en: {
    title: `System Design Interview Course: Framework, Case Studies & Quizzes | ${SITE_NAME}`,
    description:
      'A free system design interview course: learn a five-step framework for the 45 minutes, then practise requirements, estimates, APIs, high-level design, deep dives and trade-offs on classic case studies, plus object-oriented design, concurrency, ML system design, and optional chapters on key technologies such as Kafka and Redis, common design patterns, a library of LLD cases and API design, with a quiz after every chapter.',
    eyebrow: 'SYSTEM DESIGN · COURSE',
    heading: 'Turn a vague prompt into a system that works.',
    crumb: 'System design',
    quiz: (n: number) => `${n} quiz question${n === 1 ? '' : 's'}`,
    chapter: (n: number) => `Chapter ${n}`,
    total: (required: string, optional: string) =>
      `Reading time: ${required} for the required chapters, ${optional} for the optional ones.`,
    drill: 'Capacity estimation drill: 10 scenarios for QPS, storage, bandwidth and servers',
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
  const minutes = (chapters: typeof sdChapters) => minutesLabel(totalMinutes(chapters, zh), zh);
  const required = sdChapters.filter((chapter) => sdRequired.includes(chapter.slug));
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
        <p className="sd-total">
          {c.total(minutes(required), minutes(sdChapters.filter((chapter) => !required.includes(chapter))))}{' '}
          <a href={sdPath(SD_ESTIMATION)}>{c.drill}</a>
        </p>
        <SdReadCount slugs={sdRequired} />
        <SdContinue chapters={required.map((chapter) => ({ slug: chapter.slug, title: title(chapter), href: sdPath(chapter.slug) }))} />
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
                    <span>
                      {minutesLabel(chapterMinutes(chapter, zh), zh)}
                      {chapter.quiz.length > 0 && ` · ${c.quiz(chapter.quiz.length)}`}
                    </span>
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
