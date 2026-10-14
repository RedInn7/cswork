'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Navigate } from './learning';
import {
  canonicalCompany,
  companyHue,
  companyInitials,
  companyLogos,
  oaCompanyName,
  oaProblemPath,
} from '@/lib/oa-company-brands';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { OA_KIND_NAMES, TOPIC_NAMES, topicName } from '@/lib/route-stops';
import { Shuffle, Star } from 'lucide-react';

/** Text remains the accessible identity; the logo is only a visual aid. */
export function CompanyIdentity({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const asset = Object.hasOwn(companyLogos, slug)
    ? companyLogos[slug]
    : undefined;
  return (
    <span className="oa-company-identity">
      <span className="oa-company-logo" aria-hidden="true">
        {asset && failedAsset !== asset ? (
          <img
            src={asset}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            decoding="async"
            onError={() => setFailedAsset(asset)}
          />
        ) : (
          <span
            className="oa-company-initials"
            style={{ '--oa-hue': companyHue(slug) } as React.CSSProperties}
          >
            {companyInitials(name)}
          </span>
        )}
      </span>
      <span className="oa-company-name">{name}</span>
    </span>
  );
}

type Item = {
  id: string;
  companySlug: string;
  companyName: string;
  number: number;
  title: string;
  sourceUrl: string;
  languages: string[];
  judgeStatus: 'reading_only' | 'ready';
  judgeProblemId?: string;
  difficulty?: string;
  /** The package had only its default 中等, so this is the AI estimate. */
  difficultyEstimated?: boolean;
  tags?: string[];
  /** AI-estimated topic slugs, most important first. */
  topics?: string[];
  /** Set only for non-coding problems. */
  kind?: 'mcq' | 'sql' | 'other';
  progress?: 'solved' | 'attempted';
  starred?: boolean;
  /** When a judgeable problem went online (ms). */
  addedAt?: number;
};
const difficultyLevels: Record<string, string> = {
  简单: 'easy',
  中等: 'medium',
  困难: 'hard',
};
const difficultyNames: Record<string, string> = {
  简单: 'Easy',
  中等: 'Medium',
  困难: 'Hard',
};
const codeLanguages = new Set(['python', 'java', 'cpp', 'go']);
type Page = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  /** `count`: every listed problem; `ready`: the practice-ready ones. */
  companies: { slug: string; name: string; count: number; ready?: number }[];
  /** Matches per topic under the other filters. */
  topics?: { slug: string; count: number }[];
  source: { name: string; url: string; commit: string };
  /** Judgeable problems that went online in the last 7 days, site-wide. */
  newThisWeek?: number;
  signedIn?: boolean;
  /** ?random=1: an unsolved judgeable problem under the filters. */
  random?: string | null;
};
const STATUSES = ['solved', 'attempted', 'todo'] as const;
const LEVELS = ['easy', 'medium', 'hard'] as const;
type Detail = Item & {
  statement: string;
  contentHash: string;
  relatedPractice?: { problemId: string; title: string; description: string };
};
type Solution = {
  explanation: string;
  solutions: { language: string; code: string }[];
};
const languageNames: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  sql: 'SQL',
  css: 'CSS',
  bash: 'Bash',
};

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/oj/oa-library' + path, { signal });
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event('cswork:auth-required'));
    throw new Error(
      response.status === 401
        ? '请登录后查看 OA 题目'
        : response.status === 409
          ? '本题题解与评测数据正在准备中'
          : '加载失败，请重试',
    );
  }
  return response.json();
}

// read() errors stay Chinese in state; the English twin is picked at render.
const readErrorsEn: Record<string, string> = {
  '请登录后查看 OA 题目': 'Sign in to view OA problems',
  本题题解与评测数据正在准备中:
    'The solution and test data for this problem are still being prepared',
  '加载失败，请重试': 'Failed to load. Please try again',
};
const readErrorEn = (message: string) =>
  Object.hasOwn(readErrorsEn, message) ? readErrorsEn[message] : message;

