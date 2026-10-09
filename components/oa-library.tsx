'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Navigate } from './learning';
import { companyInitials, companyLogos } from '@/lib/oa-company-brands';
import { rememberProblemSequence } from '@/lib/problem-sequence';

function companyHue(slug: string) {
  let hash = 0;
  for (const char of slug || '') hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

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
            // Stable per-company hue so a missing logo still reads as an identity mark.
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
  tags?: string[];
  progress?: 'solved' | 'attempted';
};
const difficultyLevels: Record<string, string> = {
  简单: 'easy',
  中等: 'medium',
  困难: 'hard',
};
const codeLanguages = new Set(['python', 'java', 'cpp', 'go']);
const progressLabels = { solved: '已通过', attempted: '尝试过' } as const;
type Page = {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  companies: { slug: string; name: string; count: number }[];
  source: { name: string; url: string; commit: string };
};
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

export function OaMarkdown({ body }: { body: string }) {
  return (
    <div className="oa-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            safeLink(href) ? (
              <a
                href={safeLink(href)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => <span>{alt ? `[图片：${alt}]` : '[图片]'}</span>,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export function OaLibrary({ navigate }: { navigate?: Navigate }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [readyOnly, setReadyOnly] = useState(true);
  const [page, setPage] = useState(1);
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
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    const params = new URLSearchParams({
      q: search,
      company,
      page: String(page),
      ready: readyOnly ? '1' : '0',
    });
    read<Page>('?' + params, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setCompanies(value.companies);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, company, page, retry, readyOnly]);
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
      重试
    </button>
  );
  const codeBlocks =
    solution?.solutions.filter((item) => item.language === language) || [];
  const currentDetail = detail?.id === selected ? detail : null;
  if (selected)
    return (
      <section className="study-library oa-library" aria-label="OA 题目详情">
        <button
          className="oa-back"
          type="button"
          onClick={() => setSelected(null)}
        >
          ← 返回 OA 题目
        </button>
        {detailError ? (
          <div role="alert">
            {detailError} {retryButton}
          </div>
        ) : !currentDetail ? (
          <p role="status">正在加载题目…</p>
        ) : (
          <>
            <header className="study-library-heading">
              <div>
                <span className="study-kicker">
                  OA 题目 · {currentDetail.companyName} · OA MASTER
                </span>
                <h2 ref={heading} tabIndex={-1}>
                  {currentDetail.title}
                </h2>
                <p>
                  {currentDetail.judgeStatus === 'ready'
                    ? '运行样例、提交代码，查看评测结果。'
                    : currentDetail.relatedPractice
                      ? currentDetail.relatedPractice.description
                      : '评测准备中，暂可阅读原题。'}
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
                      开始练习
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
                      进入四阶段综合练习
                    </button>
                  )}
              </div>
            </header>
            <div className="oa-source">
              来源：OA Master{' '}
              {safeLink(currentDetail.sourceUrl) && (
                <a
                  href={safeLink(currentDetail.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看原题 ↗
                </a>
              )}
            </div>
            {currentDetail.statement.trim() ? (
              <OaMarkdown body={currentDetail.statement} />
            ) : (
              <p className="oa-source">
                原站未提供独立题面，可查看题解或原站。
              </p>
            )}
            {currentDetail.judgeStatus === 'ready' && (
              <section className="oa-solution" aria-label="题解">
                <button
                  type="button"
                  aria-expanded={solutionOpen}
                  aria-controls="oa-solution-body"
                  onClick={() => setSolutionOpen((value) => !value)}
                >
                  {solutionOpen ? '收起题解' : '查看题解'}
                </button>
                {solutionOpen && (
                  <div id="oa-solution-body">
                    {solutionError ? (
                      <div role="alert">
                        {solutionError} {retryButton}
                      </div>
                    ) : !solution ? (
                      <p role="status">正在加载题解…</p>
                    ) : (
                      <>
                        {solution.explanation.trim() ? (
                          <OaMarkdown body={solution.explanation} />
                        ) : (
                          <p className="oa-source">题解正在准备中。</p>
                        )}
                        {solution.solutions.length === 0 && (
                          <p className="oa-source">本题未提供参考代码。</p>
                        )}
                        {solution.solutions.length > 0 && (
                          <>
                            <div className="oa-code-toolbar">
                              <label>
                                代码语言{' '}
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
                                  <h4>代码 {index + 1}</h4>
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
                                        setCopyMessage('已复制');
                                    } catch {
                                      if (generation === copyGeneration.current)
                                        setCopyMessage(
                                          '复制失败，请手动选择代码复制',
                                        );
                                    }
                                  }}
                                >
                                  {codeBlocks.length > 1
                                    ? `复制代码 ${index + 1}`
                                    : '复制代码'}
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
  const companyTotal = companies.reduce((total, item) => total + item.count, 0);
  const visibleCompanies = companies.filter((item) =>
    item.name
      .toLocaleLowerCase()
      .includes(companySearch.trim().toLocaleLowerCase()),
  );
  return (
    <section className="study-library oa-library" aria-label="OA 题目">
      <header className="study-library-heading">
        <div>
          <h2>OA 题目</h2>
          <p>
            按公司查找 OA
            题，完成样例和提交。已验证的题目可直接练习，其余题目的评测数据正在准备中。
          </p>
        </div>
      </header>
      <div className="oa-browser">
        <aside className="oa-company-sidebar" aria-label="按公司筛选">
          <div className="oa-company-heading">
            <h3>公司</h3>
            <span>{companies.length} 类</span>
          </div>
          <label className="oa-company-search">
            搜索公司
            <input
              type="search"
              value={companySearch}
              placeholder="输入公司名称"
              onChange={(event) => setCompanySearch(event.target.value)}
            />
          </label>
          <nav className="oa-company-nav" aria-label="OA 公司">
            <button
              type="button"
              aria-pressed={!company}
              onClick={() => chooseCompany('')}
            >
              <span>全部公司</span>
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
                  <CompanyIdentity slug={item.slug} name={item.name} />
                  <span>{item.count}</span>
                </button>
              ))}
              {!visibleCompanies.length && <p role="status">没有匹配的公司</p>}
            </div>
          </nav>
          <p className="oa-company-caption">数量为收录题目总数</p>
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
              只看可练习
            </label>
            <label className="oa-search">
              搜索题目
              <input
                type="search"
                value={query}
                placeholder="输入题目名称"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="oa-company-mobile">
              公司
              <select
                value={company}
                onChange={(event) => chooseCompany(event.target.value)}
              >
                <option value="">全部公司</option>
                {companies.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p className="study-state" role="status">
              正在加载 OA 题目…
            </p>
          ) : error ? (
            <div className="study-state" role="alert">
              {error} {retryButton}
            </div>
          ) : (
            data && (
              <>
                <p className="study-result-summary" role="status">
                  共 {data.total} 道 OA 题目 · 来源 OA Master
                </p>
                {data.items.length === 0 ? (
                  <p className="study-state">
                    没有找到匹配题目，试试其他关键词或公司。
                  </p>
                ) : (
                  <div className="study-list oa-list">
                    <div className="oa-list-head" aria-hidden="true">
                      <span />
                      <span>公司</span>
                      <span>题号</span>
                      <span>题目</span>
                      <span>难度</span>
                    </div>
                    {data.items.map((item) => (
                      <button
                        type="button"
                        className="oa-row"
                        key={item.id}
                        onClick={() => {
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
                            name={item.companyName}
                          />
                        </span>
                        <span className="oa-number">#{item.number}</span>
                        <span className="oa-title">
                          <strong>{item.title}</strong>
                          {[
                            ...new Set([
                              // Only unusual languages (SQL, Bash…) tell the reader something.
                              ...item.languages
                                .filter((lang) => !codeLanguages.has(lang))
                                .map((lang) => languageNames[lang] || lang),
                              ...(item.tags || []),
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
                          {item.judgeStatus === 'ready'
                            ? item.difficulty || '—'
                            : '仅题面'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {data.total > 0 && (
                  <nav className="study-pagination" aria-label="OA 题目分页">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((n) => n - 1)}
                    >
                      上一页
                    </button>
                    <span>
                      第 {data.page} / {pages} 页
                    </span>
                    <button
                      type="button"
                      disabled={page >= pages}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      下一页
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
      <span className="oa-badge">{english ? 'OA problem' : 'OA 题目'}</span>
      {identity?.id === problemId && (
        <strong>
          <CompanyIdentity
            slug={identity.companySlug}
            name={identity.companyName}
          />
        </strong>
      )}
    </div>
  );
}

/** Mounted only after the learner selects the editorial tab. */
export function OaEditorial({ problemId }: { problemId: string }) {
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
        {error} <button onClick={() => setAttempt((n) => n + 1)}>重试</button>
      </div>
    );
  if (!data) return <p role="status">正在加载题解…</p>;
  return (
    <section aria-label="题解" className="oa-solution">
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
