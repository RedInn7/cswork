'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Building2, ChevronDown, Search, X } from 'lucide-react';
import { api } from '@/lib/types';
import { companyLogos } from '@/lib/oa-company-brands';
import type { Navigate } from './learning';
import { OaMarkdown } from './oa-library';
import '@/app/redesign.css';
import '@/app/content-library.css';

type Facet = { value: string; label: string; n: number };
type Facets = {
  companies: Facet[];
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
};
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
    samples?: { input: string; output: string; explanation?: string }[];
    constraints?: string[];
    chapters?: { title: string; lessons: { slug: string; title: string; free?: boolean }[] }[];
    course?: string;
    result?: string;
    faq?: { q: string; a: string }[];
  };
  relations: Relation[];
  dupOf: { kind: 'oa' | 'library' | 'prachub'; id: string; title?: string } | null;
};

/** Sections of the library and the content types behind them. */
export const CONTENT_SECTIONS: Record<
  string,
  { title: string; lead: string; tabs: [string, string][] }
> = {
  questions: {
    title: '面试题',
    lead: '来自真实面试的编程、系统设计、行为与基础题，按公司、岗位和轮次整理。',
    tabs: [
      ['questions', '全部'],
      ['coding_question', '编程题'],
      ['interview_question', '面试题'],
    ],
  },
  experiences: {
    title: '面经',
    lead: '候选人亲历的面试流程、题目和结果，按公司和岗位查找。',
    tabs: [['experience', '全部面经']],
  },
  resources: {
    title: '学习资料',
    lead: '公司面试指南、核心概念、文章、速查表和公开课。',
    tabs: [
      ['guide', '面试指南'],
      ['concept', '概念'],
      ['article', '文章'],
      ['cheatsheet', '速查表'],
      ['course', '公开课'],
    ],
  },
};
const TYPE_NAMES: Record<string, string> = {
  coding_question: '编程题',
  interview_question: '面试题',
  experience: '面经',
  guide: '面试指南',
  concept: '概念',
  article: '文章',
  cheatsheet: '速查表',
  course: '公开课',
  lesson: '课时',
};
const SECTION_OF: Record<string, string> = {
  coding_question: 'questions',
  interview_question: 'questions',
  experience: 'experiences',
};
const DIFFICULTY: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' };

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
  return (
    <div className="ct-meta">
      {item.company && <CompanyMark company={item.company} />}
      {item.difficulty && (
        <span className={`ct-diff is-${item.difficulty}`}>
          <span className="ct-diff-dot" aria-hidden="true" />
          {DIFFICULTY[item.difficulty]}
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
  return (
    <button type="button" className="rd-card ct-card" onClick={() => onOpen(item)}>
      <ContentMeta item={item} />
      <h3>{item.title}</h3>
      {item.summary && <p className="ct-summary">{item.summary}</p>}
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
          {TYPE_NAMES[item.type]}
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
  if (!options.length) return null;
  return (
    <label className={`rd-chip ${value ? 'is-set' : ''}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value in DIFFICULTY ? DIFFICULTY[o.value] : o.label} · {o.n}
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
  const meta = CONTENT_SECTIONS[section];
  const type = params.type && meta.tabs.some(([t]) => t === params.type) ? params.type : meta.tabs[0][0];
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
          <h1>{meta.title}</h1>
          <p>{meta.lead}</p>
        </header>
        <div className="rd-stats rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <div>
            <div className="rd-stat-label">
              <BookOpen size={13} /> {TYPE_NAMES[type] || '内容'}
            </div>
            <div className="rd-stat-value">{data?.facets ? data.facets.total.toLocaleString() : '—'}</div>
          </div>
          <div>
            <div className="rd-stat-label">
              <Building2 size={13} /> 公司
            </div>
            <div className="rd-stat-value">{data?.facets ? data.facets.companies.length : '—'}</div>
          </div>
        </div>

        <div className="ct-toolbar rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
          {meta.tabs.length > 1 && (
            <fieldset className="rd-segment">
              <legend className="sr-only">内容类型</legend>
              {meta.tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => apply({ type: value, kind: '', company: '', role: '', category: '', difficulty: '', round: '' })}
                >
                  {label}
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
              placeholder="搜索标题和内容，回车"
              aria-label="搜索"
            />
            {filters.q && (
              <button type="button" aria-label="清除搜索" onClick={() => (setText(''), apply({ q: '' }))}>
                <X size={13} />
              </button>
            )}
          </form>
        </div>
        {data?.facets && (
          <div className="rd-toolbar ct-facets">
            <FacetSelect label="公司" value={filters.company || ''} options={data.facets.companies} onChange={(v) => apply({ company: v })} />
            <FacetSelect label="岗位" value={filters.role || ''} options={data.facets.roles} onChange={(v) => apply({ role: v })} />
            <FacetSelect label="类别" value={filters.category || ''} options={data.facets.categories} onChange={(v) => apply({ category: v })} />
            <FacetSelect label="难度" value={filters.difficulty || ''} options={data.facets.difficulties} onChange={(v) => apply({ difficulty: v })} />
            <FacetSelect label="轮次" value={filters.round || ''} options={data.facets.rounds} onChange={(v) => apply({ round: v })} />
          </div>
        )}

        {error && (
          <div className="js-error" role="alert">
            {error}
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
              共 {data.total.toLocaleString()} 条{filters.q ? `，按相关度排序` : '，最新的在前'}
            </div>
            <div className="ct-list">
              {data.items.map((item) => (
                <ContentCard key={`${item.type}:${item.slug}`} item={item} onOpen={open} />
              ))}
            </div>
            {pages > 1 && (
              <nav className="ct-pager" aria-label="分页">
                <button type="button" className="rd-button is-quiet" disabled={pageNo <= 1} onClick={() => apply({ page: String(pageNo - 1) })}>
                  <ArrowLeft size={14} /> 上一页
                </button>
                <span>
                  第 {pageNo} / {pages} 页
                </span>
                <button type="button" className="rd-button is-quiet" disabled={pageNo >= pages} onClick={() => apply({ page: String(pageNo + 1) })}>
                  下一页 <ArrowRight size={14} />
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="rd-card js-empty">
            <strong>{data.facets ? '没有符合条件的内容' : '内容正在整理中'}</strong>
            <span>{data.facets ? '换个筛选条件或关键词试试。' : '稍后再来看看。'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContentDetail({
  params,
  navigate,
}: {
  params: Record<string, string>;
  navigate: Navigate;
}) {
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
  const section = SECTION_OF[params.type] || 'resources';
  const back = () => navigate(section, section === 'resources' ? { type: params.type === 'lesson' ? 'course' : params.type } : {});

  return (
    <div className="rd">
      <div className="rd-page ct-detail">
        <nav className="ct-crumbs">
          <button type="button" onClick={back}>
            <ArrowLeft size={14} /> {CONTENT_SECTIONS[section].title}
          </button>
          {item?.company && <span>/ {item.company.name}</span>}
          {item && params.type === 'lesson' && item.extra.course && (
            <button type="button" onClick={() => navigate('content', { type: 'course', slug: item.extra.course! })}>
              / 返回课程
            </button>
          )}
        </nav>
        {!current ? (
          <div className="rd-card ct-card ct-skeleton" aria-busy="true" />
        ) : current.error || !item ? (
          <div className="rd-card js-empty">
            <strong>没有找到这篇内容</strong>
            <span>{current.error}</span>
          </div>
        ) : (
          <>
            <header className="ct-detail-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
              <ContentMeta item={item} />
              <h1>{item.title}</h1>
              {item.summary && <p className="ct-lead">{item.summary}</p>}
            </header>
            {item.dupOf && item.dupOf.kind !== 'prachub' && (
              <div className="ct-callout rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
                <span>这道题已收录在算法题库，可以直接在线写代码、提交评测。</span>
                <button
                  type="button"
                  className="rd-button"
                  onClick={() => navigate('problem', { problem: item.dupOf!.id })}
                >
                  去做题 <ArrowRight size={14} />
                </button>
              </div>
            )}
            <article className="rd-card ct-body rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <OaMarkdown body={item.body} />
            </article>
            {!!item.extra.samples?.length && (
              <section className="ct-section">
                <h2>样例</h2>
                {item.extra.samples.map((sample, i) => (
                  <div key={i} className="rd-card ct-sample">
                    <div>
                      <span className="ct-sample-label">输入</span>
                      <pre>{sample.input}</pre>
                    </div>
                    <div>
                      <span className="ct-sample-label">输出</span>
                      <pre>{sample.output}</pre>
                    </div>
                    {sample.explanation && <p>{sample.explanation}</p>}
                  </div>
                ))}
              </section>
            )}
            {!!item.extra.chapters?.length && (
              <section className="ct-section">
                <h2>课程目录</h2>
                {item.extra.chapters.map((chapter, i) => (
                  <div key={i} className="rd-card ct-chapter">
                    <h3>
                      {i + 1}. {chapter.title}
                    </h3>
                    <ol>
                      {chapter.lessons.map((lesson) =>
                        lesson.free ? (
                          <li key={lesson.slug}>
                            <button
                              type="button"
                              onClick={() => navigate('content', { type: 'lesson', slug: lesson.slug })}
                            >
                              {lesson.title}
                            </button>
                          </li>
                        ) : null,
                      )}
                    </ol>
                  </div>
                ))}
              </section>
            )}
            {!!item.extra.faq?.length && (
              <section className="ct-section">
                <h2>常见问题</h2>
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
                <h2>相关内容</h2>
                <div className="ct-related">
                  {item.relations.map((rel) => (
                    <button
                      key={`${rel.type}:${rel.slug}`}
                      type="button"
                      className="rd-card ct-related-item"
                      onClick={() => navigate('content', { type: rel.type, slug: rel.slug })}
                    >
                      <span className="rd-badge">{TYPE_NAMES[rel.type] || rel.type}</span>
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