function safeLink(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** A plain left click stays in the app; modified clicks keep the browser's link behaviour. */
function plainClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  e.preventDefault();
  return true;
}

/** Same-tab navigation to another view; the app follows history via popstate. */
function openInApp(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!plainClick(e)) return;
  history.pushState(null, '', href);
  dispatchEvent(new PopStateEvent('popstate'));
  scrollTo({ top: 0 });
}

type MathPlugins = typeof import('./markdown-math');

/** `math`: the source wrote TeX (`$x$`, `$$…$$`); rendered once KaTeX has loaded. */
export function OaMarkdown({ body, math = false }: { body: string; math?: boolean }) {
  const t = useT();
  const [mathPlugins, setMathPlugins] = useState<MathPlugins | null>(null);
  useEffect(() => {
    // Without KaTeX the TeX source stays readable, so a failed load just keeps the plain view.
    if (math) import('./markdown-math').then(setMathPlugins, () => {});
  }, [math]);
  const withMath = math && mathPlugins;
  return (
    <div className="oa-markdown">
      {/* No skipHtml: statements use angle brackets as text (`<timestamp>`, `List<String>`), and
          react-markdown shows raw HTML as escaped text rather than dropping it. */}
      <ReactMarkdown
        remarkPlugins={withMath ? [remarkGfm, withMath.remarkMath] : [remarkGfm]}
        rehypePlugins={withMath ? [[withMath.rehypeKatex, { maxSize: 10, maxExpand: 200 }]] : []}
        components={{
          a: ({ node, href, children }) =>
            href?.startsWith('/?view=') ? (
              // Links between library items stay inside the app.
              <a href={href} onClick={(e) => openInApp(e, href)}>
                {children}
              </a>
            ) : safeLink(href) ? (
              <a
                href={safeLink(href)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ) : !href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href) ? (
              <span>{children}</span>
            ) : (
              // Not a link at all, e.g. `[q1,q2](A1,A2)->R` in a statement: show it as written.
              <span>
                {body.slice(node?.position?.start.offset ?? 0, node?.position?.end.offset ?? 0) || children}
              </span>
            ),
          img: ({ src, alt }) =>
            typeof src === 'string' && /^\/content-assets\/[\w.-]+$/.test(src) ? (
              // oxlint-disable-next-line nextjs/no-img-element -- Images copied to this server, sized by the article.
              <img src={src} alt={alt || ''} loading="lazy" decoding="async" />
            ) : (
            <span>
              {alt
                ? t(`[图片：${alt}]`, `[Image: ${alt}]`)
                : t('[图片]', '[Image]')}
            </span>
            ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export function OaLibrary({ navigate }: { navigate?: Navigate }) {
  const t = useT();
  const locale = useLocale();
  const companyName = (slug: string, name: string) =>
    oaCompanyName(slug, name, locale);
  const progressLabels = {
    solved: t('已通过', 'Solved'),
    attempted: t('尝试过', 'Attempted'),
  };
  // Filters live in the URL (?company=&topic=&q=&page=&ready=0) so a list can be shared or reloaded.
  const [initial] = useState(() =>
    typeof location === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(location.search),
  );
  const [query, setQuery] = useState(initial.get('q') || '');
  const [search, setSearch] = useState(query.trim());
  const [company, setCompany] = useState(
    canonicalCompany(initial.get('company') || ''),
  );
  const [topic, setTopic] = useState(() => {
    const value = initial.get('topic') || '';
    return Object.hasOwn(TOPIC_NAMES, value) ? value : '';
  });
  const [topics, setTopics] = useState<NonNullable<Page['topics']>>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [readyOnly, setReadyOnly] = useState(initial.get('ready') !== '0');
  const [status, setStatus] = useState<string>(
    () => STATUSES.find((value) => value === initial.get('status')) ?? '',
  );
  const [sort, setSort] = useState(initial.get('sort') === 'new' ? 'new' : '');
  const [level, setLevel] = useState<string>(
    () => LEVELS.find((value) => value === initial.get('difficulty')) ?? '',
  );
  // Kept across loads so the banner and the progress menu don't blink while a page loads.
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickMessage, setPickMessage] = useState('');
  const [page, setPage] = useState(
    () => Math.max(1, Number.parseInt(initial.get('page') || '', 10) || 1),
  );
  const [data, setData] = useState<Page | null>(null);
  const [companies, setCompanies] = useState<Page['companies']>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solutionError, setSolutionError] = useState('');
  const [language, setLanguage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const copyGeneration = useRef(0);
  const listParams = () =>
    new URLSearchParams({
      q: search,
      company,
      topic,
      page: String(page),
      ready: readyOnly ? '1' : '0',
      status,
      sort,
      difficulty: level,
    });
  // "Pick one": an unsolved practice-ready problem under the current filters.
  const pickOne = async () => {
    setPicking(true);
    setPickMessage('');
    try {
      const params = listParams();
      params.set('random', '1');
      const { random } = await read<Page>('?' + params, new AbortController().signal);
      if (!random)
        setPickMessage(
          t(
            '当前筛选下没有未通过的可练习题目。',
            'No unsolved practice-ready problem matches these filters.',
          ),
        );
      else if (navigate) {
        // Drop the sequence and library left by whichever list was opened before.
        rememberProblemSequence([random]);
        navigate('problem', { problem: random });
      } else location.assign('/?' + new URLSearchParams({ view: 'problem', problem: random }));
    } catch (e) {
      const message = e instanceof Error ? e.message : '加载失败，请重试';
      setPickMessage(t(message, readErrorEn(message)));
    } finally {
      setPicking(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      // The first run must not reset a page restored from the URL.
      if (query.trim() === search) return;
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    const url = new URL(location.href);
    const filters = {
      company,
      topic,
      q: search,
      page: page > 1 ? String(page) : '',
      ready: readyOnly ? '' : '0',
      status,
      sort,
      difficulty: level,
    };
    for (const [key, value] of Object.entries(filters))
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }, [company, topic, search, page, readyOnly, status, sort, level]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    read<Page>('?' + listParams(), controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setCompanies(value.companies);
          setTopics(value.topics ?? []);
          setNewThisWeek(value.newThisWeek ?? 0);
          setSignedIn(!!value.signedIn);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- listParams reads exactly these filters.
  }, [search, company, topic, page, retry, readyOnly, status, sort, level]);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setDetailError('');
    setSolutionOpen(false);
    setSolution(null);
    setCopyMessage('');
    copyGeneration.current++;
    if (selected)
      read<Detail>('/' + encodeURIComponent(selected), controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setDetail(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setDetailError(e.message);
        });
    return () => controller.abort();
  }, [selected, retry]);
  useEffect(() => {
    if (detail) heading.current?.focus();
  }, [detail]);
  useEffect(() => {
    const controller = new AbortController();
    setSolution(null);
    setSolutionError('');
    setCopyMessage('');
    copyGeneration.current++;
    if (solutionOpen && selected)
      read<Solution>(
        '/' + encodeURIComponent(selected) + '/solution',
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) {
            setSolution(value);
            setLanguage(value.solutions[0]?.language || '');
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setSolutionError(e.message);
        });
    return () => controller.abort();
  }, [solutionOpen, selected, retry]);
  const retryButton = (
    <button type="button" onClick={() => setRetry((n) => n + 1)}>
      {t('重试', 'Retry')}
    </button>
  );
  const codeBlocks =
    solution?.solutions.filter((item) => item.language === language) || [];
  const currentDetail = detail?.id === selected ? detail : null;
  if (selected)
    return (
      <section
        className="study-library oa-library"
        aria-label={t('OA 题目详情', 'OA problem details')}
      >
        <button
          className="oa-back"
          type="button"
          onClick={() => setSelected(null)}
        >
          {t('← 返回 OA 题目', '← Back to OA problems')}
        </button>
        {detailError ? (
          <div role="alert">
            {t(detailError, readErrorEn(detailError))} {retryButton}
          </div>
        ) : !currentDetail ? (
          <p role="status">{t('正在加载题目…', 'Loading problem…')}</p>
        ) : (
          <>
            <header className="study-library-heading">
              <div>
                <span className="study-kicker">
                  {t('OA 题目', 'OA problem')} ·{' '}
                  {companyName(currentDetail.companySlug, currentDetail.companyName)} ·
                  OA MASTER
                </span>
                <h2 ref={heading} tabIndex={-1}>
                  {currentDetail.title}
                </h2>
                <p>
                  {currentDetail.judgeStatus === 'ready'
                    ? t(
                        '运行样例、提交代码，查看评测结果。',
                        'Run the examples, submit your code, and see the results.',
                      )
                    : currentDetail.relatedPractice
                      ? t(
                          currentDetail.relatedPractice.description,
                          englishMessage(
                            currentDetail.relatedPractice.description,
                          ),
                        )
                      : t(
                          '评测准备中，暂可阅读原题。',
                          "Judging isn't ready yet. You can read the original problem for now.",
                        )}
                </p>
                {currentDetail.judgeStatus === 'ready' &&
                  currentDetail.judgeProblemId &&
                  navigate && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate('problem', {
                          problem: currentDetail.judgeProblemId!,
                        })
                      }
                    >
                      {t('开始练习', 'Start practicing')}
                    </button>
                  )}
                {currentDetail.judgeStatus === 'reading_only' &&
                  currentDetail.relatedPractice &&
                  navigate && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate('problem', {
                          problem: currentDetail.relatedPractice!.problemId,
                        })
                      }
                    >
                      {t('进入四阶段综合练习', 'Practice all four stages')}
                    </button>
                  )}
              </div>
            </header>
            <div className="oa-source">
              {t('来源：OA Master', 'Source: OA Master')}{' '}
              {safeLink(currentDetail.sourceUrl) && (
                <a
                  href={safeLink(currentDetail.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('查看原题 ↗', 'View original ↗')}
                </a>
              )}
            </div>
            {currentDetail.statement.trim() ? (
              <OaMarkdown body={currentDetail.statement} />
            ) : (
              <p className="oa-source">
                {t(
                  '原站未提供独立题面，可查看题解或原站。',
                  'The original site has no standalone statement. See the solution or the original site.',
                )}
              </p>
            )}
            {currentDetail.judgeStatus === 'ready' && (
              <section
                className="oa-solution"
                aria-label={t('题解', 'Solution')}
              >
                <button
                  type="button"
                  aria-expanded={solutionOpen}
                  aria-controls="oa-solution-body"
                  onClick={() => setSolutionOpen((value) => !value)}
                >
                  {solutionOpen
                    ? t('收起题解', 'Hide solution')
                    : t('查看题解', 'View solution')}
                </button>
                {solutionOpen && (
                  <div id="oa-solution-body">
                    {solutionError ? (
                      <div role="alert">
                        {t(solutionError, readErrorEn(solutionError))}{' '}
                        {retryButton}
                      </div>
                    ) : !solution ? (
                      <p role="status">
                        {t('正在加载题解…', 'Loading solution…')}
                      </p>
                    ) : (
                      <>
                        {solution.explanation.trim() ? (
                          <OaMarkdown body={solution.explanation} />
                        ) : (
                          <p className="oa-source">
                            {t(
                              '题解正在准备中。',
                              'The solution is being prepared.',
                            )}
                          </p>
                        )}
                        {solution.solutions.length === 0 && (
                          <p className="oa-source">
                            {t(
                              '本题未提供参考代码。',
                              'No reference code for this problem.',
                            )}
                          </p>
                        )}
                        {solution.solutions.length > 0 && (
                          <>
                            <div className="oa-code-toolbar">
                              <label>
                                {t('代码语言', 'Language')}{' '}
                                <select
                                  value={language}
                                  onChange={(event) => {
                                    setLanguage(event.target.value);
                                    setCopyMessage('');
                                    copyGeneration.current++;
                                  }}
                                >
                                  {[
                                    ...new Set(
                                      solution.solutions.map(
                                        (item) => item.language,
                                      ),
                                    ),
                                  ].map((value) => (
                                    <option value={value} key={value}>
                                      {languageNames[value] || value}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <span role="status">{copyMessage}</span>
                            </div>
                            {codeBlocks.map((block, index) => (
                              <div key={`${language}-${index}`}>
                                {codeBlocks.length > 1 && (
                                  <h4>
                                    {t(
                                      `代码 ${index + 1}`,
                                      `Code ${index + 1}`,
                                    )}
                                  </h4>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const generation = ++copyGeneration.current;
                                    try {
                                      await navigator.clipboard.writeText(
                                        block.code,
                                      );
                                      if (generation === copyGeneration.current)
                                        setCopyMessage(t('已复制', 'Copied'));
                                    } catch {
                                      if (generation === copyGeneration.current)
                                        setCopyMessage(
                                          t(
                                            '复制失败，请手动选择代码复制',
                                            'Copy failed. Select the code and copy it manually.',
                                          ),
                                        );
                                    }
                                  }}
                                >
                                  {codeBlocks.length > 1
                                    ? t(
                                        `复制代码 ${index + 1}`,
                                        `Copy code ${index + 1}`,
                                      )
                                    : t('复制代码', 'Copy code')}
                                </button>
                                <pre className="oa-code">
                                  <code>{block.code}</code>
                                </pre>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    );
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const chooseCompany = (slug: string) => {
    setCompany(slug);
    setPage(1);
  };
  const zh = locale === 'zh';
  // The chosen topic stays an option even when the other filters leave it no matches.
  const topicOptions =
    topic && !topics.some((item) => item.slug === topic)
      ? [...topics, { slug: topic, count: 0 }]
      : topics;
  const anyEstimated = data?.items.some(
    (item) => item.judgeStatus === 'ready' && item.difficultyEstimated,
  );
  // Sidebar counts follow the practice-ready toggle, so "All companies" matches the result count.
  const shownCount = (item: Page['companies'][number]) =>
    readyOnly ? (item.ready ?? item.count) : item.count;
  const companyTotal = companies.reduce((total, item) => total + shownCount(item), 0);
  const visibleCompanies = companies.filter((item) =>
    companyName(item.slug, item.name)
      .toLocaleLowerCase()
      .includes(companySearch.trim().toLocaleLowerCase()),
  );
  return (
    <section
      className="study-library oa-library"
      aria-label={t('OA 题目', 'OA problems')}
    >
      <header className="study-library-heading">
        <div>
          <h2>{t('OA 题目', 'OA problems')}</h2>
          <p>
            {t(
              '按公司查找 OA 题，完成样例和提交。已验证的题目可直接练习，其余题目的评测数据正在准备中。',
              'Find OA problems by company, run the examples and submit. Verified problems are ready to practice; test data for the rest is still being prepared.',
            )}
          </p>
        </div>
      </header>
      {newThisWeek > 0 && (
        <button
          type="button"
          className="oa-new-banner"
          onClick={() => {
            // Only the newest list: every other filter is cleared.
            setSort('new');
            setCompany('');
            setTopic('');
            setStatus('');
            setQuery('');
            setSearch('');
            setReadyOnly(true);
            setPage(1);
          }}
        >
          <span className="oa-new-dot" aria-hidden="true" />
          {t(`本周新增 ${newThisWeek} 道可练习 OA 题`, `${newThisWeek} practice-ready OA ${newThisWeek === 1 ? 'problem' : 'problems'} added this week`)}
          <span className="oa-new-cta">
            {t('按上线时间查看', 'See newest first')} <span aria-hidden="true">→</span>
          </span>
        </button>
      )}
      <div className="oa-browser">
        <aside
          className="oa-company-sidebar"
          aria-label={t('按公司筛选', 'Filter by company')}
        >
          <div className="oa-company-heading">
            <h3>{t('公司', 'Companies')}</h3>
            <span>
              {t(
                `${companies.length} 类`,
                `${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`,
              )}
            </span>
          </div>
          <label className="oa-company-search">
            {t('搜索公司', 'Search companies')}
            <input
              type="search"
              value={companySearch}
              placeholder={t('输入公司名称', 'Company name')}
              onChange={(event) => setCompanySearch(event.target.value)}
            />
          </label>
          <nav
            className="oa-company-nav"
            aria-label={t('OA 公司', 'OA companies')}
          >
            <button
              type="button"
              aria-pressed={!company}
              onClick={() => chooseCompany('')}
            >
              <span>{t('全部公司', 'All companies')}</span>
              <span>{companyTotal}</span>
            </button>
            <div className="oa-company-options">
              {visibleCompanies.map((item) => (
                <button
                  type="button"
                  key={item.slug}
                  aria-pressed={company === item.slug}
                  onClick={() => chooseCompany(item.slug)}
                >
                  <CompanyIdentity
                    slug={item.slug}
                    name={companyName(item.slug, item.name)}
                  />
                  <span>{shownCount(item)}</span>
                </button>
              ))}
              {!visibleCompanies.length && (
                <p role="status">
                  {t('没有匹配的公司', 'No matching companies')}
                </p>
              )}
            </div>
          </nav>
          <p className="oa-company-caption">
            {readyOnly
              ? t('数量为可练习题目数', 'Counts are practice-ready problems')
              : t('数量为收录题目总数', 'Counts include every listed problem')}
          </p>
        </aside>
        <div className="oa-browser-results">
          <div className="study-filters">
            <label>
              <input
                type="checkbox"
                checked={readyOnly}
                onChange={(event) => {
                  setReadyOnly(event.target.checked);
                  setPage(1);
                }}
              />
              {t('只看可练习', 'Practice-ready only')}
            </label>
            <label className="oa-search">
              {t('搜索题目', 'Search problems')}
              <input
                type="search"
                value={query}
                placeholder={t('输入题目名称', 'Problem title')}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="oa-company-mobile">
              {t('公司', 'Company')}
              <select
                value={company}
                onChange={(event) => chooseCompany(event.target.value)}
              >
                <option value="">{t('全部公司', 'All companies')}</option>
                {companies.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {companyName(item.slug, item.name)} ({shownCount(item)})
                  </option>
                ))}
              </select>
            </label>
            <label className="oa-topic-filter">
              {t('专题', 'Topic')}
              <select
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('全部专题', 'All topics')}</option>
                {topicOptions.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {topicName(item.slug, zh)} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            {/* Progress only means something with an account; a filter from a link stays visible. */}
            {(signedIn || status) && (
              <label className="oa-status-filter">
                {t('进度', 'Progress')}
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t('全部进度', 'Any progress')}</option>
                  <option value="todo">{t('尚未通过', 'Not solved')}</option>
                  <option value="attempted">{t('尝试过 · 未通过', 'Attempted · Not solved')}</option>
                  <option value="solved">{t('已通过', 'Solved')}</option>
                </select>
              </label>
            )}
            <label className="oa-level-filter">
              {t('难度', 'Difficulty')}
              <select
                value={level}
                title={t('包含 AI 估计的难度', 'Includes AI-estimated levels')}
                onChange={(event) => {
                  setLevel(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('全部难度', 'Any difficulty')}</option>
                <option value="easy">{t('简单', 'Easy')}</option>
                <option value="medium">{t('中等', 'Medium')}</option>
                <option value="hard">{t('困难', 'Hard')}</option>
              </select>
            </label>
            <label className="oa-sort-filter">
              {t('排序', 'Order')}
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('按公司题号', 'By company')}</option>
                <option value="new">{t('最新上线', 'Newest first')}</option>
              </select>
            </label>
            <button
              type="button"
              className="oa-pick-one"
              disabled={picking}
              onClick={pickOne}
            >
              <Shuffle size={14} aria-hidden="true" /> {t('随机一题', 'Pick one')}
            </button>
          </div>
          <p className="oa-pick-message" role="status">
            {pickMessage}
          </p>
          {loading ? (
            <p className="study-state" role="status">
              {t('正在加载 OA 题目…', 'Loading OA problems…')}
            </p>
          ) : error ? (
            <div className="study-state" role="alert">
              {t(error, readErrorEn(error))} {retryButton}
            </div>
          ) : (
            data && (
              <>
                <p className="study-result-summary" role="status">
                  {t(
                    `共 ${data.total} 道${readyOnly ? '可练习的' : ''} OA 题目 · 来源 OA Master`,
                    `${data.total}${readyOnly ? ' practice-ready' : ''} OA ${data.total === 1 ? 'problem' : 'problems'} · Source: OA Master`,
                  )}
                  {sort === 'new' &&
                    t(' · 按上线时间倒序', ' · newest first')}
                  {anyEstimated &&
                    t(
                      ' · 难度带 ≈ 的是 AI 估计，专题同为 AI 标注',
                      ' · ≈ marks an AI-estimated difficulty; topics are AI-labelled too',
                    )}
                </p>
                {data.items.length === 0 ? (
                  <p className="study-state">
                    {t(
                      '没有找到匹配题目，试试其他关键词或公司。',
                      'No matching problems. Try another keyword or company.',
                    )}
                  </p>
                ) : (
                  <div className="study-list oa-list">
                    <div className="oa-list-head" aria-hidden="true">
                      <span />
                      <span>{t('公司', 'Company')}</span>
                      <span>{t('题号', '#')}</span>
                      <span>{t('题目', 'Title')}</span>
                      <span>{t('难度', 'Difficulty')}</span>
                    </div>
                    {data.items.map((item) => (
                      // A real link for new tabs and crawlers; a plain click stays in the app.
                      <a
                        className="oa-row"
                        key={item.id}
                        href={oaProblemPath(item.companySlug, item.id)}
                        onClick={(event) => {
                          if (!plainClick(event)) return;
                          if (
                            item.judgeStatus === 'ready' &&
                            item.judgeProblemId &&
                            navigate
                          ) {
                            rememberProblemSequence(
                              data.items.flatMap((row) =>
                                row.judgeStatus === 'ready' &&
                                row.judgeProblemId
                                  ? [row.judgeProblemId]
                                  : [],
                              ),
                            );
                            navigate('problem', {
                              problem: item.judgeProblemId,
                            });
                          } else setSelected(item.id);
                        }}
                      >
                        <span
                          className="oa-progress"
                          data-progress={item.progress}
                          title={item.progress && progressLabels[item.progress]}
                        >
                          {item.progress && (
                            <span className="oa-visually-hidden">
                              {progressLabels[item.progress]}
                            </span>
                          )}
                        </span>
                        <span className="oa-company">
                          <CompanyIdentity
                            slug={item.companySlug}
                            name={companyName(item.companySlug, item.companyName)}
                          />
                        </span>
                        <span className="oa-number">#{item.number}</span>
                        <span className="oa-title">
                          <strong>
                            {item.title}
                            {item.starred && (
                              <>
                                <Star className="study-star" size={14} aria-hidden="true" />
                                <span className="sr-only">{t('（已收藏）', ' (starred)')}</span>
                              </>
                            )}
                          </strong>
                          {sort === 'new' && item.addedAt && (
                            <small className="oa-added">
                              <time dateTime={new Date(item.addedAt).toISOString()}>
                                {t(
                                  `${new Date(item.addedAt).toISOString().slice(5, 10)} 上线`,
                                  `Added ${new Date(item.addedAt).toISOString().slice(0, 10)}`,
                                )}
                              </time>
                            </small>
                          )}
                          {item.kind && Object.hasOwn(OA_KIND_NAMES, item.kind) && (
                            <small data-kind={item.kind}>{t(...OA_KIND_NAMES[item.kind])}</small>
                          )}
                          {[
                            ...new Set([
                              // Only unusual languages (SQL, Bash…) tell the reader something.
                              ...item.languages
                                .filter((lang) => !codeLanguages.has(lang))
                                .map((lang) => languageNames[lang] || lang),
                              // The estimated topics replace the packages' uneven tags.
                              ...(item.topics?.length
                                ? item.topics.map((slug) => topicName(slug, zh))
                                : item.tags || []),
                            ]),
                          ].map((tag) => (
                            <small key={tag}>{tag}</small>
                          ))}
                        </span>
                        <span
                          className="oa-difficulty"
                          data-level={
                            item.judgeStatus === 'ready'
                              ? difficultyLevels[item.difficulty || '']
                              : 'reading'
                          }
                        >
                          {item.judgeStatus === 'ready' ? (
                            item.difficulty ? (
                              <span
                                title={
                                  item.difficultyEstimated
                                    ? t('AI 估计的难度', 'AI-estimated difficulty')
                                    : undefined
                                }
                              >
                                {item.difficultyEstimated && (
                                  <>
                                    <span aria-hidden="true">≈</span>
                                    <span className="oa-visually-hidden">
                                      {t('估计', 'Estimated ')}
                                    </span>
                                  </>
                                )}
                                {t(
                                  item.difficulty,
                                  difficultyNames[item.difficulty] ||
                                    item.difficulty,
                                )}
                              </span>
                            ) : (
                              '—'
                            )
                          ) : (
                            t('仅题面', 'Statement only')
                          )}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
                {data.total > 0 && (
                  <nav
                    className="study-pagination"
                    aria-label={t('OA 题目分页', 'OA problem pages')}
                  >
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      {t('上一页', 'Previous')}
                    </button>
                    <span>
                      {t(
                        `第 ${data.page} / ${pages} 页`,
                        `Page ${data.page} of ${pages}`,
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={page >= pages}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      {t('下一页', 'Next')}
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </div>
      </div>
    </section>
  );
}

/** Company identity comes from the authenticated catalogue, never an ID guess. */
export function OaCompanyBadge({
  problemId,
  english = false,
}: {
  problemId: string;
  english?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [identity, setIdentity] = useState<{
    id: string;
    companyName: string;
    companySlug: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setIdentity(null);
    read<Detail>('/' + encodeURIComponent(problemId), controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && value.id === problemId)
          setIdentity({
            id: value.id,
            companyName: value.companyName,
            companySlug: value.companySlug,
          });
      })
      .catch(() => {
        /* Optional identity must not block the problem workspace. */
      });
    return () => controller.abort();
  }, [problemId]);
  return (
    <div className="oa-workspace-company">
      <span className="oa-badge">
        {english ? 'OA problem' : t('OA 题目', 'OA problem')}
      </span>
      {identity?.id === problemId && (
        <strong>
          <CompanyIdentity
            slug={identity.companySlug}
            name={oaCompanyName(
              identity.companySlug,
              identity.companyName,
              english ? 'en' : locale,
            )}
          />
        </strong>
      )}
    </div>
  );
}

/** Mounted only after the learner selects the editorial tab. */
export function OaEditorial({ problemId }: { problemId: string }) {
  const t = useT();
  const [data, setData] = useState<Solution | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    read<Solution>(
      '/' + encodeURIComponent(problemId) + '/solution',
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [problemId, attempt]);
  if (error)
    return (
      <div role="alert">
        {t(error, readErrorEn(error))}{' '}
        <button onClick={() => setAttempt((n) => n + 1)}>
          {t('重试', 'Retry')}
        </button>
      </div>
    );
  if (!data)
    return <p role="status">{t('正在加载题解…', 'Loading solution…')}</p>;
  return (
    <section aria-label={t('题解', 'Solution')} className="oa-solution">
      <OaMarkdown body={data.explanation} />
      {data.solutions.map((solution, index) => (
        <div key={solution.language + index}>
          <h3>{languageNames[solution.language] || solution.language}</h3>
          <pre className="oa-code">
            <code>{solution.code}</code>
          </pre>
        </div>
      ))}
    </section>
  );
}
