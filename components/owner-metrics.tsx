'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Activity, Eye, RefreshCw, Send, Timer, UserPlus, Users } from 'lucide-react';
import { api, statusNames } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type { Navigate } from './learning';
import '@/app/redesign.css';
import '@/app/owner-metrics.css';

type Stat = {
  count: number;
  p50: number | null;
  p90: number | null;
  p99?: number | null;
  avg?: number | null;
};
type Day = {
  day: string;
  pageViews: number;
  visitors: number;
  signups: number;
  submissions: number;
  runs: number;
  accepted: number;
};
type Totals = {
  pageViews: number;
  visitors: number;
  signups: number;
  submissions: number;
  runs: number;
  accepted: number;
  judgeErrors: number;
};
type Judge = {
  server: Stat;
  client: Stat;
  run: Stat;
  queue: Stat;
  byLanguage: { language: string; count: number; p50: number | null }[];
  verdicts: { verdict: string; count: number }[];
  queuedNow: number;
  runningNow: number;
};
/** GET /api/metrics/summary?days=N. Durations are milliseconds. */
type Summary = {
  range: { days: number; from: string | number; to: string | number };
  generatedAt: string | number;
  totals: Totals;
  daily: Day[];
  judge: Judge;
  topViews: { view: string; type?: string | null; count: number }[];
  topContent: { type: string; slug: string; count: number }[];
  topSearches: { q: string; count: number }[];
  errors: { stage: string; status?: string | number | null; count: number }[];
  locales: { locale: string; count: number }[];
};
type T = (zh: string, en: string) => string;

const RANGES = [7, 14, 30, 90];
// ponytail: copies of the academy nav labels and the content library's type names
// (neither is exported); ids missing here show as they are.
const VIEW_NAMES: Record<string, [string, string]> = {
  problems: ['算法题库', 'Problem Bank'],
  problem: ['题目', 'Problem'],
  status: ['评测状态', 'Status'],
  questions: ['面试题', 'Interview Questions'],
  experiences: ['面经', 'Experiences'],
  resources: ['学习资料', 'Resources'],
  content: ['内容详情', 'Content page'],
  courses: ['我的课程', 'My Courses'],
  knowledge: ['算法知识点', 'Algorithm Concepts'],
  lesson: ['课时', 'Lesson'],
  tickets: ['我的工单', 'Support'],
  account: ['账户', 'Account'],
};
const TYPE_NAMES: Record<string, [string, string]> = {
  coding_question: ['编程题', 'Coding'],
  interview_question: ['面试题', 'Interview question'],
  experience: ['面经', 'Experience'],
  guide: ['面试指南', 'Guide'],
  concept: ['概念', 'Concept'],
  article: ['文章', 'Article'],
  cheatsheet: ['速查表', 'Cheatsheet'],
  algorithm: ['算法专题', 'Algorithm'],
};
const LOCALE_NAMES: Record<string, [string, string]> = {
  en: ['英文', 'English'],
  zh: ['中文', 'Chinese'],
};
const LANGUAGE_NAMES: Record<string, string> = { cpp: 'C++', python: 'Python', java: 'Java', go: 'Go' };
/** [abbreviation, tone]; the label comes from statusNames, like the status page. */
const VERDICTS: Record<string, [string, string]> = {
  accepted: ['AC', 'good'],
  wrong_answer: ['WA', 'bad'],
  runtime_error: ['RE', 'bad'],
  time_limit: ['TLE', 'warn'],
  memory_limit: ['MLE', 'warn'],
  output_limit: ['OLE', 'warn'],
  compile_error: ['CE', 'neutral'],
  system_error: ['SE', 'neutral'],
};
/** Ids come from tracked data, so "constructor" must not reach the prototype. */
const named = (map: Record<string, [string, string]>, id: string, t: T) =>
  Object.hasOwn(map, id) ? t(...map[id]) : id;

