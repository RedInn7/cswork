// /topics/print without request context: every stop's sheet and template in one language, laid
// out to print or save as a PDF. No account and no API: everything comes from the stop data.
import { SITE_NAME, breadcrumbJsonLd } from '@/lib/seo';
import { TEMPLATE_LANGS, type TemplateLang } from '@/lib/route-templates';
import { PrintButton } from '@/components/print-button';
import { CodeBlock } from '../code-block';
import { TOPIC_GROUPS, TOPIC_STOPS } from '../stops';

export const PRINT_COPY = {
  zh: {
    title: `500 路代码模板手册（可打印 / 存 PDF）| ${SITE_NAME}`,
    description: `35 个算法专题的模板合订本：每站的模式、复杂度、3 条要点、3 个易错点和代码模板，可选 Python、C++、Java 或 Go，打开浏览器打印即可存成 PDF，不用登录。`,
    crumb: '打印版手册',
  },
  en: {
    title: `Printable Algorithm Template Handbook (PDF) | ${SITE_NAME}`,
    description: `All 35 topic sheets in one handbook: the pattern, complexity, three key points, three pitfalls and the code template in Python, C++, Java or Go. Print it or save it as a PDF from your browser, no account needed.`,
    crumb: 'Printable handbook',
  },
};

/** ?lang= when it names a template language, else Python. */
export const printLang = (raw: unknown): TemplateLang =>
  TEMPLATE_LANGS.find(([lang]) => lang === raw)?.[0] ?? 'python';

export function TopicsPrintView({ zh, lang }: { zh: boolean; lang: TemplateLang }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const label = TEMPLATE_LANGS.find(([l]) => l === lang)![1];
  return (
    <div className="topics-print">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: t('模板速查', 'Templates'), path: '/topics' },
            { name: PRINT_COPY[zh ? 'zh' : 'en'].crumb, path: '/topics/print' },
          ]),
        }}
      />
      <div className="topics-print-bar">
        <nav aria-label={t('模板语言', 'Template language')}>
          {TEMPLATE_LANGS.map(([l, name]) => (
            <a key={l} href={`/topics/print?lang=${l}`} aria-current={l === lang ? 'page' : undefined}>
              {name}
            </a>
          ))}
        </nav>
        <PrintButton zh={zh} className="topics-print-button" />
      </div>
      <header className="topics-print-cover">
        <p className="public-library-eyebrow">
          {t(`500 路 · ${TOPIC_STOPS.length} 站 · ${label}`, `LINE 500 · ${TOPIC_STOPS.length} STOPS · ${label.toUpperCase()}`)}
        </p>
        <h1>{t(`代码模板手册：${label}`, `Template handbook: ${label}`)}</h1>
        <p>
          {t(
            `每站一节：模式、复杂度、3 条要点、3 个易错点和 ${label} 模板。每份模板都编译运行过，并用测试数据核对了输出。打印时每组从新的一页开始；在打印对话框里选「存储为 PDF」就能存成文件。`,
            `One section per stop: the pattern, its complexity, three key points, three pitfalls and the ${label} template. Every template is compiled, run and checked against test data. Each group starts on a new page; choose “Save as PDF” in the print dialog to keep a file.`,
          )}
        </p>
        <p className="topics-print-source">cswork.org/topics</p>
      </header>
      <nav className="topics-print-toc" aria-labelledby="print-toc">
        <h2 id="print-toc">{t('目录', 'Contents')}</h2>
        {TOPIC_GROUPS.map((group) => (
          <div key={group.en}>
            <h3>{zh ? group.zh : group.en}</h3>
            <ol>
              {group.stops.map((stop) => (
                <li key={stop.slug}>
                  <a href={`#stop-${stop.slug}`}>
                    <span className="topics-print-no">{stop.no}</span> {zh ? stop.title : stop.titleEn}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>
      {TOPIC_GROUPS.map((group, g) => (
        <section className="topics-print-group" key={group.en} aria-labelledby={`print-group-${g}`}>
          <h2 id={`print-group-${g}`}>{zh ? group.zh : group.en}</h2>
          {group.stops.map((stop) => (
            <article className="topics-print-stop" id={`stop-${stop.slug}`} key={stop.slug} aria-labelledby={`print-stop-${stop.slug}`}>
              <h3 id={`print-stop-${stop.slug}`}>
                <span className="topics-print-no">{stop.no}</span> {zh ? stop.title : stop.titleEn}{' '}
                <small lang={zh ? 'en' : 'zh-CN'}>{zh ? stop.titleEn : stop.title}</small>
              </h3>
              <p className="topics-print-pattern">
                {zh ? stop.pattern.zh : stop.pattern.en} · {zh ? stop.complexity.zh : stop.complexity.en}
              </p>
              <div className="topics-print-notes">
                <div>
                  <h4>{t('要点', 'Key points')}</h4>
                  <ol>
                    {stop.points.map((point) => (
                      <li key={point.en}>{zh ? point.zh : point.en}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h4>{t('易错点', 'Common pitfalls')}</h4>
                  <ul>
                    {stop.pitfalls.map((pitfall) => (
                      <li key={pitfall.en}>{zh ? pitfall.zh : pitfall.en}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <CodeBlock
                code={stop.code[lang]}
                lang={lang}
                label={t(`${stop.no} ${stop.title} · ${label} 模板代码`, `${stop.no} ${stop.titleEn} · ${label} template`)}
                run={false}
              />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
