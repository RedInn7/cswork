'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Cpu,
  Gauge,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { api, type Boot } from '@/lib/types';
import { useLocale, useT, type Locale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { companyLogos } from '@/lib/oa-company-brands';
import type { Navigate } from './learning';
import '@/app/redesign.css';
import '@/app/judge-status.css';

export type FeedItem = {
  seq: number;
  run: string;
  problemId: string;
  source:
    | { kind: 'oa'; company: { slug: string; name: string } }
    | { kind: 'library' | 'course' };
  user: string;
  mine: boolean;
  language: string;
  status: string;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  codeBytes: number;
  createdAt: number;
};
type Feed = {
  items: FeedItem[];
  next: number | null;
  /** Masked name for the userOf filter chip. */
  userLabel?: string;
  stats?: {
    judging: number;
    recent: number;
    recentAccepted: number;
    concurrency: number | null;
  };
};

/** Labels are [zh, en]. */
const VERDICTS: Record<string, { abbr: string; label: [string, string]; tone: string }> = {
  accepted: { abbr: 'AC', label: ['通过', 'Accepted'], tone: 'ac' },
  wrong_answer: { abbr: 'WA', label: ['答案错误', 'Wrong Answer'], tone: 'wa' },
  time_limit: { abbr: 'TLE', label: ['超出时间', 'Time Limit Exceeded'], tone: 'tle' },
  memory_limit: { abbr: 'MLE', label: ['超出内存', 'Memory Limit Exceeded'], tone: 'mle' },
  output_limit: { abbr: 'OLE', label: ['输出超限', 'Output Limit Exceeded'], tone: 'ole' },
  runtime_error: { abbr: 'RE', label: ['运行错误', 'Runtime Error'], tone: 're' },
  compile_error: { abbr: 'CE', label: ['编译错误', 'Compile Error'], tone: 'ce' },
  system_error: { abbr: 'SE', label: ['判题异常', 'System Error'], tone: 'se' },
  cancelled: { abbr: '—', label: ['已取消', 'Cancelled'], tone: 'se' },
  queued: { abbr: '…', label: ['排队中', 'Queued'], tone: 'pending' },
  compiling: { abbr: '…', label: ['编译中', 'Compiling'], tone: 'pending' },
  running: { abbr: '…', label: ['运行中', 'Running'], tone: 'pending' },
};
/** [value, zh, en] */
const RESULT_FILTERS: [string, string, string][] = [
  ['', '全部结果', 'All results'],
  ['accepted', '通过', 'Accepted'],
  ['wrong_answer', '答案错误', 'Wrong Answer'],
  ['time_limit', '超出时间', 'Time Limit Exceeded'],
  ['memory_limit', '超出内存', 'Memory Limit Exceeded'],
  ['runtime_error', '运行错误', 'Runtime Error'],
  ['compile_error', '编译错误', 'Compile Error'],
  ['pending', '评测中', 'Judging'],
];
/** [value, zh, en] */
const LANGUAGES: [string, string, string][] = [
  ['', '全部语言', 'All languages'],
  ['cpp', 'C++', 'C++'],
  ['python', 'Python', 'Python'],
  ['java', 'Java', 'Java'],
  ['go', 'Go', 'Go'],
];
const FILTER_KEYS = ['result', 'language', 'problem', 'userOf', 'mine'] as const;
const POLL_MS = 5000;

export function relativeTime(at: number, now = Date.now(), locale: Locale = 'en') {
  const t = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return t('刚刚', 'just now');
  if (s < 60) return t(`${s} 秒前`, `${s} sec ago`);
  if (s < 3600) return t(`${Math.floor(s / 60)} 分钟前`, `${Math.floor(s / 60)} min ago`);
  if (s < 86400) return t(`${Math.floor(s / 3600)} 小时前`, `${Math.floor(s / 3600)} h ago`);
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const memory = (kb: number | null) =>
  kb == null ? '—' : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
const bytes = (n: number) =>
  n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

/**
 * Newest-first merge: the freshly polled first page wins and older pages stay. When
 * the page does not reach the loaded rows (more than a page arrived meanwhile), the
 * list restarts from the page so no gap is shown; `null` asks for its cursor.
 */
export function mergeFeed(current: FeedItem[], page: FeedItem[]) {
  if (!page.length) return current;
  const oldest = page[page.length - 1].seq;
  if (current.length && oldest > current[0].seq) return null;
  return [...page, ...current.filter((item) => item.seq < oldest)];
}

function Verdict({ item }: { item: FeedItem }) {
  const t = useT();
  const v = VERDICTS[item.status] || { abbr: '?', label: [item.status, item.status], tone: 'se' };
  const progress =
    item.total > 0 && item.status !== 'accepted' && item.status !== 'compile_error';
  return (
    <span className={`js-verdict is-${v.tone}`}>
      <span className="js-dot" aria-hidden="true" />
      {v.tone !== 'pending' && <span className="js-abbr">{v.abbr}</span>}
      {t(...v.label)}
      {progress && (
        <span className="js-progress">
          {item.passed}/{item.total}
        </span>
      )}
    </span>
  );
}

export function FeedTable({
  items,
  titles,
  fresh,
  onProblem,
  onUser,
  now,
}: {
  items: FeedItem[];
  titles: Map<string, string>;
  fresh: Set<number>;
  onProblem: (id: string) => void;
  onUser: (seq: number) => void;
  now: number;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <table className="js-table">
      <caption className="sr-only">
        {t('全站评测状态，最新的提交在前', 'Submissions across the site, newest first')}
      </caption>
      <thead>
        <tr>
          <th className="js-col-run">{t('编号', 'ID')}</th>
          <th>{t('用户', 'User')}</th>
          <th>{t('题目', 'Problem')}</th>
          <th>{t('结果', 'Result')}</th>
          <th className="is-num">{t('用时', 'Runtime')}</th>
          <th className="is-num js-col-memory">{t('内存', 'Memory')}</th>
          <th className="js-col-language">{t('语言', 'Language')}</th>
          <th className="is-num js-col-length">{t('代码', 'Code')}</th>
          <th>{t('提交时间', 'Submitted')}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const title = titles.get(item.problemId);
          const logo =
            item.source.kind === 'oa' &&
            Object.hasOwn(companyLogos, item.source.company.slug)
              ? companyLogos[item.source.company.slug]
              : null;
          const language = LANGUAGES.find(([id]) => id === item.language);
          return (
            <tr
              key={item.seq}
              className={`${item.mine ? 'is-mine' : ''} ${fresh.has(item.seq) ? 'is-new' : ''}`}
            >
              <td className="js-col-run">
                <span className="js-run">#{item.run}</span>
              </td>
              <td className="js-cell-user">
                <span className="js-user">
                  <button
                    type="button"
                    className="js-user-filter"
                    title={t('只看这位用户的提交', "Show only this user's submissions")}
                    onClick={() => onUser(item.seq)}
                  >
                    {t(item.user, englishMessage(item.user))}
                  </button>
                  {item.mine && <span className="rd-badge is-brand">{t('我', 'You')}</span>}
                </span>
              </td>
              <td className="js-cell-problem">
                <span className="js-problem">
                  {item.source.kind === 'oa' ? (
                    <>
                      {logo && (
                        <span className="js-problem-logo" aria-hidden="true">
                          {/* oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name. */}
                          <img src={logo} alt="" width={18} height={18} loading="lazy" />
                        </span>
                      )}
                      <span className="rd-badge is-brand">{item.source.company.name}</span>
                    </>
                  ) : (
                    <span className="rd-badge">
                      {item.source.kind === 'library' ? t('题库', 'Problems') : t('课程', 'Course')}
                    </span>
                  )}
                  {title ? (
                    <button
                      type="button"
                      className="js-problem-title"
                      title={title}
                      onClick={() => onProblem(item.problemId)}
                    >
                      {title}
                    </button>
                  ) : (
                    <span className="js-problem-title">{item.problemId}</span>
                  )}
                </span>
              </td>
              <td className="js-cell-verdict">
                <Verdict item={item} />
              </td>
              <td className="is-num js-num js-cell-runtime">
                {item.runtimeMs == null ? '—' : `${item.runtimeMs} ms`}
              </td>
              <td className="is-num js-num js-col-memory">{memory(item.memoryKb)}</td>
              <td className="js-col-language">
                {(language && t(language[1], language[2])) || item.language}
              </td>
              <td className="is-num js-num js-col-length">{bytes(item.codeBytes)}</td>
              <td className="js-time js-cell-time" title={new Date(item.createdAt).toLocaleString()}>
                {relativeTime(item.createdAt, now, locale)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function JudgeStatus({
  boot,
  params,
  navigate,
}: {
  boot: Boot;
  params: Record<string, string>;
  navigate: Navigate;
}) {
  const t = useT();
  const signedIn = !!boot.person;
  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of FILTER_KEYS) if (params[key]) out[key] = params[key];
    // A stale "mine" link without a session would 401 on every poll.
    if (!signedIn) delete out.mine;
    return out;
  }, [params, signedIn]);
  const query = new URLSearchParams(filters).toString();
  // Rows belong to the query they were loaded for, so a filter change starts empty.
  const [state, setState] = useState<{
    query: string;
    items: FeedItem[];
    next: number | null;
    userLabel?: string;
    stats?: Feed['stats'];
    fresh: Set<number>;
  } | null>(null);
  const latestQuery = useRef(query);
  useEffect(() => {
    latestQuery.current = query;
  }, [query]);
  const [error, setError] = useState('');
  const [live, setLive] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [problemText, setProblemText] = useState('');
  const current = state?.query === query ? state : null;
  const titles = useMemo(
    () => new Map(boot.problems.map((p) => [p.id, p.title])),
    [boot.problems],
  );

  const refresh = useCallback(async () => {
    const page = await api<Feed>(`oj/feed${query ? `?${query}` : ''}`);
    // A slower response for a previous filter must not overwrite the current one.
    if (latestQuery.current !== query) return;
    setState((prev) => {
      const items = prev?.query === query ? prev.items : [];
      const known = new Set(items.map((item) => item.seq));
      const merged = mergeFeed(items, page.items);
      return {
        query,
        items: merged ?? page.items,
        // Polls keep the cursor of pages already loaded unless the list restarted.
        next: prev?.query === query && merged ? prev.next : page.next,
        userLabel: page.userLabel,
        stats: page.stats,
        fresh: new Set(
          items.length ? page.items.filter((i) => !known.has(i.seq)).map((i) => i.seq) : [],
        ),
      };
    });
    setError('');
    setNow(Date.now());
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    // oxlint-disable-next-line react/react-compiler -- The board subscribes to the server's live submission feed.
    refresh().catch((e: Error) => !cancelled && setError(e.message));
    if (!live) return () => void (cancelled = true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        refresh().catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh, live]);

  async function loadMore() {
    if (!current?.next) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(filters);
      params.set('cursor', String(current.next));
      const page = await api<Feed>(`oj/feed?${params}`);
      setState((prev) =>
        prev && prev.query === query
          ? { ...prev, items: [...prev.items, ...page.items], next: page.next }
          : prev,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function apply(next: Record<string, string>) {
    const merged: Record<string, string> = { ...filters, ...next };
    for (const key of Object.keys(merged)) if (!merged[key]) delete merged[key];
    navigate('status', merged);
  }
  function findProblem(text: string) {
    const q = text.trim().toLowerCase();
    if (!q) return '';
    if (titles.has(q)) return q;
    for (const [id, title] of titles)
      if (title.toLowerCase().includes(q) || id.includes(q)) return id;
    return '';
  }

  const stats = current?.stats;
  const rate =
    stats && stats.recent ? Math.round((stats.recentAccepted / stats.recent) * 100) : null;
  const problemTitle = filters.problem
    ? titles.get(filters.problem) || filters.problem
    : '';

  return (
    <div className="rd">
      <div className="rd-page">
        <header className="rd-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
          <h1>{t('评测状态', 'Status')}</h1>
          <p>
            {t(
              '全站提交实时滚动。只公开结果和用时；代码和测试点详情不公开，其他用户的昵称会打码。',
              "Live submissions from across the site. Only results and runtimes are public; code and test case details stay private, and other users' names are masked.",
            )}
          </p>
        </header>
        <div className="rd-stats rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <div>
            <div className="rd-stat-label">
              <Activity size={13} /> {t('正在评测', 'Judging now')}
            </div>
            <div className="rd-stat-value">{stats ? stats.judging : '—'}</div>
          </div>
          <div>
            <div className="rd-stat-label">
              <Gauge size={13} /> {t('最近通过率', 'Recent acceptance rate')}
            </div>
            <div className="rd-stat-value">
              {rate == null ? '—' : `${rate}%`}
              {stats?.recent ? (
                <small>{t(`近 ${stats.recent} 次`, `last ${stats.recent}`)}</small>
              ) : null}
            </div>
          </div>
          <div>
            <div className="rd-stat-label">
              <Cpu size={13} /> {t('判题并发', 'Judge concurrency')}
            </div>
            <div className="rd-stat-value">
              {stats?.concurrency ?? '—'}
              {stats?.concurrency ? <small>{t('路', 'slots')}</small> : null}
            </div>
          </div>
        </div>

        <div className="rd-toolbar js-toolbar rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="js-filters">
            {boot.person && (
              <fieldset className="rd-segment">
                <legend className="sr-only">{t('提交范围', 'Submission scope')}</legend>
                <button
                  type="button"
                  aria-pressed={!filters.mine}
                  onClick={() => apply({ mine: '' })}
                >
                  {t('全部', 'All')}
                </button>
                <button
                  type="button"
                  aria-pressed={!!filters.mine}
                  onClick={() => apply({ mine: '1' })}
                >
                  {t('我的', 'Mine')}
                </button>
              </fieldset>
            )}
            <label className={`rd-chip ${filters.result ? 'is-set' : ''}`}>
              <span className="sr-only">{t('评测结果', 'Result')}</span>
              <select
                value={filters.result || ''}
                onChange={(e) => apply({ result: e.target.value })}
              >
                {RESULT_FILTERS.map(([value, zh, en]) => (
                  <option key={value} value={value}>
                    {t(zh, en)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
            </label>
            <label className={`rd-chip ${filters.language ? 'is-set' : ''}`}>
              <span className="sr-only">{t('语言', 'Language')}</span>
              <select
                value={filters.language || ''}
                onChange={(e) => apply({ language: e.target.value })}
              >
                {LANGUAGES.map(([value, zh, en]) => (
                  <option key={value} value={value}>
                    {t(zh, en)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
            </label>
            {filters.problem ? (
              <span className="rd-chip is-set">
                {t('题目：', 'Problem: ')}
                {problemTitle}
                <button
                  type="button"
                  aria-label={t('清除题目筛选', 'Clear problem filter')}
                  onClick={() => apply({ problem: '' })}
                >
                  <X size={13} />
                </button>
              </span>
            ) : (
              <form
                className="rd-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = findProblem(problemText);
                  if (id) apply({ problem: id });
                  else
                    setError(
                      t('没有找到这道题，换个题号或标题试试', 'No matching problem. Try another ID or title.'),
                    );
                  setProblemText('');
                }}
              >
                <Search size={14} aria-hidden="true" />
                <input
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  placeholder={t('题号或标题，回车筛选', 'Problem ID or title, press Enter')}
                  aria-label={t('按题目筛选', 'Filter by problem')}
                />
              </form>
            )}
            {filters.userOf && (
              <span className="rd-chip is-set">
                {t('用户：', 'User: ')}
                {current?.userLabel || '…'}
                <button
                  type="button"
                  aria-label={t('清除用户筛选', 'Clear user filter')}
                  onClick={() => apply({ userOf: '' })}
                >
                  <X size={13} />
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            className="js-live"
            aria-pressed={live}
            onClick={() => setLive((on) => !on)}
            title={
              live
                ? t('每 5 秒自动刷新，点击暂停', 'Refreshes every 5 seconds. Click to pause')
                : t('已暂停，点击恢复自动刷新', 'Paused. Click to resume auto-refresh')
            }
          >
            <span className="js-live-dot" aria-hidden="true" />
            {live ? t('实时', 'Live') : t('已暂停', 'Paused')}
            {!live && <RefreshCw size={12} aria-hidden="true" />}
          </button>
        </div>

        {error && (
          <div className="js-error" role="alert">
            {t(error, englishMessage(error))}
          </div>
        )}
        <div className="rd-card js-card rd-reveal" style={{ '--i': 3 } as React.CSSProperties}>
          {!current ? (
            <table className="js-table" aria-hidden="true">
              <tbody>
                {Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="js-skeleton">
                    {Array.from({ length: 6 }, (__, j) => (
                      <td key={j}>.</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : current.items.length ? (
            <>
              <FeedTable
                items={current.items}
                titles={titles}
                fresh={current.fresh}
                now={now}
                onProblem={(id) => navigate('problem', { problem: id })}
                onUser={(seq) => apply({ userOf: String(seq), mine: '' })}
              />
              {current.next && (
                <div className="js-foot">
                  <button
                    type="button"
                    className="rd-button is-quiet"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? t('加载中…', 'Loading…') : t('加载更早的提交', 'Load older submissions')}
                  </button>
                </div>
              )}
            </>
          ) : current.next ? (
            <div className="js-empty">
              <strong>{t('最近的提交里没有符合条件的', 'No recent submissions match')}</strong>
              <span>{t('可以继续往更早的提交里找。', 'Keep looking through older submissions.')}</span>
              <button
                type="button"
                className="rd-button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? t('查找中…', 'Searching…') : t('继续往前找', 'Search older')}
              </button>
            </div>
          ) : (
            <div className="js-empty">
              <strong>
                {query ? t('没有符合条件的提交', 'No matching submissions') : t('还没有人提交', 'No submissions yet')}
              </strong>
              <span>
                {query
                  ? t('换个筛选条件试试。', 'Try different filters.')
                  : t('去题库挑一道题，成为第一个出现在这里的人。', 'Pick a problem and be the first one here.')}
              </span>
              <button
                type="button"
                className="rd-button"
                onClick={() => (query ? navigate('status') : navigate('problems'))}
              >
                {query ? t('清除筛选', 'Clear filters') : t('去题库做题', 'Browse problems')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