/** 420 ms · 1.8 s · 12 s · 1.5 min */
function duration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (Math.round(ms) < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 9_950 ? 1 : 0)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}
/** Smallest 1/2/4/6/8/10 × 10^k at or above v (at least 2), so the halfway tick is a whole number. */
function niceMax(v: number) {
  if (!(v > 0)) return 2;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.max(2, [1, 2, 4, 6, 8, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p);
}
/** A column with a 4px rounded data end, square on the baseline. */
function column(x: number, y: number, w: number, h: number, round: boolean) {
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

function useFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = locale === 'zh' ? 'zh-CN' : 'en-US';
    const whole = new Intl.NumberFormat(tag);
    const short = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
    return {
      n: (v: number | null | undefined) => (v == null ? '—' : whole.format(v)),
      compact: (v: number) => short.format(v),
      day(value: string | number, weekday = false) {
        const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
        const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        if (weekday) options.weekday = 'short';
        // A calendar day from the server is a date, not an instant: no time-zone shift.
        if (m) options.timeZone = 'UTC';
        return date.toLocaleDateString(tag, options);
      },
      time(value: string | number) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
          ? ''
          : date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
      },
    };
  }, [locale]);
}

function Card({
  title,
  note,
  extra,
  className,
  i,
  ref,
  children,
}: {
  title: string;
  note?: string;
  extra?: ReactNode;
  className: string;
  i: number;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section
      ref={ref}
      className={`rd-card om-card rd-reveal ${className}`}
      style={{ '--i': i } as CSSProperties}
    >
      <header className="om-card-head">
        <h2>{title}</h2>
        {extra}
      </header>
      {note && <p className="om-card-note">{note}</p>}
      {children}
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="om-kpi">
      <div className="rd-stat-label">
        {icon}
        {label}
      </div>
      <div className="om-kpi-value">{value}</div>
      {sub && <div className="om-kpi-sub">{sub}</div>}
    </div>
  );
}

