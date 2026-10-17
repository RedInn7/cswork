'use client';
import { useEffect, useState } from 'react';
import { decisionScore, DEFAULT_FACTORS, FACTORS_MAX, readDecision, type Decision, type Factor, type Offer } from '@/lib/offer-math';

// Weights and scores stay in this browser, like the offers.
const KEY = 'cswork:offers:decision:v1';
/** The latest fiscal year's [year, new-employment approved, denied], by company slug and lower-case name. */
export type H1bRecords = Record<string, [number, number, number]>;
const NAMES: Record<string, [string, string]> = {
  visa: ['签证（H-1B）', 'Visa (H-1B)'],
  growth: ['成长空间', 'Growth'],
  team: ['团队和经理', 'Team and manager'],
  balance: ['工作强度', 'Work-life balance'],
  location: ['城市', 'Location'],
  stability: ['稳定性', 'Job security'],
  work: ['做的事', 'The work itself'],
} satisfies Record<(typeof DEFAULT_FACTORS)[number], [string, string]>;
const MONEY = '$money';
type View = 'money' | 'other' | 'all';
const VIEWS: [View, string, string][] = [
  ['all', '综合', 'Overall'],
  ['money', '只看钱', 'Money only'],
  ['other', '只看非钱', 'Everything but money'],
];
const GRADES = [1, 2, 3, 4, 5];

const h1bOf = (h1b: H1bRecords, company: string) => {
  // Own keys only: a company typed "Constructor" or "__proto__" must not reach Object's prototype.
  const own = (k: string) => (Object.hasOwn(h1b, k) ? h1b[k] : undefined);
  const name = company.trim().toLowerCase();
  return name ? (own(name) ?? own(name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))) : undefined;
};

/**
 * The decision matrix under /career/offers: weighted 1–5 scores for what money leaves out, with
 * money itself (`money`, already 1–5 within each kind) as one more factor in the overall view.
 */
