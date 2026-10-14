// Locale-free views for /topics and /topics/<stop>; the pages only resolve the locale.
import { SITE_NAME, SITE_URL, breadcrumbJsonLd } from '@/lib/seo';
import { TEMPLATE_LANGS, line500Path, topicPath } from '@/lib/route-templates';
import { CodeBlock } from './code-block';
import { TOPIC_GROUPS, TOPIC_STOPS, type TopicStop } from './stops';

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
      ? `「${stop.title}」代码模板速查：${stop.pattern.zh}（${stop.complexity}）。3 条要点、3 个易错点，附 Python、C++、Java、Go 四种可运行模板，配合 500 路第 ${stop.no} 站的 ${stop.problems} 道题练习。`
      : `${stop.titleEn} cheat sheet: ${stop.pattern.en} (${stop.complexity}). Three key points, three common pitfalls and a runnable template in Python, C++, Java and Go, to practise with the ${stop.problems} problems at stop ${stop.no} of Line 500.`,
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
          programmingLanguage: TEMPLATE_LANGS.map(([, label]) => label),
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
            <span className="topics-complexity" translate="no">
              {stop.complexity}
            </span>
          </p>
        </div>
        <a className="topics-cta" href={line500Path(stop.slug)}>
          {t(`去 500 路练这一站 · ${stop.problems} 题`, `Practise this stop · ${stop.problems} problems`)}
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
      <nav className="topics-adjacent" aria-label={t('相邻站点', 'Adjacent stops')}>
        <Adjacent stop={TOPIC_STOPS[stop.index - 1]} rel="prev" zh={zh} />
        <Adjacent stop={TOPIC_STOPS[stop.index + 1]} rel="next" zh={zh} />
      </nav>
    </>
  );
}
