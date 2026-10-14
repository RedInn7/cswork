'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { rememberLibraryQuery, rememberProblemSequence } from '@/lib/problem-sequence';
import { PracticeCalendar, usePracticeStats } from './practice-calendar';
import { StudyPlan, useStudyPlan, type PlanTodo } from './study-plan';
import { RouteLine } from './route-line';
import {
  askedText,
  routeStops,
  stopFromUrl,
  topicName,
  type RouteStop,
} from '@/lib/route-stops';
import { dailySolved, dailyStreak, type DailyProblem } from '@/lib/daily-problem';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Search,
  Shuffle,
  Star,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { StatementMarkdown } from './statement-markdown';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { LeetcodeSyncPanel } from './leetcode-sync-panel';
import { CompanyMarks } from './company-tags';
import { RatingBadge } from './rating-badge';
import { ContestGrid } from './contest-grid';
import { LEETCODE_SYNC_AVAILABLE } from '@/lib/leetcode-sync-types';
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
  /** Contest rating (zerotrac), null outside rated contests. */
  rating?: number | null;
  /** Accepted share in %, sent only while sorting by it. */
  acceptance?: number;
  solved?: boolean;
  solvedLocally?: boolean;
  importedSources?: string[];
  progressStatus?: 'solved' | 'attempted' | 'not_started';
  judging?: boolean;
  /** The signed-in learner's own marks. */
  starred?: boolean;
  redo?: boolean;
  /** Up to two companies that asked it, for the row marks, with their report counts. */
  companies?: { slug: string; name: string; count?: number; last?: string }[];
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
  /** Companies on the line, with how many of its problems they asked. */
  companies?: { slug: string; name: string; count: number }[];
  sequence?: string[];
  /** What is left of the sequence, for the sprint plan. */
  planTodo?: PlanTodo[];
  nextProblemId?: string | null;
  /** The recommended next problem, for everyone (signed out: the first stop). */
  next?: {
    judgeProblemId: string | null;
    number: number;
    titleZh: string;
    titleEn: string;
    difficulty: string;
    sectionSlug: string;
    stage: string;
  } | null;
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
      stages?: Record<string, { total: number; solved: number }>;
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
const urlParam = (key: string) =>
  typeof location === 'undefined'
    ? ''
    : new URLSearchParams(location.search).get(key) || '';
const SORTS = ['frequency', 'number', 'difficulty', 'rating', 'acceptance'];
/** Rating bands for the filter, as ratingMin-ratingMax (an open end is empty). */
const BANDS = ['0-1199', '1200-1399', '1400-1599', '1600-1899', '1900-2099', '2100-2399', '2400-'];