export function OfferDecision({ zh, offers, money, h1b }: { zh: boolean; offers: Offer[]; money: (number | null)[]; h1b: H1bRecords }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [d, setD] = useState<Decision>(() => readDecision(null));
  const [view, setView] = useState<View>('all');
  useEffect(() => {
    try {
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      setD(readDecision(JSON.parse(localStorage.getItem(KEY) ?? 'null')));
    } catch {
      // Blocked or broken storage: start from the default factors.
    }
  }, []);
  const save = (next: Decision) => {
    // Scores of offers no longer on the page go with this save.
    const ids = new Set(offers.map((o) => o.id));
    const kept = { ...next, scores: Object.fromEntries(Object.entries(next.scores).filter(([id]) => ids.has(id))) };
    setD(kept);
    try {
      localStorage.setItem(KEY, JSON.stringify(kept));
    } catch {
      // Private mode or full storage: the matrix still works for this visit.
    }
  };
  const putFactor = (i: number, f: Factor) => save({ ...d, factors: d.factors.map((x, j) => (j === i ? f : x)) });
  const label = (f: Factor) => f.name.trim() || (Object.hasOwn(NAMES, f.id) ? t(...NAMES[f.id]) : t('未命名', 'Untitled'));
  const name = (o: Offer, i: number) => o.company.trim() || `Offer ${i + 1}`;
  const fmt = (n: number) => n.toLocaleString(zh ? 'zh-CN' : 'en-US');

  const moneyFactor = { id: MONEY, name: '', weight: d.moneyWeight };
  const totals = offers.map((o, i) =>
    view === 'money'
      ? money[i]
      : view === 'other'
        ? decisionScore(d.factors, d.scores[o.id])
        : decisionScore([...d.factors, moneyFactor], { ...d.scores[o.id], [MONEY]: money[i] }),
  );
  const scored = totals.filter((v): v is number => v !== null);
  const top = scored.length > 1 ? Math.max(...scored) : null;

  const weight = (value: number, aria: string, onChange: (w: number) => void) => (
    <select aria-label={aria} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {GRADES.map((g) => (
        <option key={g} value={g}>
          {t(`权重 ${g}`, `Weight ${g}`)}
        </option>
      ))}
    </select>
  );

  return (
    <section aria-labelledby="offer-decision-title" className="offer-decision">
      <h2 id="offer-decision-title" className="guide-h2">
        {t('决策矩阵：钱以外的东西', 'Decision matrix: what money leaves out')}
      </h2>
      <p className="offer-note">
        {t(
          '给每个因素定权重（1–5），再给每个 offer 打 1–5 分；得分是加权平均，没打分的因素不算。钱由上面的数字自动换算成 1–5 分（全职和实习分开比，选了城市的按生活成本折算后再比）。',
          'Weight each factor 1–5, then score each offer 1–5; the result is the weighted mean of the factors you scored. Money is turned into a 1–5 score from the figures above (full-time and internships compared separately, after the cost-of-living adjustment where a city is set).',
        )}
      </p>
      <div className="offer-views" role="radiogroup" aria-label={t('视图', 'View')}>
        {VIEWS.map(([v, zhName, enName]) => (
          <label key={v} className="visa-check">
            <input type="radio" name="offer-view" checked={view === v} onChange={() => setView(v)} />
            {t(zhName, enName)}
          </label>
        ))}
      </div>
      <div className="offer-table-wrap" role="region" aria-labelledby="offer-decision-title" tabIndex={0}>
        <table className="offer-table">
          <thead>
            <tr>
              <th scope="col">{t('因素', 'Factor')}</th>
              {offers.map((o, i) => (
                <th key={o.id} scope="col">
                  {name(o, i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view !== 'money' &&
              d.factors.map((f, k) => (
                <tr key={f.id}>
                  <th scope="row" className="offer-factor">
                    <input
                      value={f.name}
                      maxLength={40}
                      placeholder={label(f)}
                      aria-label={t(`因素名称：${label(f)}`, `Factor name: ${label(f)}`)}
                      onChange={(e) => putFactor(k, { ...f, name: e.target.value })}
                    />
                    {weight(f.weight, t(`${label(f)} 的权重`, `Weight of ${label(f)}`), (w) => putFactor(k, { ...f, weight: w }))}
                    <button
                      type="button"
                      aria-label={t(`删除因素 ${label(f)}`, `Remove factor ${label(f)}`)}
                      onClick={() =>
                        save({
                          ...d,
                          factors: d.factors.filter((_, j) => j !== k),
                          scores: Object.fromEntries(
                            Object.entries(d.scores).map(([id, row]) => [id, Object.fromEntries(Object.entries(row).filter(([fid]) => fid !== f.id))]),
                          ),
                        })
                      }
                    >
                      {t('删除', 'Remove')}
                    </button>
                    {f.id === 'visa' && <small>{t('H-1B：按雇主税号统计，不代表该岗位担保', 'H-1B: counted by employer tax ID; not a promise this role sponsors')}</small>}
                  </th>
                  {offers.map((o, i) => {
                    const rec = f.id === 'visa' ? h1bOf(h1b, o.company) : undefined;
                    const rate = rec && rec[1] + rec[2] ? `${((rec[1] / (rec[1] + rec[2])) * 100).toFixed(1)}%` : '—';
                    return (
                      <td key={o.id}>
                        <select
                          aria-label={`${name(o, i)} · ${label(f)}`}
                          value={d.scores[o.id]?.[f.id] ?? ''}
                          onChange={(e) => {
                            const row = { ...d.scores[o.id] };
                            if (e.target.value) row[f.id] = Number(e.target.value);
                            else delete row[f.id];
                            save({ ...d, scores: { ...d.scores, [o.id]: row } });
                          }}
                        >
                          <option value="">{t('未打分', 'Not scored')}</option>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        {f.id === 'visa' && (
                          <small>
                            <a href="/career/h1b">
                              {rec
                                ? t(`FY${rec[0]} 新雇佣批准 ${fmt(rec[1])}，批准率 ${rate}`, `FY${rec[0]} new: ${fmt(rec[1])} approved, ${rate} approval rate`)
                                : t('暂无数据', 'No data')}
                            </a>
                          </small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            {view !== 'other' && (
              <tr>
                <th scope="row" className="offer-factor">
                  {t('钱（自动换算）', 'Money (from the figures)')}
                  {view === 'all' && weight(d.moneyWeight, t('钱的权重', 'Weight of money'), (w) => save({ ...d, moneyWeight: w }))}
                </th>
                {money.map((m, i) => (
                  <td key={offers[i].id}>{m === null ? '—' : m.toFixed(1)}</td>
                ))}
              </tr>
            )}
            <tr className="offer-key">
              <th scope="row">{t('得分（1–5）', 'Score (1–5)')}</th>
              {totals.map((v, i) => (
                <td key={offers[i].id} data-best={(v !== null && v === top) || undefined}>
                  {v === null ? '—' : v.toFixed(2)}
                  {v !== null && v === top && <b className="offer-best">{t('最高', 'Highest')}</b>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {view !== 'money' && (
        <div className="resume-actions">
          <button
            type="button"
            disabled={d.factors.length >= FACTORS_MAX}
            onClick={() => save({ ...d, factors: [...d.factors, { id: Math.random().toString(36).slice(2), name: '', weight: 3 }] })}
          >
            {t('加一个因素', 'Add a factor')}
          </button>
          <small>{t(`最多 ${FACTORS_MAX} 个因素。`, `Up to ${FACTORS_MAX} factors.`)}</small>
        </div>
      )}
    </section>
  );
}
