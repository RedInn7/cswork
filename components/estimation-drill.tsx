'use client';
import { useState } from 'react';

/**
 * Back-of-the-envelope drill for the system design course: a scenario's numbers in, the learner's
 * QPS, peak QPS, storage a year, bandwidth and server count out, each right within ±30%. Pure client
 * state; nothing is saved. Units are decimal (1 KB = 1,000 B), as estimates usually are.
 */
export type Scenario = {
  id: string;
  zh: string;
  en: string;
  /** What one write and one read are in this scenario. */
  whatZh: string;
  whatEn: string;
  dau: number;
  /** Writes per user per day. */
  writes: number;
  /** Reads per write. */
  ratio: number;
  /** Bytes per write, and per read response. */
  size: number;
  /** Days the data is kept. */
  retention: number;
  /** Peak QPS over the average. */
  peak: number;
  /** Requests a second one app server handles. */
  serverQps: number;
};

/** Usable disk per storage server and the copies kept of every byte. */
export const DISK = 10e12;
export const REPLICAS = 3;
const DAY = 86_400;

export const SCENARIOS: Scenario[] = [
  { id: 'url-shortener', zh: '短链接服务', en: 'URL shortener', whatZh: '写 = 生成一个短链；读 = 一次跳转', whatEn: 'write = create a short link; read = one redirect', dau: 100e6, writes: 0.1, ratio: 100, size: 500, retention: 1825, peak: 3, serverQps: 5_000 },
  { id: 'photo-sharing', zh: '图片分享', en: 'Photo sharing', whatZh: '写 = 上传一张照片；读 = 看一次原图', whatEn: 'write = upload a photo; read = view it in full', dau: 50e6, writes: 0.2, ratio: 50, size: 2e6, retention: 3650, peak: 2, serverQps: 1_000 },
  { id: 'chat', zh: '即时聊天', en: 'Chat messages', whatZh: '写 = 发一条消息；读 = 一次投递给接收方', whatEn: 'write = send a message; read = one delivery to a recipient', dau: 500e6, writes: 40, ratio: 2, size: 200, retention: 365, peak: 3, serverQps: 10_000 },
  { id: 'news-feed', zh: '社交动态 Feed', en: 'Social news feed', whatZh: '写 = 发一条动态；读 = 刷到一次', whatEn: 'write = publish a post; read = one view in a feed', dau: 200e6, writes: 2, ratio: 50, size: 1_000, retention: 1825, peak: 3, serverQps: 2_000 },
  { id: 'ride-locations', zh: '网约车司机定位', en: 'Ride-hailing driver locations', whatZh: '写 = 司机上报一次位置；读 = 匹配服务查一次位置', whatEn: 'write = a driver location ping; read = one lookup by matching', dau: 1e6, writes: 7_200, ratio: 1, size: 100, retention: 30, peak: 2, serverQps: 10_000 },
  { id: 'clickstream', zh: '电商点击流埋点', en: 'E-commerce clickstream', whatZh: '写 = 一条埋点事件；读 = 分析查询扫到它一次', whatEn: 'write = one tracking event; read = an analytics query touching it', dau: 20e6, writes: 100, ratio: 0.1, size: 300, retention: 90, peak: 4, serverQps: 20_000 },
  { id: 'video', zh: '视频网站', en: 'Video platform', whatZh: '写 = 上传一个视频；读 = 完整播放一次', whatEn: 'write = upload a video; read = one full playback', dau: 100e6, writes: 0.001, ratio: 1_000, size: 500e6, retention: 1825, peak: 3, serverQps: 1_000 },
  { id: 'orders', zh: '电商订单', en: 'E-commerce orders', whatZh: '写 = 下一单；读 = 查看一次订单状态', whatEn: 'write = place an order; read = one order status view', dau: 30e6, writes: 0.1, ratio: 20, size: 2_000, retention: 2555, peak: 10, serverQps: 1_000 },
  { id: 'autocomplete', zh: '搜索联想', en: 'Search autocomplete', whatZh: '写 = 记录一次搜索；读 = 一次联想请求', whatEn: 'write = log one search; read = one suggestion request', dau: 100e6, writes: 5, ratio: 6, size: 100, retention: 30, peak: 3, serverQps: 5_000 },
  { id: 'notifications', zh: '消息推送', en: 'Push notifications', whatZh: '写 = 生成一条通知；读 = 用户打开一次', whatEn: 'write = create a notification; read = one open by the user', dau: 100e6, writes: 10, ratio: 0.5, size: 500, retention: 30, peak: 5, serverQps: 5_000 },
];

/** mulberry32: the same seed gives the same numbers on the server and in the browser. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Two significant digits, so a varied scenario still reads like an interview prompt. */
const round2 = (n: number) => {
  const step = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / step) * step;
};

