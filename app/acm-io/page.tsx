import '../library/library.css';
import './acm-io.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { ACM_IO_TEMPLATES } from '@/lib/acm-io-templates';
import type { CodeLanguage } from '@/lib/problems';
import { SITE_URL, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { LibraryPageView } from '../library/page-view';

const title = 'ACM 模式输入输出模板';
const description =
  'C++、Python、Java、Go 的 ACM 模式（标准输入输出）读写模板：单组、读到 EOF、T 组数据、n 加数组、矩阵、字符网格、建图、整行读入和快读快写，每种都附说明和可运行样例。';
const descriptionEn =
  'Stdin/stdout templates for ACM-style problems and OAs in C++, Python, Java and Go: EOF loops, T test cases, arrays, matrices, grids, graphs, whole lines and fast I/O, each with a runnable sample.';
// C++ first: most ACM-mode readers write it.
const LANGUAGES: [CodeLanguage, string][] = [
  ['cpp', 'C++'],
  ['python', 'Python 3'],
  ['java', 'Java'],
  ['go', 'Go'],
];

export function generateMetadata() {
  return seoMetadata({
    title: `${title} · ACM-style input/output templates`,
    description,
    path: '/acm-io',
  });
}

export default function AcmIoPage() {
  return (
    <div className="public-library acm-io" lang="zh-CN">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: title, path: '/acm-io' },
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
            alternativeHeadline: 'ACM-style input/output templates',
            description,
            inLanguage: ['zh-CN', 'en'],
            url: `${SITE_URL}/acm-io`,
            about: ACM_IO_TEMPLATES.map((item) => item.title.en),
            programmingLanguage: LANGUAGES.map(([, name]) => name),
          }).replace(/</g, '\\u003c'),
        }}
      />
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / ACM I/O</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          去题库练习 · Practice <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <div className="public-library-intro">
          <p className="public-library-eyebrow">STDIN → STDOUT</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <p lang="en">{descriptionEn}</p>
        </div>
        <nav className="acm-io-toc" aria-label="模板目录 · Templates">
          <ol>
            {ACM_IO_TEMPLATES.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>
                  {item.title.zh}
                  <span lang="en">{item.title.en}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {ACM_IO_TEMPLATES.map((item, index) => (
          <section
            key={item.id}
            id={item.id}
            className="acm-io-shape"
            aria-labelledby={`${item.id}-title`}
          >
            <h2 id={`${item.id}-title`}>
              <span className="acm-io-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>
                {item.title.zh}
                <small lang="en">{item.title.en}</small>
              </span>
            </h2>
            <p>{item.note.zh}</p>
            <p lang="en" className="acm-io-en">
              {item.note.en}
            </p>
            <div className="acm-io-sample">
              <figure>
                <figcaption>样例输入 · Sample input</figcaption>
                <pre>{item.sample.input}</pre>
              </figure>
              <figure>
                <figcaption>样例输出 · Sample output</figcaption>
                <pre>{item.sample.output}</pre>
              </figure>
            </div>
            {LANGUAGES.map(([language, name], position) => (
              <details key={language} open={position === 0}>
                <summary>{name}</summary>
                <pre>
                  <code>{item.code[language]}</code>
                </pre>
              </details>
            ))}
          </section>
        ))}
        <p className="acm-io-cta">
          写题时在编辑器工具栏切到 ACM 模式，选「输入模板」即可换成其中任一份完整程序（改过的代码会先确认）。
          <span lang="en">
            {' '}
            In the practice editor, switch to ACM mode and pick Input templates to
            start from any of these whole programs (edited code asks first).
          </span>{' '}
          <Link href="/?view=problems" prefetch={false}>
            去题库练习 · Open the problems →
          </Link>
        </p>
      </main>
      <footer className="public-library-footer">
        <Link href="/library" prefetch={false}>
          Browse the library
        </Link>
        <Link href="/privacy" prefetch={false}>
          Privacy
        </Link>
      </footer>
      {/* useSearchParams: no static-render bailout for the rest of the page. */}
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
