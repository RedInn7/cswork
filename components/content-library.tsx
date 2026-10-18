'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Building2, ChevronDown, Search, Sparkles, ThumbsUp, Trophy, X } from 'lucide-react';
import { api } from '@/lib/types';
import { track } from '@/lib/analytics';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import {
  EMPLOYMENT,
  RESULTS,
  ROUND_LABELS,
  seasonLabel,
  SENTIMENTS,
  SOURCES,
  MEMBER_FACETS,
  MEMBER_FILTERS,
  prepLine,
  type MemberDetails,
  type MemberQuestion,
} from '@/lib/experience';
import { companyLogos } from '@/lib/oa-company-brands';
import type { Navigate } from './learning';
import { OaMarkdown } from './oa-library';
import { kindOf, splitBody, type BodyParts } from '@/lib/mock-interview';
import { keyPoints } from '@/lib/recall';
import { TryFirst } from './try-first';
import { RecallRate } from './recall-rate';
import { StoryPicker } from './story-bank';
import { MemberPost, SafeMarkdown, type MemberInfo } from './experience-report';
import { CommunityPosts } from './community-posts';
import { AskedReport } from './problem-community';
import '@/app/redesign.css';
import '@/app/content-library.css';
import { SelectionAsk } from './command-palette';

type Facet = { value: string; label: string; n: number };
type Facets = {
  companies: Facet[];
  companyTotal: number;
  roles: Facet[];
  categories: Facet[];
  difficulties: Facet[];
  rounds: Facet[];
  seniorities?: Facet[];
  /** Experiences: self-reported outcomes. */
  results?: Facet[];
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
  /** Experiences only: self-reported outcome, rounds, and the interview date when the source gives it. */
  result?: string | null;
  rounds?: string[];
  interviewDate?: string | null;
  /** A member's own experience (lib/server/experience-submissions.ts); its slug is member.<id>. */
  member?: { handle: string | null };
  /** Member experiences: the optional structured facts. */
  details?: MemberDetails;
  /** A teacher's pick. */
  curated?: boolean;
  /** What learners did with it (lib/server/content-library.ts). */
  stats?: ContentStats;
};
type ContentStats = {
  /** Answers to a question, comments on an experience. */
  answers: number;
  ups: number;
  /** Learners who said they were asked it in the recent months, and the latest month. */
  asked: { n: number; last: string } | null;
  /** People who solved the judge problem a coding question maps to. */
  practised: number | null;
};
/** Experiences and concepts summarise with their opening lines; the page doesn't print them twice. */
const flat = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
const opensWith = (body: string, summary: string) =>
  flat(
    body
      .slice(0, 3000)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/^#{1,6}\s.*$/gm, ''),
  ).startsWith(flat(summary.replace(/…$/, '')).slice(0, 80));
/** Tutorials are bilingual: Chinese readers get the Chinese text when there is one. */
const localized = (locale: string, en: string, zh?: string | null) =>
  locale === 'zh' && zh ? zh : en;
type ListPage = {
  items: ContentSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets: Facets | null;
  /** Experiences: values of the filters only member posts carry. */
  memberFacets?: Record<(typeof MEMBER_FACETS)[number], Facet[]> | null;
  /** A member-only filter is on: imported experiences are left out. */
  memberOnly?: boolean;
};
type Relation = {
  kind: string;
  type: string;
  slug: string;
  title: string;
  company_name: string | null;
  difficulty: string | null;
  /** A judge problem the related question can be practised on. */
  problem?: string | null;
};
/** "Practise this company" (lib/server/company-hub.ts companyPractice). */
type CompanyPractice = {
  slug: string;
  name: string;
  oaReady: number;
  /** Mock OA preset with a deep enough pool. */
  mock: string | null;
  top: { id: string; number: number; titleZh: string; titleEn: string; count: number }[];
  hub: boolean;
};
type Detail = ContentSummary & {
  body: string;
  updatedAt: string | null;
  extra: {
    constraints?: string[];
    /** Chinese body of a bilingual tutorial. */
    bodyZh?: string;
    /** The body uses TeX math. */
    math?: boolean;
    result?: string;
    faq?: { q: string; a: string }[];
  };
  relations: Relation[];
  /** `problem` is the judge problem id when the bank has one for it. */
  dupOf: { kind: 'oa' | 'library' | 'prachub'; id: string; title?: string; problem?: string } | null;
  /** A judgeable LeetCode problem this coding question maps to. */
  practice?: string | null;
  /** Experiences and interview questions: practice for their company. */
  companyPractice?: CompanyPractice | null;
  /** Member posts: the questions they were asked. */
  questions?: MemberQuestion[];
} & { member?: MemberInfo };

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