type BarRow = { key: string; label: ReactNode; count: number; tone?: string };
/** Ranked rows: a soft bar behind each label, the count (and share) at the end. */
function BarList({ rows, share, none }: { rows: BarRow[]; share?: boolean; none: string }) {
  const f = useFormat();
  if (!rows.length) return <p className="om-none">{none}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <ol className="om-bars">
      {rows.map((r) => (
        <li key={r.key} className={`om-bar${r.tone ? ` is-${r.tone}` : ''}`}>
          <span className="om-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} aria-hidden="true" />
          <span className="om-bar-label">{r.label}</span>
          <span className="om-bar-value">
            {f.n(r.count)}
            {share && total > 0 && <small>{Math.round((r.count / total) * 100)}%</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const PAD_L = 44;
const PAD_R = 6;
const TOP = 6;
const AXIS_H = 22;
const GAP = 2;
const TIP_W = 184;

function Plot({
  kind,
  daily,
  width,
  active,
  onActive,
  axis = false,
  label,
}: {
  kind: 'traffic' | 'submissions';
  daily: Day[];
  width: number;
  active: number | null;
  onActive: (i: number | null) => void;
  axis?: boolean;
  label: string;
}) {
  const f = useFormat();
  const n = daily.length;
  const last = n - 1;
  const plotW = Math.max(n, width - PAD_L - PAD_R);
  const slot = plotW / n;
  const bw = Math.max(1, Math.min(24, slot * 0.62));
  const cx = (i: number) => PAD_L + slot * (i + 0.5);
  const traffic = kind === 'traffic';
  const max = niceMax(
    Math.max(0, ...daily.map((d) => (traffic ? Math.max(d.pageViews, d.visitors) : d.submissions))),
  );
  // Taller plots when there is room; phones keep both panels in one screen.
  const plotH = width < 600 ? 84 : 112;
  const base = TOP + plotH;
  const y = (v: number) => base - (v / max) * plotH;
  const height = base + (axis ? AXIS_H : 4);
  // One date label per ~72px, counted back from the latest day so it is always labelled.
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 72))));
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onActive(Math.max(0, Math.min(last, Math.floor(((e.clientX - box.left) / box.width) * n))));
  };
  return (
    <svg
      className={`om-plot${active == null ? '' : ' has-active'}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- An inline SVG chart has no <img> twin; role="img" names it and hides the tick text from screen readers.
      role="img"
      aria-label={label}
    >
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line className={v ? 'om-gridline' : 'om-baseline'} x1={PAD_L} x2={width - PAD_R} y1={y(v)} y2={y(v)} />
          <text x={PAD_L - 8} y={y(v)} dy="0.32em" textAnchor="end">
            {f.compact(v)}
          </text>
        </g>
      ))}
      {daily.map((d, i) => {
        const x = cx(i) - bw / 2;
        const on = i === active ? 'is-active' : undefined;
        if (traffic)
          return d.pageViews > 0 ? (
            <path
              key={d.day}
              className={`om-col is-views ${on ?? ''}`}
              d={column(x, y(d.pageViews), bw, base - y(d.pageViews), true)}
            />
          ) : null;
        const accepted = Math.min(d.accepted, d.submissions);
        const hA = (accepted / max) * plotH;
        // The rest of the day's submissions sits on top, a 2px surface gap apart.
        const hR = ((d.submissions - accepted) / max) * plotH - (hA > 0 ? GAP : 0);
        return (
          <g key={d.day} className={on}>
            {hA > 0 && <path className="om-col is-accepted" d={column(x, base - hA, bw, hA, hR <= 0.5)} />}
            {hR > 0.5 && <path className="om-col is-other" d={column(x, y(d.submissions), bw, hR, true)} />}
          </g>
        );
      })}
      {active != null && <line className="om-cross" x1={cx(active)} x2={cx(active)} y1={TOP} y2={base} />}
      {traffic && (
        <>
          <polyline className="om-line" points={daily.map((d, i) => `${cx(i)},${y(d.visitors)}`).join(' ')} />
          <circle className="om-dot" cx={cx(active ?? last)} cy={y(daily[active ?? last].visitors)} r={4} />
        </>
      )}
      {axis &&
        daily.map((d, i) =>
          (last - i) % every ? null : (
            <text
              key={d.day}
              x={i === last ? width - PAD_R : cx(i)}
              y={base + 16}
              textAnchor={i === last ? 'end' : 'middle'}
            >
              {f.day(d.day)}
            </text>
          ),
        )}
      <rect
        className="om-hit"
        x={PAD_L}
        y={0}
        width={plotW}
        height={height}
        onPointerDown={pick}
        onPointerMove={pick}
        onPointerLeave={() => onActive(null)}
      />
    </svg>
  );
}

function TipRow({ tone, value, label }: { tone: string; value: string; label: string }) {
  return (
    <div className="om-tip-row">
      <span className={`om-key is-line is-${tone}`} />
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Small multiples on one date axis: traffic above, submissions below; one crosshair for both. */
function Trend({ daily, totals, range }: { daily: Day[]; totals: Totals; range: string }) {
  const t = useT();
  const f = useFormat();
  const [width, setWidth] = useState(0);
  const measure = useCallback((el: HTMLElement | null) => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [active, setActive] = useState<number | null>(null);
  const n = daily.length;
  const w = width || 640;
  const quiet = !daily.some((d) => d.pageViews || d.visitors || d.submissions);
  const i = active == null || !n ? null : Math.min(active, n - 1);
  const day = i == null ? null : daily[i];
  const x = i == null ? 0 : PAD_L + ((w - PAD_L - PAD_R) / n) * (i + 0.5);
  const tipLeft = x + 12 + TIP_W <= w ? x + 12 : Math.max(0, x - 12 - TIP_W);
  const describe = (d: Day) =>
    t(
      `${f.day(d.day)}：浏览 ${f.n(d.pageViews)}，访客 ${f.n(d.visitors)}，提交 ${f.n(d.submissions)}，通过 ${f.n(d.accepted)}`,
      `${f.day(d.day)}: ${f.n(d.pageViews)} page views, ${f.n(d.visitors)} visitors, ${f.n(d.submissions)} submissions, ${f.n(d.accepted)} accepted`,
    );
  return (
    <Card
      ref={measure}
      className="om-span-12"
      i={3}
      title={t('每日趋势', 'Daily trend')}
      extra={<span className="om-card-extra">{range}</span>}
    >
      {quiet ? (
        <p className="om-none">{t('这段时间还没有访问或提交。', 'No visits or submissions in this range yet.')}</p>
      ) : (
        <div className="om-plots">
          <div className="om-panel">
            <div className="om-panel-head">
              <h3>{t('流量', 'Traffic')}</h3>
              <ul className="om-legend">
                <li>
                  <span className="om-key is-bar is-views" aria-hidden="true" />
                  {t('浏览量', 'Page views')} <b>{f.n(totals.pageViews)}</b>
                </li>
                <li>
                  <span className="om-key is-line is-visitors" aria-hidden="true" />
                  {t('访客', 'Visitors')} <b>{f.n(totals.visitors)}</b>
                </li>
              </ul>
            </div>
            <Plot
              kind="traffic"
              daily={daily}
              width={w}
              active={i}
              onActive={setActive}
              label={t(`每日浏览量与访客，${range}`, `Daily page views and visitors, ${range}`)}
            />
          </div>
          <div className="om-panel">
            <div className="om-panel-head">
              <h3>{t('提交', 'Submissions')}</h3>
              <ul className="om-legend">
                <li>
                  <span className="om-key is-bar is-accepted" aria-hidden="true" />
                  {t('通过', 'Accepted')} <b>{f.n(totals.accepted)}</b>
                </li>
                <li>
                  <span className="om-key is-bar is-other" aria-hidden="true" />
                  {t('未通过', 'Not accepted')} <b>{f.n(Math.max(0, totals.submissions - totals.accepted))}</b>
                </li>
              </ul>
            </div>
            <Plot
              kind="submissions"
              daily={daily}
              width={w}
              active={i}
              onActive={setActive}
              axis
              label={t(`每日提交与通过，${range}`, `Daily submissions and accepted, ${range}`)}
            />
          </div>
          {day && (
            <div className="om-tip" style={{ left: tipLeft, width: TIP_W }} aria-hidden="true">
              <strong>{f.day(day.day, true)}</strong>
              <TipRow tone="views" value={f.n(day.pageViews)} label={t('浏览量', 'Page views')} />
              <TipRow tone="visitors" value={f.n(day.visitors)} label={t('访客', 'Visitors')} />
              <TipRow tone="accepted" value={f.n(Math.min(day.accepted, day.submissions))} label={t('通过', 'Accepted')} />
              <TipRow
                tone="other"
                value={f.n(Math.max(0, day.submissions - day.accepted))}
                label={t('未通过', 'Not accepted')}
              />
            </div>
          )}
          {/* Keyboard and screen readers walk the days with a native slider; it drives the crosshair. */}
          <input
            type="range"
            className="om-scrub sr-only"
            min={0}
            max={n - 1}
            step={1}
            value={i ?? n - 1}
            aria-label={t('逐日查看', 'Browse by day')}
            aria-valuetext={describe(daily[i ?? n - 1])}
            onChange={(e) => setActive(Number(e.target.value))}
            onFocus={() => setActive((a) => a ?? n - 1)}
            onBlur={() => setActive(null)}
          />
        </div>
      )}
      {n > 0 && (
        <details className="om-details">
          <summary>{t('查看每日数据表', 'Show daily data table')}</summary>
          <div className="om-table-wrap">
            <table className="om-table">
              <caption className="sr-only">{t('每日数据，最新的在前', 'Daily numbers, newest first')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('日期', 'Day')}</th>
                  <th scope="col" className="is-num">{t('浏览量', 'Page views')}</th>
                  <th scope="col" className="is-num">{t('访客', 'Visitors')}</th>
                  <th scope="col" className="is-num">{t('注册', 'Signups')}</th>
                  <th scope="col" className="is-num">{t('提交', 'Submissions')}</th>
                  <th scope="col" className="is-num">{t('通过', 'Accepted')}</th>
                  <th scope="col" className="is-num">{t('运行', 'Runs')}</th>
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{f.day(d.day)}</th>
                    <td className="is-num">{f.n(d.pageViews)}</td>
                    <td className="is-num">{f.n(d.visitors)}</td>
                    <td className="is-num">{f.n(d.signups)}</td>
                    <td className="is-num">{f.n(d.submissions)}</td>
                    <td className="is-num">{f.n(d.accepted)}</td>
                    <td className="is-num">{f.n(d.runs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Card>
  );
}

const PERCENTILES = ['p50', 'p90', 'p99', 'avg'] as const;

/** Measured vs felt: every timing on one shared axis, the numbers beside it. */
function Latency({ judge }: { judge: Judge }) {
  const t = useT();
  const f = useFormat();
  const rows = [
    {
      key: 'client',
      name: t('用户感受', 'Users feel'),
      hint: t('浏览器里从点提交到看到结果', 'Browser: Submit click to result'),
      stat: judge.client,
      tone: 'felt',
    },
    {
      key: 'server',
      name: t('判题耗时', 'Judge time'),
      hint: t('判题服务器上测得', 'Measured on the judge server'),
      stat: judge.server,
      tone: 'judge',
    },
    {
      key: 'queue',
      name: t('排队等待', 'Queue wait'),
      hint: t('等判题机空出来', 'Waiting for a free judge worker'),
      stat: judge.queue,
      tone: 'context',
    },
    {
      key: 'run',
      name: t('运行样例', 'Run samples'),
      hint: t('点“运行”到看到结果', 'Run button to result'),
      stat: judge.run,
      tone: 'context',
    },
  ];
  const max = niceMax(
    Math.max(
      0,
      ...rows.flatMap(({ stat }) => PERCENTILES.map((p) => stat?.[p] ?? 0)),
    ),
  );
  const at = (v: number) => (Math.min(1, v / max) * 100).toFixed(2) + '%';
  const gap =
    judge.client?.p50 != null && judge.server?.p50 != null ? judge.client.p50 - judge.server.p50 : null;
  return (
    <Card
      className="om-span-8"
      i={4}
      title={t('判题耗时', 'Judge latency')}
      extra={
        <span className="rd-badge">
          {t(`评测 ${f.n(judge.server?.count ?? 0)} 次`, `${f.n(judge.server?.count ?? 0)} judged`)}
        </span>
      }
      note={t(
        '判题服务器测得的时间，和用户在浏览器里等到结果的时间放在一起看。',
        'What the judge server measures, next to what users wait for in the browser.',
      )}
    >
      {!rows.some(({ stat }) => stat?.count) ? (
        <p className="om-none">{t('这段时间没有评测。', 'No judging in this range.')}</p>
      ) : (
        <>
          {gap != null && (
            <p className="om-gap">
              <strong>{(gap < 0 ? '−' : '+') + duration(Math.abs(gap))}</strong>
              {t('用户比判题本身多等的时间（中位数）', "users wait beyond the judge's own time (median)")}
            </p>
          )}
          <div className="om-lat">
            <div className="om-lat-row om-lat-head" aria-hidden="true">
              <span />
              {PERCENTILES.map((p) => (
                <span key={p}>{p === 'avg' ? t('平均', 'avg') : p}</span>
              ))}
              <span />
            </div>
            {rows.map(({ key, name, hint, stat, tone }) => {
              const end = stat?.p99 ?? stat?.p90;
              return (
                <div key={key} className={`om-lat-row is-${tone}`}>
                  <div className="om-lat-name">
                    <strong>{name}</strong>
                    <span>{hint}</span>
                  </div>
                  <dl className="om-lat-values">
                    {PERCENTILES.map((p) => (
                      <div key={p}>
                        <dt>{p === 'avg' ? t('平均', 'avg') : p}</dt>
                        <dd>{duration(stat?.[p])}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="om-lat-track" aria-hidden="true">
                    {stat?.p50 != null && end != null && (
                      <span className="om-lat-tail" style={{ left: at(stat.p50), width: `calc(${at(end)} - ${at(stat.p50)})` }} />
                    )}
                    {stat?.p50 != null && stat.p90 != null && (
                      <span
                        className="om-lat-spread"
                        style={{ left: at(stat.p50), width: `calc(${at(stat.p90)} - ${at(stat.p50)})` }}
                      />
                    )}
                    {stat?.avg != null && <span className="om-lat-avg" style={{ left: at(stat.avg) }} />}
                    {stat?.p99 != null && <span className="om-lat-ring" style={{ left: at(stat.p99) }} />}
                    {stat?.p50 != null && <span className="om-lat-dot" style={{ left: at(stat.p50) }} />}
                  </div>
                </div>
              );
            })}
            <div className="om-lat-row om-lat-axis" aria-hidden="true">
              <span className="om-lat-ticks">
                <span>0</span>
                <span>{duration(max / 2)}</span>
                <span>{duration(max)}</span>
              </span>
            </div>
          </div>
          <p className="om-lat-legend" aria-hidden="true">
            <span>
              <i className="om-glyph is-dot" />
              {t('中位数 p50', 'median (p50)')}
            </span>
            <span>
              <i className="om-glyph is-spread" />
              p50–p90
            </span>
            <span>
              <i className="om-glyph is-ring" />
              p99
            </span>
            <span>
              <i className="om-glyph is-avg" />
              {t('平均', 'average')}
            </span>
          </p>
        </>
      )}
    </Card>
  );
}

function Languages({ languages }: { languages: Judge['byLanguage'] }) {
  const t = useT();
  const f = useFormat();
  const slowest = Math.max(1, ...languages.map((l) => l.p50 ?? 0));
  return (
    <Card
      className="om-span-4"
      i={9}
      title={t('各语言判题耗时', 'Judge time by language')}
      note={t('评测次数和中位耗时', 'Judged submissions and the median judge time')}
    >
      {languages.length ? (
        <table className="om-table">
          <caption className="sr-only">
            {t('各语言的评测次数和中位耗时', 'Judged submissions and median judge time by language')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('语言', 'Language')}</th>
              <th scope="col" className="is-num">{t('评测', 'Judged')}</th>
              <th scope="col" className="is-num">{t('中位耗时', 'Median')}</th>
            </tr>
          </thead>
          <tbody>
            {languages.map((l) => (
              <tr key={l.language}>
                <th scope="row">
                  {Object.hasOwn(LANGUAGE_NAMES, l.language) ? LANGUAGE_NAMES[l.language] : l.language}
                </th>
                <td className="is-num">{f.n(l.count)}</td>
                <td className="is-num">
                  <span className="om-meter" aria-hidden="true">
                    <span style={{ width: `${((l.p50 ?? 0) / slowest) * 100}%` }} />
                  </span>
                  {duration(l.p50)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="om-none">{t('这段时间没有评测。', 'No judging in this range.')}</p>
      )}
    </Card>
  );
}

function Dashboard({
  data,
  stale,
  navigate,
}: {
  data: Summary;
  stale: boolean;
  navigate?: Navigate;
}) {
  const t = useT();
  const f = useFormat();
  const { totals, judge } = data;
  const rate = totals.submissions ? Math.round((totals.accepted / totals.submissions) * 100) : null;
  const queued = judge.queuedNow ?? 0;
  const running = judge.runningNow ?? 0;
  const verdicts = judge.verdicts ?? [];
  const range = `${f.day(data.range.from)} – ${f.day(data.range.to)}`;
  // Real links (new tab, copy) that stay inside the app on a plain click.
  const open = (e: MouseEvent<HTMLAnchorElement>, type: string, slug: string) => {
    if (!navigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate('content', { type, slug });
  };
  return (
    <div className={`om-grid${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
      <section
        className="rd-card om-kpis om-span-12 rd-reveal"
        style={{ '--i': 2 } as CSSProperties}
        aria-label={t('关键指标', 'Key numbers')}
      >
        <Kpi icon={<Eye size={13} />} label={t('浏览量', 'Page views')} value={f.n(totals.pageViews)} />
        <Kpi icon={<Users size={13} />} label={t('访客', 'Visitors')} value={f.n(totals.visitors)} />
        <Kpi icon={<UserPlus size={13} />} label={t('新注册', 'Signups')} value={f.n(totals.signups)} />
        <Kpi
          icon={<Send size={13} />}
          label={t('提交', 'Submissions')}
          value={f.n(totals.submissions)}
          sub={[
            rate == null ? '' : t(`通过率 ${rate}%`, `${rate}% accepted`),
            t(`运行 ${f.n(totals.runs)} 次`, `${f.n(totals.runs)} runs`),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Kpi
          icon={<Timer size={13} />}
          label={t('判题耗时中位数', 'Median judge time')}
          value={duration(judge.server?.p50)}
          sub={t(`用户感受 ${duration(judge.client?.p50)}`, `Users feel ${duration(judge.client?.p50)}`)}
        />
        <Kpi
          icon={<Activity size={13} />}
          label={t('正在评测', 'Judging now')}
          value={
            <>
              {queued + running > 0 && <span className="om-live" aria-hidden="true" />}
              {f.n(queued + running)}
            </>
          }
          sub={t(`排队 ${f.n(queued)} · 运行中 ${f.n(running)}`, `${f.n(queued)} queued · ${f.n(running)} running`)}
        />
      </section>

      <Trend daily={data.daily ?? []} totals={totals} range={range} />
      <Latency judge={judge} />

      <Card
        className="om-span-4"
        i={5}
        title={t('评测结果', 'Verdicts')}
        extra={<span className="rd-badge">{f.n(verdicts.reduce((sum, v) => sum + v.count, 0))}</span>}
        note={t('这段时间的提交都以什么结果结束', 'How submissions in this range ended')}
      >
        <BarList
          share
          none={t('还没有评测结果。', 'No verdicts yet.')}
          rows={verdicts.map((v) => {
            const [abbr, tone] = Object.hasOwn(VERDICTS, v.verdict) ? VERDICTS[v.verdict] : ['', 'neutral'];
            return {
              key: v.verdict,
              tone,
              count: v.count,
              label: (
                <>
                  {abbr && <span className="om-abbr">{abbr}</span>}
                  <span className="om-text">{statusNames[v.verdict] || v.verdict}</span>
                </>
              ),
            };
          })}
        />
      </Card>
      <Card className="om-span-4" i={6} title={t('热门页面', 'Top pages')} note={t('按浏览量排序', 'By page views')}>
        <BarList
          none={t('还没有浏览记录。', 'No page views yet.')}
          rows={(data.topViews ?? []).map((v) => ({
            key: `${v.view}:${v.type ?? ''}`,
            count: v.count,
            label: (
              <>
                <span className="om-text">{named(VIEW_NAMES, v.view, t)}</span>
                {v.type && <span className="rd-badge">{named(TYPE_NAMES, v.type, t)}</span>}
              </>
            ),
          }))}
        />
      </Card>
      <Card
        className="om-span-4"
        i={7}
        title={t('热门内容', 'Top content')}
        note={t('面试题、面经和学习资料的浏览量', 'Views of questions, experiences and resources')}
      >
        <BarList
          none={t('还没有内容被浏览。', 'No content views yet.')}
          rows={(data.topContent ?? []).map((c) => ({
            key: `${c.type}:${c.slug}`,
            count: c.count,
            label: (
              <a
                className="om-link"
                href={`/?${new URLSearchParams({ view: 'content', type: c.type, slug: c.slug })}`}
                onClick={(e) => open(e, c.type, c.slug)}
              >
                <span className="rd-badge">{named(TYPE_NAMES, c.type, t)}</span>
                <span className="om-text">{c.slug}</span>
              </a>
            ),
          }))}
        />
      </Card>
      <Card
        className="om-span-4"
        i={8}
        title={t('热门搜索', 'Top searches')}
        note={t('大家在站内搜什么', 'What people searched for')}
      >
        <BarList
          none={t('还没有搜索记录。', 'No searches yet.')}
          rows={(data.topSearches ?? []).map((s) => ({
            key: s.q,
            count: s.count,
            label: <span className="om-text">{s.q}</span>,
          }))}
        />
      </Card>
      <Languages languages={judge.byLanguage ?? []} />
      <Card
        className="om-span-4"
        i={10}
        title={t('错误', 'Errors')}
        extra={
          <span className={`rd-badge${totals.judgeErrors ? ' is-warn' : ''}`}>
            {t(`判题异常 ${f.n(totals.judgeErrors)}`, `${f.n(totals.judgeErrors)} judge errors`)}
          </span>
        }
        note={t('按环节和状态码统计', 'By stage and status code')}
      >
        <BarList
          none={t('这段时间没有错误。', 'No errors in this range.')}
          rows={(data.errors ?? []).map((e) => ({
            key: `${e.stage}:${e.status ?? ''}`,
            tone: 'bad',
            count: e.count,
            label: (
              <>
                <span className="om-text om-mono">{e.stage}</span>
                {e.status != null && e.status !== '' && <span className="rd-badge">{String(e.status)}</span>}
              </>
            ),
          }))}
        />
      </Card>
      <Card
        className="om-span-4"
        i={11}
        title={t('界面语言', 'Site language')}
        note={t('浏览时使用的界面语言', 'The language pages were viewed in')}
      >
        <BarList
          share
          none={t('还没有浏览记录。', 'No page views yet.')}
          rows={(data.locales ?? []).map((l) => ({
            key: l.locale,
            count: l.count,
            label: <span className="om-text">{named(LOCALE_NAMES, l.locale, t)}</span>,
          }))}
        />
      </Card>
    </div>
  );
}

function Skeleton() {
  const t = useT();
  return (
    <>
      <output className="sr-only">{t('正在加载…', 'Loading…')}</output>
      <div className="om-grid" aria-hidden="true">
        <div className="om-skel om-span-12" style={{ height: 106 }} />
        <div className="om-skel om-span-12" style={{ height: 300 }} />
        <div className="om-skel om-span-8" style={{ height: 280 }} />
        <div className="om-skel om-span-4" style={{ height: 280 }} />
      </div>
    </>
  );
}

/** Owner analytics: traffic, signups and judging for the last 7/14/30/90 days. */
export function OwnerMetrics({ navigate }: { navigate?: Navigate }) {
  const t = useT();
  const f = useFormat();
  const [days, setDays] = useState(7);
  const [reload, setReload] = useState(0);
  const key = `${days}:${reload}`;
  const [loaded, setLoaded] = useState<{ key: string; data: Summary } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Summary>(`metrics/summary?days=${days}`)
      .then((data) => !cancelled && setLoaded({ key, data }))
      .catch((e: Error) => !cancelled && setFailed({ key, message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [days, key]);
  const data = loaded?.data;
  const error = failed?.key === key ? failed.message : '';
  const loading = loaded?.key !== key && !error;
  const retry = () => setReload((r) => r + 1);

  return (
    <div className="rd om">
      <div className="rd-page">
        <header className="rd-head rd-reveal" style={{ '--i': 0 } as CSSProperties}>
          <h1>{t('运营数据', 'Analytics')}</h1>
          <p>
            {t(
              '全站的流量、注册和评测情况。只有老师和站长能看到这一页。',
              'Traffic, signups and judging across the site. Only teachers and the owner can see this page.',
            )}
          </p>
        </header>
        <div className="rd-toolbar om-toolbar rd-reveal" style={{ '--i': 1 } as CSSProperties}>
          <fieldset className="rd-segment">
            <legend className="sr-only">{t('时间范围', 'Date range')}</legend>
            {RANGES.map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
                {t(`${d} 天`, `${d} days`)}
              </button>
            ))}
          </fieldset>
          <div className="om-updated">
            {data && (
              <span>
                {t(`更新于 ${f.time(data.generatedAt)}`, `Updated ${f.time(data.generatedAt)}`)}
              </span>
            )}
            <button
              type="button"
              className="om-refresh"
              disabled={loading}
              onClick={retry}
              aria-label={t('刷新', 'Refresh')}
              title={t('刷新', 'Refresh')}
            >
              <RefreshCw size={13} className={loading ? 'is-spinning' : undefined} aria-hidden="true" />
            </button>
          </div>
        </div>
        {error && (
          <div className="om-error" role="alert">
            <span>{t(error, englishMessage(error))}</span>
            <button type="button" className="rd-button is-quiet" onClick={retry}>
              {t('重试', 'Retry')}
            </button>
          </div>
        )}
        <div className="om-body">
          {data ? (
            <Dashboard data={data} stale={loaded?.key !== key} navigate={navigate} />
          ) : (
            loading && <Skeleton />
          )}
        </div>
      </div>
    </div>
  );
}
