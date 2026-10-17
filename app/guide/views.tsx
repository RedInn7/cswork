// Locale-free views for /guide and /guide/<chapter>; the pages only resolve the locale.
import { SITE_NAME, SITE_URL, breadcrumbJsonLd } from '@/lib/seo';
import { GUIDE_CHAPTERS, SEASON, guidePath, type GuideChapter } from '@/lib/career-guide';
import { GUIDE_BODIES } from '@/lib/content/career-guide';
import { GuideMarkdown } from './markdown';

export const GUIDE_COPY = {
  zh: {
    title: `北美软件工程求职指南：时间线、简历、内推、OA、面试与 offer | ${SITE_NAME}`,
    description:
      '面向学生和应届生的北美软件工程求职指南：招聘时间线、简历 XYZ 写法与模板、内推、在线笔试、电话面、终面与职级、offer 比较与谈薪基础，以及国际学生签证须知。',
    kicker: '求职指南 · 8 章',
    heading: '从投简历到接 offer，一条线走完。',
    lead: '这份指南按招聘季的顺序排列：先看什么时候该做什么，再逐章准备简历、内推、笔试、面试和 offer。内容由 CSWork 编写，月份和规则都是常见情况，具体以各公司和官方为准。',
    season: '一个典型的招聘季',
    seasonNote: '月份为常见情况，各公司不同，近年整体有提前的趋势。',
    chapters: '章节',
    review: '把简历贴进来，看看成果量化、动词和关键词还缺什么。',
    reviewCta: '试试简历 AI 点评',
    visa: '国际学生：按项目结束日和 OPT 日期，排出 OPT、STEM OPT 和 H-1B 的窗口与截止日。',
    visaCta: '身份时间线计算器',
    aiRound: '允许用 AI 的编程面试：在多文件代码库里修 bug、加功能，旁边有 AI 结对，再用隐藏测试检验。',
    aiRoundCta: 'AI 辅助编程轮练习',
    crumb: '求职指南',
  },
  en: {
    title: `Software Engineering Job Search Guide: Timeline, Resume, Referrals, OAs, Interviews & Offers | ${SITE_NAME}`,
    description:
      'A job search guide for students and new graduates in North America: the recruiting calendar, XYZ resume bullets and a template, referrals, online assessments, phone screens, final rounds and levels, offers and negotiation basics, and visa notes for international students.',
    kicker: 'CAREER GUIDE · 8 CHAPTERS',
    heading: 'From the first application to the signed offer.',
    lead: 'The chapters follow the recruiting season: first what to do when, then how to prepare your resume, referrals, assessments, interviews and offer. Written by CSWork; months and rules are typical, and each company and official source has the final word.',
    season: 'A typical recruiting season',
    seasonNote: 'Months are typical and vary by company; in recent years most have moved earlier.',
    chapters: 'Chapters',
    review: 'Paste your resume to see what it lacks in impact, verbs and keywords.',
    reviewCta: 'Try the AI resume review',
    visa: 'International students: lay out your OPT, STEM OPT and H-1B windows and deadlines from your own dates.',
    visaCta: 'Visa timeline calculator',
    aiRound: 'Coding rounds that allow AI: fix and extend a small multi-file codebase with an AI pair, checked by hidden tests.',
    aiRoundCta: 'AI-assisted round practice',
    crumb: 'Career guide',
  },
};

const ldJson = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
const no = (i: number) => String(i + 1).padStart(2, '0');

