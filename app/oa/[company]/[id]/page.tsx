import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import {
  OTHER_COMPANY,
  oaCompanyName,
  oaCompanyPath,
  oaProblemPath,
} from '@/lib/oa-company-brands';
import { oaStatementLang, oaStatementMarkdown } from '@/lib/oa-verified-statement';
import { breadcrumbJsonLd, oaPageTitle, seoMetadata } from '@/lib/seo';
import { icaTask } from '@/lib/server/ai-tasks';
import { HttpError } from '@/lib/server/http';
import { mockPresetFor } from '@/lib/server/mock-oa-presets';
import { requestLocale } from '@/lib/server/locale';
import { oaEnglishStatement, oaReadyProblems } from '@/lib/server/oa-judge';
import { oaDrillIndex, oaLibrary } from '@/lib/server/oa-library';
import { oaDifficulty, oaTopic } from '@/lib/server/oa-topics';
import { getPublicOaProblem } from '@/lib/server/oj-problems';
import { OA_KIND_NAMES, stopHref, topicName } from '@/lib/route-stops';
import { publicLibraryDescription } from '@/lib/server/public-library';
import { PublicLibraryMarkdown } from '../../../library/markdown';
import { OaCompanyMark, OaDifficulty } from '../../parts';

type Props = { params: Promise<{ company: string; id: string }> };
/** Four-level OAs left unjudged for their unclear rules: the ICA set closest to each (/oa/ica). */
const ICA_TWINS: Record<string, string> = {
  'oa-meta-11': 'bank-ledger',
  'oa-visa-9': 'bank-ledger',
  'oa-ramp-1': 'bank-ledger',
  'oa-ramp-3': 'bank-ledger',
  'oa-ziprecruiter-1': 'bank-ledger',
  'oa-tradedesk-1': 'file-store',
};
const load = cache(async (slug: string, id: string) => {
  // Same gates as the OA API: hidden companies 404, and only the canonical company path exists.
  const found = oaLibrary().problem(id);
  if (!found || found.company.slug !== slug) notFound();
  const { item, company } = found;
  // Judge-ready problems show the verified package (the statement learners submit against);
  // the rest show the catalog text, exactly like /api/oj/oa-library/<id>.
  const judged = await getPublicOaProblem(id).catch((error: unknown) => {
    if (error instanceof HttpError) return null;
    throw error;
  });
  const locale = await requestLocale();
  const english = judged && locale === 'en' ? oaEnglishStatement(id) : undefined;
  const statement = judged
    ? oaStatementMarkdown(english || judged, judged.samples, locale)
    : item.statement;
  const name = oaCompanyName(company.slug, company.name, locale);
  const listed = oaLibrary().company(company.slug, new Set((await oaReadyProblems()).keys()));
  const siblings = listed?.items ?? [];
  const at = siblings.findIndex((sibling) => sibling.id === id);
  return {
    item,
    company,
    judged,
    statement,
    // Verified packages are Chinese and their translations English; catalog text varies.
    statementLang: judged ? (english ? 'en' : 'zh-CN') : oaStatementLang(statement),
    // Title only: no statement and nothing to judge, so not worth indexing.
    thin: !judged && !statement.trim(),
    // A mock needs a preset page and only draws judge-ready problems.
    mock:
      company.slug !== OTHER_COMPANY && listed?.company.ready
        ? (mockPresetFor(company.slug)?.slug ?? null)
        : null,
    locale,
    name,
    // Debugging drills (the API serves them signed in); only a judge-ready problem can be fixed.
    drills: judged ? oaDrillIndex().get(id) : undefined,
    previous: siblings[at - 1],
    next: siblings[at + 1],
  };
});

