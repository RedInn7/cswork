import Link from 'next/link';
import { Suspense } from 'react';
import { CATEGORIES } from '@/components/company-stats-card';
import { PaletteButton } from '@/components/command-palette';
import { ROUND_LABELS } from '@/lib/experience';
import { companyHubPath } from '@/lib/oa-company-brands';
import { breadcrumbJsonLd, facetPageTitle, itemListJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { publicLibraryPath } from '@/lib/server/public-library';
import { facetPath, type FacetPage } from '@/lib/server/seo-facets';
import { LibraryPageView } from '../library/page-view';
import { Facts, QUESTION_LEVELS } from './parts';
import '../library/library.css';
import '../oa/oa.css';
import './company.css';
import './landing.css';

/**
 * Role and category landing pages, alone (/roles, /categories) or for one company
 * (/company/<employer>/role-…, cat-…): the latest experiences and questions under the facet,
 * with links across to the related pages. Data: lib/server/seo-facets.ts.
 */
const label = (kind: 'role' | 'cat', value: string, zh: boolean) =>
  kind === 'cat' && Object.hasOwn(CATEGORIES, value) ? CATEGORIES[value][zh ? 0 : 1] : value;
const spa = (params: Record<string, string>) => `/?${new URLSearchParams(params)}`;

function describe(page: FacetPage, zh: boolean) {
  const { facet, company } = page;
  const name = label(facet.kind, facet.value, zh);
  const parts = [
    facet.questions && (zh ? `${facet.questions} 道面试题` : `${facet.questions} interview ${facet.questions === 1 ? 'question' : 'questions'}`),
    facet.experiences && (zh ? `${facet.experiences} 篇面经` : `${facet.experiences} interview ${facet.experiences === 1 ? 'experience' : 'experiences'}`),
  ].filter(Boolean);
  const scope = company ? `${company.name} ` : '';
  return zh
    ? `${scope}${name}${facet.kind === 'role' ? '岗位' : '类'}面试准备：${parts.join('、')}，来自候选人真实面试。在 CSWork 阅读、练习、模拟。`
    : `Prepare for ${scope}${name}${facet.kind === 'role' ? ' interviews' : ' questions'}: ${parts.join(' and ')} from real interviews. Read, practise and mock them on CSWork.`;
}

export async function facetMetadata(page: FacetPage) {
  const locale = await requestLocale();
  const zh = locale === 'zh';
  const { facet, company } = page;
  return {
    ...seoMetadata({
      title: facetPageTitle(locale, facet.kind, label(facet.kind, facet.value, zh), company?.name),
      description: describe(page, zh),
      path: facetPath(facet.kind, facet.slug, company?.slug),
    }),
    // A page below the index threshold is still useful to a reader, not to search results.
    ...(page.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function FacetView({ page }: { page: FacetPage }) {
  const zh = (await requestLocale()) === 'zh';
  const { facet, company, experiences, questions, related } = page;
  const name = label(facet.kind, facet.value, zh);
  const path = facetPath(facet.kind, facet.slug, company?.slug);
  const heading = facetPageTitle(zh ? 'zh' : 'en', facet.kind, name, company?.name).replace(/ \| .*$/, '');
  const trail = [
    { name: 'CSWork', path: '/' },
    ...(company
      ? [{ name: company.name, path: companyHubPath(company.slug) }]
      : [{ name: facet.kind === 'role' ? (zh ? '岗位' : 'Roles') : zh ? '类别' : 'Categories', path }]),
    { name, path },
  ];
  // The SPA filters by one library spelling: the facet's and the company's most used ones.
  const filter = {
    [facet.kind === 'role' ? 'role' : 'category']: facet.value,
    ...(company?.library[0] && { company: company.library[0] }),
  };
  const items = [
    ...experiences.map((e) => ({ name: e.title, path: publicLibraryPath(e.type, e.slug) })),
    ...questions.map((q) => ({ name: q.title, path: publicLibraryPath(q.type, q.slug) })),
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(trail) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd(heading, items) }} />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/" prefetch={false}>
          CSWork
        </Link>
        {company && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={companyHubPath(company.slug)} prefetch={false}>
              {company.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>
      <header className="facet-head">
        <p className="public-library-eyebrow">
          {facet.kind === 'role' ? (zh ? '按岗位' : 'BY ROLE') : zh ? '按题目类别' : 'BY CATEGORY'}
          {company ? ` · ${company.name}` : ''}
        </p>
        <h1>{heading}</h1>
        <p className="public-library-summary">{describe(page, zh)}</p>
        <dl className="facet-figures">
          {!!facet.questions && (
            <div>
              <dt>{zh ? '面试题' : 'Questions'}</dt>
              <dd>{facet.questions}</dd>
            </div>
          )}
          {!!facet.experiences && (
            <div>
              <dt>{zh ? '面经' : 'Experiences'}</dt>
              <dd>{facet.experiences}</dd>
            </div>
          )}
          {facet.updatedAt && (
            <div>
              <dt>{zh ? '最近更新' : 'Updated'}</dt>
              <dd>{facet.updatedAt.slice(0, 10)}</dd>
            </div>
          )}
        </dl>
      </header>

      {!!experiences.length && (
        <section className="company-hub-section" aria-labelledby="facet-experiences">
          <div className="company-hub-section-head">
            <h2 id="facet-experiences">
              {zh ? '最新面经' : 'Latest interview experiences'} <small>{facet.experiences}</small>
            </h2>
            <a href={spa({ view: 'experiences', ...filter })}>
              {zh ? '在工作台筛选' : 'Filter in the workspace'} <span aria-hidden="true">→</span>
            </a>
          </div>
          <ul className="company-hub-cards">
            {experiences.slice(0, 12).map((item) => (
              <li key={item.slug}>
                <a href={publicLibraryPath(item.type, item.slug)}>{item.title}</a>
                <Facts item={item} zh={zh} />
                {item.role && facet.kind !== 'role' && <p className="company-hub-role">{item.role}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!questions.length && (
        <section className="company-hub-section" aria-labelledby="facet-questions">
          <div className="company-hub-section-head">
            <h2 id="facet-questions">
              {zh ? '面试题' : 'Interview questions'} <small>{facet.questions}</small>
            </h2>
            <a href={spa({ view: 'questions', ...filter })}>
              {zh ? '在工作台筛选' : 'Filter in the workspace'} <span aria-hidden="true">→</span>
            </a>
          </div>
          <ol className="oa-public-list company-hub-questions">
            {questions.map((item) => {
              const level = item.difficulty && Object.hasOwn(QUESTION_LEVELS, item.difficulty) ? item.difficulty : null;
              return (
                <li key={`${item.type}:${item.slug}`}>
                  <a href={publicLibraryPath(item.type, item.slug)}>
                    <span className="oa-public-number">
                      {item.type === 'coding_question' ? (zh ? '编程' : 'Code') : zh ? '面试' : 'Q'}
                    </span>
                    <span className="oa-public-title">
                      {item.title}
                      {!company && item.company && <span className="facet-company"> · {item.company}</span>}
                    </span>
                    {level ? (
                      <span className="oa-public-chip" data-level={level}>
                        {QUESTION_LEVELS[level][zh ? 0 : 1]}
                      </span>
                    ) : (
                      item.round && (
                        <span className="oa-public-chip">
                          {Object.hasOwn(ROUND_LABELS, item.round) ? ROUND_LABELS[item.round][zh ? 0 : 1] : item.round}
                        </span>
                      )
                    )}
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!!related.length && (
        <nav className="company-hub-section facet-related" aria-labelledby="facet-related">
          <h2 id="facet-related">
            {company
              ? zh
                ? `${company.name} 的其他岗位与类别`
                : `More ${company.name} roles and categories`
              : zh
                ? `按公司看${name}`
                : `${name} by company`}
          </h2>
          <ul>
            {related.map((r) => (
              <li key={r.path}>
                <a href={r.path}>
                  {company ? label(r.kind, r.name, zh) : r.name} <b>{r.n}</b>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

/** The public shell for /roles and /categories (the company pages have their own layout). */
export async function FacetShell({ children, section }: { children: React.ReactNode; section: [string, string] }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library oa-public company-hub" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {section[zh ? 0 : 1]}</span>
        </Link>
        <PaletteButton className="public-library-search" />
        <Link href="/?view=questions" prefetch={false}>
          {zh ? '打开练习工作台' : 'Open practice workspace'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/oa" prefetch={false}>
          {zh ? '全部公司 OA' : 'All company OAs'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料库' : 'Library'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私' : 'Privacy'}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
