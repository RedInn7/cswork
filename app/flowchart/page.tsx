import '../mock-oa/mock-oa-public.css';
import './flowchart.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { library } from '@/lib/server/content-library';
import { tutorialSlugs } from '@/lib/pattern-flowchart';
import { FlowchartWalk, type Tutorials } from './walk';

const copy = {
  en: {
    title: 'Which algorithm pattern? A yes/no decision tree · CSWork',
    description: 'Stuck on which technique a coding problem needs? Answer yes-or-no questions about the input and the ask, one at a time, and land on the matching topic of Ling’s Curated 500 with a one-line reason, its problems and a tutorial.',
    kicker: 'PATTERN FINDER · DECISION TREE',
    h1: 'Not sure which pattern a problem needs? Answer yes or no.',
    lead: 'Start with the shape of the input, then what the problem asks for. A few answers later you reach one of the 35 stops on Ling’s Curated 500: why it fits, its problems and a tutorial. It is a first guess, not a rule; some problems mix two patterns.',
    practise: 'Open the problem list',
  },
  zh: {
    title: '解题思路决策树：这道题该用什么算法？ · CSWork',
    description: '读完题不知道用什么方法？逐个回答关于输入和问法的是非题，就能定位到灵神题单精选里对应的专题，附一句理由、对应题目和算法教程。',
    kicker: '解题思路 · 决策树',
    h1: '读完题不知道用什么方法？回答几个是或否。',
    lead: '先看输入长什么样，再看题目问什么。几个回答之后，你会落到灵神题单精选 35 个专题中的一站：为什么是它、去哪刷题、读哪篇教程。这只是第一猜测，不是定理，有些题要组合两种方法。',
    practise: '打开题单',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/flowchart' });
}

/** Titles of the leaves' tutorials that the content library publishes; none when it is missing. */
function tutorialTitles(zh: boolean): Tutorials {
  const db = library();
  if (!db) return {};
  const slugs = tutorialSlugs();
  try {
    const rows = db
      .prepare(
        `SELECT slug,title,title_zh FROM items WHERE type='algorithm' AND listed=1 AND partial=0
         AND dup_of IS NULL AND slug IN (${slugs.map(() => '?').join(',')})`,
      )
      .all(...slugs) as { slug: string; title: string; title_zh: string | null }[];
    return Object.fromEntries(rows.map((r) => [r.slug, (zh && r.title_zh) || r.title]));
  } catch {
    // ponytail: an older library (no title_zh) only loses the optional tutorial links, not the page.
    return {};
  }
}

export default async function FlowchartPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  return (
    <div className="mock-public flow-page" lang={zh ? 'zh-CN' : 'en'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: c.title,
            description: c.description,
            url: `${SITE_URL}/flowchart`,
            inLanguage: zh ? 'zh-CN' : 'en',
          }).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: zh ? '解题思路决策树' : 'Pattern decision tree', path: '/flowchart' },
          ]),
        }}
      />
      <header className="mock-public-header">
        <Link className="mock-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '解题思路' : 'patterns'}</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {c.practise} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="mock-public-main" id="main-content">
        <section className="mock-public-hero">
          <p className="mock-public-kicker">{c.kicker}</p>
          <h1>{c.h1}</h1>
          <p>{c.lead}</p>
        </section>
        <FlowchartWalk zh={zh} tutorials={tutorialTitles(zh)} />
      </main>
      <footer className="mock-public-footer">
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '灵神题单精选' : 'Ling’s Curated 500'}
        </Link>
        <Link href="/library?type=algorithm" prefetch={false}>
          {zh ? '算法教程' : 'Algorithm tutorials'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