/** This local month as YYYY-MM, the month box's value format. */
const thisMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function StudyLibrary({
  navigate,
  availableProblemIds,
  activity = [],
  signedIn = false,
  userId,
  daily,
  purchasedFreezes,
}: {
  navigate: Navigate;
  availableProblemIds: string[];
  activity?: { problem_id: string; created_at: number }[];
  /** Streak freezes bought with points, from the bootstrap. */
  purchasedFreezes?: number[];
  /** Today's problem from the bootstrap. */
  daily?: DailyProblem | null;
  signedIn?: boolean;
  /** Keys the sprint plan on this device; guests share one. */
  userId?: string | null;
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
  // ?section=<stop> opens on that stop (links from the mock OA topics).
  const [section, setSection] = useState(stopFromUrl);
  // Kept in the URL, so going back or reloading reopens the stop chosen since.
  useEffect(() => {
    if (typeof location === 'undefined') return;
    const url = new URL(location.href);
    if (section) url.searchParams.set('section', section);
    else url.searchParams.delete('section');
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }, [section]);
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  // Company pages link here with ?company=<slug>&sort=frequency.
  const [company, setCompany] = useState(() => urlParam('company').slice(0, 80));
  const [sort, setSort] = useState(() => (SORTS.includes(urlParam('sort')) ? urlParam('sort') : ''));
  const [dir, setDir] = useState<string>(() => (urlParam('dir') === 'desc' ? 'desc' : 'asc'));
  // Report counts belong to one company: without a filter the line keeps its order.
  const order = sort === 'frequency' && !company ? '' : sort;
  // A rating band, one of the learner's lists (or a public one linked here), a solved month.
  const [band, setBand] = useState('');
  const [list, setList] = useState(() => urlParam('list').slice(0, 40));
  const [lists, setLists] = useState<{ id: string; title: string }[]>([]);
  // What the month box holds; a browser without a month picker types it, so only a whole
  // YYYY-MM filters.
  const [monthInput, setMonthInput] = useState('');
  const solvedMonth = /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : '';
  // ?browse=contests: the bank by weekly contest instead of the line.
  const [browse, setBrowse] = useState(() => (urlParam('browse') === 'contests' ? 'contests' : 'line'));
  useEffect(() => {
    if (typeof location === 'undefined') return;
    const url = new URL(location.href);
    if (browse === 'contests') url.searchParams.set('browse', 'contests');
    else url.searchParams.delete('browse');
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }, [browse]);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    api<{ items: { id: string; title: string }[] }>('oj/lists').then(
      (result) => {
        if (current)
          setLists(result.items.filter((l) => typeof l.id === 'string' && typeof l.title === 'string'));
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [signedIn]);
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LibraryPage | null>(null);
  const [dataQuery, setDataQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [picking, setPicking] = useState(false);
  const [pickMessage, setPickMessage] = useState('');
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
  const stats = usePracticeStats(activity, english, daily?.done, purchasedFreezes);
  // The daily streak's "now"; shown only after mount (with stats), so SSR never reads it.
  const [openedAt] = useState(Date.now);
  // Per-device preferences: a folded line and the sprint plan, whose daily
  // count (else the "n a day" picker) is today's target.
  const [folded, setFolded] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    try {
      setFolded(localStorage.getItem('cswork:route:folded') === '1');
    } catch {}
  }, []);
  function changeFolded(value: boolean) {
    setFolded(value);
    try {
      localStorage.setItem('cswork:route:folded', value ? '1' : '0');
    } catch {}
  }
  const sprint = useStudyPlan(userId, data?.planTodo, data?.sequence, activity);
  const target = sprint.target;
  function changeTarget(value: number) {
    if (sprint.goal) sprint.save({ ...sprint.goal, dailyTarget: value });
  }
  // Reaching the daily target is celebrated once per day on this device. It waits
  // for the panel so its live region exists before the text arrives.
  const lineShown = !!data?.collection;
  useEffect(() => {
    if (!stats || !signedIn || !lineShown || !target || stats.today < target) return;
    const day = new Date().toDateString();
    try {
      if (localStorage.getItem('cswork:practice:trip-done') === day) return;
      localStorage.setItem('cswork:practice:trip-done', day);
    } catch {
      return;
    }
    setCelebrate(true);
  }, [stats, signedIn, lineShown, target]);
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
  }, [data, roundBusy, page, search, difficulty, section, stage, status, company]);
  const [ratingMin, ratingMax] = band ? band.split('-') : ['', ''];
  // The list request; the page compares it with the response's to spot stale rows.
  const listQuery = new URLSearchParams({
    q: search,
    difficulty,
    page: String(page),
    collection,
    section,
    stage,
    status,
    company,
    sort: order,
    ...(!!order && order !== 'frequency' && { dir }),
    ...(!!ratingMin && { ratingMin }),
    ...(!!ratingMax && { ratingMax }),
    ...(!!list && { list }),
    // Months are the learner's own: the server reads them in this browser's zone.
    ...(!!solvedMonth && { solved: solvedMonth, tz: String(new Date().getTimezoneOffset()) }),
  }).toString();
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
    api<LibraryPage>(`oj/library?${listQuery}`)
      .then((result) => {
        if (current && request === listRequest.current) {
          setData(result);
          setDataQuery(listQuery);
          rememberLibraryQuery(new URLSearchParams(listQuery));
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
  }, [listQuery, retry, roundBusy]);
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
              <StatementMarkdown
                // The workspace's statement repairs (scripts in `10^{9}`, CJK bold), page styles.
                className="prose-content lms-markdown"
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
  const currentQuery = listQuery;
  // Any order but the line's (or a company's report count, grouped as before) drops the stop headings.
  const lineOrder = !order || order === 'frequency';
  // next, nextProblemId and sequence span the whole line, so a previous
  // filter's response still holds them; only its rows are stale while loading.
  const stale = loading && dataQuery !== currentQuery;
  // A sprint plan from a later stop starts the trip there: the CTA, the stop on
  // show and the list's mark follow it. Only the line's first problem has a
  // ticket, so it hides then.
  const planStart = member ? sprint.start : undefined;
  const nextProblemId = planStart?.[0] ?? data?.nextProblemId;
  const next =
    planStart && planStart[0] !== data?.next?.judgeProblemId ? null : (data?.next ?? null);
  const route = data?.collection ? routeStops(data.collection.sections) : null;
  const stops = route?.stops ?? [];
  const currentSlug =
    (planStart ? stops[planStart[2] ?? 0]?.slug : undefined) ??
    next?.sectionSlug ??
    stops.find((stop) => stop.solved < stop.total)?.slug ??
    stops.at(-1)?.slug ??
    '';
  const currentStop = stops.find((stop) => stop.slug === currentSlug);
  const solvedAll =
    member &&
    !!data?.collection &&
    data.collection.solved >= data.collection.total;
  const roundNumber = data?.currentRound?.number || 1;
  const stageNames: Record<string, string> = {
    基础: t('基础', 'Foundation'),
    核心: t('核心', 'Core'),
    进阶: t('进阶', 'Advanced'),
  };
  const stopName = (stop: RouteStop) =>
    english ? stop.titleEn || stop.title : stop.title;
  const today = stats?.today ?? 0;
  const dailyRun = member && stats && daily ? dailyStreak(daily.done, openedAt) : 0;
  const dailyDone = member && !!daily && dailySolved(daily);
  // 0 on a mock OA or OA day: no practice planned.
  const tripDone = member && !!target && today >= target;
  const startNext = () => {
    const id = nextProblemId ?? next?.judgeProblemId;
    if (!id) return;
    const sequence = data?.sequence ?? [id];
    // From the plan's start stop, previous/next stay on the planned part of the line.
    rememberProblemSequence(
      planStart ? sequence.slice(Math.max(0, sequence.indexOf(id))) : sequence,
    );
    navigate('problem', { problem: id });
  };
  // "Pick one": the server draws an unsolved judgeable problem under the current filters.
  const pickOne = async () => {
    setPicking(true);
    setPickMessage('');
    try {
      const { random } = await api<{ random?: string | null }>(
        `oj/library?${currentQuery}&random=1`,
      );
      if (random) {
        // Previous/next and "back to list" follow this line, not the last list opened.
        rememberProblemSequence(data?.sequence ?? [random]);
        navigate('problem', { problem: random });
      } else
        setPickMessage(
          t(
            '当前筛选下没有未通过的可判题目。',
            'No unsolved judgeable problem matches these filters.',
          ),
        );
    } catch (reason) {
      setPickMessage((reason as Error).message);
    } finally {
      setPicking(false);
    }
  };
  const selectStop = (slug: string) => {
    setSection(slug);
    setPage(1);
  };
  // The control that moved focus unmounts; land on the stop, or on any stop the
  // stage lens leaves enabled.
  const focusStop = (slug: string) =>
    requestAnimationFrame(() => {
      const radio = document.getElementById(`route-stop-${slug}`);
      (radio instanceof HTMLInputElement && !radio.disabled
        ? radio
        : document.querySelector<HTMLInputElement>('.route-stops input:not(:disabled)')
      )?.focus();
    });
  const selectedStop = stops.find((stop) => stop.slug === section);
  const pips = (value?: string) => {
    const level = value === '进阶' ? 3 : value === '核心' ? 2 : value ? 1 : 0;
    if (!level) return null;
    return (
      <span
        className="study-pips"
        data-level={level}
        title={t(`阶段：${value}`, `Stage: ${stageNames[value!] || value}`)}
      >
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <span className="sr-only">{stageNames[value!] || value}</span>
      </span>
    );
  };
  const kicker = !member || !data?.collection?.solved
    ? t('始发站', 'First stop')
    : solvedAll && !next
      ? t('终点站', 'End of the line')
      : t('下一站', 'Next stop');
  const remaining = currentStop ? currentStop.total - currentStop.solved : 0;
  const daysLeft = data?.collection
    ? Math.ceil((data.collection.total - data.collection.solved) / target)
    : 0;

  return (
    <section className="study-library study-bank" lang={english ? 'en' : 'zh'}>
      <header className="study-library-heading">
        <div>
          <h2>
            <span className="route-roundel" aria-hidden="true">
              500
            </span>
            {t('灵神题单精选', 'Ling’s Curated 500')}
          </h2>
          <p>
            {t(
              '35 个专题、500 道题，按顺序从基础练到进阶。由 cswork 从灵神题单中筛选编排。',
              '35 topics and 500 problems in order, from fundamentals to advanced. Selected and ordered by cswork from Ling’s study lists.',
            )}
          </p>
        </div>
        {languageControl}
      </header>
      {route && currentStop ? (
        <div
          className="study-route"
          data-folded={folded || undefined}
          data-member={member || undefined}
          aria-busy={roundBusy}
        >
          <div className="route-announce">
            <div className="route-stop-now">
              <span className="route-led" aria-hidden="true">
                {currentStop.code}
              </span>
              <span className="sr-only">
                {t(`第 ${currentStop.index + 1} 站`, `Stop ${currentStop.index + 1}`)}
              </span>
              <div>
                <p className="route-kicker">
                  {kicker}
                  {member && !!stats?.streak && (
                    <span className="route-streak-chip">
                      {t(`连续 ${stats.streak} 天`, `${stats.streak}-day streak`)}
                    </span>
                  )}
                </p>
                <h3 className="route-name">{stopName(currentStop)}</h3>
                <p className="route-stop-count">
                  {member
                    ? t(
                        `本站已通过 ${currentStop.solved} / ${currentStop.total}`,
                        `${currentStop.solved} of ${currentStop.total} solved at this stop`,
                      )
                    : t(
                        `本站共 ${currentStop.total} 道题`,
                        `${currentStop.total} problems at this stop`,
                      )}
                  {member && remaining > 0 && remaining <= 3 && (
                    <span className="route-to-go">
                      {t(`还差 ${remaining} 题`, `${remaining} to go`)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {next && (
              <div className="route-ticket">
                <span className="study-number">{next.number}</span>
                <strong>{english ? next.titleEn || next.titleZh : next.titleZh || next.titleEn}</strong>
                <span
                  className="route-level study-level"
                  data-level={next.difficulty.toLowerCase()}
                >
                  {difficultyName(next.difficulty)}
                </span>
                {pips(next.stage)}
              </div>
            )}
            {daily && (
              <div
                className="route-ticket route-daily"
                data-done={dailyDone || undefined}
              >
                <span className="route-daily-tag">
                  <Star size={14} aria-hidden="true" />
                  {t('今日一题', 'Daily problem')}
                </span>
                <strong>{english ? daily.titleEn || daily.title : daily.title}</strong>
                <span
                  className="route-level study-level"
                  data-level={daily.difficulty.toLowerCase()}
                >
                  {difficultyName(daily.difficulty)}
                </span>
                <a
                  className="route-daily-go"
                  // Guests get the public page: OA statements are open, LeetCode needs an account.
                  href={
                    member
                      ? `/?${new URLSearchParams({ view: 'problem', problem: daily.id })}`
                      : '/daily'
                  }
                  onClick={(event) => {
                    if (!member || event.button || event.metaKey || event.ctrlKey || event.shiftKey)
                      return;
                    event.preventDefault();
                    navigate('problem', { problem: daily.id });
                  }}
                >
                  {dailyDone ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      {t('已完成', 'Done')}
                    </>
                  ) : member ? (
                    t('去做题', 'Solve it')
                  ) : (
                    t('查看', 'View')
                  )}
                </a>
                <span className="route-daily-meta">
                  {daily.kind === 'oa'
                    ? t(`${daily.company?.name ?? ''} OA · 双号日练热门公司 OA`, `${daily.company?.name ?? ''} OA · even dates bring a hot company’s OA`)
                    : t(
                        `500 路 · ${topicName(daily.stop ?? '', true)} · 单号日练 500 路`,
                        `Line 500 · ${topicName(daily.stop ?? '', false)} · odd dates ride Line 500`,
                      )}
                  {dailyRun > 0 && (
                    <span className="route-daily-run">
                      {t(`每日一题连续 ${dailyRun} 天`, `${dailyRun}-day daily streak`)}
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="route-actions">
              {!member ? (
                <Button
                  className="route-cta"
                  onClick={() =>
                    window.dispatchEvent(new Event('cswork:auth-required'))
                  }
                >
                  {t('登录后上车', 'Sign in to board')}
                </Button>
              ) : nextProblemId || next ? (
                <Button className="route-cta" onClick={startNext}>
                  {tripDone
                    ? t('再刷一题', 'One more problem')
                    : t('开始下一题', 'Start next problem')}
                </Button>
              ) : solvedAll ? (
                <Button
                  className="route-cta"
                  disabled={roundBusy || loading}
                  onClick={() => void changeRound()}
                >
                  {t(`开始第 ${roundNumber + 1} 轮`, `Start round ${roundNumber + 1}`)}
                </Button>
              ) : null}
              {member && (
                <div
                  className="route-today"
                  data-celebrate={(celebrate && tripDone) || undefined}
                >
                  <span className="route-today-label">
                    {t('今日行程', 'Today’s trip')}
                  </span>
                  {target ? (
                    <>
                      <span className="route-punches" aria-hidden="true">
                        {Array.from({ length: target }, (_, k) => (
                          <i
                            key={k}
                            className="route-punch"
                            data-on={k < today || undefined}
                            style={{ '--k': k } as React.CSSProperties}
                          />
                        ))}
                      </span>
                      <span className="route-today-count" aria-hidden="true">
                        {Math.min(today, 99)} / {target}
                      </span>
                      <span className="sr-only">
                        {t(
                          `今天已通过 ${today} 题，目标 ${target} 题`,
                          `${today} of ${target} solved today`,
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="route-today-rest">
                      {sprint.plan?.days[0]?.oa
                        ? t('OA 日，不排练习题', 'OA day, no practice planned')
                        : t('模拟 OA 日，不排练习题', 'Mock OA day, no practice planned')}
                    </span>
                  )}
                  {/* A sprint plan sets the count; its summary below says how. */}
                  {!sprint.plan?.daily && (
                    <label className="route-target">
                      <span className="sr-only">{t('每日目标', 'Daily target')}</span>
                      <select
                        value={target}
                        onChange={(event) => changeTarget(Number(event.target.value))}
                      >
                        {[1, 2, 3, 5].map((n) => (
                          <option key={n} value={n}>
                            {t(`每天 ${n} 题`, `${n} a day`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <output className="sr-only" aria-live="polite">
                    {celebrate && tripDone
                      ? t(
                          `今日行程完成：已通过 ${today} 题`,
                          `Today’s trip is done: ${today} solved`,
                        )
                      : ''}
                  </output>
                </div>
              )}
            </div>
            {member && data?.collection && !solvedAll && !sprint.plan && (
              <p className="route-pace">
                {t(
                  `按每天 ${target} 题，约 ${daysLeft} 天到终点站。`,
                  `At ${target} a day, about ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to the end of the line.`,
                )}
              </p>
            )}
            {!member ? (
              <p className="route-note">
                {t(
                  '登录后，线路图会点亮你走过的每一站，并可在站内提交代码。',
                  'Sign in to light up every stop you pass and submit code here.',
                )}
              </p>
            ) : solvedAll && !next ? (
              <p className="route-note">
                {t(
                  `第 ${roundNumber} 轮的 ${data?.collection?.total} 道题已全部通过。`,
                  `You solved all ${data?.collection?.total} problems in round ${roundNumber}.`,
                )}
              </p>
            ) : !next && !nextProblemId ? (
              <p className="route-note">
                {t(
                  '站内可提交的题目已全部通过，其余题目可前往 LeetCode 练习。',
                  'You’ve solved every problem you can submit here. Practice the rest on LeetCode.',
                )}
              </p>
            ) : null}
            <StudyPlan
              goal={sprint.goal}
              plan={sprint.plan}
              today={sprint.today}
              onSave={sprint.save}
              stops={stops}
              english={english}
            />
          </div>
          <div className="route-habit">
            <PracticeCalendar
              stats={stats}
              signedIn={member}
              target={target}
              t={t}
              lineTotal={data?.collection?.total}
            />
          </div>
          <div className="route-line" id="route-line">
            <div className="route-line-head">
              <span className="route-head-stats">
                {member && data?.collection ? (
                  <>
                    <span>
                      {t(`第 ${roundNumber} 轮通过`, `Solved in round ${roundNumber}`)}
                    </span>
                    <strong>
                      {data.collection.solved}
                      <small> / {data.collection.total}</small>
                    </strong>
                    <span>
                      {t(
                        `已到站 ${stops.filter((stop) => stop.total && stop.solved >= stop.total).length} / ${stops.length}`,
                        `${stops.filter((stop) => stop.total && stop.solved >= stop.total).length} of ${stops.length} stops complete`,
                      )}
                    </span>
                  </>
                ) : (
                  <span>
                    {t(
                      `${stops.length} 站，${data?.collection?.total} 道题`,
                      `${stops.length} stops, ${data?.collection?.total} problems`,
                    )}
                  </span>
                )}
              </span>
              {stops.some((stop) => stop.companies) && (
                <span className="route-heat-key">
                  <i aria-hidden="true" />
                  {t('热度点：面经出现越多越亮', 'Dots glow with interview reports')}
                </span>
              )}
              <a className="route-graph-link" href="/roadmap">
                {t('查看依赖图', 'Prerequisite graph')}
              </a>
              {data?.currentRound && (
                <details className="route-round">
                  <summary>
                    {t(`第 ${roundNumber} 轮`, `Round ${roundNumber}`)}
                    <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <div className="route-round-panel">
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
                    <Button
                      variant="outline"
                      aria-expanded={syncOpen}
                      disabled={!LEETCODE_SYNC_AVAILABLE}
                      aria-describedby={
                        LEETCODE_SYNC_AVAILABLE ? undefined : 'leetcode-sync-off'
                      }
                      onClick={() => setSyncOpen((open) => !open)}
                    >
                      {t('同步 LeetCode', 'Sync LeetCode')}
                    </Button>
                    {!LEETCODE_SYNC_AVAILABLE && (
                      <span id="leetcode-sync-off" className="route-ready">
                        {t(
                          '同步暂不可用：LeetCode 接口有变化，正在适配。',
                          "Sync is temporarily unavailable: LeetCode changed its API and we're adapting.",
                        )}
                      </span>
                    )}
                    {data.collection && (
                      <span className="route-ready">
                        {t(
                          `站内可判题 ${data.collection.ready} 道`,
                          `${data.collection.ready} ready to submit here`,
                        )}
                      </span>
                    )}
                  </div>
                </details>
              )}
              <button
                type="button"
                className="route-fold"
                aria-expanded={!folded}
                aria-controls="route-line"
                onClick={() => changeFolded(!folded)}
              >
                {folded ? (
                  <ChevronDown size={16} aria-hidden="true" />
                ) : (
                  <ChevronUp size={16} aria-hidden="true" />
                )}
                <span className="sr-only">
                  {folded
                    ? t('展开线路图', 'Expand the line')
                    : t('收起线路图', 'Collapse the line')}
                </span>
              </button>
            </div>
            <RouteLine
              stops={stops}
              runs={route.runs}
              currentSlug={currentSlug}
              selected={section}
              onSelect={selectStop}
              stage={stage}
              stageName={stageNames[stage] || ''}
              member={member}
              english={english}
              disabled={roundBusy}
            />
          </div>
        </div>
      ) : (
        <output className="study-state route-loading">
          {error
            ? t('暂时无法加载', 'Unable to load right now')
            : t('正在读取线路…', 'Loading the line…')}
        </output>
      )}
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
          {t('更新失败，请重试。', 'Could not update your round. Please retry.')}{' '}
          {t(roundError, englishMessage(roundError))}
        </p>
      )}
      {syncOpen && data?.currentRound && (
        <LeetcodeSyncPanel
          rounds={data.rounds}
          currentRoundId={data.activeRoundId}
          onClose={() => setSyncOpen(false)}
          onChanged={() => setRetry((value) => value + 1)}
        />
      )}
      {member && (
        <div className="study-browse" role="group" aria-label={t('浏览方式', 'Browse by')}>
          <button type="button" aria-pressed={browse === 'line'} onClick={() => setBrowse('line')}>
            {t('按线路', 'By line')}
          </button>
          <button type="button" aria-pressed={browse === 'contests'} onClick={() => setBrowse('contests')}>
            {t('按周赛', 'By contest')}
          </button>
        </div>
      )}
      {member && browse === 'contests' ? (
        <ContestGrid
          english={english}
          onOpen={(problem) => {
            if (problem.caseStatus === 'verified' && problem.judgeProblemId)
              navigate('problem', { problem: problem.judgeProblemId });
            else setSelected(problem.id);
          }}
        />
      ) : (
        // The line view; its children keep the indentation they had before the contest view.
        <>
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
        <div
          className="route-stage"
          role="radiogroup"
          aria-labelledby="route-stage-label"
        >
          <span id="route-stage-label">{t('阶段', 'Stage')}</span>
          {['', '基础', '核心', '进阶'].map((value) => (
            <label key={value || 'all'}>
              <input
                type="radio"
                name="route-stage"
                value={value}
                checked={stage === value}
                onChange={() => {
                  setStage(value);
                  setPage(1);
                }}
              />
              <span>{value ? stageNames[value] : t('全部', 'All')}</span>
            </label>
          ))}
        </div>
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
                <option value="not_started">{t('未开始', 'Not started')}</option>
                <option value="starred">{t('已收藏', 'Starred')}</option>
                <option value="redo">{t('待重做', 'To redo')}</option>
              </>
            )}
            <option value="ready">{t('可站内判题', 'Ready to submit')}</option>
          </select>
        </label>
        {!!data?.companies?.length && (
          <label>
            {t('公司', 'Company')}
            <select
              value={company}
              onChange={(event) => {
                setCompany(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('全部公司', 'All companies')}</option>
              {data.companies.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="study-pick-one"
          disabled={picking}
          onClick={pickOne}
        >
          <Shuffle size={15} aria-hidden="true" /> {t('随机一题', 'Pick one')}
        </button>
      </fieldset>
      <fieldset className="study-sorts" disabled={roundBusy}>
        <legend className="sr-only">{t('排序与更多筛选', 'Order and more filters')}</legend>
        <label>
          {t('排序', 'Order')}
          <select
            value={!order ? '' : order === 'frequency' ? 'frequency' : `${order}:${dir}`}
            onChange={(event) => {
              const [value, way = 'asc'] = event.target.value.split(':');
              setSort(value);
              setDir(way);
              setPage(1);
            }}
          >
            <option value="">{t('线路顺序', 'Line order')}</option>
            {company && (
              <option value="frequency">
                {t('该公司报告次数', 'Most reported here')}
              </option>
            )}
            <option value="rating:asc">{t('难度分 低→高', 'Rating, low to high')}</option>
            <option value="rating:desc">{t('难度分 高→低', 'Rating, high to low')}</option>
            <option value="difficulty:asc">{t('难度 易→难', 'Difficulty, easy first')}</option>
            <option value="difficulty:desc">{t('难度 难→易', 'Difficulty, hard first')}</option>
            <option value="acceptance:desc">{t('通过率 高→低', 'Acceptance, high to low')}</option>
            <option value="acceptance:asc">{t('通过率 低→高', 'Acceptance, low to high')}</option>
            <option value="number:asc">{t('题号 小→大', 'Number, ascending')}</option>
            <option value="number:desc">{t('题号 大→小', 'Number, descending')}</option>
          </select>
        </label>
        <label>
          {t('难度分', 'Rating')}
          <select
            value={band}
            onChange={(event) => {
              setBand(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('不限', 'Any')}</option>
            {BANDS.map((value) => {
              const [from, to] = value.split('-');
              return (
                <option key={value} value={value}>
                  {from === '0' ? `< ${Number(to) + 1}` : to ? `${from}–${to}` : `≥ ${from}`}
                </option>
              );
            })}
          </select>
        </label>
        {member && (lists.length > 0 || !!list) && (
          <label>
            {t('我的题单', 'My lists')}
            <select
              value={list}
              onChange={(event) => {
                setList(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('全部', 'All')}</option>
              {list && !lists.some((l) => l.id === list) && (
                <option value={list}>{t('链接里的题单', 'The linked list')}</option>
              )}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {member && (
          <label>
            {t('通过月份', 'Solved in')}
            <input
              type="month"
              value={monthInput}
              max={thisMonth()}
              pattern="\d{4}-\d{2}"
              placeholder="YYYY-MM"
              onChange={(event) => {
                setMonthInput(event.target.value);
                setPage(1);
              }}
            />
          </label>
        )}
      </fieldset>
      <p className="study-pick-message" role="status">
        {pickMessage}
      </p>
      {selectedStop && (
        <div className="route-selected">
          <span className="route-code">{selectedStop.code}</span>
          <strong>{stopName(selectedStop)}</strong>
          {!!selectedStop.companies && (
            <span className="route-asked">{askedText(selectedStop, !english)}</span>
          )}
          {member ? (
            <span className="route-selected-count">
              {t(
                `已通过 ${selectedStop.solved} / ${selectedStop.total}`,
                `${selectedStop.solved} of ${selectedStop.total} solved`,
              )}
              <meter
                min={0}
                max={selectedStop.total || 1}
                value={selectedStop.solved}
                aria-hidden="true"
              />
              {selectedStop.total - selectedStop.solved > 0 &&
                selectedStop.total - selectedStop.solved <= 3 && (
                  <span className="route-to-go">
                    {t(
                      `还差 ${selectedStop.total - selectedStop.solved} 题`,
                      `${selectedStop.total - selectedStop.solved} to go`,
                    )}
                  </span>
                )}
            </span>
          ) : (
            <span className="route-selected-count">
              {t(
                `本站 ${selectedStop.total} 道题`,
                `${selectedStop.total} problems at this stop`,
              )}
            </span>
          )}
          {selectedStop.stages && (
            <span className="route-selected-stages">
              {['基础', '核心', '进阶'].map((value) =>
                selectedStop.stages?.[value]?.total ? (
                  <span key={value}>
                    {stageNames[value]} {selectedStop.stages[value].total}
                  </span>
                ) : null,
              )}
            </span>
          )}
          <span className="route-selected-actions">
            {member &&
              (() => {
                const resume = stale
                  ? undefined
                  : data?.items.find((item) => canJudge(item) && !item.solved);
                return resume ? (
                  <Button
                    onClick={() => {
                      rememberProblemSequence(
                        data!.items.flatMap((row) =>
                          canJudge(row) ? [row.judgeProblemId!] : [],
                        ),
                      );
                      navigate('problem', { problem: resume.judgeProblemId! });
                    }}
                  >
                    {t('从本站继续', 'Continue at this stop')}
                  </Button>
                ) : null;
              })()}
            <button
              type="button"
              className="route-rating-sort"
              aria-pressed={order === 'rating'}
              onClick={() => {
                setSort(order === 'rating' ? '' : 'rating');
                setDir('asc');
                setPage(1);
              }}
            >
              {t('按难度分排序', 'Sort by rating')}
            </button>
            <Button
              variant="outline"
              onClick={() => {
                const slug = section;
                selectStop('');
                focusStop(slug);
              }}
            >
              {t('回到全线', 'Show the whole line')}
            </Button>
          </span>
        </div>
      )}
      <div className="study-result-summary" aria-live="polite">
        {loading
          ? t('正在查找题目…', 'Finding problems…')
          : error
            ? t('暂时无法加载', 'Unable to load right now')
            : !search && !difficulty && !stage && !status && !section && !company && !band && !list && !solvedMonth
              ? t(
                  `全线共 ${data?.total || 0} 道题`,
                  `${data?.total || 0} problems on the line`,
                )
              : section && !search && !difficulty && !stage && !status && !company && !band && !list && !solvedMonth
                ? t(
                    `本站 ${data?.total || 0} 道题`,
                    `${data?.total || 0} problems at this stop`,
                  )
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
              setCompany('');
              setBand('');
              setList('');
              setMonthInput('');
              setPage(1);
            }}
          >
            {t('清除筛选', 'Clear filters')}
          </Button>
        </div>
      ) : (
        <>
          <div className="study-list" aria-busy={loading}>
            {data.items.map((item, index) => {
              const slug = item.selection?.sectionSlug;
              const stop =
                lineOrder && !section && slug && slug !== data.items[index - 1]?.selection?.sectionSlug
                  ? stops.find((candidate) => candidate.slug === slug)
                  : undefined;
              const isNext =
                !!item.judgeProblemId &&
                item.judgeProblemId === (nextProblemId ?? next?.judgeProblemId);
              return (
                <Fragment key={item.id}>
                  {stop && (
                    <h3 className="route-heading">
                      <span className="route-code">{stop.code}</span>
                      <span className="route-heading-name">{stopName(stop)}</span>
                      {!!stop.companies && (
                        <span className="route-asked">{askedText(stop, !english)}</span>
                      )}
                      <span className="route-count">
                        {member ? (
                          <>
                            {stop.solved}/{stop.total}
                            <meter
                              min={0}
                              max={stop.total || 1}
                              value={stop.solved}
                              aria-hidden="true"
                            />
                          </>
                        ) : (
                          t(`${stop.total} 道题`, `${stop.total} problems`)
                        )}
                      </span>
                      {member &&
                        stop.total - stop.solved > 0 &&
                        stop.total - stop.solved <= 3 && (
                          <span className="route-to-go">
                            {t(
                              `还差 ${stop.total - stop.solved} 题`,
                              `${stop.total - stop.solved} to go`,
                            )}
                          </span>
                        )}
                      <button
                        type="button"
                        className="route-only"
                        onClick={() => {
                          selectStop(stop.slug);
                          focusStop(stop.slug);
                        }}
                      >
                        {t('只看这一站', 'This stop only')}
                      </button>
                    </h3>
                  )}
                  <button
                    type="button"
                    className="study-row"
                    data-next={isNext || undefined}
                    data-progress={
                      item.solved ? 'solved' : item.progressStatus || 'not_started'
                    }
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
                        {isNext && (
                          <span className="route-next-pill">
                            {t('下一题', 'Next')}
                          </span>
                        )}
                        <span className="study-number">{item.number}.</span>{' '}
                        {title(item, english)}
                        {item.starred && (
                          <>
                            <Star className="study-star" size={14} aria-hidden="true" />
                            <span className="sr-only">{t('（已收藏）', ' (starred)')}</span>
                          </>
                        )}
                      </strong>
                      {pips(item.selection?.stage)}
                      <RatingBadge rating={item.rating} english={english} />
                      {!!item.companies?.length && (
                        <CompanyMarks companies={item.companies} english={english} />
                      )}
                      {item.acceptance !== undefined && (
                        <small className="study-acceptance">
                          {t(`通过率 ${item.acceptance}%`, `${item.acceptance}% accepted`)}
                        </small>
                      )}
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
                </Fragment>
              );
            })}
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
        </>
      )}
    </section>
  );
}
