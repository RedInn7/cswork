// Locale-free views for /topics and /topics/<stop>; the pages only resolve the locale.
import { SITE_NAME, SITE_URL, breadcrumbJsonLd } from '@/lib/seo';
import { TEMPLATE_LANGS, line500Path, topicPath } from '@/lib/route-templates';
import { CodeBlock } from './code-block';
import { RatingBadge } from '@/components/rating-badge';
import { AlgorithmDemo } from '@/components/algorithm-demo';
import { stopDemos } from '@/lib/route-stops';
import { TOPIC_GROUPS, TOPIC_STOPS, type TopicStop } from './stops';
import bankFile from '@/lib/content/oa-mcq.json';
import type { McqQuestion } from '@/lib/mock-oa';
import { McqPractice } from '@/app/oa/mcq/practice';
import { TemplateDrill } from '@/components/template-drill';

export const INDEX_COPY = {
  zh: {
    title: `500 路代码模板速查：35 个算法专题 | ${SITE_NAME}`,
    description:
      '灵神题单 500 题按 35 个专题排成一条线路，每一站一页速查：3 条要点、3 个易错点，以及 Python、C++、Java、Go 四种可运行的代码模板。',
    eyebrow: '500 路 · 35 站 · 4 种语言',
    heading: '每一站的代码模板，一页看完。',
    crumb: '模板速查',
  },
  en: {
    title: `Algorithm Pattern Templates for 35 Topics | ${SITE_NAME}`,
    description:
      'The 500 curated problems run as one line of 35 topic stops. Each stop has a one-page cheat sheet: three key points, three common pitfalls and a runnable template in Python, C++, Java and Go.',
    eyebrow: 'LINE 500 · 35 STOPS · 4 LANGUAGES',
    heading: 'A code template for every stop.',
    crumb: 'Templates',
  },
};

const ldJson = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

