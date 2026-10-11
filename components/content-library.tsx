'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Building2, ChevronDown, Search, X } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { companyLogos } from '@/lib/oa-company-brands';
import type { Navigate } from './learning';
import { OaMarkdown } from './oa-library';
import '@/app/redesign.css';
import '@/app/content-library.css';

type Facet = { value: string; label: string; n: number };
type Facets = {
  companies: Facet[];
  companyTotal: number;
  roles: Facet[];
  categories: Facet[];
  difficulties: Facet[];
  rounds: Facet[];
  total: number;
};
export type ContentSummary = {
  type: string;
  slug: string;
  title: string;
  summary: string | null;
  company: { slug: string; name: string } | null;
  role: string | null;
  category: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  round: string | null;
  seniority: string | null;
  tags: string[];
  publishedAt: string | null;
  partial: boolean;
  /** Bilingual tutorials only. */
  titleZh?: string | null;
  summaryZh?: string | null;
  level?: 'core' | 'advanced' | null;
};
/** Tutorials are bilingual: Chinese readers get the Chinese text when there is one. */
const localized = (locale: string, en: string, zh?: string | null) =>
  locale === 'zh' && zh ? zh : en;
type ListPage = {
  items: ContentSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets: Facets | null;
};
type Relation = {
  kind: string;
  type: string;
  slug: string;
  title: string;
  company_name: string | null;
  difficulty: string | null;
};
type Detail = ContentSummary & {
  body: string;
  updatedAt: string | null;
  extra: {
    constraints?: string[];
    /** Chinese body of a bilingual tutorial. */
    bodyZh?: string;
    result?: string;
    faq?: { q: string; a: string }[];
  };
  relations: Relation[];
  /** `problem` is the judge problem id when the bank has one for it. */
  dupOf: { kind: 'oa' | 'library' | 'prachub'; id: string; title?: string; problem?: string } | null;
};

/**
 * Sections of the library and the content types behind them. Texts are [zh, en];
 * tabs are [type, zh, en].
 */
export const CONTENT_SECTIONS: Record<
  string,
  { title: [string, string]; lead: [string, string]; tabs: [string, string, string][] }
> = {
  questions: {
    title: ['面试题', 'Interview Questions'],
    lead: [
      '来自真实面试的编程、系统设计、行为与基础题，按公司、岗位和轮次整理。',
      'Coding, system design, behavioral and fundamentals questions from real interviews, organized by company, role and round.',
    ],
    tabs: [
      ['questions', '全部', 'All'],
      ['coding_question', '编程题', 'Coding'],
      ['interview_question', '面试题', 'Interview Questions'],
    ],
  },
  experiences: {
    title: ['面经', 'Interview Experiences'],
    lead: [
      '候选人亲历的面试流程、题目和结果，按公司和岗位查找。',
      'Real interview processes, questions and outcomes shared by candidates. Browse by company and role.',
    ],
    tabs: [['experience', '全部面经', 'All experiences']],
  },
  resources: {
    title: ['学习资料', 'Resources'],
    lead: [
      '面试向的算法专题、公司面试指南、核心概念、文章和速查表。',
      'Interview-focused algorithm tutorials, company interview guides, core concepts, articles and cheatsheets.',
    ],
    tabs: [
      ['algorithm', '算法专题', 'Algorithms'],
      ['guide', '面试指南', 'Interview Guides'],
      ['concept', '概念', 'Concepts'],
      ['article', '文章', 'Articles'],
      ['cheatsheet', '速查表', 'Cheatsheets'],
    ],
  },
};
/** One item's type as [zh, en]; the plural English names live in the section tabs. */
const TYPE_NAMES: Record<string, [string, string]> = {
  coding_question: ['编程题', 'Coding'],
  interview_question: ['面试题', 'Interview question'],
  experience: ['面经', 'Interview experience'],
  guide: ['面试指南', 'Interview guide'],
  concept: ['概念', 'Concept'],
  article: ['文章', 'Article'],
  cheatsheet: ['速查表', 'Cheatsheet'],
  algorithm: ['算法专题', 'Algorithm tutorial'],
};
/** The list view an item of this type belongs to. */
export const contentSection = (type: string | undefined) =>
  (type && Object.hasOwn(SECTION_OF, type) && SECTION_OF[type]) || 'resources';
