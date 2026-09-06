'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Search,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { LessonMarkdown } from './lms-shared';
import { api } from '@/lib/types';
import type { Navigate } from './learning';

type LibraryItem = {
  id: string;
  number: number;
  slug: string;
  titleZh: string;
  titleEn: string;
  difficulty: string;
  topics: string[];
  caseStatus: 'unverified' | 'missing' | 'verified';
  caseCount: number;
  judgeProblemId: string | null;
};
type LibraryPage = {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  topics: string[];
};
type LibraryDetail = LibraryItem & {
  descriptionZh: string;
  descriptionEn: string;
  sourceUrl: string;
  sourceEnUrl: string;
  attribution: string;
  signature: object;
  caseSummary: { total: number; withExpected: number };
};
const difficultyLabels: Record<string, string> = {
  Easy: '简单',
  Medium: '中等',
  Hard: '困难',
  easy: '简单',
  medium: '中等',
  hard: '困难',
};
function title(item: LibraryItem, english: boolean) {
  return (
    (english ? item.titleEn : item.titleZh) || item.titleEn || item.titleZh
  );
}
function safeSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['leetcode.cn', 'leetcode.com'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function canJudge(item: LibraryItem) {
  return item.caseStatus === 'verified' && !!item.judgeProblemId;
}

export function StudyLibrary({
  navigate,
  availableProblemIds,
}: {
  navigate: Navigate;
  availableProblemIds: string[];
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LibraryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<LibraryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [english, setEnglish] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      setEnglish(localStorage.getItem('cswork:problem:locale') === 'en');
    } catch {}
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      q: search,
      topic,
      difficulty,
      page: String(page),
    });
    api<LibraryPage>(`oj/library?${params}`)
      .then((result) => {
        if (current) setData(result);
      })
      .catch((reason: Error) => {
        if (current) setError(reason.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [search, topic, difficulty, page, retry]);
  useEffect(() => {
    let current = true;
    setDetail(null);
    setDetailError('');
    setCopyMessage('');
    if (!selected) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    api<LibraryDetail>(`oj/library/${encodeURIComponent(selected)}`)
      .then((result) => {
        if (current) setDetail(result);
      })
      .catch((reason: Error) => {
        if (current) setDetailError(reason.message);
      })
      .finally(() => {
        if (current) setDetailLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selected, detailRetry]);
  useEffect(() => {
    if (detail) detailHeading.current?.focus();
  }, [detail]);
  function changeLanguage(value: string) {
    setEnglish(value === 'en');
    setCopyMessage('');
    try {
      localStorage.setItem('cswork:problem:locale', value);
    } catch {}
  }
  const languageControl = (
    <label className="study-language">
      题面语言
      <select
        aria-label="题单题面语言"
        value={english ? 'en' : 'zh'}
        onChange={(event) => changeLanguage(event.target.value)}
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );

  if (selected) {
    const judgeAccess =
      !!detail?.judgeProblemId &&
      availableProblemIds.includes(detail.judgeProblemId);
    const source =
      detail &&
      safeSource(
        (english ? detail.sourceEnUrl : detail.sourceUrl) || detail.sourceUrl,
      );
    const body =
      detail && (english ? detail.descriptionEn : detail.descriptionZh);
    const fallbackBody =
      detail && (detail.descriptionZh || detail.descriptionEn);
    return (
      <section className="study-library study-detail">
        <div className="study-detail-toolbar">
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            返回题单
          </Button>
          {languageControl}
        </div>
        {detailLoading && (
          <output className="study-state">正在加载题面…</output>
        )}
        {detailError && (
          <div className="study-state" role="alert">
            <p>{detailError}</p>
            <Button
              variant="outline"
              onClick={() => setDetailRetry((n) => n + 1)}
            >
              重试
            </Button>
          </div>
        )}
        {detail && (
          <>
            <header className="study-detail-heading">
              <div className="study-kicker">LEETCODE · {detail.number}</div>
              <h2 ref={detailHeading} tabIndex={-1}>
                {title(detail, english)}
              </h2>
              <div className="study-topic-list">
                <span
                  className="study-level"
                  data-level={detail.difficulty.toLowerCase()}
                >
                  {difficultyLabels[detail.difficulty] || detail.difficulty}
                </span>
                {detail.topics.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </header>
            <div className="study-judge-status">
              <div>
                <strong>
                  {canJudge(detail)
                    ? judgeAccess
                      ? '可以在 cswork 编写并提交'
                      : '站内练习需先开通对应课程'
                    : '测试数据校验中'}
                </strong>
                <p>
                  {canJudge(detail)
                    ? judgeAccess
                      ? '站内判题使用已验证的测试数据。'
                      : '仍可查看原题，并前往 LeetCode 练习。'
                    : '题面已可阅读。测试数据验证完成前，请前往原题练习。'}
                </p>
              </div>
              {canJudge(detail) && judgeAccess && (
                <Button
                  onClick={() =>
                    navigate('problem', { problem: detail.judgeProblemId! })
                  }
                >
                  进入站内判题
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
            <div className="study-source-actions">
              {source && (
                <>
                  <a href={source} target="_blank" rel="noopener noreferrer">
                    {english ? 'Open original problem' : '打开原题'}
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(source);
                        setCopyMessage('原题链接已复制');
                      } catch {
                        setCopyMessage('复制失败，请使用打开原题链接');
                      }
                    }}
                  >
                    <Copy size={14} />
                    复制链接
                  </button>
                </>
              )}
              <output>{copyMessage}</output>
            </div>
            {!body && fallbackBody && (
              <output className="study-language-fallback">
                {english
                  ? 'English translation is not available. Showing the available statement.'
                  : '本题暂无中文题面，显示英文原题。'}
              </output>
            )}
            <article
              className="study-statement"
              lang={body ? (english ? 'en' : 'zh') : undefined}
            >
              <LessonMarkdown
                body={body || fallbackBody || '题面暂不可用，请查看原题。'}
              />
            </article>
            <footer className="study-attribution">{detail.attribution}</footer>
          </>
        )}
      </section>
    );
  }

  const pages = Math.max(
    1,
    Math.ceil((data?.total || 0) / (data?.pageSize || 30)),
  );
  return (
    <section className="study-library">
      <header className="study-library-heading">
        <div>
          <span className="study-kicker">STEP BY STEP</span>
          <h2>跟着题单，稳步练习。</h2>
          <p>
            按专题找到下一道题。中英题面随时切换，验证完成的题目可直接在站内提交。
          </p>
        </div>
        {languageControl}
      </header>
      <div className="study-filters">
        <div className="study-search">
          <Search size={17} />
          <Input
            aria-label="搜索灵神题单"
            placeholder="搜索题号、中英文名称…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <label>
          专题
          <select
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部专题</option>
            {data?.topics.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          难度
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部难度</option>
            <option value="简单">简单</option>
            <option value="中等">中等</option>
            <option value="困难">困难</option>
          </select>
        </label>
      </div>
      <div className="study-result-summary" aria-live="polite">
        {loading
          ? '正在查找题目…'
          : error
            ? '暂时无法加载'
            : `共 ${data?.total || 0} 道题`}
      </div>
      {error ? (
        <div className="study-state" role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            重新加载
          </Button>
        </div>
      ) : loading ? (
        <output className="study-state">正在加载题单…</output>
      ) : !data?.items.length ? (
        <div className="study-state">
          <h3>没有找到匹配的题目</h3>
          <p>换个关键词，或清除筛选后再试。</p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setSearch('');
              setTopic('');
              setDifficulty('');
              setPage(1);
            }}
          >
            清除筛选
          </Button>
        </div>
      ) : (
        <>
          <div className="study-list">
            {data.items.map((item) => (
              <button
                type="button"
                className="study-row"
                key={item.id}
                onClick={() => setSelected(item.id)}
              >
                <span className="study-number">{item.number}</span>
                <span className="study-row-main">
                  <strong>{title(item, english)}</strong>
                  <span className="study-row-secondary">
                    {english ? item.titleZh : item.titleEn}
                  </span>
                  <span className="study-row-topics">
                    {item.topics.slice(0, 3).join(' · ')}
                  </span>
                </span>
                <span className="study-row-end">
                  <span
                    className="study-level"
                    data-level={item.difficulty.toLowerCase()}
                  >
                    {difficultyLabels[item.difficulty] || item.difficulty}
                  </span>
                  <span
                    className={canJudge(item) ? 'study-ready' : 'study-pending'}
                  >
                    {canJudge(item) ? (
                      <>
                        <Check size={13} />
                        站内判题
                      </>
                    ) : (
                      '测试数据校验中'
                    )}
                  </span>
                </span>
                <ChevronRight className="study-row-arrow" size={17} />
              </button>
            ))}
          </div>
          <nav className="study-pagination" aria-label="题单分页">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((n) => n - 1)}
              aria-label="上一页"
            >
              <ChevronLeft size={16} />
              上一页
            </Button>
            <span>
              第 {data.page} / {pages} 页
            </span>
            <Button
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((n) => n + 1)}
              aria-label="下一页"
            >
              下一页
              <ChevronRight size={16} />
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
