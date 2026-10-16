'use client';
import { useEffect, useState } from 'react';
import { countdown, type Application } from '@/lib/applications';
import {
  blankOffer,
  firstYearCash,
  fourYear,
  importOffers,
  OFFERS_MAX,
  readOffers,
  SCHEDULES,
  yearly,
  type NumKey,
  type Offer,
  type Schedule,
  type Year,
} from '@/lib/offer-math';
import { api } from '@/lib/types';

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
const PARTS: [Exclude<keyof Year, 'total'>, string, string][] = [
  ['base', '基本工资', 'Base'],
  ['bonus', '奖金', 'Bonus'],
  ['stock', '股票', 'Stock'],
  ['signOn', '签字费', 'Sign-on'],
  ['other', '其他', 'Other'],
];
const YEARS = [0, 1, 2, 3];

/** /career/offers: two to four offers side by side, pre-tax, year by year for four years. */
export function OfferCompare({ zh, signedIn }: { zh: boolean; signedIn: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [offers, setOffers] = useState<Offer[]>(fresh);
  // Read after mount: storage and the clock differ from the server's render.
  const [now, setNow] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = load();
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    if (saved.length) setOffers([...saved, ...fresh()].slice(0, Math.max(OFFERS_MIN, saved.length)));
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);
  const save = (next: Offer[]) => {
    setOffers(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or full storage: the comparison still works for this visit.
    }
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
      const got = importOffers(
        offers,
        items.filter((a) => a.stage === 'offer'),
      );
      save(got.offers);
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

  const results = offers.map((o) => {
    try {
      return { years: yearly(o), four: fourYear(o), cash: firstYearCash(o) };
    } catch {
      return null;
    }
  });
  const fmt = (n: number) => Math.round(n).toLocaleString(zh ? 'zh-CN' : 'en-US');
  const name = (o: Offer, i: number) => o.company.trim() || `Offer ${i + 1}`;
  const max = Math.max(0, ...results.flatMap((r) => r?.years.map((y) => y.total) ?? []));
  // The highest 4-year total and first-year cash, once two offers can be compared.
  const best = (pick: (r: NonNullable<(typeof results)[number]>) => number) => {
    const values = results.map((r) => (r ? pick(r) : null));
    const valid = values.filter((v): v is number => v !== null);
    const top = valid.length > 1 ? Math.max(...valid) : 0;
    return values.map((v, i) => (
      <td key={offers[i].id} data-best={(top > 0 && v === top) || undefined}>
        {v === null ? '—' : fmt(v)}
        {top > 0 && v === top && <b className="offer-best">{t('最高', 'Highest')}</b>}
      </td>
    ));
  };

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
              <label>
                {t('公司', 'Company')}
                <input value={o.company} maxLength={120} onChange={(e) => put(i, { ...o, company: e.target.value })} />
              </label>
              <label>
                {t('岗位', 'Role')}
                <input value={o.role} maxLength={120} onChange={(e) => put(i, { ...o, role: e.target.value })} />
              </label>
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
              {!results[i] && (
                <p className="resume-error" aria-live="polite">
                  {t(
                    `自定义归属比例合计 ${(o.custom ?? []).reduce<number>((a, b) => a + (b ?? 0), 0)}%，需要正好 100%，且每项不能为负。`,
                    `The custom schedule adds up to ${(o.custom ?? []).reduce<number>((a, b) => a + (b ?? 0), 0)}%; it must be exactly 100%, with no negative year.`,
                  )}
                </p>
              )}
              {EQUITY.slice(1).map((f) => field(o, i, f))}
              {EXTRA.map((f) => field(o, i, f))}
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
        {note && (
          <output className="offer-note">{note}</output>
        )}
      </form>

      <section aria-labelledby="offer-table-title">
        <h2 id="offer-table-title" className="guide-h2">
          {t('逐年对比（税前）', 'Year by year (pre-tax)')}
        </h2>
        <div className="offer-table-wrap" role="region" aria-labelledby="offer-table-title" tabIndex={0}>
          <table className="offer-table">
            <thead>
              <tr>
                <th scope="col">{t('年份', 'Year')}</th>
                {offers.map((o, i) => (
                  <th key={o.id} scope="col">
                    {name(o, i)}
                    {o.role.trim() && <small>{o.role}</small>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YEARS.map((k) => (
                <tr key={k}>
                  <th scope="row">{t(`第 ${k + 1} 年`, `Year ${k + 1}`)}</th>
                  {results.map((r, i) => (
                    <td key={offers[i].id}>
                      {r ? (
                        <>
                          {fmt(r.years[k].total)}
                          <small>
                            {t('其中股票', 'stock')} {fmt(r.years[k].stock)}
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="offer-key">
                <th scope="row">{t('4 年合计', '4-year total')}</th>
                {best((r) => r.four)}
              </tr>
              <tr className="offer-key">
                <th scope="row">{t('首年现金（不含股票）', 'First-year cash (no stock)')}</th>
                {best((r) => r.cash)}
              </tr>
              <tr>
                <th scope="row">{t('答复截止', 'Reply by')}</th>
                {offers.map((o) => (
                  <td key={o.id}>{due(o)}</td>
                ))}
              </tr>
              {offers.some((o) => o.clawbackNote.trim()) && (
                <tr>
                  <th scope="row">{t('签字费回收', 'Clawback')}</th>
                  {offers.map((o) => (
                    <td key={o.id} className="offer-text">
                      {o.clawbackNote.trim() || '—'}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
              {offers.map((o, i) => {
                const y = results[i]?.years[k];
                return (
                  y && (
                    <div key={o.id} className="offer-bar-row">
                      <span className="offer-bar-name">{name(o, i)}</span>
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
    </div>
  );
}
