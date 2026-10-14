import { SITE_NAME, SITE_URL, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { topicPath } from '@/lib/route-templates';
import { TOPIC_GROUPS, TOPIC_STOPS } from './stops';

const copy = {
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

export async function generateMetadata() {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/topics' });
}

export default async function TopicsIndex() {
  const locale = await requestLocale();
  const zh = locale === 'zh';
  const c = copy[locale];
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: c.heading,
            itemListElement: TOPIC_STOPS.map((stop) => ({
              '@type': 'ListItem',
              position: stop.index + 1,
              name: zh ? stop.title : stop.titleEn,
              url: `${SITE_URL}${topicPath(stop.slug)}`,
            })),
          }).replace(/</g, '\\u003c'),
        }}
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