/** Seed 0 is the scenario as written; any other seed scales its users, activity and item size. */
export function drillParams(scenario: Scenario, seed: number): Scenario {
  if (!seed) return scenario;
  const next = random(seed * 7_919 + SCENARIOS.indexOf(scenario));
  const pick = (choices: number[]) => choices[Math.floor(next() * choices.length)];
  return {
    ...scenario,
    dau: round2(scenario.dau * pick([0.2, 0.5, 2, 3, 5])),
    writes: round2(scenario.writes * pick([0.5, 1, 2])),
    size: round2(scenario.size * pick([0.5, 1, 2, 4])),
  };
}

export type Answers = { qps: number; peak: number; storage: number; bandwidth: number; machines: number };
export const FIELDS = ['qps', 'peak', 'storage', 'bandwidth', 'machines'] as const;

/** The reference answers: storage in TB a year (one copy), bandwidth in MB/s on average. */
export function solve(p: Scenario) {
  const writes = p.dau * p.writes;
  const reads = writes * p.ratio;
  const qps = (writes + reads) / DAY;
  const peak = qps * p.peak;
  const daily = writes * p.size;
  const kept = daily * p.retention * REPLICAS;
  const appServers = Math.ceil(peak / p.serverQps);
  const storageServers = Math.ceil(kept / DISK);
  return {
    writes,
    reads,
    daily,
    kept,
    appServers,
    storageServers,
    answers: {
      qps,
      peak,
      storage: (daily * 365) / 1e12,
      bandwidth: (qps * p.size) / 1e6,
      machines: Math.max(appServers, storageServers),
    } satisfies Answers,
  };
}

/** Right when within ±30% of the reference. */
export const close = (value: number | null, reference: number) =>
  value !== null && Number.isFinite(value) && Math.abs(value - reference) <= 0.3 * reference;

const SUFFIX: Record<string, number> = { '': 1, k: 1e3, m: 1e6, b: 1e9, 万: 1e4, 亿: 1e8 };
/** "46000", "46,000", "46k", "4.6万", "4.6e4" → 46000; anything else → null. */
export function parseAmount(text: string) {
  const m = text
    .trim()
    .replace(/[,，\s]/g, '')
    .match(/^(\d+(?:\.\d+)?|\.\d+)(?:e(\d{1,2}))?([kmb万亿]?)$/i);
  return m ? Number(m[1]) * 10 ** Number(m[2] ?? 0) * SUFFIX[m[3].toLowerCase()] : null;
}

