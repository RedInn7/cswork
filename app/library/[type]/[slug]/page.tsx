import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import 'katex/dist/katex.min.css';
import { PublicLibraryMarkdown } from '../../markdown';
import { seoMetadata } from '@/lib/seo';
import { lcIdBySource } from '@/lib/company-tags';
import { RESULTS, ROUND_LABELS, type ExperienceFacts } from '@/lib/experience';
import { companyHubPath } from '@/lib/oa-company-brands';
import { companyPractice, type CompanyPractice } from '@/lib/server/company-hub';
import { library } from '@/lib/server/content-library';
import {
  PUBLIC_LIBRARY_TYPES,
  publicLibraryItem,
  publicLibraryPath,
  publicLibraryDescription,
} from '@/lib/server/public-library';

type Props = { params: Promise<{ type: string; slug: string }> };
const readItem = cache(publicLibraryItem);
async function load(params: Props['params']) {
  const { type, slug } = await params;
  const item = readItem(type, slug);
  if (!item) notFound();
  return item;
}

export async function generateMetadata({ params }: Props) {
  const item = await load(params);
  return {
    ...seoMetadata({
      title: item.title,
      description: publicLibraryDescription(item),
      path: publicLibraryPath(item.type, item.slug),
    }),
    ...(item.type === 'guide'
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

/** An experience's self-reported outcome, rounds and interview month: labels, not rates. */
function Facts({ facts }: { facts: ExperienceFacts }) {
  const result = facts.result ? RESULTS[facts.result] : null;
  const rounds = facts.rounds.map((r) => (Object.hasOwn(ROUND_LABELS, r) ? ROUND_LABELS[r][1] : r));
  if (!result && !rounds.length && !facts.interviewDate) return null;
  return (
    <p className="public-library-facts">
      {result && <span data-tone={result.tone}>{result.en}</span>}
      {!!rounds.length && <span>{rounds.join(' → ')}</span>}
      {facts.interviewDate && <span>Interviewed {facts.interviewDate.slice(0, 7)}</span>}
    </p>
  );
}

/** "Practise this company": judgeable OA problems, a timed mock and the most reported LeetCode problems. */
function Practice({ practice }: { practice: CompanyPractice }) {
  return (
    <aside className="public-library-practice" aria-labelledby="practice-title">
      <p className="public-library-practice-eyebrow">PRACTISE THIS COMPANY</p>
      <h2 id="practice-title">{practice.name}</h2>
      <p lang="zh">练这家公司：OA 真题、限时模拟和面经里的高频 LeetCode 题。</p>
      {(practice.oaReady > 0 || practice.mock) && (
        <div className="public-library-practice-row">
          {practice.oaReady > 0 && (
            <a href={`/?${new URLSearchParams({ view: 'problems', library: 'oa', company: practice.slug })}`}>
              <strong>{practice.oaReady}</strong> judge-ready OA {practice.oaReady === 1 ? 'problem' : 'problems'}
            </a>
          )}
          {practice.mock && (
            <a className="public-library-practice-cta" href={`/mock-oa/${practice.mock}`}>
              Take a timed mock OA →
            </a>
          )}
        </div>
      )}
      {!!practice.top.length && (
        <ol className="public-library-practice-lc" aria-label="Most reported LeetCode problems">
          {practice.top.map((p) => (
            <li key={p.id}>
              <a href={`/?view=problem&problem=${encodeURIComponent(p.id)}`}>
                <span>LC {p.number}</span> {p.titleEn || p.titleZh}{' '}
                <small>
                  {p.count} {p.count === 1 ? 'report' : 'reports'}
                </small>
              </a>
            </li>
          ))}
        </ol>
      )}
      {practice.hub && (
        <Link href={companyHubPath(practice.slug)} prefetch={false}>
          {practice.name} interview questions, OA and experiences →
        </Link>
      )}
    </aside>
  );
}

export default async function PublicLibraryDetail({ params }: Props) {
  const item = await load(params);
  // A coding question with a judgeable LeetCode match links straight to it.
  const practice =
    item.type === 'coding_question' ? lcIdBySource.get(item.slug) : undefined;
  // Experiences and interview questions point at practice for their company.
  const company =
    item.type === 'experience' || item.type === 'interview_question'
      ? await companyPractice(library(), item.companySlug)
      : null;
  return (
    <article className="public-library-article">
      <nav className="public-library-breadcrumb" aria-label="Breadcrumb">
        <Link href="/library" prefetch={false}>
          Library
        </Link>
        <span aria-hidden="true">/</span>
        <a href={`/library?type=${item.type}`}>
          {PUBLIC_LIBRARY_TYPES[item.type]}
        </a>
      </nav>
      <header className="public-library-article-header">
        <p className="public-library-eyebrow">
          {PUBLIC_LIBRARY_TYPES[item.type]}
          {item.company ? ` · ${item.company}` : ''}
        </p>
        <h1>{item.title}</h1>
        {item.facts && <Facts facts={item.facts} />}
        {item.summary && (
          <p className="public-library-summary">{item.summary}</p>
        )}
      </header>
      <div className="public-library-prose">
        <PublicLibraryMarkdown body={item.body} math={item.math} />
      </div>
      {company ? (
        <Practice practice={company} />
      ) : practice ? (
        <aside className="public-library-next">
          <h2>Practice this problem here.</h2>
          <p lang="zh">在 CSWork 上在线写代码、提交评测。</p>
          <Link
            href={`/?view=problem&problem=${encodeURIComponent(practice)}`}
            prefetch={false}
          >
            Write code for LeetCode {practice.slice(3)} →
          </Link>
        </aside>
      ) : (
        <aside className="public-library-next">
          <h2>Put what you learned into practice.</h2>
          <p>Work through coding problems in the cswork practice workspace.</p>
          <Link href="/?view=problems" prefetch={false}>
            Explore the problem bank →
          </Link>
        </aside>
      )}
    </article>
  );
}
