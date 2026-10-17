'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { countdown, localStamp, type Application } from '@/lib/applications';
import rpp from '@/lib/content/rpp.json';
import {
  blankOffer,
  costAdjusted,
  firstYearCash,
  fourYear,
  importOffers,
  internTotals,
  moneyScores,
  OFFERS_MAX,
  readOffers,
  SCHEDULES,
  shareOffers,
  yearly,
  type NumKey,
  type Offer,
  type Schedule,
  type Year,
} from '@/lib/offer-math';
import { packJson, unpackJson } from '@/lib/playground-share';
import { api } from '@/lib/types';
import { OfferDecision, type H1bRecords } from './offer-decision';

// Pay figures stay in this browser and are never sent anywhere.
const KEY = 'cswork:offers:v1';
const OFFERS_MIN = 2;
const load = () => {
  try {
    return readOffers(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return [];
  }
};
const fresh = () => Array.from({ length: OFFERS_MIN }, () => blankOffer());
/** Longest #o= value a read-only link carries. */
const LINK_MAX = 8000;
const CITIES = rpp.values as Record<string, { name_zh: string; name_en: string; rpp: number }>;
const cityOf = (o: Offer) => (o.city && Object.hasOwn(CITIES, o.city) ? CITIES[o.city] : null);
const parity = (o: Offer) => cityOf(o)?.rpp ?? 0;

const SCHEDULE_NAMES: Record<Schedule, [string, string]> = {
  even: ['每年 25%', '25% a year'],
  '5-15-40-40': ['5 / 15 / 40 / 40（后置）', '5 / 15 / 40 / 40 (back-loaded)'],
  'front-40-30-20-10': ['40 / 30 / 20 / 10（前置）', '40 / 30 / 20 / 10 (front-loaded)'],
  custom: ['自定义', 'Custom'],
};
type Field = [NumKey, string, string, number?, number?];
// [key, zh, en, min (default 0), max]
const PAY: Field[] = [
  ['base', '基本工资（每年）', 'Base salary (yearly)'],
  ['bonusPct', '目标奖金（基本工资的 %）', 'Target bonus (% of base)', 0, 100],
  ['signOn1', '签字费：第 1 年', 'Sign-on: year 1'],
  ['signOn2', '签字费：第 2 年', 'Sign-on: year 2'],
];
const EQUITY: Field[] = [
  ['grant', '股票授予总值（4 年合计）', 'Equity grant (4-year value)'],
  ['cliffMonths', 'Cliff（月）', 'Cliff (months)', 0, 48],
  ['refresherPct', '每年 refresher（授予值的 %）', 'Yearly refresher (% of grant)', 0, 100],
  ['growthPct', '股价每年涨跌（%）', 'Share price change a year (%)', -100, 1000],
];
const EXTRA: Field[] = [
  ['match401k', '401(k) 匹配（每年金额）', '401(k) match (yearly amount)'],
  ['relocation', '搬家补贴（一次性）', 'Relocation (one-off)'],
  ['otherAnnual', '其他每年收入', 'Other yearly pay'],
];
const INTERN: Field[] = [
  ['hourly', '时薪', 'Hourly rate'],
  ['hoursPerWeek', '每周工时（不填按 40）', 'Hours a week (blank = 40)', 0, 80],
  ['monthly', '月薪（没有时薪时填）', 'Monthly pay (if there is no hourly rate)'],
  ['weeks', '实习周数', 'Weeks', 0, 52],
  ['housing', '住房补贴（一次性）', 'Housing stipend (lump sum)'],
  ['housingMonthly', '住房补贴（每月）', 'Housing stipend (monthly)'],
  ['relocation', '搬家费', 'Relocation'],
  ['travel', '路费（一次性）', 'Travel (one-off)'],
];
const RETURN_NAMES: [NonNullable<Offer['returnOffer']>, string, string][] = [
  ['', '还不知道', 'Not known yet'],
  ['likely', '大概率有', 'Likely'],
  ['unclear', '不确定', 'Unclear'],
  ['no', '没有', 'None'],
];
const PARTS: [Exclude<keyof Year, 'total'>, string, string][] = [
  ['base', '基本工资', 'Base'],
  ['bonus', '奖金', 'Bonus'],
  ['stock', '股票', 'Stock'],
  ['signOn', '签字费', 'Sign-on'],
  ['other', '其他', 'Other'],
];
const YEARS = [0, 1, 2, 3];

/**
 * /career/offers: two to four offers side by side, pre-tax: full-time year by year for four years,
 * internships by the week. A #o= link opens someone's comparison read-only.
 */
export function OfferCompare({ zh, signedIn, h1b = {} }: { zh: boolean; signedIn: boolean; h1b?: H1bRecords }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [offers, setOffers] = useState<Offer[]>(fresh);
  // Read after mount: storage and the clock differ from the server's render.
  const [now, setNow] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // The offers of a #o= link, shown read-only and never saved unless imported.
  const [shared, setShared] = useState<Offer[] | null>(null);
  const [anon, setAnon] = useState(false);
  const [link, setLink] = useState('');
  useEffect(() => {
    const saved = load();
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    if (saved.length) setOffers([...saved, ...fresh()].slice(0, Math.max(OFFERS_MIN, saved.length)));
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60000);
    const value = /^#(?:.*&)?o=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
    if (value)
      void (async () => {
        const packed = value.length <= LINK_MAX ? await unpackJson(value, 65536) : null;
        const got = packed && typeof packed === 'object' && (packed as { v?: unknown }).v === 1 ? readOffers((packed as { o?: unknown }).o) : [];
        if (got.length) setShared(got);
        else setNote(t('链接无效：打不开这个只读对比，下面是你自己的。', 'Invalid link: that read-only comparison could not be opened. This is your own.'));
      })();
    return () => clearInterval(tick);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, on mount.
  }, []);
  const leave = () => {
    setShared(null);
    history.replaceState(history.state, '', location.pathname + location.search);
  };
  const adopt = () => {
    if (!shared) return;
    if (load().length && !window.confirm(t('导入会替换你在这个浏览器里保存的 offer，继续吗？', 'Importing replaces the offers saved in this browser. Go on?')))
      return;
    save([...shared, ...fresh()].slice(0, Math.max(OFFERS_MIN, shared.length)));
    leave();
  };
  const share = async () => {
    setLink('');
    const value = await packJson({ v: 1, o: shareOffers(offers, { anon }) }, LINK_MAX);
    if (!value) {
      setNote(t(`内容太多，超过链接上限 ${LINK_MAX} 个字符。`, `Too much for one link (over ${LINK_MAX} characters).`));
      return;
    }
    const url = `${location.origin}${location.pathname}#o=${value}`;
    setLink(url);
    await (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'))).then(
      () => setNote(t('只读链接已复制：金额已取整，不含截止日和回收条款。', 'Read-only link copied: amounts are rounded; no deadlines or clawback terms.')),
      () => setNote(t('没能自动复制，请手动复制下面的链接。', "Couldn't copy it. Copy the link below by hand.")),
    );
  };
  const store = (next: Offer[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the comparison still works for this visit.
    }
  };
  const save = (next: Offer[]) => {
    setOffers(next);
    store(next);
  };
  const put = (i: number, o: Offer) => save(offers.map((x, j) => (j === i ? o : x)));
  const clear = () => {
    setOffers(fresh());
    setNote('');
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing was saved where storage is blocked.
    }
  };
  const pull = async () => {
    setBusy(true);
    setNote('');
    try {
      const { items } = await api<{ items: Application[] }>('oj/applications');
      const jobs = items
        .filter((a) => a.stage === 'offer')
        .map((a) => ({ company: a.company, role: a.role, deadline: localStamp(a.offerDeadline, false) }));
      // Merge into the offers as they are now, not as they were at the click: typing, Remove,
      // Add or Clear may have happened while the request was out. flushSync runs the updater
      // before the counts below are read; it never runs once the page is gone.
      let got = undefined as ReturnType<typeof importOffers> | undefined;
      flushSync(() => setOffers((prev) => (got = importOffers(prev, jobs)).offers));
      if (!got) return;
      store(got.offers);
      setNote(
        got.added || got.skipped
          ? t(
              `导入了 ${got.added} 个 offer 的公司和岗位，数字请自己填。${got.skipped ? `另有 ${got.skipped} 个没导入：最多比较 ${OFFERS_MAX} 个。` : ''}`,
              `Added ${got.added} ${got.added === 1 ? 'offer' : 'offers'} by company and role; fill in the numbers yourself.${got.skipped ? ` ${got.skipped} more left out: up to ${OFFERS_MAX} can be compared.` : ''}`,
            )
          : t('投递看板上没有新的「Offer」阶段卡片。', 'No new cards at the Offer stage on your tracker.'),
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // What the tables show: a shared link's offers, or this browser's.
  const list = shared ?? offers;
  const results = list.map((o) => {
    try {
      return { years: yearly(o), four: fourYear(o), cash: firstYearCash(o) };
    } catch {
      return null;
    }
  });
  const intern = list.map((o) => (o.kind === 'intern' && (o.weeks ?? 0) > 0 ? internTotals(o) : null));
  const full = list.flatMap((o, i) => (o.kind === 'fulltime' ? [i] : []));
  const interns = list.flatMap((o, i) => (o.kind === 'intern' ? [i] : []));
  const fmt = (n: number) => Math.round(n).toLocaleString(zh ? 'zh-CN' : 'en-US');
  const name = (o: Offer, i: number) => o.company.trim() || `Offer ${i + 1}`;
  const max = Math.max(0, ...full.flatMap((i) => results[i]?.years.map((y) => y.total) ?? []));
  // The highest value in a row of these columns, once two offers can be compared.
  const best = (cols: number[], pick: (i: number) => number | null | undefined, extra?: (i: number) => ReactNode) => {
    const values = cols.map((i) => pick(i) ?? null);
    const valid = values.filter((v): v is number => v !== null);
    const top = valid.length > 1 ? Math.max(...valid) : 0;
    return values.map((v, j) => (
      <td key={list[cols[j]].id} data-best={(top > 0 && v === top) || undefined}>
        {v === null ? '—' : fmt(v)}
        {top > 0 && v === top && <b className="offer-best">{t('最高', 'Highest')}</b>}
        {extra?.(cols[j])}
      </td>
    ));
  };
  const plain = (cols: number[], show: (i: number) => ReactNode) => cols.map((i) => <td key={list[i].id}>{show(i)}</td>);
  // Cost of living, a row of either table once some offer there has a priced city.
  const cityNote = (i: number) => {
    const c = cityOf(list[i]);
    return <small>{c ? `${t(c.name_zh, c.name_en)} · ${c.rpp}` : t('未折算', 'not adjusted')}</small>;
  };
  const costRow = (cols: number[], of: string, pick: (i: number) => number | null | undefined) =>
    cols.some((i) => parity(list[i])) && (
      <tr>
        <th scope="row">
          {t('按生活成本折算（全美平均=100）', 'Cost-of-living adjusted (US average = 100)')}
          <small>{t(`${of}；只看物价，不含税`, `${of}; prices only, not taxes`)}</small>
        </th>
        {best(
          cols,
          (i) => {
            const v = pick(i);
            return v == null ? null : costAdjusted(v, parity(list[i]));
          },
          cityNote,
        )}
      </tr>
    );
  const heads = (cols: number[]) =>
    cols.map((i) => (
      <th key={list[i].id} scope="col">
        {name(list[i], i)}
        {list[i].role.trim() && <small>{list[i].role}</small>}
      </th>
    ));
  const money = moneyScores(
    list.map((o, i) => {
      const v = (o.kind === 'intern' ? intern[i]?.weekly : results[i]?.four) || null;
      return { kind: o.kind, value: v == null ? null : costAdjusted(v, parity(o)) };
    }),
  );

  const field = (o: Offer, i: number, [key, zhLabel, enLabel, min = 0, maxValue]: Field) => (
    <label key={key}>
      {t(zhLabel, enLabel)}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={maxValue}
        step="any"
        value={o[key] ?? ''}
        onChange={(e) => {
          const next = { ...o };
          next[key] = e.target.value === '' ? undefined : Number(e.target.value);
          put(i, next);
        }}
      />
    </label>
  );
  const customSum = (o: Offer) => Math.round((o.custom ?? []).reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;
  const due = (o: Offer) => {
    if (!o.deadline) return '—';
    const left = now === null ? null : countdown(new Date(`${o.deadline}T23:59:59`).getTime(), now, !zh);
    return (
      <>
        <time dateTime={o.deadline}>{o.deadline}</time>
        {now !== null && <small>{left ? t(`还剩 ${left}`, `${left} left`) : t('已过截止日', 'Passed')}</small>}
      </>
    );
  };

  const tables = (
    <>
      {full.length > 0 && (
        <section aria-labelledby="offer-table-title">
          <h2 id="offer-table-title" className="guide-h2">
            {t('逐年对比（税前）', 'Year by year (pre-tax)')}
          </h2>
          <div className="offer-table-wrap" role="region" aria-labelledby="offer-table-title" tabIndex={0}>
            <table className="offer-table">
              <thead>
                <tr>
                  <th scope="col">{t('年份', 'Year')}</th>
                  {heads(full)}
                </tr>
              </thead>
              <tbody>
                {YEARS.map((k) => (
                  <tr key={k}>
                    <th scope="row">{t(`第 ${k + 1} 年`, `Year ${k + 1}`)}</th>
                    {plain(full, (i) => {
                      const r = results[i];
                      return r ? (
                        <>
                          {fmt(r.years[k].total)}
                          <small>
                            {t('其中股票', 'stock')} {fmt(r.years[k].stock)}
                          </small>
                        </>
                      ) : (
                        '—'
                      );
                    })}
                  </tr>
                ))}
                <tr className="offer-key">
                  <th scope="row">{t('4 年合计', '4-year total')}</th>
                  {best(full, (i) => results[i]?.four)}
                </tr>
                {costRow(full, t('4 年合计', '4-year total'), (i) => results[i]?.four)}
                <tr className="offer-key">
                  <th scope="row">{t('首年现金（不含股票）', 'First-year cash (no stock)')}</th>
                  {best(full, (i) => results[i]?.cash)}
                </tr>
                <tr>
                  <th scope="row">{t('答复截止', 'Reply by')}</th>
                  {plain(full, (i) => due(list[i]))}
                </tr>
                {full.some((i) => list[i].clawbackNote.trim()) && (
                  <tr>
                    <th scope="row">{t('签字费回收', 'Clawback')}</th>
                    {full.map((i) => (
                      <td key={list[i].id} className="offer-text">
                        {list[i].clawbackNote.trim() || '—'}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {interns.length > 0 && (
        <section aria-labelledby="offer-intern-title">
          <h2 id="offer-intern-title" className="guide-h2">
            {t('实习对比（税前）', 'Internships (pre-tax)')}
          </h2>
          <div className="offer-table-wrap" role="region" aria-labelledby="offer-intern-title" tabIndex={0}>
            <table className="offer-table offer-intern-table">
              <thead>
                <tr>
                  <th scope="col">{t('实习', 'Internship')}</th>
                  {heads(interns)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('工资合计', 'Pay')}</th>
                  {plain(interns, (i) => (intern[i] ? fmt(intern[i].pay) : '—'))}
                </tr>
                <tr>
                  <th scope="row">{t('补贴（住房、搬家、路费）', 'Stipends (housing, relocation, travel)')}</th>
                  {plain(interns, (i) => (intern[i] ? fmt(intern[i].gross - intern[i].pay) : '—'))}
                </tr>
                <tr className="offer-key">
                  <th scope="row">{t('合计', 'Total')}</th>
                  {best(interns, (i) => intern[i]?.gross)}
                </tr>
                <tr className="offer-key">
                  <th scope="row">{t('折合周薪', 'Per week')}</th>
                  {best(interns, (i) => intern[i]?.weekly)}
                </tr>
                {costRow(interns, t('折合周薪', 'per week'), (i) => intern[i]?.weekly)}
                <tr>
                  <th scope="row">
                    {t('年化', 'Annualized')}
                    <small>{t('工资 ÷ 周数 × 52，不含补贴', 'pay ÷ weeks × 52, no stipends')}</small>
                  </th>
                  {plain(interns, (i) => (intern[i] ? fmt(intern[i].annualized) : '—'))}
                </tr>
                <tr>
                  <th scope="row">{t('住房', 'Housing')}</th>
                  {plain(interns, (i) => {
                    const o = list[i];
                    const parts = [
                      o.housingProvided && t('公司提供', 'provided'),
                      o.housing && t(`一次性 ${fmt(o.housing)}`, `${fmt(o.housing)} lump sum`),
                      o.housingMonthly && t(`每月 ${fmt(o.housingMonthly)}`, `${fmt(o.housingMonthly)} a month`),
                    ].filter(Boolean);
                    return parts.length ? parts.join(t('；', '; ')) : '—';
                  })}
                </tr>
                <tr>
                  <th scope="row">{t('转正意向', 'Return offer')}</th>
                  {plain(interns, (i) => {
                    const r = RETURN_NAMES.find(([k]) => k === list[i].returnOffer);
                    return r?.[0] ? t(r[1], r[2]) : '—';
                  })}
                </tr>
                <tr>
                  <th scope="row">{t('答复截止', 'Reply by')}</th>
                  {plain(interns, (i) => due(list[i]))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {max > 0 && (
        <section aria-labelledby="offer-bars-title">
          <h2 id="offer-bars-title" className="guide-h2">
            {t('每年由什么组成', 'What each year is made of')}
          </h2>
          <ul className="offer-legend">
            {PARTS.map(([key, zhName, enName]) => (
              <li key={key} data-part={key}>
                {t(zhName, enName)}
              </li>
            ))}
          </ul>
          {YEARS.map((k) => (
            <div key={k} className="offer-year">
              <h3>{t(`第 ${k + 1} 年`, `Year ${k + 1}`)}</h3>
              {full.map((i) => {
                const y = results[i]?.years[k];
                return (
                  y && (
                    <div key={list[i].id} className="offer-bar-row">
                      <span className="offer-bar-name">{name(list[i], i)}</span>
                      <span className="offer-bar" aria-hidden="true">
                        {PARTS.map(([key]) => y[key] > 0 && <span key={key} data-part={key} style={{ width: `${(y[key] / max) * 100}%` }} />)}
                      </span>
                      <span className="offer-bar-total">{fmt(y.total)}</span>
                    </div>
                  )
                );
              })}
            </div>
          ))}
        </section>
      )}
    </>
  );

  if (shared)
    return (
      <div className="offer-compare">
        <div className="offer-shared" role="note">
          <strong>{t('别人分享的只读对比', 'A read-only comparison someone shared')}</strong>
          <p>
            {t(
              '金额已取整，不含截止日和签字费回收条款。导入后可以在这个浏览器里接着改。',
              'Amounts are rounded, with no deadlines or clawback terms. Import it to keep editing in this browser.',
            )}
          </p>
          <div className="resume-actions">
            <button type="button" onClick={adopt}>
              {t('导入到我的对比', 'Import into my comparison')}
            </button>
            <button type="button" onClick={leave}>
              {t('返回我的对比', 'Back to my comparison')}
            </button>
          </div>
        </div>
        {tables}
      </div>
    );
  return (
    <div className="offer-compare">
      <form className="resume-form" onSubmit={(e) => e.preventDefault()}>
        <div className="offer-cards">
          {offers.map((o, i) => (
            <fieldset key={o.id} className="offer-card">
              <legend>{name(o, i)}</legend>
              {offers.length > OFFERS_MIN && (
                <button
                  type="button"
                  className="offer-remove"
                  aria-label={t(`移除 ${name(o, i)}`, `Remove ${name(o, i)}`)}
                  onClick={() => save(offers.filter((_, j) => j !== i))}
                >
                  {t('移除', 'Remove')}
                </button>
              )}
              <div className="offer-kind" role="radiogroup" aria-label={t(`${name(o, i)} 的类型`, `${name(o, i)}: type`)}>
                {(
                  [
                    ['fulltime', '全职', 'Full-time'],
                    ['intern', '实习', 'Internship'],
                  ] as const
                ).map(([kind, zhName, enName]) => (
                  <label key={kind} className="visa-check">
                    <input type="radio" name={`offer-kind-${o.id}`} checked={o.kind === kind} onChange={() => put(i, { ...o, kind })} />
                    {t(zhName, enName)}
                  </label>
                ))}
              </div>
              <label>
                {t('公司', 'Company')}
                <input value={o.company} maxLength={120} onChange={(e) => put(i, { ...o, company: e.target.value })} />
              </label>
              <label>
                {t('岗位', 'Role')}
                <input value={o.role} maxLength={120} onChange={(e) => put(i, { ...o, role: e.target.value })} />
              </label>
              <label>
                {t('城市（按生活成本折算）', 'City (for cost of living)')}
                <select value={o.city ?? ''} onChange={(e) => put(i, { ...o, city: e.target.value || undefined })}>
                  <option value="">{t('不选（不折算）', 'None (no adjustment)')}</option>
                  <option value="remote">{t('远程（不折算）', 'Remote (no adjustment)')}</option>
                  {Object.entries(CITIES).map(([key, c]) => (
                    <option key={key} value={key}>
                      {t(c.name_zh, c.name_en)} · {c.rpp}
                    </option>
                  ))}
                </select>
              </label>
              {o.kind === 'intern' ? (
                <>
                  {INTERN.map((f) => field(o, i, f))}
                  <label className="visa-check">
                    <input type="checkbox" checked={!!o.housingProvided} onChange={(e) => put(i, { ...o, housingProvided: e.target.checked })} />
                    {t('公司提供住房', 'Housing provided')}
                  </label>
                  <label>
                    {t('转正意向', 'Return offer')}
                    <select value={o.returnOffer ?? ''} onChange={(e) => put(i, { ...o, returnOffer: e.target.value as Offer['returnOffer'] })}>
                      {RETURN_NAMES.map(([key, zhName, enName]) => (
                        <option key={key} value={key}>
                          {t(zhName, enName)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  {PAY.map((f) => field(o, i, f))}
                  <label>
                    {t('签字费回收条款（可选）', 'Sign-on clawback terms (optional)')}
                    <input
                      value={o.clawbackNote}
                      maxLength={300}
                      placeholder={t('例如：一年内离职全额退还', 'e.g. repay in full if you leave within a year')}
                      onChange={(e) => put(i, { ...o, clawbackNote: e.target.value })}
                    />
                  </label>
                  {field(o, i, EQUITY[0])}
                  <label>
                    {t('归属方式', 'Vesting schedule')}
                    <select value={o.schedule} onChange={(e) => put(i, { ...o, schedule: e.target.value as Schedule })}>
                      {(Object.keys(SCHEDULES) as Schedule[]).map((s) => (
                        <option key={s} value={s}>
                          {t(...SCHEDULE_NAMES[s])}
                        </option>
                      ))}
                    </select>
                  </label>
                  {o.schedule === 'custom' && (
                    <fieldset className="offer-custom">
                      <legend>{t('每年归属的 %（合计 100）', '% vesting each year (adds up to 100)')}</legend>
                      {YEARS.map((k) => (
                        <label key={k}>
                          {t(`第 ${k + 1} 年`, `Year ${k + 1}`)}
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="any"
                            aria-invalid={!results[i]}
                            aria-describedby={`offer-err-${i}`}
                            value={o.custom?.[k] ?? ''}
                            onChange={(e) => {
                              const custom = YEARS.map((j) => o.custom?.[j]);
                              custom[k] = e.target.value === '' ? undefined : Number(e.target.value);
                              put(i, { ...o, custom });
                            }}
                          />
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {/* Always mounted, so a screen reader reads the message when it appears. */}
                  <p id={`offer-err-${i}`} className={results[i] ? 'offer-live' : 'offer-live resume-error'} aria-live="polite">
                    {!results[i] &&
                      t(
                        `自定义归属比例合计 ${customSum(o)}%，需要正好 100%，且每项不能为负。`,
                        `The custom schedule adds up to ${customSum(o)}%; it must be exactly 100%, with no negative year.`,
                      )}
                  </p>
                  {EQUITY.slice(1).map((f) => field(o, i, f))}
                  {EXTRA.map((f) => field(o, i, f))}
                </>
              )}
              <label>
                {t('答复截止日', 'Reply deadline')}
                <input type="date" value={o.deadline} onChange={(e) => put(i, { ...o, deadline: e.target.value })} />
              </label>
            </fieldset>
          ))}
        </div>
        <div className="resume-actions">
          <button type="button" disabled={offers.length >= OFFERS_MAX} onClick={() => save([...offers, blankOffer()])}>
            {t('再加一个 offer', 'Add an offer')}
          </button>
          {signedIn && (
            <button type="button" disabled={busy} onClick={pull}>
              {t('从投递看板导入', 'Import from my tracker')}
            </button>
          )}
          <button type="button" onClick={clear}>
            {t('清空', 'Clear')}
          </button>
          <small>{t('填写的数字只保存在这个浏览器里，不会上传。', 'What you enter stays in this browser and is never uploaded.')}</small>
        </div>
        <div className="resume-actions">
          <button type="button" onClick={share}>
            {t('复制只读链接', 'Copy a read-only link')}
          </button>
          <label className="visa-check">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            {t('隐去公司名', 'Leave out company names')}
          </label>
          <small>{t('链接内容在网址 # 后面，不上传到服务器。', 'What the link carries sits after the # and never reaches the server.')}</small>
        </div>
        {link && <input className="offer-link" readOnly value={link} aria-label={t('只读链接', 'Read-only link')} onFocus={(e) => e.target.select()} />}
        <output className="offer-note offer-live">{note}</output>
      </form>
      {tables}
      <OfferDecision zh={zh} offers={offers} money={money} h1b={h1b} />
    </div>
  );
}
