// /topics/glossary without request context: the page only resolves the locale.
import { SITE_NAME, SITE_URL, breadcrumbJsonLd } from '@/lib/seo';
import { GLOSSARY, glossaryHref } from '@/lib/glossary';
import { GlossaryList } from '@/components/glossary-list';

export const GLOSSARY_COPY = {
  zh: {
    title: `算法术语中英对照表：${GLOSSARY.length} 个面试常用词 | ${SITE_NAME}`,
    description: `差分、状压、换根、单调栈的英文怎么说？${GLOSSARY.length} 个算法与数据结构术语的中英对照，每条配一句英文面试例句，可以朗读，也能一键做成复习卡。`,
    eyebrow: `术语表 · ${GLOSSARY.length} 条 · 中英对照`,
    heading: '英文面试时，这些词怎么说。',
    crumb: '术语表',
  },
  en: {
    title: `Chinese–English Algorithm Glossary: ${GLOSSARY.length} Interview Terms | ${SITE_NAME}`,
    description: `${GLOSSARY.length} algorithm and data structure terms in Chinese and English, each with an interview sentence you can listen to and turn into a review card.`,
    eyebrow: `GLOSSARY · ${GLOSSARY.length} TERMS · CHINESE / ENGLISH`,
    heading: 'The words for explaining your solution.',
    crumb: 'Glossary',
  },
};

const ldJson = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

export function GlossaryView({ zh }: { zh: boolean }) {
  const c = GLOSSARY_COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: zh ? '模板速查' : 'Templates', path: '/topics' },
            { name: c.crumb, path: '/topics/glossary' },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({
          '@context': 'https://schema.org',
          '@type': 'DefinedTermSet',
          name: c.heading,
          url: `${SITE_URL}/topics/glossary`,
          inLanguage: ['zh-CN', 'en'],
          hasDefinedTerm: GLOSSARY.map((term) => ({
            '@type': 'DefinedTerm',
            name: term.en,
            alternateName: [term.zh, ...(term.alt ?? [])],
            description: term.say,
            url: `${SITE_URL}${glossaryHref(term.id)}`,
          })),
        })}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/topics">{zh ? '模板速查' : 'Templates'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{c.crumb}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
      </div>
      <p className="glossary-more">
        {zh ? '自我介绍、澄清题意、边写边讲这类整句表达，在 ' : 'Whole phrases for introductions, clarifying questions and thinking aloud are in '}
        <a href="/english">{zh ? '面试英语' : 'Interview English'}</a>
        {zh ? '。想把各站模板打印出来，用 ' : '. To print every stop’s template, use the '}
        <a href="/topics/print">{zh ? '打印版模板手册' : 'printable handbook'}</a>
        {zh ? '。' : '.'}
      </p>
      <GlossaryList zh={zh} />
    </>
  );
}