export async function generateMetadata({ params }: Props) {
  const { company, id } = await params;
  const page = await load(company, id);
  return {
    ...seoMetadata({
      title: oaPageTitle(page.locale, page.name, page.item.title),
      description: publicLibraryDescription({
        title: page.item.title,
        summary: null,
        body: page.statement,
      }),
      path: oaProblemPath(page.company.slug, page.item.id),
    }),
    ...(page.thin ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function OaProblemPage({ params }: Props) {
  const { company: slug, id } = await params;
  const page = await load(slug, id);
  const { item, company, judged, statement, statementLang, mock, locale, name } = page;
  const zh = locale === 'zh';
  const topic = oaTopic(item.id);
  const kind = topic && Object.hasOwn(OA_KIND_NAMES, topic.k) ? OA_KIND_NAMES[topic.k] : null;
  const twin = Object.hasOwn(ICA_TWINS, item.id) ? icaTask(ICA_TWINS[item.id]) : undefined;
  return (
    <article className="public-library-article oa-public-problem">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name, path: oaCompanyPath(company.slug) },
            { name: item.title, path: oaProblemPath(company.slug, item.id) },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <a href={oaCompanyPath(company.slug)}>{name}</a>
      </nav>
      <header className="oa-public-ticket">
        <p className="oa-public-ticket-line">
          <OaCompanyMark slug={company.slug} name={name} />
          <span>{name}</span>
          <span aria-hidden="true">·</span>
          <span className="oa-public-number">OA #{item.number}</span>
        </p>
        <h1>{item.title}</h1>
        <p className="oa-public-ticket-status">
          <OaDifficulty {...oaDifficulty(item.id, judged?.difficulty)} locale={locale} />
          {kind && (
            <span className="oa-public-chip" data-level="kind">
              {kind[zh ? 0 : 1]}
            </span>
          )}
          {judged ? (
            <span className="oa-public-chip" data-level="ready">
              {zh ? '可在线判题' : 'Judge-ready'}
            </span>
          ) : (
            <span className="oa-public-chip" data-level="reading">
              {zh ? '评测数据准备中，可先阅读题面' : 'Statement only — judging is being prepared'}
            </span>
          )}
        </p>
        {topic && topic.t.length > 0 && (
          <p className="oa-public-ticket-topics">
            <span>{zh ? '考点（AI 标注）' : 'Topics (AI-labelled)'}</span>
            {topic.t.map((slug) => {
              const href = stopHref(slug);
              return href ? (
                <a
                  key={slug}
                  href={href}
                  title={zh ? '去 500 路这一站练习' : 'Practise this stop on Line 500'}
                >
                  {topicName(slug, zh)}
                </a>
              ) : (
                <b key={slug}>{topicName(slug, zh)}</b>
              );
            })}
          </p>
        )}
        {(judged || mock) && (
          <div className="oa-public-actions">
            {judged && (
              <a
                className="oa-public-cta"
                href={`/?${new URLSearchParams({ view: 'problem', problem: item.id })}`}
              >
                {zh ? '在线判题' : 'Run & submit'}
              </a>
            )}
            {mock && (
              <a
                className={judged ? 'oa-public-cta is-quiet' : 'oa-public-cta'}
                href={`/mock-oa/${mock}`}
              >
                {zh ? `模拟 ${name} OA` : `Mock ${name} OA`}
              </a>
            )}
            {page.drills && (
              <>
                <a
                  className="oa-public-cta is-quiet"
                  href={`/?${new URLSearchParams({ view: 'problem', problem: item.id, drill: String(page.drills[0]) })}`}
                >
                  {zh ? '调试练习' : 'Debugging drill'}
                </a>
                <a className="oa-public-cta is-quiet" href={`/oa/drills/review/${encodeURIComponent(item.id)}`}>
                  {zh ? '代码评审练习' : 'Code review drill'}
                </a>
              </>
            )}
          </div>
        )}
        {twin && (
          <p className="oa-public-actions">
            <a className="oa-public-cta is-quiet" href={`/oa/ica/${twin.slug}`}>
              {zh ? `同类可判练习：${twin.title[0]}（四关递进）` : `Judged practice of this kind: ${twin.title[1]} (four levels)`}
            </a>
          </p>
        )}
      </header>
      {statement.trim() ? (
        // Server twin of the OA reader's OaMarkdown: same link and image policy, no client code.
        <div className="public-library-prose" lang={statementLang}>
          <PublicLibraryMarkdown body={statement} math={false} />
        </div>
      ) : (
        <p className="public-library-empty">
          {zh ? '原站未提供独立题面。' : 'The source has no standalone statement.'}
        </p>
      )}
      {(page.previous || page.next) && (
        <nav className="oa-public-pager" aria-label={zh ? `更多 ${name} OA 题` : `More ${name} OA problems`}>
          {page.previous ? (
            <a rel="prev" href={oaProblemPath(company.slug, page.previous.id)}>
              <span>{zh ? '← 上一题' : '← Previous'}</span>
              {page.previous.title}
            </a>
          ) : (
            <span />
          )}
          {page.next && (
            <a rel="next" href={oaProblemPath(company.slug, page.next.id)}>
              <span>{zh ? '下一题 →' : 'Next →'}</span>
              {page.next.title}
            </a>
          )}
        </nav>
      )}
    </article>
  );
}