const sig = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 3 });
/** 46300 → "4.63 万" / "46.3K": the same text on the server and in the browser. */
export function count(n: number, zh: boolean) {
  const units: [number, string][] = zh ? [[1e8, ' 亿'], [1e4, ' 万']] : [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  const [size, unit] = units.find(([size]) => n >= size) ?? [1, ''];
  return `${sig(n / size)}${unit}`;
}
export function bytes(n: number) {
  const units: [number, string][] = [[1e15, 'PB'], [1e12, 'TB'], [1e9, 'GB'], [1e6, 'MB'], [1e3, 'KB']];
  const [size, unit] = units.find(([size]) => n >= size) ?? [1, 'B'];
  return `${sig(n / size)} ${unit}`;
}
const days = (n: number, zh: boolean) =>
  n % 365 === 0 ? (zh ? `${n / 365} 年` : `${n / 365} year${n === 365 ? '' : 's'}`) : zh ? `${n} 天` : `${n} days`;

/** Step by step, in the reader's language. */
export function steps(p: Scenario, zh: boolean) {
  const s = solve(p);
  const a = s.answers;
  const n = (x: number) => count(x, zh);
  return zh
    ? [
        `每天写入 = ${n(p.dau)} DAU × ${sig(p.writes)} 次 = ${n(s.writes)} 次；每天读取 = 写入 × ${sig(p.ratio)} = ${n(s.reads)} 次。`,
        `平均 QPS = (${n(s.writes)} + ${n(s.reads)}) ÷ 86,400 秒 ≈ ${n(a.qps)}。`,
        `峰值 QPS = ${n(a.qps)} × ${p.peak} ≈ ${n(a.peak)}。`,
        `每天新增数据 = ${n(s.writes)} × ${bytes(p.size)} = ${bytes(s.daily)}；一年 × 365 ≈ ${bytes(s.daily * 365)}（单副本）。`,
        `平均带宽 = ${n(a.qps)} 次/秒 × ${bytes(p.size)} ≈ ${bytes(a.bandwidth * 1e6)}/s。`,
        `应用服务器 = ⌈${n(a.peak)} ÷ ${n(p.serverQps)}⌉ = ${s.appServers} 台；存储：${bytes(s.daily)} × ${p.retention} 天 × ${REPLICAS} 副本 = ${bytes(s.kept)}，每台 ${bytes(DISK)}，需要 ${s.storageServers} 台。`,
        `机器数取两者中较大的：${a.machines} 台。${s.storageServers > s.appServers ? '这个场景受存储约束。' : '这个场景受请求量约束。'}`,
      ]
    : [
        `Writes a day = ${n(p.dau)} DAU × ${sig(p.writes)} = ${n(s.writes)}; reads a day = writes × ${sig(p.ratio)} = ${n(s.reads)}.`,
        `Average QPS = (${n(s.writes)} + ${n(s.reads)}) ÷ 86,400 s ≈ ${n(a.qps)}.`,
        `Peak QPS = ${n(a.qps)} × ${p.peak} ≈ ${n(a.peak)}.`,
        `New data a day = ${n(s.writes)} × ${bytes(p.size)} = ${bytes(s.daily)}; × 365 ≈ ${bytes(s.daily * 365)} a year (one copy).`,
        `Average bandwidth = ${n(a.qps)} requests/s × ${bytes(p.size)} ≈ ${bytes(a.bandwidth * 1e6)}/s.`,
        `App servers = ⌈${n(a.peak)} ÷ ${n(p.serverQps)}⌉ = ${s.appServers}; storage: ${bytes(s.daily)} × ${p.retention} days × ${REPLICAS} copies = ${bytes(s.kept)}, at ${bytes(DISK)} a server that is ${s.storageServers}.`,
        `Servers = the larger of the two: ${a.machines}. ${s.storageServers > s.appServers ? 'Storage is the constraint here.' : 'Request volume is the constraint here.'}`,
      ];
}

const POWERS: [string, string, string][] = [
  ['2¹⁰ = 1,024', '≈ 10³', 'KB'],
  ['2²⁰', '≈ 10⁶', 'MB'],
  ['2³⁰', '≈ 10⁹', 'GB'],
  ['2⁴⁰', '≈ 10¹²', 'TB'],
  ['2⁵⁰', '≈ 10¹⁵', 'PB'],
];
const HANDY: [string, string, string][] = [
  ['一天的秒数', 'Seconds in a day', '86,400 ≈ 10⁵'],
  ['一年的秒数', 'Seconds in a year', '≈ 3.15 × 10⁷'],
  ['每天 100 万次', 'A million a day', '≈ 12 / s'],
  ['每天 10 亿次', 'A billion a day', '≈ 11,600 / s'],
];
// Orders of magnitude on current hardware; real numbers vary with the machine.
const LATENCY: [string, string, string][] = [
  ['L1 缓存访问', 'L1 cache reference', '~1 ns'],
  ['内存访问', 'Main memory reference', '~100 ns'],
  ['SSD 随机读 4 KB', 'SSD random read, 4 KB', '~20–100 μs'],
  ['从内存顺序读 1 MB', 'Read 1 MB sequentially from memory', '~50 μs'],
  ['从 SSD 顺序读 1 MB', 'Read 1 MB sequentially from SSD', '~0.5 ms'],
  ['同机房网络往返', 'Round trip within a data center', '~0.5 ms'],
  ['1 Gbps 网络传 1 MB', 'Send 1 MB over 1 Gbps', '~8 ms'],
  ['机械硬盘寻道', 'Hard disk seek', '~5–10 ms'],
  ['跨洲网络往返', 'Round trip between continents', '~100–150 ms'],
];

const LABELS: Record<(typeof FIELDS)[number], [string, string, string]> = {
  qps: ['平均 QPS', 'Average QPS', '次/秒 · requests/s'],
  peak: ['峰值 QPS', 'Peak QPS', '次/秒 · requests/s'],
  storage: ['每年新增存储（单副本）', 'New storage a year (one copy)', 'TB'],
  bandwidth: ['平均带宽', 'Average bandwidth', 'MB/s'],
  machines: ['机器数（应用或存储，取多者）', 'Servers (app or storage, whichever is more)', '台 · servers'],
};

export function EstimationDrill({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [at, setAt] = useState(0);
  const [seed, setSeed] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const p = drillParams(SCENARIOS[at], seed);
  const { answers } = solve(p);
  const reset = () => {
    setValues({});
    setChecked(false);
  };
  const shown = (field: (typeof FIELDS)[number], value: number) =>
    field === 'machines' ? String(value) : field === 'storage' || field === 'bandwidth' ? sig(value) : count(value, zh);
  const right = FIELDS.filter((field) => close(parseAmount(values[field] ?? ''), answers[field])).length;
  return (
    <section className="sd-quiz sd-drill" aria-labelledby="sd-drill-title">
      <div className="sd-quiz-head">
        <h2 id="sd-drill-title">{t('容量估算练习', 'Capacity estimation drill')}</h2>
        <p className="sd-quiz-score">{t('误差 ±30% 以内算对', 'Within ±30% counts as right')}</p>
      </div>
      <div className="sd-drill-pick">
        <label>
          {t('场景', 'Scenario')}
          <select
            value={at}
            onChange={(event) => {
              setAt(Number(event.target.value));
              setSeed(0);
              reset();
            }}
          >
            {SCENARIOS.map((s, i) => (
              <option key={s.id} value={i}>
                {i + 1}. {zh ? s.zh : s.en}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="sd-quiz-restart"
          onClick={() => {
            setSeed(seed + 1);
            reset();
          }}
        >
          {t('换一组数字', 'New numbers')}
        </button>
      </div>
      <p className="sd-drill-what">{zh ? p.whatZh : p.whatEn}</p>
      <dl className="sd-drill-params">
        <div>
          <dt>DAU</dt>
          <dd>{count(p.dau, zh)}</dd>
        </div>
        <div>
          <dt>{t('每人每天写入', 'Writes per user a day')}</dt>
          <dd>{sig(p.writes)}</dd>
        </div>
        <div>
          <dt>{t('读 : 写', 'Reads : writes')}</dt>
          <dd>{sig(p.ratio)} : 1</dd>
        </div>
        <div>
          <dt>{t('每次写入 / 读取的大小', 'Size per write or read')}</dt>
          <dd>{bytes(p.size)}</dd>
        </div>
        <div>
          <dt>{t('保留期', 'Kept for')}</dt>
          <dd>{days(p.retention, zh)}</dd>
        </div>
        <div>
          <dt>{t('峰值 / 平均', 'Peak / average')}</dt>
          <dd>× {p.peak}</dd>
        </div>
        <div>
          <dt>{t('单台应用服务器', 'One app server')}</dt>
          <dd>{count(p.serverQps, zh)} QPS</dd>
        </div>
        <div>
          <dt>{t('单台存储服务器', 'One storage server')}</dt>
          <dd>
            {bytes(DISK)} · {t(`${REPLICAS} 副本`, `${REPLICAS} copies`)}
          </dd>
        </div>
      </dl>
      <form
        className="sd-drill-form"
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
      >
        {FIELDS.map((field) => {
          const ok = close(parseAmount(values[field] ?? ''), answers[field]);
          return (
            <div key={field} className="sd-drill-field" data-state={checked ? (ok ? 'right' : 'wrong') : undefined}>
              <label htmlFor={`sd-drill-${field}`}>{zh ? LABELS[field][0] : LABELS[field][1]}</label>
              <input
                id={`sd-drill-${field}`}
                autoComplete="off"
                value={values[field] ?? ''}
                aria-describedby={`sd-drill-${field}-unit`}
                onChange={(event) => setValues({ ...values, [field]: event.target.value })}
              />
              <span id={`sd-drill-${field}-unit`} className="sd-drill-unit">
                {LABELS[field][2]}
              </span>
              {checked && (
                <span className="sd-drill-mark">
                  {ok ? t('✓ 对', '✓ Right') : t('✗ 参考', '✗ Reference')} {shown(field, answers[field])}
                </span>
              )}
            </div>
          );
        })}
        <p className="sd-drill-hint">{t('可以写 46000、4.6万、46k 或 4.6e4。', 'Write 46000, 46k or 4.6e4.')}</p>
        <button type="submit" className="sd-quiz-restart">
          {t('核对答案', 'Check answers')}
        </button>
      </form>
      <div role="status">
        {checked && (
          <p className="sd-drill-score">{t(`答对 ${right} / ${FIELDS.length} 项`, `${right} of ${FIELDS.length} right`)}</p>
        )}
      </div>
      {checked && (
        <>
          <ol className="sd-quiz-why sd-drill-steps">
            {steps(p, zh).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="sd-drill-tables">
            <table>
              <caption>{t('2 的幂与常用数字', 'Powers of two and handy numbers')}</caption>
              <tbody>
                {POWERS.map(([power, decimal, unit]) => (
                  <tr key={unit}>
                    <th scope="row">{power}</th>
                    <td>
                      {decimal} · {unit}
                    </td>
                  </tr>
                ))}
                {HANDY.map(([a, b, value]) => (
                  <tr key={b}>
                    <th scope="row">{zh ? a : b}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table>
              <caption>{t('常见延迟（数量级）', 'Latency numbers (orders of magnitude)')}</caption>
              <tbody>
                {LATENCY.map(([a, b, value]) => (
                  <tr key={b}>
                    <th scope="row">{zh ? a : b}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
