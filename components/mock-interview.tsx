'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, Code2, Copy, Dices, ExternalLink, Eye, Flag,
  History as HistoryIcon, Lightbulb, Minus, Pause, Play, Plus, Printer, RotateCcw, ShieldAlert, Shuffle, Users,
} from 'lucide-react';
import { api } from '@/lib/types';
import { track } from '@/lib/analytics';
import { useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { companyLogos } from '@/lib/oa-company-brands';
import {
  CUSTOM_NAME, KINDS, ROLES, ROUNDS, SMALL_BANK, TEMPLATES, newSeed, resolveTemplate,
  type KindId, type Text,
} from '@/lib/mock-interview';
import type { Navigate } from './learning';
import { OaMarkdown } from './oa-library';
import '@/app/redesign.css';
import '@/app/mock-interview.css';

type Company = { slug: string; name: string; n: number; kinds: Partial<Record<KindId, number>> };
type Item = {
  id: string;
  type: string;
  slug: string;
  title: string;
  company: { slug: string; name: string } | null;
  role: string | null;
  round: string | null;
  difficulty: string | null;
  problem: string | null;
  math: boolean;
  principles: string[];
  question: string;
  hints: string;
  followUps: string;
  rubric: string;
  solution: string;
};
type DrawnSlot = { kind: KindId; minutes: number; name?: Text; similar: boolean; pool: number; item: Item | null };
type MockSet = { seed: string; rerolls: number[]; template: { id: string; name: Text }; slots: DrawnSlot[] };
type Mode = 'solo' | 'candidate' | 'interviewer';
/** One sitting, per viewer and mode. Slot-indexed; `since` is when the running clock last started. */
type Run = {
  phase: 'plan' | 'run' | 'done';
  index: number;
  since: number | null;
  elapsed: number[];
  notes: Record<number, string>;
  ratings: Record<number, number>;
  shown: Record<number, { hint?: boolean; answer?: boolean }>;
  verdict?: string;
  summary?: string;
  /** Start and finish were counted for this sitting (saved, so a reload or a review doesn't count again). */
  started?: boolean;
  finished?: boolean;
};
type Past = {
  query: Record<string, string>;
  name: Text;
  company: string | null;
  at: number;
  items: { id: string; title: string; kind: KindId; seconds: number; minutes: number; rating: number | null }[];
};

const SET_KEYS = ['template', 'company', 'role', 'round', 'mix', 'min', 'set', 'rr'] as const;
const RUNS = 'cswork:mock-interview:runs',
  HISTORY = 'cswork:mock-interview:history',
  AVOID = 'cswork:mock-interview:avoid-seen';
const RATINGS: Text[] = [['卡住了', 'Stuck'], ['有思路', 'Partial'], ['基本答好', 'Solid'], ['很完整', 'Nailed it']];
const SCORES: Text[] = [['不足', 'Weak'], ['一般', 'Mixed'], ['良好', 'Good'], ['出色', 'Excellent']];
const VERDICTS: [string, Text][] = [
  ['strong-no', ['明确不通过', 'Strong no hire']],
  ['no', ['倾向不通过', 'Lean no hire']],
  ['yes', ['倾向通过', 'Lean hire']],
  ['strong-yes', ['强烈推荐', 'Strong hire']],
];

const pick = (params: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const key of SET_KEYS) if (params[key]) out[key] = params[key];
  return out;
};
const apiQuery = (query: Record<string, string>, extra: Record<string, string> = {}) => {
  const { set, ...rest } = query;
  return new URLSearchParams({ ...rest, seed: set, ...extra }).toString();
};
const clock = (seconds: number) => {
  const s = Math.abs(Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
// Storage can be blocked (private mode, sandboxed previews): every read and write falls back.
function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? ((JSON.parse(value) as T | null) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Not saved; the page keeps working. */
  }
}
const pastSessions = () => {
  const list = read<Past[]>(HISTORY, []);
  return Array.isArray(list) ? list : [];
};
/** The most recently practiced questions; kept short so the request URL stays small. */
const seenIds = () => [...new Set(pastSessions().flatMap((p) => p.items.map((i) => i.id)))].slice(0, 60);
/** The set the setup just drew, so the session doesn't fetch it again. */
let handoff: { key: string; set: MockSet } | null = null;

export function MockInterview({
  params,
  navigate,
  problemIds,
}: {
  params: Record<string, string>;
  navigate: Navigate;
  problemIds: string[];
}) {
  const query = pick(params);
  const key = new URLSearchParams(query).toString();
  return (
    <div className="rd mi">
      <div className="rd-page">
        <ModeTabs navigate={navigate} />
        {query.set ? (
          <Session key={`${key}:${params.as ?? ''}`} query={query} mode={modeOf(params.as)} navigate={navigate} problemIds={problemIds} />
        ) : (
          <Setup params={params} navigate={navigate} />
        )}
      </div>
    </div>
  );
}
const modeOf = (as: string | undefined): Mode => (as === 'interviewer' || as === 'candidate' ? as : 'solo');

function ModeTabs({ navigate }: { navigate: Navigate }) {
  const t = useT();
  // Plain clicks stay in the app; modified clicks open a tab as usual.
  const go = (view: string) => (e: React.MouseEvent) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(view);
  };
  return (
    <nav className="mi-modes mi-noprint" aria-label={t('模拟练习', 'Mock practice')}>
      <Link href="/?view=mock" prefetch={false} onClick={go('mock')}>
        {t('模拟 OA', 'Mock OA')}
      </Link>
      <Link href="/?view=mock-interview" prefetch={false} aria-current="page" onClick={go('mock-interview')}>
        {t('模拟面试', 'Mock interview')}
      </Link>
    </nav>
  );
}

function CompanyLogo({ slug }: { slug: string }) {
  const logo = Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : null;
  // oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name.
  return logo ? <img className="mi-logo" src={logo} alt="" width={16} height={16} loading="lazy" /> : null;
}

/* ------------------------------------------------------------------ setup */

