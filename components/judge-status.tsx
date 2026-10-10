'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  stats?: {
    judging: number;
    recent: number;
    recentAccepted: number;
    concurrency: number | null;
  };
};

const VERDICTS: Record<string, { abbr: string; label: string; tone: string }> = {
  accepted: { abbr: 'AC', label: '通过', tone: 'ac' },
  wrong_answer: { abbr: 'WA', label: '答案错误', tone: 'wa' },
  time_limit: { abbr: 'TLE', label: '超出时间', tone: 'tle' },
  memory_limit: { abbr: 'MLE', label: '超出内存', tone: 'mle' },
  output_limit: { abbr: 'OLE', label: '输出超限', tone: 'ole' },
  runtime_error: { abbr: 'RE', label: '运行错误', tone: 're' },
  compile_error: { abbr: 'CE', label: '编译错误', tone: 'ce' },
  system_error: { abbr: 'SE', label: '判题异常', tone: 'se' },
  cancelled: { abbr: '—', label: '已取消', tone: 'se' },
  queued: { abbr: '…', label: '排队中', tone: 'pending' },
  compiling: { abbr: '…', label: '编译中', tone: 'pending' },
  running: { abbr: '…', label: '运行中', tone: 'pending' },
};
const RESULT_FILTERS: [string, string][] = [
  ['', '全部结果'],
  ['accepted', '通过'],
  ['wrong_answer', '答案错误'],
  ['time_limit', '超出时间'],
  ['memory_limit', '超出内存'],
  ['runtime_error', '运行错误'],
  ['compile_error', '编译错误'],
  ['pending', '评测中'],
];
const LANGUAGES: [string, string][] = [
  ['', '全部语言'],
  ['cpp', 'C++'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['go', 'Go'],
];
const FILTER_KEYS = ['result', 'language', 'problem', 'user', 'mine'] as const;
const POLL_MS = 5000;

export function relativeTime(at: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return '刚刚';
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const memory = (kb: number | null) =>
  kb == null ? '—' : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
const bytes = (n: number) =>
  n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

/** Newest-first merge: the freshly polled first page wins, older pages stay. */
export function mergeFeed(current: FeedItem[], page: FeedItem[]) {
  if (!page.length) return current;
  const oldest = page[page.length - 1].seq;
  return [...page, ...current.filter((item) => item.seq < oldest)];
}

function Verdict({ item }: { item: FeedItem }) {
  const v = VERDICTS[item.status] || { abbr: '?', label: item.status, tone: 'se' };
  const progress =
    item.total > 0 && item.status !== 'accepted' && item.status !== 'compile_error';
  return (
    <span className={`js-verdict is-${v.tone}`}>
      <span className="js-dot" aria-hidden="true" />
      {v.tone !== 'pending' && <span className="js-abbr">{v.abbr}</span>}
      {v.label}
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
  onUser: (name: string) => void;
  now: number;
}) {
  return (
    <table className="js-table">
      <caption className="sr-only">全站评测状态，最新的提交在前</caption>
      <thead>
        <tr>
          <th className="js-col-run">编号</th>
          <th>用户</th>
          <th>题目</th>
          <th>结果</th>
          <th className="is-num">用时</th>
          <th className="is-num js-col-memory">内存</th>
          <th className="js-col-language">语言</th>
          <th className="is-num js-col-length">代码</th>
          <th>提交时间</th>
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
                    title={`只看 ${item.user} 的提交`}
                    onClick={() => onUser(item.user)}
                  >
                    {item.user}
                  </button>
                  {item.mine && <span className="rd-badge is-brand">我</span>}
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
                      {item.source.kind === 'library' ? '题库' : '课程'}
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
                {LANGUAGES.find(([id]) => id === item.language)?.[1] || item.language}
              </td>
              <td className="is-num js-num js-col-length">{bytes(item.codeBytes)}</td>
              <td className="js-time js-cell-time" title={new Date(item.createdAt).toLocaleString()}>
                {relativeTime(item.createdAt, now)}
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
  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of FILTER_KEYS) if (params[key]) out[key] = params[key];
    return out;
  }, [params]);
  const query = new URLSearchParams(filters).toString();
  // Rows belong to the query they were loaded for, so a filter change starts empty.
  const [state, setState] = useState<{
    query: string;
    items: FeedItem[];
    next: number | null;
    stats?: Feed['stats'];
    fresh: Set<number>;
  } | null>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [problemText, setProblemText] = useState('');
  const [userText, setUserText] = useState('');
  const current = state?.query === query ? state : null;
  const titles = useMemo(
    () => new Map(boot.problems.map((p) => [p.id, p.title])),
    [boot.problems],
  );

  const refresh = useCallback(async () => {
    const page = await api<Feed>(`oj/feed${query ? `?${query}` : ''}`);
    setState((prev) => {
      const items = prev?.query === query ? prev.items : [];
      const known = new Set(items.map((item) => item.seq));
      return {
        query,
        items: mergeFeed(items, page.items),
        // The first load keeps the cursor; polls must not drop pages already loaded.
        next: prev?.query === query ? prev.next : page.next,
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
          <h1>评测状态</h1>
          <p>全站提交实时滚动。只公开结果和用时，代码和测试点详情仅提交者本人可见。</p>
        </header>
        <div className="rd-stats rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
          <div>
            <div className="rd-stat-label">
              <Activity size={13} /> 正在评测
            </div>
            <div className="rd-stat-value">{stats ? stats.judging : '—'}</div>
          </div>
          <div>
            <div className="rd-stat-label">
              <Gauge size={13} /> 最近通过率
            </div>
            <div className="rd-stat-value">
              {rate == null ? '—' : `${rate}%`}
              {stats?.recent ? <small>近 {stats.recent} 次</small> : null}
            </div>
          </div>
          <div>
            <div className="rd-stat-label">
              <Cpu size={13} /> 判题并发
            </div>
            <div className="rd-stat-value">
              {stats?.concurrency ?? '—'}
              {stats?.concurrency ? <small>路</small> : null}
            </div>
          </div>
        </div>

        <div className="rd-toolbar js-toolbar rd-reveal" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="js-filters">
            {boot.person && (
              <fieldset className="rd-segment">
                <legend className="sr-only">提交范围</legend>
                <button
                  type="button"
                  aria-pressed={!filters.mine}
                  onClick={() => apply({ mine: '' })}
                >
                  全部
                </button>
                <button
                  type="button"
                  aria-pressed={!!filters.mine}
                  onClick={() => apply({ mine: '1' })}
                >
                  我的
                </button>
              </fieldset>
            )}
            <label className={`rd-chip ${filters.result ? 'is-set' : ''}`}>
              <span className="sr-only">评测结果</span>
              <select
                value={filters.result || ''}
                onChange={(e) => apply({ result: e.target.value })}
              >
                {RESULT_FILTERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
            </label>
            <label className={`rd-chip ${filters.language ? 'is-set' : ''}`}>
              <span className="sr-only">语言</span>
              <select
                value={filters.language || ''}
                onChange={(e) => apply({ language: e.target.value })}
              >
                {LANGUAGES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="rd-chip-caret" aria-hidden="true" />
            </label>
            {filters.problem ? (
              <span className="rd-chip is-set">
                题目：{problemTitle}
                <button type="button" aria-label="清除题目筛选" onClick={() => apply({ problem: '' })}>
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
                  else setError('没有找到这道题，换个题号或标题试试');
                  setProblemText('');
                }}
              >
                <Search size={14} aria-hidden="true" />
                <input
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  placeholder="题号或标题，回车筛选"
                  aria-label="按题目筛选"
                />
              </form>
            )}
            {filters.user ? (
              <span className="rd-chip is-set">
                用户：{filters.user}
                <button type="button" aria-label="清除用户筛选" onClick={() => apply({ user: '' })}>
                  <X size={13} />
                </button>
              </span>
            ) : (
              <form
                className="rd-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (userText.trim()) apply({ user: userText.trim() });
                  setUserText('');
                }}
              >
                <Search size={14} aria-hidden="true" />
                <input
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  placeholder="用户昵称"
                  aria-label="按用户筛选"
                />
              </form>
            )}
          </div>
          <button
            type="button"
            className="js-live"
            aria-pressed={live}
            onClick={() => setLive((on) => !on)}
            title={live ? '每 5 秒自动刷新，点击暂停' : '已暂停，点击恢复自动刷新'}
          >
            <span className="js-live-dot" aria-hidden="true" />
            {live ? '实时' : '已暂停'}
            {!live && <RefreshCw size={12} aria-hidden="true" />}
          </button>
        </div>

        {error && (
          <div className="js-error" role="alert">
            {error}
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
                onUser={(name) => apply({ user: name, mine: '' })}
              />
              {current.next && (
                <div className="js-foot">
                  <button
                    type="button"
                    className="rd-button is-quiet"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? '加载中…' : '加载更早的提交'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="js-empty">
              <strong>{query ? '没有符合条件的提交' : '还没有人提交'}</strong>
              <span>{query ? '换个筛选条件试试。' : '去题库挑一道题，成为第一个出现在这里的人。'}</span>
              <button
                type="button"
                className="rd-button"
                onClick={() => (query ? navigate('status') : navigate('problems'))}
              >
                {query ? '清除筛选' : '去题库做题'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