const SECTION_OF: Record<string, string> = {
  coding_question: 'questions',
  interview_question: 'questions',
  experience: 'experiences',
};
/** [zh, en] */
const DIFFICULTY: Record<string, [string, string]> = {
  easy: ['简单', 'Easy'],
  medium: ['中等', 'Medium'],
  hard: ['困难', 'Hard'],
};
/** The label for `key` in a [zh, en] map, or undefined when the map has none. */
const labelOf = (
  t: (zh: string, en: string) => string,
  map: Record<string, [string, string]>,
  key: string,
) => (Object.hasOwn(map, key) ? t(...map[key]) : undefined);

function CompanyMark({ company }: { company: { slug: string; name: string } }) {
  const logo = Object.hasOwn(companyLogos, company.slug) ? companyLogos[company.slug] : null;
  return (
    <>
      {logo && (
        <span className="ct-logo" aria-hidden="true">
          {/* oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name. */}
          <img src={logo} alt="" width={16} height={16} loading="lazy" />
        </span>
      )}
      <span className="rd-badge is-brand">{company.name}</span>
    </>
  );
}

export function ContentMeta({ item }: { item: ContentSummary }) {
  const t = useT();
  return (
    <div className="ct-meta">
      {item.company && <CompanyMark company={item.company} />}
      {item.difficulty && (
        <span className={`ct-diff is-${item.difficulty}`}>
          <span className="ct-diff-dot" aria-hidden="true" />
          {labelOf(t, DIFFICULTY, item.difficulty)}
        </span>
      )}
      {item.level && (
        <span className={`rd-badge${item.level === 'advanced' ? ' is-warn' : ''}`}>
          {item.level === 'advanced' ? t('拓展', 'Advanced') : t('核心', 'Core')}
        </span>
      )}
      {[item.role, item.round, item.seniority].filter(Boolean).map((label) => (
        <span key={label} className="ct-meta-text">
          {label}
        </span>
      ))}
    </div>
  );
}