function Setup({ params, navigate }: { params: Record<string, string>; navigate: Navigate }) {
  const t = useT();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [bank, setBank] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api<{ companies: Company[]; total: number }>('content/mock-companies')
      .then((r) => !cancelled && (setCompanies(r.companies), setBank(r.total)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);
  const [template, setTemplate] = useState(
    params.template === 'custom' || TEMPLATES.some((x) => x.id === params.template) ? params.template : 'phone',
  );
  const [company, setCompany] = useState(params.company || '');
  const [role, setRole] = useState(params.role && Object.hasOwn(ROLES, params.role) ? params.role : '');
  const [round, setRound] = useState(params.round && Object.hasOwn(ROUNDS, params.round) ? params.round : '');
  const [mix, setMix] = useState<Partial<Record<KindId, number>>>(() => {
    const parsed = resolveTemplate('custom', params.mix);
    if (!parsed) return { coding: 2, behavioral: 1 };
    const counts: Partial<Record<KindId, number>> = {};
    for (const s of parsed.slots) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    return counts;
  });
  const [minutes, setMinutes] = useState(Number(params.min) || 60);
  const [avoid, setAvoid] = useState(() => read(AVOID, true));
  const [drawing, setDrawing] = useState(false);
  const [past] = useState(pastSessions);
  const mixText = (Object.keys(KINDS) as KindId[])
    .filter((k) => mix[k])
    .map((k) => `${k}.${mix[k]}`)
    .join('-');
  const custom = resolveTemplate('custom', mixText, minutes);
  const chosen = template === 'custom' ? custom : resolveTemplate(template);
  const company_ = companies?.find((c) => c.slug === company);
  const total = chosen?.slots.reduce((sum, s) => sum + s.minutes, 0) ?? 0;

  async function draw() {
    if (!chosen) return;
    const query: Record<string, string> = { template, set: newSeed() };
    if (company) query.company = company;
    if (role) query.role = role;
    if (round) query.round = round;
    if (template === 'custom') Object.assign(query, { mix: mixText, min: String(minutes) });
    setDrawing(true);
    setError('');
    try {
      const set = await api<MockSet>(`content/mock?${apiQuery(query, avoid ? { exclude: seenIds().join(',') } : {})}`);
      if (set.rerolls.length) query.rr = set.rerolls.join('.');
      handoff = { key: new URLSearchParams(pick(query)).toString(), set };
      navigate('mock-interview', query);
    } catch (e) {
      setError((e as Error).message);
      setDrawing(false);
    }
  }

  return (
    <>
      <header className="rd-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <h1>{t('模拟面试', 'Mock interview')}</h1>
        <p>
          {t(
            '选公司、岗位和轮次，一键从真实面试题里抽出一整套：自己计时练，或者两个人一问一答。',
            'Pick a company, role and round, and draw a full set from real interview questions. Practice on the clock, or run it with a partner.',
          )}
        </p>
      </header>
      <div className="rd-stats rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div>
          <div className="rd-stat-label">{t('题库', 'Questions in the bank')}</div>
          <div className="rd-stat-value">{bank?.toLocaleString() ?? '—'}</div>
        </div>
        <div>
          <div className="rd-stat-label">{t('公司', 'Companies')}</div>
          <div className="rd-stat-value">{companies?.length.toLocaleString() ?? '—'}</div>
        </div>
        <div>
          <div className="rd-stat-label">{t('面试模板', 'Templates')}</div>
          <div className="rd-stat-value">{TEMPLATES.length + 1}</div>
        </div>
      </div>
      {error && (
        <div className="js-error" role="alert">
          {t(error, englishMessage(error))}
        </div>
      )}
      <section className="mi-board rd-reveal" style={{ '--i': 2 } as React.CSSProperties} aria-label={t('抽题设置', 'Set options')}>
        <div className="mi-board-controls">
          <label className="mi-field">
            <span className="mi-field-label">
              <b>01</b> {t('公司', 'Company')}
            </span>
            <select value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{t('不限公司（全库随机）', 'Any company (whole bank)')}</option>
              {company && !companies?.some((c) => c.slug === company) && <option value={company}>{company}</option>}
              {companies?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} · {c.n}
                </option>
              ))}
            </select>
          </label>
          {!!companies?.length && (
            <fieldset className="mi-quick">
              <legend className="sr-only">{t('常见公司', 'Popular companies')}</legend>
              {companies.slice(0, 8).map((c) => (
                <button key={c.slug} type="button" aria-pressed={company === c.slug} onClick={() => setCompany(company === c.slug ? '' : c.slug)}>
                  <CompanyLogo slug={c.slug} />
                  {c.name.split(' / ')[0]}
                </button>
              ))}
            </fieldset>
          )}
          <fieldset className="mi-field">
            <legend className="mi-field-label">
              <b>02</b> {t('岗位', 'Role')}
            </legend>
            <div className="mi-seg">
              <button type="button" aria-pressed={!role} onClick={() => setRole('')}>
                {t('按模板', 'Template default')}
              </button>
              {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((id) => (
                <button key={id} type="button" aria-pressed={role === id} onClick={() => setRole(id)}>
                  {t(...ROLES[id].name)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mi-field">
            <legend className="mi-field-label">
              <b>03</b> {t('轮次', 'Round')}
            </legend>
            <div className="mi-seg">
              <button type="button" aria-pressed={!round} onClick={() => setRound('')}>
                {t('按模板', 'Template default')}
              </button>
              {Object.entries(ROUNDS).map(([id, name]) => (
                <button key={id} type="button" aria-pressed={round === id} onClick={() => setRound(id)}>
                  {t(...name)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mi-ticket">
          <p className="mi-ticket-kicker">{t('本次面试', 'This interview')}</p>
          <p className="mi-ticket-name">
            {company_ && <CompanyLogo slug={company_.slug} />}
            <span>{(company_ ? `${company_.name} · ` : '') + (chosen ? t(...chosen.name) : t('题型数量不对', 'Check the mix'))}</span>
          </p>
          <ol className="mi-ticket-slots">
            {chosen?.slots.map((s, i) => (
              <li key={i}>
                <span>{t(...(s.name ?? KINDS[s.kind].name))}</span>
                <span>{s.minutes}′</span>
              </li>
            ))}
          </ol>
          <p className="mi-ticket-total">
            <span className="mi-led-small">{total}</span> {t('分钟', 'min')}
          </p>
          <button type="button" className="mi-cta" disabled={!chosen || drawing} onClick={draw}>
            <Dices size={17} aria-hidden="true" />
            {drawing ? t('正在抽题…', 'Drawing…') : t('一键抽题', 'Draw a set')}
          </button>
          <label className="mi-avoid">
            <input
              type="checkbox"
              checked={avoid}
              onChange={(e) => (setAvoid(e.target.checked), write(AVOID, e.target.checked))}
            />
            {t('避开练过的题', "Skip questions I've practiced")}
          </label>
        </div>
      </section>

      <section className="mi-section rd-reveal" style={{ '--i': 4 } as React.CSSProperties}>
        <h2>{t('选择模板', 'Choose a template')}</h2>
        <fieldset className="mi-templates">
          <legend className="sr-only">{t('面试模板', 'Interview templates')}</legend>
          {[...TEMPLATES, null].map((x) => {
            const id = x?.id ?? 'custom';
            const slots = x?.slots ?? custom?.slots ?? [];
            const kinds = [...new Set(slots.map((s) => s.kind))];
            return (
              <label key={id} className="rd-card mi-template" data-tone={id}>
                <input type="radio" name="mi-template" checked={template === id} onChange={() => setTemplate(id)} />
                <span className="mi-template-head">
                  <strong>{t(...(x?.name ?? CUSTOM_NAME))}</strong>
                  <span className="mi-template-min">
                    {slots.reduce((sum, s) => sum + s.minutes, 0)}′
                  </span>
                </span>
                <span className="mi-template-blurb">
                  {x ? t(...x.blurb) : t('按题型自己配数量和总时长。', 'Set your own counts per kind and a total time.')}
                </span>
                <span className="mi-template-slots">
                  {kinds.map((kind) => {
                    const n = slots.filter((s) => s.kind === kind).length;
                    return (
                      <span key={kind} data-kind={kind}>
                        {t(...KINDS[kind].name)}
                        {n > 1 && ` ×${n}`}
                      </span>
                    );
                  })}
                </span>
              </label>
            );
          })}
        </fieldset>
        {template === 'custom' && (
          <div className="rd-card mi-custom">
            {(Object.keys(KINDS) as KindId[]).map((k) => (
              <div key={k} className="mi-counter">
                <span>{t(...KINDS[k].name)}</span>
                <button
                  type="button"
                  aria-label={t(`减少${KINDS[k].name[0]}`, `Fewer ${KINDS[k].name[1]}`)}
                  disabled={!mix[k]}
                  onClick={() => setMix({ ...mix, [k]: (mix[k] ?? 0) - 1 })}
                >
                  <Minus size={13} />
                </button>
                <output aria-live="polite">{mix[k] ?? 0}</output>
                <button
                  type="button"
                  aria-label={t(`增加${KINDS[k].name[0]}`, `More ${KINDS[k].name[1]}`)}
                  disabled={(mix[k] ?? 0) >= 5}
                  onClick={() => setMix({ ...mix, [k]: (mix[k] ?? 0) + 1 })}
                >
                  <Plus size={13} />
                </button>
              </div>
            ))}
            <label className="mi-counter mi-duration">
              <span>{t('总时长（分钟）', 'Total minutes')}</span>
              <input
                type="number"
                min={10}
                max={240}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </section>

      {!!past.length && (
        <section className="mi-section rd-reveal" style={{ '--i': 3 } as React.CSSProperties}>
          <h2>
            <HistoryIcon size={17} aria-hidden="true" /> {t('最近的模拟', 'Recent sessions')}
          </h2>
          <ol className="mi-history">
            {past.map((p) => {
              const rated = p.items.filter((i) => i.rating);
              return (
                <li key={p.at}>
                  <button type="button" className="mi-history-row" onClick={() => navigate('mock-interview', p.query)}>
                    <time dateTime={new Date(p.at).toISOString()}>{new Date(p.at).toLocaleDateString()}</time>
                    <strong>
                      {p.company ? `${p.company} · ` : ''}
                      {t(...p.name)}
                    </strong>
                    <span>
                      {t(`${p.items.length} 题`, `${p.items.length} questions`)} ·{' '}
                      {clock(p.items.reduce((sum, i) => sum + i.seconds, 0))}
                    </span>
                    <span className="mi-history-score">
                      {rated.length ? (rated.reduce((sum, i) => sum + i.rating!, 0) / rated.length).toFixed(1) : '—'}
                      <small>/4</small>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- session */

const fresh = (mode: Mode): Run => ({
  phase: mode === 'solo' ? 'plan' : 'run',
  index: 0,
  since: null,
  elapsed: [],
  notes: {},
  ratings: {},
  shown: {},
});
/** Folds the running clock into the current slot's seconds. */
const commit = (r: Run, at = Date.now()): Run => {
  if (r.since === null) return r;
  const elapsed = [...r.elapsed];
  elapsed[r.index] = (elapsed[r.index] ?? 0) + (at - r.since) / 1000;
  return { ...r, elapsed, since: at };
};
const spent = (r: Run, index: number, now: number) =>
  (r.elapsed[index] ?? 0) + (r.since !== null && r.index === index ? Math.max(0, now - r.since) / 1000 : 0);

function Session({
  query: initial,
  mode,
  navigate,
  problemIds,
}: {
  query: Record<string, string>;
  mode: Mode;
  navigate: Navigate;
  problemIds: string[];
}) {
  const t = useT();
  const [query, setQuery] = useState(initial);
  const key = new URLSearchParams(query).toString();
  // The candidate's view fetches questions without the answers, so its data carries none.
  const [data, setData] = useState<MockSet | null>(() => (handoff?.key === key && mode !== 'candidate' ? handoff.set : null));
  const [error, setError] = useState('');
  const [rolling, setRolling] = useState<number | null>(null);
  // A failed re-roll leaves the set as it was: it says so beside it, not instead of it.
  const [rollError, setRollError] = useState('');
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    api<MockSet>(`content/mock?${apiQuery(initial, mode === 'candidate' ? { parts: 'question' } : {})}`)
      .then((set) => !cancelled && setData(set))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // Fetched once; a re-roll replaces the set in place.
  }, [data, initial, mode]);
  const storeKey = `${mode}:${key}`;
  const [run, setRun] = useState<Run>(() => {
    const saved = read<Record<string, Run & { at?: number }>>(RUNS, {})[storeKey];
    if (!saved) return fresh(mode);
    // A clock left running stops where the page last saved it, so time away doesn't count; it resumes paused.
    const { at, ...r } = saved;
    return { ...fresh(mode), ...commit(r, at), since: null };
  });
  useEffect(() => {
    const save = () => {
      const all = read<Record<string, Run & { at: number }>>(RUNS, {});
      all[storeKey] = { ...run, at: Date.now() };
      // Only the latest sittings are kept.
      write(RUNS, Object.fromEntries(Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 30)));
    };
    save();
    // Leaving (closing, reloading, hiding the tab, another view) saves again, so `at` is when the clock was last seen.
    const hide = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', hide);
      save();
    };
  }, [run, storeKey]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.since === null) return;
    // Wall-clock based: a throttled background tab (coding in the other tab) still counts right.
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [run.since]);
  useEffect(() => {
    if (!data || run.started || run.phase !== 'run') return;
    // oxlint-disable-next-line react/react-compiler -- Flags the analytics event on the saved sitting once, so a reload doesn't send it again.
    setRun((r) => ({ ...r, started: true }));
    track('mock_interview_start', { company: query.company || 'any', template: query.template, mode });
  }, [data, run.phase, run.started, query, mode]);

  if (error)
    return (
      <div className="rd-card js-empty" role="alert">
        <strong>{t('这套题打不开', "Couldn't open this set")}</strong>
        <span>{t(error, englishMessage(error))}</span>
        <button type="button" className="rd-button" onClick={() => navigate('mock-interview')}>
          {t('重新抽一套', 'Draw a new set')}
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="mi-plan" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rd-card mi-skeleton" />
        ))}
      </div>
    );

  const reroll = async (index: number) => {
    setRolling(index);
    setRollError('');
    try {
      const rr = [...(query.rr ? query.rr.split('.') : []), String(index)].join('.');
      // Only the re-rolled slot may move, so questions already on screen are not excluded.
      const shown = new Set(data.slots.map((s) => s.item?.id));
      const exclude = read(AVOID, true) ? seenIds().filter((id) => !shown.has(id)).join(',') : '';
      const set = await api<MockSet>(`content/mock?${apiQuery({ ...query, rr }, exclude ? { exclude } : {})}`);
      const next = { ...query, rr: set.rerolls.join('.') };
      if (!next.rr) delete next.rr;
      setData(set);
      setQuery(next);
      // Replace, not push: the address always reproduces the set on screen.
      window.history.replaceState(null, '', '/?' + new URLSearchParams({ view: 'mock-interview', ...next }));
    } catch (e) {
      setRollError((e as Error).message);
    } finally {
      setRolling(null);
    }
  };
  const finish = () => {
    const done = { ...commit(run), since: null, phase: 'done' as const, finished: true };
    setRun(done);
    if (!run.finished) track('mock_interview_finish', { company: query.company || 'any', template: query.template, mode });
    if (mode !== 'solo') return;
    const entry: Past = {
      query,
      name: data.template.name,
      company: (query.company && data.slots.find((s) => s.item?.company && !s.similar)?.item?.company?.name) || null,
      at: Date.now(),
      items: data.slots.flatMap((s, i) =>
        s.item
          ? [{ id: s.item.id, title: s.item.title, kind: s.kind, seconds: Math.round(done.elapsed[i] ?? 0), minutes: s.minutes, rating: done.ratings[i] ?? null }]
          : [],
      ),
    };
    write(HISTORY, [entry, ...pastSessions().filter((p) => new URLSearchParams(p.query).toString() !== key)].slice(0, 30));
  };

  const props = { data, query, mode, run, setRun, now, problemIds, navigate, finish };
  if (mode === 'interviewer') return <InterviewerSheet {...props} />;
  if (run.phase === 'plan') return <Plan {...props} reroll={reroll} rolling={rolling} rollError={rollError} />;
  if (run.phase === 'done') return <Summary {...props} />;
  return <Runner {...props} />;
}
type SessionProps = {
  data: MockSet;
  query: Record<string, string>;
  mode: Mode;
  run: Run;
  setRun: React.Dispatch<React.SetStateAction<Run>>;
  now: number;
  problemIds: string[];
  navigate: Navigate;
  finish: () => void;
};

const shareLink = (query: Record<string, string>, as: Mode) =>
  `${location.origin}/?${new URLSearchParams({ view: 'mock-interview', ...query, ...(as === 'solo' ? {} : { as }) })}`;

function SetHead({ data, query, mode }: Pick<SessionProps, 'data' | 'query' | 'mode'>) {
  const t = useT();
  const total = data.slots.reduce((sum, s) => sum + s.minutes, 0);
  // The chosen company, named as the library names it (a set without one names none).
  const company = query.company ? data.slots.find((s) => s.item?.company && !s.similar)?.item?.company : undefined;
  return (
    <header className="mi-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
      <p className="mi-head-kicker">
        {mode === 'interviewer'
          ? t('面试官视图', 'Interviewer view')
          : mode === 'candidate'
            ? t('候选人视图', 'Candidate view')
            : t('独自练习', 'Solo practice')}
        <span className="mi-seed" title={t('抽题编号：同一个链接抽到同一套题', 'Set number: the same link draws the same set')}>
          No. {data.seed}
        </span>
      </p>
      <h1>
        {company && <CompanyLogo slug={company.slug} />}
        <span>{(company ? `${company.name} · ` : '') + t(...data.template.name)}</span>
      </h1>
      <p className="mi-head-meta">
        {t(`${data.slots.length} 题 · 约 ${total} 分钟`, `${data.slots.length} questions · about ${total} minutes`)}
        {query.role && Object.hasOwn(ROLES, query.role) && ` · ${t(...ROLES[query.role as keyof typeof ROLES].name)}`}
        {query.round && Object.hasOwn(ROUNDS, query.round) && ` · ${t(...ROUNDS[query.round])}`}
      </p>
    </header>
  );
}

function SlotBadges({ slot }: { slot: DrawnSlot }) {
  const t = useT();
  return (
    <span className="mi-badges">
      <span className="rd-badge" data-kind={slot.kind}>
        {t(...(slot.name ?? KINDS[slot.kind].name))}
      </span>
      {slot.item?.company && (
        <span className="rd-badge is-brand">
          <CompanyLogo slug={slot.item.company.slug} />
          {slot.item.company.name}
        </span>
      )}
      {slot.similar && (
        <span className="rd-badge is-warn" title={t('这家公司的同类题不够，补了其他公司的同类题', 'Not enough of these at this company; this one is from another company')}>
          {t('其他公司同类题', 'Similar company')}
        </span>
      )}
      {slot.pool < SMALL_BANK && <span className="rd-badge">{t(`题库较小 · ${slot.pool} 题`, `Small bank · ${slot.pool}`)}</span>}
      {slot.item?.principles.map((p) => (
        <span key={p} className="rd-badge mi-lp" title="Amazon Leadership Principle">
          LP · {p}
        </span>
      ))}
    </span>
  );
}

function Plan({
  data,
  query,
  setRun,
  reroll,
  rolling,
  rollError,
}: SessionProps & { reroll: (i: number) => void; rolling: number | null; rollError: string }) {
  const t = useT();
  return (
    <>
      <SetHead data={data} query={query} mode="solo" />
      {rollError && (
        <div className="js-error" role="alert">
          {t(`没换成，这套题没变：${rollError}`, `Couldn't re-roll; the set is unchanged. ${englishMessage(rollError)}`)}
        </div>
      )}
      <ol className="mi-plan">
        {data.slots.map((slot, i) => (
          <li key={`${i}:${slot.item?.id}`} className="rd-card mi-plan-row mi-flap" style={{ '--i': i } as React.CSSProperties}>
            <span className="mi-plan-no" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="mi-plan-body">
              <SlotBadges slot={slot} />
              <h3>{slot.item?.title ?? t('题库暂时没有这类题', 'No question of this kind yet')}</h3>
            </div>
            <span className="mi-plan-min">{slot.minutes}′</span>
            <button
              type="button"
              className="rd-button is-quiet mi-reroll"
              disabled={rolling !== null || slot.pool < 2}
              onClick={() => reroll(i)}
              aria-label={t(`第 ${i + 1} 题换一题`, `Re-roll question ${i + 1}`)}
            >
              <Shuffle size={14} aria-hidden="true" className={rolling === i ? 'mi-spin' : undefined} />
              {t('换一题', 'Re-roll')}
            </button>
          </li>
        ))}
      </ol>
      <div className="mi-start rd-reveal" style={{ '--i': data.slots.length + 1 } as React.CSSProperties}>
        <div className="rd-card mi-start-solo">
          <h2>{t('自己练', 'Practice solo')}</h2>
          <p className="mi-solo-total">
            <span className="mi-led-small">{data.slots.reduce((sum, s) => sum + s.minutes, 0)}</span> {t('分钟', 'min')} ·{' '}
            {t(`${data.slots.length} 题`, `${data.slots.length} questions`)}
          </p>
          <p>
            {t(
              '一题一题来，每题按建议时间倒计时。答完再看面试官想听什么，给自己打分。',
              'One question at a time on a countdown. Then see what interviewers look for and rate yourself.',
            )}
          </p>
          <button type="button" className="mi-cta" onClick={() => setRun((r) => ({ ...r, phase: 'run', index: 0, since: Date.now() }))}>
            <Play size={16} aria-hidden="true" /> {t('开始计时', 'Start the clock')}
          </button>
        </div>
        <PairLinks query={query} />
      </div>
    </>
  );
}

function PairLinks({ query }: { query: Record<string, string> }) {
  const t = useT();
  const [copied, setCopied] = useState('');
  const copy = async (as: Mode) => {
    try {
      await navigator.clipboard.writeText(shareLink(query, as));
      setCopied(as);
    } catch {
      setCopied('');
    }
  };
  return (
    <div className="rd-card mi-pair">
      <h2>
        <Users size={17} aria-hidden="true" /> {t('两人模拟', 'Pair mode')}
      </h2>
      <p>{t('同一套题，两个链接：一个给候选人，一个给面试官。', 'The same set, two links: one for the candidate, one for the interviewer.')}</p>
      {(['candidate', 'interviewer'] as const).map((as) => (
        <div key={as} className="mi-link" data-as={as}>
          <label>
            <span>{as === 'candidate' ? t('候选人链接（只有题目和计时）', 'Candidate link (questions and timer only)') : t('面试官链接（含参考答案）', 'Interviewer link (includes answers)')}</span>
            <input readOnly value={shareLink(query, as)} onFocus={(e) => e.target.select()} />
          </label>
          <button type="button" className="rd-button is-quiet" onClick={() => copy(as)}>
            {copied === as ? <Check size={14} /> : <Copy size={14} />}
            {copied === as ? t('已复制', 'Copied') : t('复制', 'Copy')}
          </button>
        </div>
      ))}
      <p className="mi-warn">
        <ShieldAlert size={14} aria-hidden="true" />
        {t('面试官链接能看到答案，不要发给候选人。', "The interviewer link shows the answers. Don't send it to the candidate.")}
      </p>
    </div>
  );
}

function Rail({ data, run, onGo }: { data: MockSet; run: Run; onGo: (i: number) => void }) {
  const t = useT();
  return (
    <ol className="mi-rail mi-noprint" style={{ '--n': data.slots.length } as React.CSSProperties} aria-label={t('题目进度', 'Question progress')}>
      {data.slots.map((slot, i) => (
        <li key={i} data-state={i === run.index ? 'now' : (run.elapsed[i] ?? 0) > 0 || run.ratings[i] ? 'done' : 'todo'}>
          <button type="button" onClick={() => onGo(i)} aria-current={i === run.index ? 'step' : undefined}>
            <span className="mi-rail-dot" aria-hidden="true" />
            <span className="mi-rail-label">
              {i + 1}. {t(...(slot.name ?? KINDS[slot.kind].name))}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Clock({ seconds, minutes, running, onToggle, onReset }: { seconds: number; minutes: number; running: boolean; onToggle: () => void; onReset?: () => void }) {
  const t = useT();
  const left = minutes * 60 - seconds;
  return (
    <div className="mi-clock" data-over={left < 0 || undefined}>
      <span className="mi-led" role="timer" aria-label={t('剩余时间', 'Time left')}>
        {left < 0 ? '+' : ''}
        {clock(left)}
      </span>
      <span className="mi-clock-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (seconds / (minutes * 60)) * 100)}%` }} />
      </span>
      <span className="mi-clock-actions">
        <button type="button" onClick={onToggle} aria-label={running ? t('暂停', 'Pause') : t('继续', 'Resume')}>
          {running ? <Pause size={15} /> : <Play size={15} />}
        </button>
        {onReset && (
          <button type="button" onClick={onReset} aria-label={t('重新计时', 'Restart the clock')}>
            <RotateCcw size={15} />
          </button>
        )}
      </span>
      {/* Announced once when it flips, not every second. */}
      <span className="sr-only" aria-live="polite">
        {left < 0 ? t('时间到', "Time's up") : ''}
      </span>
    </div>
  );
}

function QuestionCard({ slot, problemIds, showSource }: { slot: DrawnSlot; problemIds: string[]; showSource: boolean }) {
  const t = useT();
  const item = slot.item;
  if (!item)
    return (
      <div className="rd-card js-empty">
        <strong>{t('题库暂时没有这类题', 'No question of this kind yet')}</strong>
      </div>
    );
  const judge = item.problem && problemIds.includes(item.problem) ? item.problem : null;
  return (
    <article className="rd-card mi-question">
      <SlotBadges slot={slot} />
      <h2>{item.title}</h2>
      <OaMarkdown body={item.question} math={item.math} />
      {(judge || showSource) && (
        <div className="mi-question-foot mi-noprint">
          {judge && (
            <a className="rd-button" href={`/?view=problem&problem=${encodeURIComponent(judge)}`} target="_blank" rel="noopener">
              <Code2 size={14} aria-hidden="true" /> {t('在线写代码', 'Write & run code here')} <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          {showSource && (
            <a
              className="rd-button is-quiet"
              href={`/?view=content&type=${encodeURIComponent(item.type)}&slug=${encodeURIComponent(item.slug)}`}
              target="_blank"
              rel="noopener"
            >
              {t('在题库中打开', 'Open in the library')} <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function Notes({ value, onChange, label, code }: { value: string; onChange: (v: string) => void; label: string; code?: boolean }) {
  return (
    <label className="mi-notes">
      <span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={code ? 9 : 5} spellCheck={!code} data-code={code || undefined} />
    </label>
  );
}

function Guide({ item }: { item: Item }) {
  const t = useT();
  const [full, setFull] = useState(false);
  return (
    <div className="mi-guide">
      {item.followUps && (
        <section>
          <h3>{t('可能的追问', 'Likely follow-ups')}</h3>
          <OaMarkdown body={item.followUps} math={item.math} />
        </section>
      )}
      {item.rubric && (
        <section>
          <h3>{t('面试官想听到什么', 'What interviewers look for')}</h3>
          <OaMarkdown body={item.rubric} math={item.math} />
        </section>
      )}
      {item.solution ? (
        <section className="mi-solution" data-open={full || undefined}>
          <h3>{t('参考答案', 'Reference answer')}</h3>
          <div className="mi-solution-body">
            <OaMarkdown body={item.solution} math={item.math} />
          </div>
          {!full && (
            <button type="button" className="rd-button is-quiet mi-noprint" onClick={() => setFull(true)}>
              {t('展开全部', 'Show all')}
            </button>
          )}
        </section>
      ) : (
        !item.rubric &&
        !item.followUps && <p className="mi-muted">{t('这道题没有参考答案，可以在题库里看讨论。', "This question has no reference answer; open it in the library for more.")}</p>
      )}
    </div>
  );
}

function Rating({ value, onChange, labels, name }: { value: number | undefined; onChange: (n: number) => void; labels: Text[]; name: string }) {
  const t = useT();
  return (
    <fieldset className="mi-rating">
      <legend>{name}</legend>
      {labels.map((label, i) => (
        <label key={i} data-n={i + 1}>
          <input type="radio" name={name} checked={value === i + 1} onChange={() => onChange(i + 1)} />
          <b>{i + 1}</b>
          <span>{t(...label)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Runner({ data, query, mode, run, setRun, now, problemIds, finish }: SessionProps) {
  const t = useT();
  const slot = data.slots[run.index];
  const item = slot?.item;
  const shown = run.shown[run.index] ?? {};
  const solo = mode === 'solo';
  const go = (index: number) => setRun((r) => ({ ...commit(r), index }));
  const show = (part: 'hint' | 'answer') => {
    setRun((r) => ({ ...r, shown: { ...r.shown, [r.index]: { ...r.shown[r.index], [part]: true } } }));
    // The answer opens under the question: bring it into view.
    if (part === 'answer') requestAnimationFrame(() => document.getElementById('mi-reveal')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const seconds = spent(run, run.index, now);
  const last = run.index === data.slots.length - 1;
  if (!slot) return null;
  const code = slot.kind === 'coding' || slot.kind === 'sql';
  return (
    <>
      <SetHead data={data} query={query} mode={mode} />
      <Rail data={data} run={run} onGo={go} />
      <section className="mi-stage" aria-label={t('计时', 'Timer')}>
        <div className="mi-stage-now">
          <p className="mi-stage-kicker">
            {t(`第 ${run.index + 1} / ${data.slots.length} 题`, `Question ${run.index + 1} of ${data.slots.length}`)} ·{' '}
            {t(`建议 ${slot.minutes} 分钟`, `${slot.minutes} min suggested`)}
          </p>
          <p className="mi-stage-title">{t(...(slot.name ?? KINDS[slot.kind].name))}</p>
        </div>
        <Clock
          seconds={seconds}
          minutes={slot.minutes}
          running={run.since !== null}
          onToggle={() => setRun((r) => (r.since === null ? { ...r, since: Date.now() } : { ...commit(r), since: null }))}
        />
        {seconds >= slot.minutes * 60 && solo && !shown.answer && item && (
          <p className="mi-stage-up">
            <Flag size={14} aria-hidden="true" /> {t('时间到。可以看看参考要点了。', "Time's up. Have a look at what interviewers expect.")}
          </p>
        )}
      </section>
      <div className="mi-work">
        <div className="mi-work-main">
          <QuestionCard slot={slot} problemIds={problemIds} showSource={solo && !!shown.answer} />
          {solo && item && shown.answer && (
            <section className="rd-card mi-reveal" id="mi-reveal">
              <Guide item={item} />
            </section>
          )}
        </div>
        {item && (
          // Beside the question on wide screens, so the notes stay in view while reading.
          <aside className="mi-work-side" aria-label={t('草稿与自评', 'Notes and rating')}>
            <Notes
              label={code ? t('思路与代码草稿（只存在这台设备上）', 'Notes & code sketch (saved on this device only)') : t('要点草稿（只存在这台设备上）', 'Notes (saved on this device only)')}
              code={code}
              value={run.notes[run.index] ?? ''}
              onChange={(v) => setRun((r) => ({ ...r, notes: { ...r.notes, [r.index]: v } }))}
            />
            {solo && ((item.hints && !shown.hint) || !shown.answer) && (
              <div className="mi-reveals">
                {item.hints && !shown.hint && (
                  <button type="button" className="rd-button is-quiet" onClick={() => show('hint')}>
                    <Lightbulb size={14} aria-hidden="true" /> {t('给个提示', 'Show a hint')}
                  </button>
                )}
                {!shown.answer && (
                  <button type="button" className="rd-button is-quiet" onClick={() => show('answer')}>
                    <Eye size={14} aria-hidden="true" /> {t('查看参考要点', 'Reveal what interviewers look for')}
                  </button>
                )}
              </div>
            )}
            {solo && shown.hint && item.hints && (
              <section className="mi-hints">
                <h3>
                  <Lightbulb size={15} aria-hidden="true" /> {t('提示', 'Hints')}
                </h3>
                <OaMarkdown body={item.hints} math={item.math} />
              </section>
            )}
            {solo && (
              <Rating
                name={t('给自己打分', 'Rate yourself')}
                labels={RATINGS}
                value={run.ratings[run.index]}
                onChange={(n) => setRun((r) => ({ ...r, ratings: { ...r.ratings, [r.index]: n } }))}
              />
            )}
          </aside>
        )}
      </div>
      <nav className="mi-steps" aria-label={t('换题', 'Questions')}>
        <button type="button" className="rd-button is-quiet" disabled={!run.index} onClick={() => go(run.index - 1)}>
          <ChevronLeft size={15} aria-hidden="true" /> {t('上一题', 'Previous')}
        </button>
        {last ? (
          <button type="button" className="mi-cta" onClick={finish}>
            <Flag size={15} aria-hidden="true" /> {t('结束面试', 'Finish')}
          </button>
        ) : (
          <button type="button" className="mi-cta" onClick={() => go(run.index + 1)}>
            {t('下一题', 'Next question')} <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
      </nav>
    </>
  );
}

function Summary({ data, query, mode, run, setRun, navigate }: SessionProps) {
  const t = useT();
  const rated = data.slots.map((_, i) => run.ratings[i]).filter(Boolean) as number[];
  const total = data.slots.reduce((sum, _, i) => sum + (run.elapsed[i] ?? 0), 0);
  const planned = data.slots.reduce((sum, s) => sum + s.minutes * 60, 0);
  return (
    <>
      <SetHead data={data} query={query} mode={mode} />
      <section className="mi-board mi-summary-board rd-reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div>
          <p className="mi-ticket-kicker">{t('用时', 'Time')}</p>
          <p className="mi-led">{clock(total)}</p>
          <p className="mi-summary-sub">{t(`计划 ${clock(planned)}`, `Planned ${clock(planned)}`)}</p>
        </div>
        {mode === 'solo' && (
          <div>
            <p className="mi-ticket-kicker">{t('自评', 'Self rating')}</p>
            <p className="mi-led">{rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : '—'}</p>
            <p className="mi-summary-sub">{t(`满分 4 · 评了 ${rated.length} 题`, `out of 4 · ${rated.length} rated`)}</p>
          </div>
        )}
      </section>
      <div className="rd-card mi-table-wrap">
        <table className="mi-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('题目', 'Question')}</th>
              <th scope="col">{t('用时 / 建议', 'Time / suggested')}</th>
              {mode === 'solo' && <th scope="col">{t('自评', 'Rating')}</th>}
            </tr>
          </thead>
          <tbody>
            {data.slots.map((slot, i) => {
              const seconds = run.elapsed[i] ?? 0;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="mi-table-kind">{t(...KINDS[slot.kind].name)}</span>
                    {slot.item?.title ?? '—'}
                  </td>
                  <td data-over={seconds > slot.minutes * 60 || undefined}>
                    {clock(seconds)} / {slot.minutes}′
                    <span className="mi-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, (seconds / (slot.minutes * 60)) * 100)}%` }} />
                    </span>
                  </td>
                  {mode === 'solo' && (
                    <td>
                      {run.ratings[i] ? (
                        <span className="mi-pips" data-n={run.ratings[i]}>
                          <span aria-hidden="true">
                            <i />
                            <i />
                            <i />
                            <i />
                          </span>
                          {t(...RATINGS[run.ratings[i] - 1])}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mi-steps">
        <button type="button" className="rd-button is-quiet" onClick={() => setRun({ ...fresh(mode), phase: 'run', since: Date.now() })}>
          <RotateCcw size={14} aria-hidden="true" /> {t('这套题再来一遍', 'Retry this set')}
        </button>
        {mode === 'solo' && (
          <button type="button" className="rd-button is-quiet" onClick={() => setRun((r) => ({ ...r, phase: 'run', index: 0 }))}>
            <Eye size={14} aria-hidden="true" /> {t('回看题目和答案', 'Review questions & answers')}
          </button>
        )}
        <button
          type="button"
          className="mi-cta"
          onClick={() => {
            const { template, company, role, round, mix, min } = query;
            navigate('mock-interview', Object.fromEntries(Object.entries({ template, company, role, round, mix, min }).filter(([, v]) => v)) as Record<string, string>);
          }}
        >
          <Dices size={15} aria-hidden="true" /> {t('再抽一套', 'Draw another set')} <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function InterviewerSheet({ data, query, run, setRun, now, problemIds, finish }: SessionProps) {
  const t = useT();
  const toggle = (index: number) =>
    setRun((r) =>
      r.since !== null && r.index === index
        ? { ...commit(r), since: null }
        : { ...commit(r), index, since: Date.now() },
    );
  return (
    <div className="mi-sheet">
      <SetHead data={data} query={query} mode="interviewer" />
      <p className="mi-alert" role="note">
        <ShieldAlert size={16} aria-hidden="true" />
        {t(
          '这是面试官视图，带参考答案和评分表。不要把这个链接发给候选人——给他们候选人链接。',
          'This is the interviewer view, with answers and a scoring sheet. Don’t share this link with the candidate; send them the candidate link.',
        )}
      </p>
      <div className="mi-sheet-actions mi-noprint">
        <CopyCandidate query={query} />
        <button type="button" className="rd-button is-quiet" onClick={() => window.print()}>
          <Printer size={14} aria-hidden="true" /> {t('打印评分表', 'Print the sheet')}
        </button>
      </div>
      {data.slots.map((slot, i) => (
        <section key={i} className="rd-card mi-sheet-slot">
          <header className="mi-sheet-head">
            <span className="mi-plan-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="mi-sheet-time">
              {t(`建议 ${slot.minutes} 分钟`, `${slot.minutes} min`)}
              <Clock
                seconds={spent(run, i, now)}
                minutes={slot.minutes}
                running={run.since !== null && run.index === i}
                onToggle={() => toggle(i)}
                onReset={() => setRun((r) => ({ ...r, elapsed: Object.assign([...r.elapsed], { [i]: 0 }), since: r.index === i && r.since !== null ? Date.now() : r.since }))}
              />
            </span>
          </header>
          <QuestionCard slot={slot} problemIds={problemIds} showSource />
          {slot.item && (
            <>
              {slot.item.hints && (
                <section className="mi-hints">
                  <h3>
                    <Lightbulb size={15} aria-hidden="true" /> {t('卡住时可以给的提示', 'Hints to give if they’re stuck')}
                  </h3>
                  <OaMarkdown body={slot.item.hints} math={slot.item.math} />
                </section>
              )}
              <Guide item={slot.item} />
              <div className="mi-score">
                <Rating
                  name={t(`第 ${i + 1} 题评分`, `Score for question ${i + 1}`)}
                  labels={SCORES}
                  value={run.ratings[i]}
                  onChange={(n) => setRun((r) => ({ ...r, ratings: { ...r.ratings, [i]: n } }))}
                />
                <Notes
                  label={t('面试记录', 'Interview notes')}
                  value={run.notes[i] ?? ''}
                  onChange={(v) => setRun((r) => ({ ...r, notes: { ...r.notes, [i]: v } }))}
                />
              </div>
            </>
          )}
        </section>
      ))}
      <section className="rd-card mi-verdict">
        <h2>{t('总体评价', 'Overall')}</h2>
        <fieldset className="mi-rating mi-verdicts">
          <legend>{t('录用建议', 'Hiring recommendation')}</legend>
          {VERDICTS.map(([id, label]) => (
            <label key={id} data-verdict={id}>
              <input type="radio" name="mi-verdict" checked={run.verdict === id} onChange={() => setRun((r) => ({ ...r, verdict: id }))} />
              <span>{t(...label)}</span>
            </label>
          ))}
        </fieldset>
        <Notes label={t('给候选人的反馈', 'Feedback for the candidate')} value={run.summary ?? ''} onChange={(v) => setRun((r) => ({ ...r, summary: v }))} />
        <button type="button" className="mi-cta mi-noprint" onClick={finish} disabled={run.phase === 'done'}>
          <Check size={15} aria-hidden="true" /> {run.phase === 'done' ? t('已完成', 'Done') : t('完成面试', 'Finish the interview')}
        </button>
      </section>
    </div>
  );
}

function CopyCandidate({ query }: { query: Record<string, string> }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => shareLink(query, 'candidate'), [query]);
  return (
    <button
      type="button"
      className="rd-button"
      onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? t('已复制候选人链接', 'Candidate link copied') : t('复制候选人链接', 'Copy the candidate link')}
    </button>
  );
}
