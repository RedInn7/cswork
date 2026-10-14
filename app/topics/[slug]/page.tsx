import { notFound } from 'next/navigation';
import { SITE_NAME, SITE_URL, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { TEMPLATE_LANGS, line500Path, topicPath } from '@/lib/route-templates';
import { CodeBlock } from '../code-block';
import { TOPIC_STOPS, topicStop, type TopicStop } from '../stops';

type Props = { params: Promise<{ slug: string }> };

async function load(params: Props['params']) {
  const stop = topicStop((await params).slug);
  if (!stop) notFound();
  const zh = (await requestLocale()) === 'zh';
  const title = zh ? stop.title : stop.titleEn;
  const description = zh
    ? `「${stop.title}」代码模板速查：${stop.pattern.zh}（${stop.complexity}）。3 条要点、3 个易错点，附 Python、C++、Java、Go 四种可运行模板，配合 500 路第 ${stop.no} 站的 ${stop.problems} 道题练习。`
    : `${stop.titleEn} cheat sheet: ${stop.pattern.en} (${stop.complexity}). Three key points, three common pitfalls and a runnable template in Python, C++, Java and Go, to practise with the ${stop.problems} problems at stop ${stop.no} of Line 500.`;
  return { stop, zh, title, description };
}

export async function generateMetadata({ params }: Props) {
  const { stop, zh, title, description } = await load(params);
  return seoMetadata({
    title: zh
      ? `${title}代码模板：Python / C++ / Java / Go | ${SITE_NAME}`
      : `${title}: Code Templates in Python, C++, Java & Go | ${SITE_NAME}`,
    description,
    path: topicPath(stop.slug),
  });
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

export default async function TopicPage({ params }: Props) {
  const { stop, zh, title, description } = await load(params);
  const t = (a: string, b: string) => (zh ? a : b);
  const url = `${SITE_URL}${topicPath(stop.slug)}`;
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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: title,
            description,
            url,
            inLanguage: zh ? 'zh-CN' : 'en',
            programmingLanguage: TEMPLATE_LANGS.map(([, label]) => label),
            isPartOf: { '@type': 'CollectionPage', url: `${SITE_URL}/topics` },
          }).replace(/</g, '\\u003c'),
        }}
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