/** Self-reported outcomes as [zh, en] labels (filter menu and badges). */
const RESULT_NAMES: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(RESULTS).map(([value, r]) => [value, [r.zh, r.en] as [string, string]]),
);

export function ContentMeta({ item }: { item: ContentSummary }) {
  const t = useT();
  // Experiences: outcome badge (none when the report gives none), the rounds in order, the interview month.
  const result = item.result && Object.hasOwn(RESULTS, item.result) ? RESULTS[item.result] : null;
  const rounds = item.rounds?.map((r) => labelOf(t, ROUND_LABELS, r) ?? r) ?? [];
  return (
    <div className="ct-meta">
      {item.curated && (
        <span className="rd-badge ct-curated">
          <Sparkles size={11} aria-hidden="true" /> {t('精选', 'Curated')}
        </span>
      )}
      {item.member && <span className="rd-badge is-member">{t('学员投稿', 'Member submission')}</span>}
      {item.company && <CompanyMark company={item.company} />}
      {result && (
        <span className="rd-badge ct-result" data-tone={result.tone}>
          {t(result.zh, result.en)}
        </span>
      )}
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
      {[item.role, rounds.length ? null : item.round, item.seniority].filter(Boolean).map((label) => (
        <span key={label} className="ct-meta-text">
          {label}
        </span>
      ))}
      {!!rounds.length && (
        <span className="ct-meta-text">
          <span aria-hidden="true">{rounds.join(' → ')}</span>
          <span className="sr-only">{t(`轮次：${rounds.join('、')}`, `Rounds: ${rounds.join(', ')}`)}</span>
        </span>
      )}
      {item.interviewDate && (
        <span className="ct-meta-text">
          {t(`面试于 ${item.interviewDate.slice(0, 7)}`, `Interviewed ${item.interviewDate.slice(0, 7)}`)}
        </span>
      )}
      {item.details && <DetailsMeta details={item.details} />}
    </div>
  );
}

/** A member post's structured facts, the ones it gives. */
function DetailsMeta({ details: d }: { details: MemberDetails }) {
  const t = useT();
  const english = useLocale() === 'en';
  const facts = [
    d.employment && labelOf(t, EMPLOYMENT, d.employment),
    d.season && seasonLabel(d.season, !english),
    d.channel && labelOf(t, SOURCES, d.channel),
    d.location,
    d.difficulty && t(`难度 ${d.difficulty}/5`, `Difficulty ${d.difficulty}/5`),
    d.sentiment && labelOf(t, SENTIMENTS, d.sentiment),
    d.durationWeeks !== null && t(`流程 ${d.durationWeeks} 周`, `${d.durationWeeks}-week process`),
    prepLine(d, !english),
  ].filter((x): x is string => !!x);
  return (
    <>
      {facts.map((fact) => (
        <span key={fact} className="ct-meta-text">
          {fact}
        </span>
      ))}
      {d.verified && (
        <span className="rd-badge ct-verified" title={t('作者的邮箱已验证，不代表身份核验', "The author's email is verified; not an identity check")}>
          {t('已验证邮箱', 'Verified email')}
        </span>
      )}
    </>
  );
}