export function ContentCard({
  item,
  onOpen,
}: {
  item: ContentSummary;
  onOpen: (item: ContentSummary) => void;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <button type="button" className="rd-card ct-card" onClick={() => onOpen(item)}>
      <ContentMeta item={item} />
      <h3>{localized(locale, item.title, item.titleZh)}</h3>
      {item.summary && (
        <p className="ct-summary">{localized(locale, item.summary, item.summaryZh)}</p>
      )}
      <div className="ct-foot">
        <span className="ct-tags">
          {item.category && <span className="ct-tag">{item.category}</span>}
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="ct-tag">
              {tag}
            </span>
          ))}
        </span>
        <span className="ct-date">
          {labelOf(t, TYPE_NAMES, item.type)}
          {item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''}
        </span>
      </div>
    </button>
  );
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Facet[];
  onChange: (value: string) => void;
}) {
  const t = useT();
  if (!options.length) return null;
  // The menu lists the most common values; a value from a link may not be among them.
  const all = value && !options.some((o) => o.value === value) ? [{ value, label: value, n: 0 }, ...options] : options;
  return (
    <label className={`rd-chip ${value ? 'is-set' : ''}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {all.map((o) => (
          <option key={o.value} value={o.value}>
            {labelOf(t, DIFFICULTY, o.value) ?? o.label}
            {o.n ? ` · ${o.n}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
    </label>
  );
}

const FILTERS = ['type', 'kind', 'company', 'role', 'category', 'difficulty', 'round', 'q', 'page'] as const;

export function ContentList({
  section,
  params,
  navigate,
}: {
  section: string;
  params: Record<string, string>;
  navigate: Navigate;
}) {
  const t = useT();
  const meta = CONTENT_SECTIONS[section];
  const type = params.type && meta.tabs.some(([tab]) => tab === params.type) ? params.type : meta.tabs[0][0];
  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of FILTERS) if (params[key]) out[key] = params[key];
    out.type = type;
    return out;
  }, [params, type]);
  const query = new URLSearchParams(filters).toString();
  const [page, setPage] = useState<{ query: string; data: ListPage } | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState(params.q || '');
  // Back/forward or the sidebar can change the search; the box follows the URL.
  const [shownQ, setShownQ] = useState(params.q);
  if (shownQ !== params.q) {
    setShownQ(params.q);
    setText(params.q || '');
  }
  useEffect(() => {
    let cancelled = false;
    api<ListPage>(`content/list?${query}`)
      .then((data) => !cancelled && (setPage({ query, data }), setError('')))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [query]);
  const data = page?.query === query ? page.data : null;
  const apply = (next: Record<string, string>) => {
    const merged: Record<string, string> = { ...filters, page: '', ...next };
    for (const key of Object.keys(merged)) if (!merged[key]) delete merged[key];
    navigate(section, merged);
  };
  const pageNo = Number(filters.page) || 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const open = (item: ContentSummary) => navigate('content', { type: item.type, slug: item.slug });

  return (
    <div className="rd">
      <div className="rd-page">
        <header className="rd-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
          <h1>{t(...meta.title)}</h1>
          <p>{t(...meta.lead)}</p>
        </header>
        <div className="rd-stats rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <div>
            <div className="rd-stat-label">
              <BookOpen size={13} />{' '}
              {Object.hasOwn(TYPE_NAMES, type)
                ? t(TYPE_NAMES[type][0], meta.tabs.find(([tab]) => tab === type)![2])
                : t('内容', 'Content')}
            </div>
            <div className="rd-stat-value">{data?.facets ? data.facets.total.toLocaleString() : '—'}</div>
          </div>
          {type !== 'algorithm' && (
            <div>
              <div className="rd-stat-label">
                <Building2 size={13} /> {t('公司', 'Companies')}
              </div>
              <div className="rd-stat-value">{data?.facets ? data.facets.companyTotal.toLocaleString() : '—'}</div>
            </div>
          )}
        </div>

        <div className="ct-toolbar rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
          {meta.tabs.length > 1 && (
            <fieldset className="rd-segment">
              <legend className="sr-only">{t('内容类型', 'Content type')}</legend>
              {meta.tabs.map(([value, zh, en]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => apply({ type: value, kind: '', company: '', role: '', category: '', difficulty: '', round: '' })}
                >
                  {t(zh, en)}
                </button>
              ))}
            </fieldset>
          )}
          <form
            className="rd-search ct-search"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ q: text.trim() });
            }}
          >
            <Search size={14} aria-hidden="true" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('搜索标题和内容，回车', 'Search titles and content, press Enter')}
              aria-label={t('搜索', 'Search')}
            />
            {filters.q && (
              <button type="button" aria-label={t('清除搜索', 'Clear search')} onClick={() => (setText(''), apply({ q: '' }))}>
                <X size={13} />
              </button>
            )}
          </form>
        </div>
        {data?.facets && (
          <div className="rd-toolbar ct-facets">
            <FacetSelect label={t('公司', 'Company')} value={filters.company || ''} options={data.facets.companies} onChange={(v) => apply({ company: v })} />
            <FacetSelect label={t('岗位', 'Role')} value={filters.role || ''} options={data.facets.roles} onChange={(v) => apply({ role: v })} />
            <FacetSelect label={t('类别', 'Category')} value={filters.category || ''} options={data.facets.categories} onChange={(v) => apply({ category: v })} />
            <FacetSelect label={t('难度', 'Difficulty')} value={filters.difficulty || ''} options={data.facets.difficulties} onChange={(v) => apply({ difficulty: v })} />
            <FacetSelect label={t('轮次', 'Round')} value={filters.round || ''} options={data.facets.rounds} onChange={(v) => apply({ round: v })} />
          </div>
        )}

        {error && (
          <div className="js-error" role="alert">
            {t(error, englishMessage(error))}
          </div>
        )}
        {!data ? (
          <div className="ct-list" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rd-card ct-card ct-skeleton" />
            ))}
          </div>
        ) : data.items.length ? (
          <>
            <div className="ct-list-head">
              {t(
                `共 ${data.total.toLocaleString()} 条`,
                `${data.total.toLocaleString()} ${data.total === 1 ? 'result' : 'results'}`,
              )}
              {filters.q
                ? t('，按相关度排序', ', sorted by relevance')
                : type === 'algorithm'
                  ? t('，核心专题在前', ', core topics first')
                  : t('，最新的在前', ', newest first')}
            </div>
            <div className="ct-list">
              {data.items.map((item) => (
                <ContentCard key={`${item.type}:${item.slug}`} item={item} onOpen={open} />
              ))}
            </div>
            {pages > 1 && (
              <nav className="ct-pager" aria-label={t('分页', 'Pagination')}>
                <button type="button" className="rd-button is-quiet" disabled={pageNo <= 1} onClick={() => apply({ page: String(pageNo - 1) })}>
                  <ArrowLeft size={14} /> {t('上一页', 'Previous')}
                </button>
                <span>{t(`第 ${pageNo} / ${pages} 页`, `Page ${pageNo} of ${pages}`)}</span>
                <button type="button" className="rd-button is-quiet" disabled={pageNo >= pages} onClick={() => apply({ page: String(pageNo + 1) })}>
                  {t('下一页', 'Next')} <ArrowRight size={14} />
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="rd-card js-empty">
            <strong>{data.facets ? t('没有符合条件的内容', 'No matching content') : t('内容正在整理中', 'Content coming soon')}</strong>
            <span>
              {data.facets
                ? t('换个筛选条件或关键词试试。', 'Try different filters or keywords.')
                : t('稍后再来看看。', 'Check back later.')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContentDetail({
  params,
  navigate,
  problemIds,
}: {
  params: Record<string, string>;
  navigate: Navigate;
  /** Judge problems this visitor can open. */
  problemIds: string[];
}) {
  const t = useT();
  const locale = useLocale();
  const key = `${params.type}:${params.slug}`;
  const [state, setState] = useState<{ key: string; item?: Detail; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Detail>(`content/item?type=${encodeURIComponent(params.type || '')}&slug=${encodeURIComponent(params.slug || '')}`)
      .then((item) => !cancelled && setState({ key, item }))
      .catch((e: Error) => !cancelled && setState({ key, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [key, params.type, params.slug]);
  const current = state?.key === key ? state : null;
  const item = current?.item;
  const dup = item?.dupOf;
  const judgeable = !!dup?.problem && problemIds.includes(dup.problem);
  const section = contentSection(params.type);
  const back = () => navigate(section, section === 'resources' ? { type: params.type } : {});

  return (
    <div className="rd">
      <div className="rd-page ct-detail">
        <nav className="ct-crumbs">
          <button type="button" onClick={back}>
            <ArrowLeft size={14} /> {t(...CONTENT_SECTIONS[section].title)}
          </button>
          {item?.company && <span>/ {item.company.name}</span>}
        </nav>
        {!current ? (
          <div className="rd-card ct-card ct-skeleton" aria-busy="true" />
        ) : current.error || !item ? (
          <div className="rd-card js-empty">
            <strong>{t('没有找到这篇内容', 'Content not found')}</strong>
            <span>{current.error && t(current.error, englishMessage(current.error))}</span>
          </div>
        ) : (
          <>
            <header className="ct-detail-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
              <ContentMeta item={item} />
              <h1>{localized(locale, item.title, item.titleZh)}</h1>
              {item.summary && (
                <p className="ct-lead">{localized(locale, item.summary, item.summaryZh)}</p>
              )}
            </header>
            {dup && dup.kind !== 'prachub' && (
              <div className="ct-callout rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
                <span>
                  {judgeable
                    ? t(
                        '这道题已收录在算法题库，可以直接在线写代码、提交评测。',
                        'This problem is in the Problem Bank, so you can write code and submit it online.',
                      )
                    : t(
                        `算法题库里已有这道题：${dup.title || dup.id}`,
                        `The Problem Bank already has this problem: ${dup.title || dup.id}`,
                      )}
                </span>
                <button
                  type="button"
                  className="rd-button"
                  onClick={() =>
                    judgeable
                      ? navigate('problem', { problem: dup.problem! })
                      : navigate('problems', dup.kind === 'oa' ? { library: 'oa' } : {})
                  }
                >
                  {judgeable ? t('去做题', 'Go to problem') : t('打开题库', 'Open Problem Bank')}{' '}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {dup?.kind === 'prachub' && /^(cq|iq)-/.test(dup.id) && (
              <div className="ct-callout rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
                <span>
                  {t('这道题有更完整的版本：', 'A more complete version of this question: ')}
                  {dup.title || dup.id}
                </span>
                <button
                  type="button"
                  className="rd-button"
                  onClick={() =>
                    navigate('content', {
                      type: dup.id.startsWith('cq-') ? 'coding_question' : 'interview_question',
                      slug: dup.id.slice(3),
                    })
                  }
                >
                  {t('查看', 'Open')} <ArrowRight size={14} />
                </button>
              </div>
            )}
            <article className="rd-card ct-body rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <OaMarkdown body={localized(locale, item.body, item.extra.bodyZh)} />
            </article>
            {!!item.extra.faq?.length && (
              <section className="ct-section">
                <h2>{t('常见问题', 'FAQ')}</h2>
                {item.extra.faq.map((f, i) => (
                  <details key={i} className="rd-card ct-faq">
                    <summary>{f.q}</summary>
                    <OaMarkdown body={f.a} />
                  </details>
                ))}
              </section>
            )}
            {!!item.relations.length && (
              <section className="ct-section">
                <h2>{t('相关内容', 'Related content')}</h2>
                <div className="ct-related">
                  {item.relations.map((rel) => (
                    <button
                      key={`${rel.type}:${rel.slug}`}
                      type="button"
                      className="rd-card ct-related-item"
                      onClick={() => navigate('content', { type: rel.type, slug: rel.slug })}
                    >
                      <span className="rd-badge">{labelOf(t, TYPE_NAMES, rel.type) || rel.type}</span>
                      <span>{rel.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
