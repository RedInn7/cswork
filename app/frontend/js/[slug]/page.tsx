import '../../../editor.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import track from '@/lib/content/frontend-js.json';
import { JsWorkspace, type JsProblemView } from '@/components/js-workspace';
import { breadcrumbJsonLd, seoMetadata, SITE_NAME } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';

type Props = { params: Promise<{ slug: string }> };
const problemAt = (slug: string) => track.problems.findIndex((p) => p.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const problem = track.problems[problemAt(slug)];
  if (!problem) return {};
  const zh = (await requestLocale()) === 'zh';
  const title = zh ? problem.title.zh : problem.title.en;
  // The statement's first paragraph, without Markdown backticks.
  const lead = (zh ? problem.statement.zh : problem.statement.en).split('\n\n')[0].replace(/`/g, '');
  return seoMetadata({
    title: zh ? `${title}：JavaScript 手写题 | ${SITE_NAME}` : `${title}: JavaScript Practice Problem | ${SITE_NAME}`,
    description: lead.slice(0, 300),
    path: `/frontend/js/${slug}`,
  });
}

/** /frontend/js/<slug>: one JS problem, run against its tests in the browser sandbox. */
export default async function FrontendJsPage({ params }: Props) {
  const { slug } = await params;
  const at = problemAt(slug);
  const problem = track.problems[at];
  if (!problem) notFound();
  const zh = (await requestLocale()) === 'zh';
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const next = track.problems[at + 1];
  // Only this problem, in the page's language, goes to the browser.
  const view: JsProblemView = {
    slug,
    title: zh ? problem.title.zh : problem.title.en,
    difficulty: problem.difficulty as JsProblemView['difficulty'],
    statement: zh ? problem.statement.zh : problem.statement.en,
    editorial: zh ? problem.editorial.zh : problem.editorial.en,
    starter: problem.starter,
    solution: problem.solution,
    tests: problem.tests,
    cases: problem.cases,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: zh ? '前端' : 'Frontend', path: '/frontend' },
            { name: view.title, path: `/frontend/js/${slug}` },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/frontend" prefetch={false}>
          {zh ? '前端' : 'Frontend'}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{view.title}</span>
      </nav>
      <JsWorkspace
        problem={view}
        harness={track.harness}
        signedIn={!!viewer}
        next={next && { href: `/frontend/js/${next.slug}`, title: zh ? next.title.zh : next.title.en }}
      />
    </>
  );
}