/** A card's counts, the ones above zero. */
function StatsLine({ stats: s, type }: { stats: ContentStats; type: string }) {
  const t = useT();
  const facts = [
    s.practised && t(`${s.practised} 人练过`, `${s.practised} solved it`),
    s.asked && t(`最近被问 ${s.asked.last} · ${s.asked.n} 人`, `Asked ${s.asked.last} · ${s.asked.n} ${s.asked.n === 1 ? 'learner' : 'learners'}`),
    s.answers &&
      (type === 'experience'
        ? t(`${s.answers} 条评论`, `${s.answers} ${s.answers === 1 ? 'comment' : 'comments'}`)
        : t(`${s.answers} 个回答`, `${s.answers} ${s.answers === 1 ? 'answer' : 'answers'}`)),
    s.ups && t(`${s.ups} 个赞`, `${s.ups} ${s.ups === 1 ? 'upvote' : 'upvotes'}`),
  ].filter((x): x is string => !!x);
  return facts.length ? (
    <p className="ct-stats">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  ) : null;
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
    <a
      href={`/?view=content&type=${encodeURIComponent(item.type)}&slug=${encodeURIComponent(item.slug)}`}
      className="rd-card ct-card"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen(item);
      }}
    >
      <ContentMeta item={item} />
      <h3>{localized(locale, item.title, item.titleZh)}</h3>
      {item.summary && (
        <p className="ct-summary">{localized(locale, item.summary, item.summaryZh)}</p>
      )}
      {item.stats && <StatsLine stats={item.stats} type={item.type} />}
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
          {/* An experience is dated by its interview (in the meta), not by when it was collected. */}
          {item.publishedAt && item.type !== 'experience' ? ` · ${item.publishedAt.slice(0, 10)}` : ''}
        </span>
      </div>
    </a>
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
            {labelOf(t, DIFFICULTY, o.value) ?? labelOf(t, RESULT_NAMES, o.value) ?? o.label}
            {o.n ? ` · ${o.n}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
    </label>
  );
}

const FILTERS = [
  'type', 'kind', 'company', 'role', 'category', 'difficulty', 'round', 'seniority', 'result', 'curated', 'sort', 'q', 'page',
  ...MEMBER_FILTERS,
] as const;
/** List orders, [value, zh, en]; experiences list by interview date first and can show the newly shared. */
const SORTS: [string, string, string][] = [
  ['', '最新', 'Latest'],
  ['popular', '热门', 'Popular'],
  ['hot', '最热', 'Trending'],
];
const EXPERIENCE_SORTS: [string, string, string][] = [
  ['', '最近面试', 'Recent interviews'],
  ['new', '新发布', 'Newly shared'],
  ...SORTS.slice(1),
];
/** Labels for the member-only filters' values, [zh, en] per value or a function for seasons. */
const MEMBER_FILTER_LABELS: Record<(typeof MEMBER_FACETS)[number], [string, string, Record<string, [string, string]> | null]> = {
  employment: ['全职 / 实习', 'Full-time / intern', EMPLOYMENT],
  season: ['招聘季', 'Season', null],
  channel: ['渠道', 'Channel', SOURCES],
};
/** Each list's last filters, search and page, so an item's back link returns to the same list. */
const lastList: Record<string, Record<string, string>> = {};

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
  const zh = useLocale() === 'zh';
  const meta = CONTENT_SECTIONS[section];
  const type = params.type && meta.tabs.some(([tab]) => tab === params.type) ? params.type : meta.tabs[0][0];
  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of FILTERS) if (params[key]) out[key] = params[key];
    out.type = type;
    return out;
  }, [params, type]);
  const query = new URLSearchParams(filters).toString();
  useEffect(() => {
    lastList[section] = filters;
  }, [section, filters]);
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
          {section === 'experiences' && (
            // Members write their own; the form lives on My progress (components/experience-submissions.tsx).
            <button type="button" className="rd-button" onClick={() => navigate('progress', { tab: 'share' })}>
              {t('投稿我的面经', 'Share your experience')} <ArrowRight size={14} aria-hidden="true" />
            </button>
          )}
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
                  onClick={() =>
                    apply({
                      type: value,
                      kind: '',
                      company: '',
                      role: '',
                      category: '',
                      difficulty: '',
                      round: '',
                      seniority: '',
                      result: '',
                      // Algorithm tutorials keep syllabus order and have no order tabs.
                      ...(value === 'algorithm' && { sort: '' }),
                    })
                  }
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
              const q = text.trim();
              // An email typed into the box never leaves the browser.
              if (q) track('search', { view: section, q: q.includes('@') ? null : q.slice(0, 80) });
              apply({ q });
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
            <FacetSelect label={t('职级', 'Seniority')} value={filters.seniority || ''} options={data.facets.seniorities ?? []} onChange={(v) => apply({ seniority: v })} />
            <button
              type="button"
              className={`rd-chip ${filters.curated ? 'is-set' : ''}`}
              aria-pressed={!!filters.curated}
              onClick={() => apply({ curated: filters.curated ? '' : '1' })}
            >
              <Sparkles size={13} aria-hidden="true" /> {t('只看精选', 'Curated only')}
            </button>
            {!!data.facets.results?.length && (
              <>
                <FacetSelect label={t('结果', 'Outcome')} value={filters.result || ''} options={data.facets.results} onChange={(v) => apply({ result: v })} />
                <button
                  type="button"
                  className={`rd-chip ${filters.result === 'Offer' ? 'is-set' : ''}`}
                  aria-pressed={filters.result === 'Offer'}
                  onClick={() => apply({ result: filters.result === 'Offer' ? '' : 'Offer' })}
                >
                  <Trophy size={13} aria-hidden="true" /> {t('只看拿到 Offer', 'Offers only')}
                </button>
              </>
            )}
            {type === 'experience' && (
              <button
                type="button"
                className={`rd-chip ${filters.verified ? 'is-set' : ''}`}
                aria-pressed={!!filters.verified}
                onClick={() => apply({ verified: filters.verified ? '' : '1' })}
              >
                <BadgeCheck size={13} aria-hidden="true" /> {t('只看已验证作者', 'Verified authors only')}
              </button>
            )}
            {data.memberFacets &&
              MEMBER_FACETS.map((key) => {
                const [nameZh, nameEn, labels] = MEMBER_FILTER_LABELS[key];
                const options = (data.memberFacets?.[key] ?? []).map((o) => ({
                  ...o,
                  label: key === 'season' ? seasonLabel(o.value, zh) : (labels && labelOf(t, labels, o.value)) || o.value,
                }));
                return (
                  <FacetSelect
                    key={key}
                    label={t(`${nameZh}（仅学员投稿）`, `${nameEn} (members' posts)`)}
                    value={filters[key] || ''}
                    options={options}
                    onChange={(v) => apply({ [key]: v })}
                  />
                );
              })}
            {type !== 'algorithm' && (
              // Latest (experiences: by when they happened, or newly shared), popular, or trending lately.
              <fieldset className="rd-segment ct-sorts">
                <legend className="sr-only">{t('排序', 'Order')}</legend>
                {(type === 'experience' ? EXPERIENCE_SORTS : SORTS).map(([value, zh, en]) => (
                  <button key={value} type="button" aria-pressed={(filters.sort || '') === value} onClick={() => apply({ sort: value })}>
                    {t(zh, en)}
                  </button>
                ))}
              </fieldset>
            )}
          </div>
        )}

        {error && (
          <div className="js-error" role="alert">
            {t(error, englishMessage(error))}
          </div>
        )}
        {data?.memberOnly && (
          <output className="ct-member-note">
            {t(
              '仅显示学员投稿：导入的面经没有全职/实习、招聘季、渠道和作者验证这些字段。',
              'Showing members’ posts only: imported experiences have no employment, season, channel or verified author.',
            )}
          </output>
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
              {filters.sort === 'popular'
                ? t('，按热度排序（收藏、回答、被问和点赞）', ', most popular first (stars, answers, reports and upvotes)')
                : filters.sort === 'hot'
                  ? t('，按近期热度排序', ', trending first')
                  : filters.q
                    ? t('，按相关度排序', ', sorted by relevance')
                    : type === 'algorithm'
                      ? t('，核心专题在前', ', core topics first')
                      : type === 'experience' && filters.sort !== 'new'
                        ? // Two thirds of reports give only the post's date, so say so rather than "interview date".
                          t('，按面试时间（没有则按原帖时间），最近的在前', ", most recent first (interview date, else the original post's)")
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

/** Same-tab SPA navigation for plain left clicks; modified clicks open the link as usual. */
const spaClick = (go: () => void) => (event: React.MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  go();
};

/**
 * "Practise this company" ticket on experiences and interview questions: the company's judgeable OA
 * problems, a timed mock and its three most reported LeetCode problems this visitor can open.
 */
function PracticeCard({
  practice,
  navigate,
  problemIds,
}: {
  practice: CompanyPractice;
  navigate: Navigate;
  problemIds: string[];
}) {
  const t = useT();
  const locale = useLocale();
  const top = practice.top.filter((p) => problemIds.includes(p.id));
  if (!practice.oaReady && !practice.mock && !top.length) return null;
  const oa = { library: 'oa', company: practice.slug };
  return (
    <section className="ct-practice rd-reveal" aria-labelledby="ct-practice-title" style={{ '--i': 3 } as React.CSSProperties}>
      <div className="ct-practice-head">
        <p className="ct-practice-eyebrow">{t('练这家公司', 'Practise this company')}</p>
        <h2 id="ct-practice-title">{practice.name}</h2>
        {practice.hub && (
          <a href={`/company/${encodeURIComponent(practice.slug)}`}>
            {t('公司主页', 'Company page')} <ArrowRight size={13} aria-hidden="true" />
          </a>
        )}
      </div>
      {(practice.oaReady > 0 || practice.mock) && (
        <div className="ct-practice-row">
          {practice.oaReady > 0 && (
            <a className="ct-practice-oa" href={`/?${new URLSearchParams({ view: 'problems', ...oa })}`} onClick={spaClick(() => navigate('problems', oa))}>
              <strong>{practice.oaReady}</strong>
              <span>{t('道 OA 真题可在线判题', practice.oaReady === 1 ? 'judge-ready OA problem' : 'judge-ready OA problems')}</span>
            </a>
          )}
          {practice.mock && (
            <a
              className="ct-practice-cta"
              href={`/?view=mock&company=${encodeURIComponent(practice.mock)}`}
              onClick={spaClick(() => navigate('mock', { company: practice.mock! }))}
            >
              {t('开始限时模拟 OA', 'Start a timed mock OA')} <ArrowRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      {!!top.length && (
        <>
          <h3 className="ct-practice-sub">{t('高频 LeetCode 题', 'Most reported LeetCode problems')}</h3>
          <ol className="ct-practice-lc">
            {top.map((p) => (
              <li key={p.id}>
                <a href={`/?view=problem&problem=${encodeURIComponent(p.id)}`} onClick={spaClick(() => navigate('problem', { problem: p.id }))}>
                  <span className="ct-practice-num">LC {p.number}</span>
                  <span className="ct-practice-title">{locale === 'zh' ? p.titleZh || p.titleEn : p.titleEn || p.titleZh}</span>
                  <span className="ct-practice-freq" aria-hidden="true">
                    ×{p.count}
                  </span>
                  <span className="sr-only">
                    {t(`（${p.count} 次面经报告）`, ` (${p.count} ${p.count === 1 ? 'report' : 'reports'})`)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** The reference parts of a question, closed until the learner has tried (lib/mock-interview.ts splitBody). */
const ANSWER_PARTS: [keyof BodyParts, string, string][] = [
  ['followUps', '可能的追问', 'Likely follow-ups'],
  ['rubric', '面试官想听到什么', 'What interviewers look for'],
  ['solution', '参考答案', 'Reference answer'],
];

/**
 * Under an item's title: an upvote (experiences and interview questions), a teacher's curated pick,
 * and "I was asked this" (an interview question, or the judge problem a coding question maps to).
 */
function ItemActions({
  item,
  problem,
  userId,
  teacher,
}: {
  item: Detail;
  /** The judge problem a coding question maps to, when this visitor can open it (reports need one). */
  problem: string | null;
  userId: string | null;
  teacher: boolean;
}) {
  const t = useT();
  const english = useLocale() === 'en';
  const target = `content:${item.type}/${item.slug}`;
  // This learner's marks on the item, and whether it was upvoted when loaded (the count may hold that vote).
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [was, setWas] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return;
    let live = true;
    api<{ items: { mark: string }[] }>(`oj/marks?target=${encodeURIComponent(target)}`).then(
      (r) => {
        if (!live || !Array.isArray(r.items)) return;
        const marks = new Set(r.items.map((m) => m.mark));
        setWas(marks.has('up'));
        setMine(marks);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [userId, target]);
  async function toggle(mark: 'up' | 'curated') {
    if (!userId) return void window.dispatchEvent(new Event('cswork:auth-required'));
    const on = !mine.has(mark);
    setError('');
    try {
      await api('oj/marks', { target, mark, on });
      setMine((now) => {
        const next = new Set(now);
        if (on) next.add(mark);
        else next.delete(mark);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const votable = item.type === 'experience' || item.type === 'interview_question';
  const ups = Math.max(0, (item.stats?.ups ?? 0) + Number(mine.has('up')) - Number(was));
  const asked =
    item.type === 'interview_question' && !item.member
      ? `q:${item.slug}`
      : item.type === 'coding_question'
        ? problem
        : null;
  if (!votable && !teacher && !asked) return null;
  return (
    <div className="ct-actions">
      {votable && (
        <button
          type="button"
          className={`rd-chip ${mine.has('up') ? 'is-set' : ''}`}
          aria-pressed={mine.has('up')}
          onClick={() => void toggle('up')}
        >
          <ThumbsUp size={13} aria-hidden="true" /> {t('有用', 'Helpful')}
          {ups > 0 && <span className="ct-actions-count">{ups}</span>}
        </button>
      )}
      {teacher && (
        <button
          type="button"
          className={`rd-chip ${mine.has('curated') ? 'is-set' : ''}`}
          aria-pressed={mine.has('curated')}
          onClick={() => void toggle('curated')}
        >
          <Sparkles size={13} aria-hidden="true" /> {t('设为精选', 'Curate')}
        </button>
      )}
      {asked && <AskedReport problemId={asked} english={english} signedIn={!!userId} labelled />}
      {error && (
        <span className="ct-actions-error" role="alert">
          {t(error, englishMessage(error))}
        </span>
      )}
    </div>
  );
}

export function ContentDetail({
  params,
  navigate,
  problemIds,
  userId = null,
  teacher = false,
}: {
  params: Record<string, string>;
  navigate: Navigate;
  /** Judge problems this visitor can open. */
  problemIds: string[];
  /** Signed-in learner: their written answers and stories are saved. */
  userId?: string | null;
  /** Teachers can mark items curated. */
  teacher?: boolean;
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
  // The mapped LeetCode problem, unless the duplicate callout below already links one.
  const practice =
    item?.practice && problemIds.includes(item.practice) && !(dup && dup.kind !== 'prachub') ? item.practice : null;
  // Related questions this visitor can practise come first (the sort is stable).
  const canPractise = (rel: Relation) => !!rel.problem && problemIds.includes(rel.problem);
  const relations = [...(item?.relations ?? [])].sort((a, b) => Number(canPractise(b)) - Number(canPractise(a)));
  // Questions with a reference answer show it after "write your answer first"; one that won't split shows whole.
  const split = useMemo(
    () => (item && (item.type === 'interview_question' || item.type === 'coding_question') ? splitBody(item.body) : null),
    [item],
  );
  const gated = split && (split.solution || split.rubric) ? split : null;
  const [revealed, setRevealed] = useState('');
  const open = revealed === key;
  const behavioral = item?.type === 'interview_question' && kindOf(item.category) === 'behavioral';
  const section = contentSection(params.type);
  const back = () =>
    navigate(section, lastList[section] ?? (section === 'resources' ? { type: params.type } : {}));

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
              {item.summary && !opensWith(item.body, item.summary) && (
                <p className="ct-lead">{localized(locale, item.summary, item.summaryZh)}</p>
              )}
              <ItemActions
                key={key}
                item={item}
                problem={item.practice && problemIds.includes(item.practice) ? item.practice : null}
                userId={userId}
                teacher={teacher}
              />
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
            {practice && (
              <div className="ct-callout rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
                <span>
                  {t(
                    '算法题库里有对应的题，可以直接在线写代码、提交评测。',
                    'The Problem Bank has a matching problem you can code and submit online.',
                  )}
                </span>
                <a
                  className="rd-button"
                  href={`/?view=problem&problem=${encodeURIComponent(practice)}`}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigate('problem', { problem: practice });
                  }}
                >
                  {t('在 CSWork 上在线写代码', 'Practice this problem here')} <ArrowRight size={14} aria-hidden="true" />
                </a>
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
              <SelectionAsk
                clip={{
                  target: `clip:${item.type}/${item.slug}`,
                  title: localized(locale, item.title, item.titleZh),
                  href: `/?view=content&type=${encodeURIComponent(item.type)}&slug=${encodeURIComponent(item.slug)}`,
                }}
              >
                <SafeMarkdown body={gated ? gated.question : localized(locale, item.body, item.extra.bodyZh)} math={!!item.extra.math} />
              </SelectionAsk>
              {gated?.hints && (
                <details className="ct-hints">
                  <summary>{t('提示', 'Hints')}</summary>
                  <OaMarkdown body={gated.hints} math={!!item.extra.math} />
                </details>
              )}
            </article>
            {item.member && <MemberPost member={item.member} questions={item.questions ?? []} />}
            {/* Others' answers wait, like the reference answer, until the learner has tried. */}
            {((item.type === 'experience' && (!item.member || item.member.public)) ||
              (item.type === 'interview_question' && (!gated || open))) && (
              <CommunityPosts key={key} type={item.type} slug={item.slug} signedIn={!!userId} />
            )}
            {behavioral && (
              <StoryPicker
                userId={userId}
                question={{ key: `${item.type}/${item.slug}`, title: item.title, company: item.company?.name ?? null }}
                text={`${item.title}\n${gated?.question ?? item.body}`}
              />
            )}
            {gated && (
              <TryFirst
                key={key}
                userId={userId}
                target={`content:${item.type}/${item.slug}`}
                revealed={open}
                revealOnLoad
                code={item.type === 'coding_question'}
                onReveal={(asked) => {
                  setRevealed(key);
                  if (asked) requestAnimationFrame(() => document.getElementById('ct-answer')?.focus());
                }}
              />
            )}
            {gated && open && (
              <article id="ct-answer" tabIndex={-1} className="rd-card ct-body ct-answer" aria-label={t('参考答案', 'Reference answer')}>
                {ANSWER_PARTS.map(
                  ([part, zh, en]) =>
                    gated[part] && (
                      <section key={part}>
                        <h2>{t(zh, en)}</h2>
                        <OaMarkdown body={gated[part]} math={!!item.extra.math} />
                      </section>
                    ),
                )}
              </article>
            )}
            {gated && open && (
              <RecallRate
                key={key}
                target={`content:${item.type}/${item.slug}`}
                title={localized(locale, item.title, item.titleZh)}
                points={keyPoints(gated.rubric, gated.solution)}
                signedIn={!!userId}
              />
            )}
            {item.companyPractice && (
              <PracticeCard practice={item.companyPractice} navigate={navigate} problemIds={problemIds} />
            )}
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
            {!!relations.length && (
              <section className="ct-section">
                <h2>{t('相关内容', 'Related content')}</h2>
                <div className="ct-related">
                  {relations.map((rel) => (
                    <button
                      key={`${rel.type}:${rel.slug}`}
                      type="button"
                      className="rd-card ct-related-item"
                      onClick={() => navigate('content', { type: rel.type, slug: rel.slug })}
                    >
                      <span className="rd-badge">{labelOf(t, TYPE_NAMES, rel.type) || rel.type}</span>
                      <span>{rel.title}</span>
                      {canPractise(rel) && <span className="rd-badge is-brand ct-related-judge">{t('可在线判题', 'Judge-ready')}</span>}
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