export function TopicsIndexView({ zh }: { zh: boolean }) {
  const c = INDEX_COPY[zh ? 'zh' : 'en'];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: '/topics' },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: c.heading,
          itemListElement: TOPIC_STOPS.map((stop) => ({
            '@type': 'ListItem',
            position: stop.index + 1,
            name: zh ? stop.title : stop.titleEn,
            url: `${SITE_URL}${topicPath(stop.slug)}`,
          })),
        })}
      />
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
      </div>
      <a className="topics-roadmap" href="/roadmap">
        <strong>{zh ? '知识点依赖图' : 'Prerequisite graph'}</strong>
        <span>
          {zh
            ? '35 站谁是谁的先修，一张图看清；还有系统设计和行为面试的学习路线。'
            : 'How the 35 stops build on each other, plus the system design and behavioral tracks.'}
        </span>
      </a>
      <a className="topics-roadmap" href="/core-skills">
        <strong>{zh ? 'Core Skills：手写数据结构与算法' : 'Core Skills: data structures by hand'}</strong>
        <span>
          {zh
            ? '28 道题，不调库亲手实现哈希表、堆、LRU、排序、最短路、并查集、线段树等，还有多线程并发题，四种语言都能判题。'
            : '28 problems: build hash maps, heaps, an LRU cache, sorts, shortest paths, union-find, segment trees and more without libraries, plus multithreaded concurrency problems, judged in four languages.'}
        </span>
      </a>
      <div className="topics-map">
        {TOPIC_GROUPS.map((group, g) => (
          <section className="topics-group" key={group.en} aria-labelledby={`topics-group-${g}`}>
            <h2 id={`topics-group-${g}`}>
              <span>{zh ? group.zh : group.en}</span>
              <span className="topics-group-range">
                {group.stops[0].no}–{group.stops.at(-1)!.no}
              </span>
            </h2>
            <ol className="topics-line">
              {group.stops.map((stop) => (
                <li key={stop.slug} style={{ '--i': stop.index } as React.CSSProperties}>
                  <a href={topicPath(stop.slug)}>
                    <span className="topics-no" aria-hidden="true">
                      {stop.no}
                    </span>
                    <span className="topics-stop-name">
                      <span className="sr-only">{zh ? `第 ${stop.no} 站：` : `Stop ${stop.no}: `}</span>
                      {zh ? stop.short[0] : stop.short[1]}
                    </span>
                    <span className="topics-stop-pattern">{zh ? stop.pattern.zh : stop.pattern.en}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}

export function topicCopy(stop: TopicStop, zh: boolean) {
  const title = zh ? stop.title : stop.titleEn;
  return {
    title,
    pageTitle: zh
      ? `${title}代码模板：Python / C++ / Java / Go | ${SITE_NAME}`
      : `${title}: Code Templates in Python, C++, Java & Go | ${SITE_NAME}`,
    description: zh
      ? `「${stop.title}」代码模板速查：${stop.pattern.zh}（${stop.complexity.zh}）。3 条要点、3 个易错点，附 Python、C++、Java、Go 四种可运行模板，配合 500 路第 ${stop.no} 站的 ${stop.problems} 道题练习。`
      : `${stop.titleEn} cheat sheet: ${stop.pattern.en} (${stop.complexity.en}). Three key points, three common pitfalls and a runnable template in Python, C++, Java and Go, to practise with the ${stop.problems} problems at stop ${stop.no} of Line 500.`,
  };
}

function Adjacent({ stop, rel, zh }: { stop?: TopicStop; rel: 'prev' | 'next'; zh: boolean }) {
  if (!stop) return <span />;
  const label = rel === 'prev' ? (zh ? '← 上一站' : '← Previous stop') : zh ? '下一站 →' : 'Next stop →';
  return (
    <a href={topicPath(stop.slug)} rel={rel}>
      <small>{label}</small>
      <strong>
        <span className="topics-adjacent-no">{stop.no}</span> {zh ? stop.short[0] : stop.short[1]}
      </strong>
    </a>
  );
}

export function TopicView({ stop, zh }: { stop: TopicStop; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { title, description } = topicCopy(stop, zh);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('模板速查', 'Templates'), path: '/topics' },
            { name: title, path: topicPath(stop.slug) },
          ]),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson({
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: title,
          description,
          url: `${SITE_URL}${topicPath(stop.slug)}`,
          inLanguage: zh ? 'zh-CN' : 'en',
          hasPart: TEMPLATE_LANGS.map(([, label]) => ({
            '@type': 'SoftwareSourceCode',
            programmingLanguage: label,
            codeSampleType: 'template',
          })),
          isPartOf: { '@type': 'CollectionPage', url: `${SITE_URL}/topics` },
        })}
      />
      <nav className="public-library-breadcrumb" aria-label={t('导航路径', 'Breadcrumb')}>
        <a href="/topics">{t('模板速查', 'Templates')}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? stop.short[0] : stop.short[1]}</span>
      </nav>
      <header className="topics-sign">
        <span className="topics-roundel" aria-hidden="true">
          {stop.no}
        </span>
        <div className="topics-sign-text">
          <p className="topics-sign-kicker">
            {t(`第 ${stop.no} 站 · ${stop.group.zh}`, `STOP ${stop.no} · ${stop.group.en.toUpperCase()}`)}
          </p>
          <h1>{title}</h1>
          <p className="topics-sign-pattern">
            {zh ? stop.pattern.zh : stop.pattern.en}{' '}
            <span className="topics-complexity">{zh ? stop.complexity.zh : stop.complexity.en}</span>
          </p>
          {stop.ratings && (
            <p className="topics-ratings">
              {t('周赛难度分', 'Contest ratings')} <RatingBadge rating={stop.ratings.min} english={!zh} />–
              <RatingBadge rating={stop.ratings.max} english={!zh} />
              {t('· 中位', '· median')} <RatingBadge rating={stop.ratings.median} english={!zh} />
              <small>
                {t(
                  `（${stop.ratings.count}/${stop.problems} 道题有 zerotrac 周赛分）`,
                  `(${stop.ratings.count} of ${stop.problems} problems rated by zerotrac)`,
                )}
              </small>
            </p>
          )}
        </div>
        <a className="topics-cta" href={line500Path(stop.slug)}>
          {/* ponytail: the Line 500 list does not read ?section= yet, so the label points at the stop number instead of promising a filter. */}
          {t(
            `打开 500 路题单 · 第 ${stop.no} 站 · ${stop.problems} 题`,
            `Open the Line 500 list · stop ${stop.no} · ${stop.problems} problems`,
          )}
          <span aria-hidden="true">→</span>
        </a>
      </header>
      <div className="topics-notes">
        <section className="topics-points" aria-labelledby="topic-points">
          <h2 id="topic-points">{t('要点', 'Key points')}</h2>
          <ol>
            {stop.points.map((point) => (
              <li key={point.en}>{zh ? point.zh : point.en}</li>
            ))}
          </ol>
        </section>
        <section className="topics-pitfalls" aria-labelledby="topic-pitfalls">
          <h2 id="topic-pitfalls">{t('易错点', 'Common pitfalls')}</h2>
          <ul>
            {stop.pitfalls.map((pitfall) => (
              <li key={pitfall.en}>{zh ? pitfall.zh : pitfall.en}</li>
            ))}
          </ul>
        </section>
      </div>
      {stopDemos(stop.slug).length > 0 && (
        <section className="topics-demos" id="algorithm-demo" aria-labelledby="topic-demos">
          <h2 id="topic-demos">{t('看动画', 'Watch it run')}</h2>
          <p className="topics-template-lead">
            {t(
              '一步一步播放这个模式在小例子上的执行过程。可以暂停、单步前进或后退，拖动进度条跳到任意一步。',
              'Step through the pattern on a small example. Pause, step forwards or back, or drag the slider to any step.',
            )}
          </p>
          {stopDemos(stop.slug).map((kind) => (
            <AlgorithmDemo key={kind} kind={kind} />
          ))}
        </section>
      )}
      <section className="topics-template" aria-labelledby="topic-template">
        <h2 id="topic-template">{t('模板', 'Template')}</h2>
        <p className="topics-template-lead">
          {t(
            '选一种语言展开。四种写法实现的是同一个模板，每一份都编译运行过，并用测试数据核对了输出。',
            'Open one language. All four implement the same template, and each one is compiled, run and checked against test data.',
          )}
        </p>
        {TEMPLATE_LANGS.map(([lang, label], i) => (
          <details className="topics-code" name="topic-code" open={i === 0} key={lang}>
            <summary>{label}</summary>
            <CodeBlock code={stop.code[lang]} lang={lang} label={t(`${label} 模板代码`, `${label} template`)} />
          </details>
        ))}
      </section>
      <StopDrills stop={stop} zh={zh} />
      <nav className="topics-adjacent" aria-label={t('相邻站点', 'Adjacent stops')}>
        <Adjacent stop={TOPIC_STOPS[stop.index - 1]} rel="prev" zh={zh} />
        <Adjacent stop={TOPIC_STOPS[stop.index + 1]} rel="next" zh={zh} />
      </nav>
    </>
  );
}

