import { SITE_NAME, breadcrumbJsonLd, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { englishUnits } from '@/lib/interview-english';
import { EnglishDoneCheck, EnglishDoneCount } from '@/components/english-unit';

const COPY = {
  zh: {
    title: `面试英语：12 个场景的常用表达、对话、填空和跟读 | ${SITE_NAME}`,
    description:
      '为用英语面试准备的口语练习：从自我介绍、澄清题目、边写边讲、说复杂度，到行为面 STAR、系统设计取舍、最后提问和谈 offer，每个场景有常用表达和用法提醒、一段示范对话、填空和排序练习，可以用浏览器朗读和跟读打分。',
    eyebrow: '面试英语 · 12 个场景',
    heading: '把会做的题，用英语讲清楚。',
    crumb: '面试英语',
    unit: (n: number) => `单元 ${String(n).padStart(2, '0')}`,
    counts: (phrases: number, lines: number, drills: number) => `${phrases} 个表达 · ${lines} 句对话 · ${drills} 道练习`,
  },
  en: {
    title: `Interview English: Phrases, Dialogues and Shadowing for 12 Situations | ${SITE_NAME}`,
    description:
      'Spoken English practice for technical interviews: from introducing yourself, clarifying the problem, thinking aloud and talking complexity to STAR answers, design trade-offs, your own questions and offer calls. Each situation has phrases with usage notes, a model dialogue, fill-in-the-blank and word-order drills, and read-aloud and shadowing in your browser.',
    eyebrow: 'INTERVIEW ENGLISH · 12 SITUATIONS',
    heading: 'Say what you know, clearly, in English.',
    crumb: 'Interview English',
    unit: (n: number) => `Unit ${String(n).padStart(2, '0')}`,
    counts: (phrases: number, lines: number, drills: number) => `${phrases} phrases · ${lines} lines · ${drills} drills`,
  },
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/english' });
}

export default async function EnglishIndex() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: '/english' },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd(
            c.heading,
            englishUnits.map((unit) => ({ name: zh ? unit.title.zh : unit.title.en, path: `/english/${unit.slug}` })),
          ),
        }}
      />
      <div className="public-library-intro eng-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
        <EnglishDoneCount slugs={englishUnits.map((unit) => unit.slug)} />
      </div>
      <ol className="eng-units">
        {englishUnits.map((unit, i) => (
          <li key={unit.slug} style={{ '--i': i } as React.CSSProperties}>
            <a href={`/english/${unit.slug}`}>
              <span className="eng-unit-no">{c.unit(i + 1)}</span>
              <span className="eng-unit-title">{zh ? unit.title.zh : unit.title.en}</span>
              <span className="eng-unit-blurb">{zh ? unit.blurb.zh : unit.blurb.en}</span>
              <span className="eng-unit-meta">
                <span>
                  {c.counts(unit.phrases.length, unit.dialogue.length, unit.drills.cloze.length + unit.drills.order.length)}
                </span>
                <EnglishDoneCheck slug={unit.slug} />
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
