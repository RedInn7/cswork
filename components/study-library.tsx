'use client';

import { useEffect, useRef, useState } from 'react';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { PracticeCalendar } from './practice-calendar';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Clock3,
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
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { LeetcodeSyncPanel } from './leetcode-sync-panel';
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
  solved?: boolean;
  solvedLocally?: boolean;
  importedSources?: string[];
  progressStatus?: 'solved' | 'attempted' | 'not_started';
  judging?: boolean;
  selection?: {
    order: number;
    sectionSlug: string;
    sectionTitle: string;
    sectionTitleEn?: string;
    stage: string;
    stageEn?: string;
    reason: string;
    reasonEn?: string;
  } | null;
};
type PracticeRound = {
  id: string;
  number: number;
  createdAt: number;
  solved: number;
};
type RoundState = {
  rounds: PracticeRound[];
  activeRoundId: string;
  currentRound: Omit<PracticeRound, 'solved'>;
};
type LibraryPage = RoundState & {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  topics: string[];
  sequence?: string[];
  nextProblemId?: string | null;
  collection?: {
    id: string;
    title: string;
    total: number;
    available: number;
    ready: number;
    solved: number;
    sections: {
      slug: string;
      title: string;
      titleEn?: string;
      total: number;
      solved: number;
    }[];
  };
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
  activity = [],
  signedIn = false,
}: {
  navigate: Navigate;
  availableProblemIds: string[];
  activity?: { problem_id: string; created_at: number }[];
  signedIn?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const collection = 'ling-selected-500';
  const [roundBusy, setRoundBusy] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [roundError, setRoundError] = useState('');
  const [roundNotice, setRoundNotice] = useState('');
  const roundPending = useRef(false);
  const createKey = useRef<string | null>(null);
  const listRequest = useRef(0);
  const [section, setSection] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LibraryPage | null>(null);
  const [dataQuery, setDataQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<LibraryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const siteLocale = useLocale();
  const [english, setEnglish] = useState(siteLocale === 'en');
  const [copyMessage, setCopyMessage] = useState('');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const t = (zh: string, en: string) => (english ? en : zh);
  const difficultyName = (value: string) =>
    english
      ? (
          {
            简单: 'Easy',
            中等: 'Medium',
            困难: 'Hard',
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
          } as Record<string, string>
        )[value] || value
      : difficultyLabels[value] || value;

  async function changeRound(roundId?: string) {
    if (roundPending.current) return;
    roundPending.current = true;
    ++listRequest.current;
    setRoundBusy(true);
    setRoundError('');
    setRoundNotice('');
    try {
      if (!roundId && !createKey.current) {
        let savedKey: string | null = null;
        try {
          savedKey = sessionStorage.getItem('cswork:practice:create-key');
        } catch {}
        createKey.current = savedKey || crypto.randomUUID();
        try {
          sessionStorage.setItem(
            'cswork:practice:create-key',
            createKey.current,
          );
        } catch {}
      }
      const result = await api<RoundState>(
        'oj/practice-rounds',
        roundId
          ? { action: 'activate', roundId }
          : { action: 'create', idempotencyKey: createKey.current },
      );
      if (!roundId) {
        createKey.current = null;
        try {
          sessionStorage.removeItem('cswork:practice:create-key');
        } catch {}
      }
      setData((previous) => (previous ? { ...previous, ...result } : previous));
      setRoundNotice(roundId ? 'activated' : 'created');
      setPage(1);
    } catch (reason) {
      setRoundError(
        reason instanceof Error ? reason.message : 'Request failed',
      );
    } finally {
      roundPending.current = false;
      setRoundBusy(false);
      setRetry((value) => value + 1);
    }
  }

  useEffect(() => {
    // The page's language switch (shared with the problem page) wins until the site
    // language is switched, which clears it.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('cswork:problem:locale');
    } catch {}
    setEnglish(stored ? stored === 'en' : siteLocale === 'en');
    setCopyMessage('');
  }, [siteLocale]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const refreshProgress = () => {
      if (!roundPending.current) setRetry((value) => value + 1);
    };
    window.addEventListener('focus', refreshProgress);
    window.addEventListener(
      'cswork:practice-progress-changed',
      refreshProgress,
    );
    return () => {
      window.removeEventListener('focus', refreshProgress);
      window.removeEventListener(
        'cswork:practice-progress-changed',
        refreshProgress,
      );
    };
  }, []);
  useEffect(() => {
    if (roundBusy || !data?.items.some((item) => item.judging)) return;
    // A learner may leave the editor while the worker is still judging.
    // Poll only the visible page, and stop as soon as its verdicts finish.
    const timer = window.setInterval(() => {
      if (!roundPending.current) setRetry((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [data, roundBusy, page, search, difficulty, section, stage, status]);
  useEffect(() => {
    if (roundBusy) return;
    let current = true;
    const request = ++listRequest.current;
    queueMicrotask(() => {
      if (current && request === listRequest.current) {
        setLoading(true);
        setError('');
      }
    });
    const params = new URLSearchParams({
      q: search,
      difficulty,
      page: String(page),
      collection,
      section,
      stage,
      status,
    });
    api<LibraryPage>(`oj/library?${params}`)
      .then((result) => {
        if (current && request === listRequest.current) {
          setData(result);
          setDataQuery(params.toString());
        }
      })
      .catch((reason: Error) => {
        if (current && request === listRequest.current)
          setError(reason.message);
      })
      .finally(() => {
        if (current && request === listRequest.current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    search,
    difficulty,
    page,
    retry,
    collection,
    section,
    stage,
    status,
    roundBusy,
  ]);
  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (current) {
        setDetail(null);
        setDetailError('');
        setCopyMessage('');
        setDetailLoading(!!selected);
      }
    });
    if (!selected)
      return () => {
        current = false;
      };
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
      {t('题面语言', 'Language')}
      <select
        aria-label={t('题单语言', 'Collection language')}
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
      <section
        className="study-library study-detail"
        lang={english ? 'en' : 'zh'}
      >
        <div className="study-detail-toolbar">
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft size={16} />
            {t('返回题单', 'Back to collection')}
          </Button>
          {languageControl}
        </div>
        {detailLoading && (
          <output className="study-state">
            {t('正在加载题面…', 'Loading problem…')}
          </output>
        )}
        {detailError && (
          <div className="study-state" role="alert">
            <p>{t(detailError, englishMessage(detailError))}</p>
            <Button
              variant="outline"
              onClick={() => setDetailRetry((n) => n + 1)}
            >
              {t('重试', 'Retry')}
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
                  {difficultyName(detail.difficulty)}
                </span>
                {detail.selection && (
                  <span>
                    {english
                      ? detail.selection.sectionTitleEn ||
                        detail.selection.sectionTitle
                      : detail.selection.sectionTitle}
                  </span>
                )}
              </div>
            </header>
            {detail.selection && (
              <aside className="study-selection-note">
                <strong>
                  {t('灵神题单精选', 'Ling’s Curated 500')} ·{' '}
                  {english
                    ? detail.selection.sectionTitleEn ||
                      detail.selection.sectionTitle
                    : detail.selection.sectionTitle}{' '}
                  ·{' '}
                  {english
                    ? detail.selection.stageEn || detail.selection.stage
                    : detail.selection.stage}
                </strong>
                <p>
                  {english
                    ? detail.selection.reasonEn || detail.selection.reason
                    : detail.selection.reason}
                </p>
              </aside>
            )}
            <div className="study-judge-status">
              <div>
                <strong>
                  {canJudge(detail)
                    ? judgeAccess
                      ? t(
                          '可以在 cswork 编写并提交',
                          'Write and submit on cswork',
                        )
                      : t(
                          '站内判题暂未开放',
                          'On-site judging is not open yet',
                        )
                    : detail.caseStatus === 'missing'
                      ? t('测试数据待补充', 'Test cases pending')
                      : t('测试数据待校验', 'Test verification pending')}
                </strong>
                <p>
                  {canJudge(detail)
                    ? judgeAccess
                      ? t(
                          '站内判题使用已验证的测试数据。',
                          'Submissions run against verified test cases.',
                        )
                      : t(
                          '仍可查看原题，并前往 LeetCode 练习。',
                          'You can still read the statement and practice on LeetCode.',
                        )
                    : t(
                        '题面已可阅读。测试数据验证完成前，请前往原题练习。',
                        'Read the statement here and practice on LeetCode until tests are verified.',
                      )}
                </p>
              </div>
              {canJudge(detail) && judgeAccess && (
                <Button
                  onClick={() =>
                    navigate('problem', { problem: detail.judgeProblemId! })
                  }
                >
                  {t('进入站内判题', 'Start coding')}
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
            <div className="study-source-actions">
              {source && (
                <>
                  <a href={source} target="_blank" rel="noopener noreferrer">
                    {t('打开原题', 'Open original problem')}
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(source);
                        setCopyMessage(
                          t('原题链接已复制', 'Original problem link copied'),
                        );
                      } catch {
                        setCopyMessage(
                          t(
                            '复制失败，请使用打开原题链接',
                            'Could not copy. Use the original problem link.',
                          ),
                        );
                      }
                    }}
                  >
                    <Copy size={14} />
                    {t('复制链接', 'Copy link')}
                  </button>
                </>
              )}
              <output>{copyMessage}</output>
            </div>
            {!body && fallbackBody && (
              <output className="study-language-fallback">
                {t(
                  '本题暂无中文题面，显示英文原题。',
                  'English translation is not available. Showing the available statement.',
                )}
              </output>
            )}
            <article
              className="study-statement"
              lang={body ? (english ? 'en' : 'zh') : undefined}
            >
              <LessonMarkdown
                body={
                  body ||
                  fallbackBody ||
                  t(
                    '题面暂不可用，请查看原题。',
                    'Statement unavailable. Open the original problem.',
                  )
                }
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
  // The server only returns rounds to their owner, so a round also proves sign-in.
  const member = signedIn || !!data?.currentRound;
  // Must match the list request's parameters exactly, in the same order.
  const currentQuery = new URLSearchParams({
    q: search,
    difficulty,
    page: String(page),
    collection,
    section,
    stage,
    status,
  }).toString();
  // The server picks the next unsolved judgeable problem across the whole list;
  // never act on a previous filter's response while a new one is loading.
  const nextProblemId =
    loading && dataQuery !== currentQuery ? null : data?.nextProblemId;
  return (
    <section className="study-library" lang={english ? 'en' : 'zh'}>
      <div className="study-hero">
        <div className="study-hero-main">
      <header className="study-library-heading">
        <div>
          <h2>{t('灵神题单精选', 'Ling’s Curated 500')}</h2>
          <p>
            {t(
              '面向美国 SDE 编程面试，从基础到进阶练习 500 道题。由 cswork 从灵神题单中筛选与编排。',
              '500 problems for US SDE coding interviews, from fundamentals to advanced topics. Selected and organized by cswork from Ling’s study lists.',
            )}
          </p>
        </div>
        {languageControl}
      </header>
      {(!member ||
        data?.currentRound ||
        (collection === 'ling-selected-500' && data?.collection)) && (
        // One compact bar so the problem list starts above the fold.
        <div className="study-dashboard" aria-busy={roundBusy}>
          {!member && (
            <div className="study-dashboard-signin">
              <span>
                {t(
                  '登录后记录每一轮的通过进度，并在站内提交代码。',
                  'Sign in to track each round and submit code here.',
                )}
              </span>
              <Button
                onClick={() =>
                  window.dispatchEvent(new Event('cswork:auth-required'))
                }
              >
                {t('登录 / 注册', 'Sign in')}
              </Button>
            </div>
          )}
          {member &&
            collection === 'ling-selected-500' &&
            data?.collection &&
            !error && (
              <div className="study-dashboard-stats">
                <div>
                  <span>
                    {t(
                      `第 ${data.currentRound?.number || 1} 轮通过`,
                      `Solved in round ${data.currentRound?.number || 1}`,
                    )}
                  </span>
                  <strong>
                    {data.collection.solved}
                    <small> / {data.collection.total}</small>
                  </strong>
                  <progress
                    aria-label={t('本轮通过进度', 'Current round progress')}
                    value={data.collection.solved}
                    max={data.collection.total}
                  />
                </div>
                <div>
                  <span>{t('站内可判题', 'Ready to submit')}</span>
                  <strong>
                    {data.collection.ready}
                    <small> {t('道', 'problems')}</small>
                  </strong>
                </div>
              </div>
            )}
          {data?.currentRound && (
            <>
              <div className="study-round-actions">
                {nextProblemId && (
                  <Button
                    onClick={() => {
                      rememberProblemSequence(data.sequence ?? [nextProblemId]);
                      navigate('problem', { problem: nextProblemId });
                    }}
                  >
                    {t('继续刷题', 'Continue')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  aria-expanded={syncOpen}
                  onClick={() => setSyncOpen((open) => !open)}
                >
                  {t('同步 LeetCode', 'Sync LeetCode')}
                </Button>
                <label htmlFor="practice-round">
                  {t('当前轮次', 'Current round')}
                </label>
                <select
                  id="practice-round"
                  value={data.activeRoundId}
                  disabled={roundBusy || loading}
                  onChange={(event) => void changeRound(event.target.value)}
                >
                  {data.rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {t(`第 ${round.number} 轮`, `Round ${round.number}`)} ·{' '}
                      {round.solved}/{data.collection?.total || 500}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={roundBusy || loading}
                  onClick={() => void changeRound()}
                  title={t(
                    '每轮单独记录通过进度；新开一轮会从零开始，历史进度和提交记录保留。',
                    'Each round tracks its own progress. Start fresh while keeping every earlier round and submission.',
                  )}
                >
                  {roundBusy
                    ? t('正在更新…', 'Updating…')
                    : t('新开一轮', 'Start a new round')}
                </Button>
              </div>
              {roundNotice && (
                <output className="study-round-feedback">
                  {roundNotice === 'created'
                    ? t(
                        '新一轮已开启，之前的进度已保留。',
                        'New round started. Your earlier progress is saved.',
                      )
                    : t(
                        '已切换轮次，可继续这一轮的练习。',
                        'Round switched. Continue practicing in this round.',
                      )}
                </output>
              )}
              {roundError && (
                <p className="study-round-feedback error-text" role="alert">
                  {t(
                    '更新失败，请重试。',
                    'Could not update your round. Please retry.',
                  )}{' '}
                  {t(roundError, englishMessage(roundError))}
                </p>
              )}
            </>
          )}
        </div>
      )}
        </div>
        <PracticeCalendar activity={activity} signedIn={signedIn} />
      </div>
      {syncOpen && data?.currentRound && (
        <LeetcodeSyncPanel
          rounds={data.rounds}
          currentRoundId={data.activeRoundId}
          onClose={() => setSyncOpen(false)}
          onChanged={() => setRetry((value) => value + 1)}
        />
      )}
      <fieldset className="study-filters" disabled={roundBusy}>
        <legend className="sr-only">{t('筛选题目', 'Filter problems')}</legend>
        <div className="study-search">
          <Search size={17} />
          <Input
            aria-label={t('搜索灵神题单', 'Search curated problems')}
            placeholder={t(
              '搜索题号、中英文名称…',
              'Search number or Chinese / English title…',
            )}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <label>
          {t('专题', 'Topic')}
          <select
            aria-label={t('精选专题', 'Curated topic')}
            value={section}
            onChange={(event) => {
              setSection(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('全部专题', 'All topics')}</option>
            {data?.collection?.sections.map((item) => (
              <option key={item.slug} value={item.slug}>
                {`${english ? item.titleEn || item.title : item.title}${
                  member ? ` · ${item.solved}/${item.total}` : ''
                }`}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('难度', 'Difficulty')}
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('全部难度', 'All difficulties')}</option>
            <option value="简单">{t('简单', 'Easy')}</option>
            <option value="中等">{t('中等', 'Medium')}</option>
            <option value="困难">{t('困难', 'Hard')}</option>
          </select>
        </label>
        {collection === 'ling-selected-500' && (
          <>
            <label>
              {t('阶段', 'Stage')}
              <select
                value={stage}
                onChange={(event) => {
                  setStage(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('全部阶段', 'All stages')}</option>
                {['基础', '核心', '进阶'].map((item) => (
                  <option key={item} value={item}>
                    {t(
                      item,
                      (
                        {
                          基础: 'Foundation',
                          核心: 'Core',
                          进阶: 'Advanced',
                        } as Record<string, string>
                      )[item] || item,
                    )}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('进度', 'Progress')}
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('全部题目', 'All problems')}</option>
                {/* Round progress filters only mean something with an account. */}
                {member && (
                  <>
                    <option value="todo">
                      {t('尚未通过', 'Not solved this round')}
                    </option>
                    <option value="solved">
                      {t('已通过', 'Solved this round')}
                    </option>
                    <option value="attempted">
                      {t('已尝试 · 未通过', 'Attempted · Not solved')}
                    </option>
                    <option value="not_started">
                      {t('未开始', 'Not started')}
                    </option>
                  </>
                )}
                <option value="ready">
                  {t('可站内判题', 'Ready to submit')}
                </option>
              </select>
            </label>
          </>
        )}
      </fieldset>
      <div className="study-result-summary" aria-live="polite">
        {loading
          ? t('正在查找题目…', 'Finding problems…')
          : error
            ? t('暂时无法加载', 'Unable to load right now')
            : t(`共 ${data?.total || 0} 道题`, `${data?.total || 0} problems`)}
      </div>
      {error ? (
        <div className="study-state" role="alert">
          <p>{t(error, englishMessage(error))}</p>
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            {t('重新加载', 'Reload')}
          </Button>
        </div>
      ) : loading && (!data || dataQuery !== currentQuery) ? (
        // Background refreshes (window focus, judging polls) keep the current list;
        // a new filter or page never shows the previous query's rows as if current.
        <output className="study-state">
          {t('正在加载题单…', 'Loading collection…')}
        </output>
      ) : !data?.items.length ? (
        <div className="study-state">
          <h3>{t('没有找到匹配的题目', 'No matching problems')}</h3>
          <p>
            {t(
              '换个关键词，或清除筛选后再试。',
              'Try another search or clear your filters.',
            )}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setQuery('');
              setSearch('');
              setDifficulty('');
              setSection('');
              setStage('');
              setStatus('');
              setPage(1);
            }}
          >
            {t('清除筛选', 'Clear filters')}
          </Button>
        </div>
      ) : (
        <>
          <div className="study-list" aria-busy={loading}>
            <div className="study-list-head" aria-hidden="true">
              <span />
              <span>{t('题目', 'Problem')}</span>
              <span>{t('难度', 'Difficulty')}</span>
            </div>
            {data.items.map((item) => (
              <button
                type="button"
                className="study-row"
                data-progress={
                  item.solved ? 'solved' : item.progressStatus || 'not_started'
                }
                key={item.id}
                onClick={() => {
                  // Statements need an account; ask to sign in rather than open an empty page.
                  if (!member) {
                    window.dispatchEvent(new Event('cswork:auth-required'));
                    return;
                  }
                  if (canJudge(item)) {
                    rememberProblemSequence(
                      data.items.flatMap((row) =>
                        canJudge(row) ? [row.judgeProblemId!] : [],
                      ),
                    );
                    navigate('problem', { problem: item.judgeProblemId! });
                  } else setSelected(item.id);
                }}
              >
                <span
                  className="study-progress"
                  data-progress={
                    item.solved
                      ? 'solved'
                      : item.progressStatus || 'not_started'
                  }
                  title={
                    item.solved
                      ? t('已通过', 'Solved')
                      : item.judging
                        ? t('判题中', 'Judging')
                        : item.progressStatus === 'attempted'
                          ? t('未通过', 'Not solved')
                          : t('未开始', 'Not started')
                  }
                >
                  {item.solved ? (
                    <Check size={18} aria-hidden="true" />
                  ) : item.judging ? (
                    <Clock3 size={18} aria-hidden="true" />
                  ) : item.progressStatus === 'attempted' ? (
                    <Circle size={18} aria-hidden="true" />
                  ) : null}
                  <span className="sr-only">
                    {item.solved
                      ? t('已通过', 'Solved')
                      : item.judging
                        ? t('判题中', 'Judging')
                        : item.progressStatus === 'attempted'
                          ? t('未通过', 'Not solved')
                          : t('未开始', 'Not started')}
                  </span>
                </span>
                <span
                  className="study-row-main"
                  title={`${item.number}. ${title(item, english)}`}
                >
                  <strong>
                    <span className="study-number">{item.number}.</span>{' '}
                    {title(item, english)}
                    {item.selection && (
                      <span className="study-row-section">
                        {english
                          ? item.selection.sectionTitleEn ||
                            item.selection.sectionTitle
                          : item.selection.sectionTitle}
                      </span>
                    )}
                  </strong>
                  {!!item.importedSources?.length && (
                    <small>
                      {item.solvedLocally
                        ? t('本站通过 · ', 'Local AC · ')
                        : ''}
                      {item.importedSources
                        .map((source) =>
                          source === 'cn'
                            ? t('力扣国区通过', 'LeetCode CN AC')
                            : t('LeetCode 美区通过', 'LeetCode US AC'),
                        )
                        .join(' · ')}
                    </small>
                  )}
                </span>
                <span
                  className="study-level"
                  data-level={item.difficulty.toLowerCase()}
                >
                  {difficultyName(item.difficulty)}
                </span>
              </button>
            ))}
          </div>
          <nav
            className="study-pagination"
            aria-label={t('题单分页', 'Problem pagination')}
          >
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((n) => n - 1)}
              aria-label={t('上一页', 'Previous page')}
            >
              <ChevronLeft size={16} />
              {t('上一页', 'Previous')}
            </Button>
            <span>
              {t(
                `第 ${data.page} / ${pages} 页`,
                `Page ${data.page} of ${pages}`,
              )}
            </span>
            <Button
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((n) => n + 1)}
              aria-label={t('下一页', 'Next page')}
            >
              {t('下一页', 'Next')}
              <ChevronRight size={16} />
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