/** The stop's concept and complexity questions (oa-mcq.json `stop`), then drills on its template. */
function StopDrills({ stop, zh }: { stop: TopicStop; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const quiz = (bankFile.questions as McqQuestion[])
    .filter((q) => q.stop === stop.slug)
    .slice(0, 5)
    .map(({ zh: zhText, en, ...q }) => ({ ...q, text: zh ? zhText : en }));
  return (
    <>
      {quiz.length > 0 && (
        <section className="topics-template topics-quiz" aria-labelledby="topic-quiz">
          <h2 id="topic-quiz">{t('小测', 'Quick quiz')}</h2>
          <p className="topics-template-lead">
            {t(
              `${quiz.length} 道概念题和复杂度题。答过的题会和 OA 选择题练习一起按间隔回来复习。`,
              `${quiz.length} concept and complexity questions. Answered ones come back for spaced review along with the OA multiple-choice practice.`,
            )}{' '}
            <a href="/oa/mcq">{t('去 OA 选择题练习', 'Open the OA multiple-choice practice')}</a>
          </p>
          <McqPractice items={quiz} zh={zh} compact />
        </section>
      )}
      <section className="topics-template topics-drill" aria-labelledby="topic-drill">
        <h2 id="topic-drill">{t('模板练习', 'Template drills')}</h2>
        <p className="topics-template-lead">
          {t(
            '用上面的模板出题：把打乱的行排回原序，或者把挖掉的边界条件填回去。每次「换一题」都会重新出题。',
            'Drills cut from the template above: put shuffled lines back in order, or fill the blanked boundary conditions back in. Another one gives a new drill.',
          )}
        </p>
        <TemplateDrill code={stop.code} langs={TEMPLATE_LANGS} zh={zh} />
      </section>
    </>
  );
}