export function GuideIndexView({ zh }: { zh: boolean }) {
  const c = GUIDE_COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: guidePath() },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: c.heading,
          itemListElement: GUIDE_CHAPTERS.map((chapter, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: chapter.title[zh ? 0 : 1],
            url: `${SITE_URL}${guidePath(chapter.slug)}`,
          })),
        })}
      />
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.heading}</h1>
        <p>{c.lead}</p>
      </section>
      <section className="guide-season" aria-labelledby="guide-season">
        <h2 id="guide-season">{c.season}</h2>
        <ol>
          {SEASON.map(([monthsZh, monthsEn, phaseZh, phaseEn, doZh, doEn], i) => (
            <li key={monthsEn} style={{ '--i': i } as React.CSSProperties}>
              <span className="guide-season-months">{zh ? monthsZh : monthsEn}</span>
              <strong>{zh ? phaseZh : phaseEn}</strong>
              <span>{zh ? doZh : doEn}</span>
            </li>
          ))}
        </ol>
        <p className="guide-season-note">{c.seasonNote}</p>
      </section>
      <section aria-labelledby="guide-chapters">
        <h2 id="guide-chapters" className="guide-h2">
          {c.chapters}
        </h2>
        <ol className="guide-chapters">
          {GUIDE_CHAPTERS.map((chapter, i) => (
            <li key={chapter.slug}>
              <a href={guidePath(chapter.slug)}>
                <span className="guide-no" aria-hidden="true">
                  {no(i)}
                </span>
                <strong>{chapter.title[zh ? 0 : 1]}</strong>
                <span>{chapter.summary[zh ? 0 : 1]}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
      <aside className="guide-review-cta" aria-label={c.reviewCta}>
        <p>{c.review}</p>
        <a href="/career/resume">
          {c.reviewCta} <span aria-hidden="true">→</span>
        </a>
      </aside>
      <aside className="guide-review-cta" aria-label={c.visaCta}>
        <p>{c.visa}</p>
        <a href="/career/visa-timeline">
          {c.visaCta} <span aria-hidden="true">→</span>
        </a>
      </aside>
      <aside className="guide-review-cta" aria-label={c.aiRoundCta}>
        <p>{c.aiRound}</p>
        <a href="/ai-assisted">
          {c.aiRoundCta} <span aria-hidden="true">→</span>
        </a>
      </aside>
    </>
  );
}

export function guideChapterCopy(chapter: GuideChapter, zh: boolean) {
  const title = chapter.title[zh ? 0 : 1];
  return {
    title,
    pageTitle: `${title} | ${zh ? '求职指南' : 'Career guide'} | ${SITE_NAME}`,
    description: chapter.summary[zh ? 0 : 1],
  };
}

export function GuideChapterView({ chapter, zh, children }: { chapter: GuideChapter; zh: boolean; children?: React.ReactNode }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const index = GUIDE_CHAPTERS.indexOf(chapter);
  const { title, description } = guideChapterCopy(chapter, zh);
  const prev = GUIDE_CHAPTERS[index - 1],
    next = GUIDE_CHAPTERS[index + 1];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('求职指南', 'Career guide'), path: guidePath() },
            { name: title, path: guidePath(chapter.slug) },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description,
          url: `${SITE_URL}${guidePath(chapter.slug)}`,
          inLanguage: zh ? 'zh-CN' : 'en',
          author: { '@type': 'Organization', name: SITE_NAME },
          isPartOf: { '@type': 'CollectionPage', url: `${SITE_URL}${guidePath()}` },
        })}
      />
      <nav className="mock-public-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <a href={guidePath()}>{t('求职指南', 'Career guide')}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <div className="guide-layout">
        <nav className="guide-toc" aria-label={t('章节目录', 'Chapters')}>
          <ol>
            {GUIDE_CHAPTERS.map((c, i) => (
              <li key={c.slug}>
                <a href={guidePath(c.slug)} aria-current={c === chapter ? 'page' : undefined}>
                  <span aria-hidden="true">{no(i)}</span>
                  {c.title[zh ? 0 : 1]}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="guide-article" lang={zh ? 'zh-CN' : 'en'}>
          <header className="guide-article-head">
            <p className="guide-article-kicker">
              {t(`第 ${no(index)} 章 / 共 ${GUIDE_CHAPTERS.length} 章`, `CHAPTER ${no(index)} OF ${GUIDE_CHAPTERS.length}`)}
            </p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          <div className="guide-body">
            <GuideMarkdown
              body={GUIDE_BODIES[chapter.slug][zh ? 'zh' : 'en']}
              labels={{ table: t('表格，可横向滚动', 'Table, scrolls sideways'), code: t('模板，可横向滚动', 'Template, scrolls sideways') }}
            />
          </div>
          {children}
          <nav className="guide-adjacent" aria-label={t('相邻章节', 'Adjacent chapters')}>
            {prev ? (
              <a href={guidePath(prev.slug)} rel="prev">
                <small>{t('← 上一章', '← Previous')}</small>
                <strong>{prev.title[zh ? 0 : 1]}</strong>
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={guidePath(next.slug)} rel="next">
                <small>{t('下一章 →', 'Next →')}</small>
                <strong>{next.title[zh ? 0 : 1]}</strong>
              </a>
            ) : (
              <a href="/career/resume">
                <small>{t('最后一步 →', 'One more thing →')}</small>
                <strong>{t('简历 AI 点评', 'AI resume review')}</strong>
              </a>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
