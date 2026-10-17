// Offer comparison (/career/offers): pre-tax pay year by year for the first four years, internship
// totals, the decision matrix and the share link's payload. Pure, so components/offer-compare.tsx
// and tests/offer-math.test.ts share it; nothing here leaves the browser.

/** How the initial grant vests over four years, in percent per year. */
export const SCHEDULES = {
  even: [25, 25, 25, 25],
  '5-15-40-40': [5, 15, 40, 40],
  'front-40-30-20-10': [40, 30, 20, 10],
  custom: null,
} as const;
export type Schedule = keyof typeof SCHEDULES;
export const OFFERS_MAX = 4;

/** Money is per year in one currency; percentages are 0–100. A blank field is undefined (or null once saved). */
export type Offer = {
  id: string;
  kind: 'fulltime' | 'intern';
  /** A lib/content/rpp.json key or 'remote'; unset means no cost-of-living adjustment. */
  city?: string;
  company: string;
  role: string;
  /** Local "YYYY-MM-DD", or ''. */
  deadline: string;
  clawbackNote: string;
  schedule: Schedule;
  /** The four yearly percentages when schedule is 'custom'. */
  custom?: (number | null | undefined)[];
  base?: number;
  bonusPct?: number;
  signOn1?: number;
  signOn2?: number;
  /** The initial equity grant's value at grant, vesting over four years. */
  grant?: number;
  cliffMonths?: number;
  /** A yearly refresher grant from year 2, as a percentage of the initial grant. */
  refresherPct?: number;
  /** Assumed yearly change in the share price. */
  growthPct?: number;
  /** The employer's 401(k) match in money per year. */
  match401k?: number;
  relocation?: number;
  otherAnnual?: number;
  // Internship: hourly or monthly pay over `weeks`; housing as a lump sum and/or monthly; travel one-off.
  hourly?: number;
  monthly?: number;
  /** Blank counts as 40. */
  hoursPerWeek?: number;
  weeks?: number;
  housing?: number;
  housingMonthly?: number;
  travel?: number;
  housingProvided?: boolean;
  returnOffer?: '' | 'likely' | 'unclear' | 'no';
};
/** The plain number fields, in form order. */
export const NUM_KEYS = [
  'base',
  'bonusPct',
  'signOn1',
  'signOn2',
  'grant',
  'cliffMonths',
  'refresherPct',
  'growthPct',
  'match401k',
  'relocation',
  'otherAnnual',
] as const;
/** The internship's own number fields (relocation is shared with NUM_KEYS). */
export const INTERN_KEYS = ['hourly', 'monthly', 'hoursPerWeek', 'weeks', 'housing', 'housingMonthly', 'travel'] as const;
export type NumKey = (typeof NUM_KEYS)[number] | (typeof INTERN_KEYS)[number];
const RETURN_OFFERS = ['', 'likely', 'unclear', 'no'] as const;
export type Year = { base: number; bonus: number; stock: number; signOn: number; other: number; total: number };

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export const blankOffer = (id = Math.random().toString(36).slice(2)): Offer => ({
  id,
  kind: 'fulltime',
  company: '',
  role: '',
  deadline: '',
  clawbackNote: '',
  schedule: 'even',
});

/** The yearly vesting percentages; throws a RangeError when a custom schedule is negative or does not add up to 100. */
export function vestingPct(o: Offer): number[] {
  const fixed = SCHEDULES[o.schedule];
  if (fixed) return [...fixed];
  const pct = [0, 1, 2, 3].map((i) => num(o.custom?.[i]));
  if (pct.some((p) => p < 0) || Math.abs(sum(pct) - 100) > 1e-9)
    throw new RangeError(`custom vesting adds up to ${sum(pct)}%, not 100%`);
  return pct;
}

/**
 * Years 1–4. Stock vesting in year k is valued at the grant price grown (1 + growthPct) for k − 1 years.
 * A cliff past 12 months moves the earlier years' shares into the year the cliff ends. Each refresher
 * (from year 2, grant × refresherPct) vests a quarter a year starting the year it is granted, and only
 * the part inside these four years counts. Relocation is paid in year 1; the 401(k) match and other
 * yearly pay every year. Pre-tax.
 */
export function yearly(o: Offer): Year[] {
  const pct = vestingPct(o);
  const g = 1 + Math.max(-100, num(o.growthPct)) / 100;
  const grant = num(o.grant),
    refresher = (grant * num(o.refresherPct)) / 100;
  const cliffYear = Math.min(4, Math.max(1, Math.ceil(num(o.cliffMonths) / 12)));
  const base = num(o.base),
    bonus = (base * num(o.bonusPct)) / 100;
  return [1, 2, 3, 4].map((k) => {
    const share = k < cliffYear ? 0 : k === cliffYear ? sum(pct.slice(0, k)) : pct[k - 1];
    let stock = ((grant * share) / 100) * g ** (k - 1);
    for (let j = 2; j <= k; j++) stock += (refresher / 4) * g ** (k - j);
    const signOn = k === 1 ? num(o.signOn1) : k === 2 ? num(o.signOn2) : 0;
    const other = num(o.match401k) + num(o.otherAnnual) + (k === 1 ? num(o.relocation) : 0);
    return { base, bonus, stock, signOn, other, total: base + bonus + stock + signOn + other };
  });
}

export const fourYear = (o: Offer) => sum(yearly(o).map((y) => y.total));
/** Cash in year 1 without stock: base, target bonus, the first sign-on payment and relocation. */
export const firstYearCash = (o: Offer) =>
  num(o.base) + (num(o.base) * num(o.bonusPct)) / 100 + num(o.signOn1) + num(o.relocation);

/**
 * An internship's pre-tax money: `pay` is hourly × hours a week (blank = 40) × weeks, or without an
 * hourly rate monthly × 12/52 × weeks; `gross` adds housing (lump sum and monthly over the weeks),
 * relocation and travel; `weekly` is gross a week and `annualized` pay a week × 52. All 0 with no weeks.
 */
export function internTotals(o: Offer) {
  const weeks = num(o.weeks);
  if (weeks <= 0) return { pay: 0, gross: 0, weekly: 0, annualized: 0 };
  const perWeek = num(o.hourly) ? num(o.hourly) * (Number.isFinite(o.hoursPerWeek) ? num(o.hoursPerWeek) : 40) : (num(o.monthly) * 12) / 52;
  const pay = perWeek * weeks;
  const gross = pay + num(o.housing) + ((num(o.housingMonthly) * 12) / 52) * weeks + num(o.relocation) + num(o.travel);
  return { pay, gross, weekly: gross / weeks, annualized: perWeek * 52 };
}

/** `x` in national-average prices, given its area's regional price parity (US = 100); unchanged without one. */
export const costAdjusted = (x: number, rpp: number) => (rpp > 0 ? (x * 100) / rpp : x);

const text = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');

/** Offers saved in this browser, kept only where they still have the shape this page writes. */
export function readOffers(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o))
    .slice(0, OFFERS_MAX)
    .map((o) => {
      const offer: Offer = {
        ...blankOffer(text(o.id, 40) || undefined),
        kind: o.kind === 'intern' ? 'intern' : 'fulltime',
        company: text(o.company, 120),
        role: text(o.role, 120),
        deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : '',
        clawbackNote: text(o.clawbackNote, 300),
        schedule: typeof o.schedule === 'string' && o.schedule in SCHEDULES ? (o.schedule as Schedule) : 'even',
      };
      const custom: unknown = o.custom;
      if (Array.isArray(custom)) offer.custom = [0, 1, 2, 3].map((i) => (Number.isFinite(custom[i]) ? (custom[i] as number) : undefined));
      for (const key of [...NUM_KEYS, ...INTERN_KEYS]) if (Number.isFinite(o[key])) offer[key] = o[key] as number;
      if (typeof o.city === 'string' && /^[a-z0-9-]{1,40}$/.test(o.city)) offer.city = o.city;
      if (typeof o.housingProvided === 'boolean') offer.housingProvided = o.housingProvided;
      if ((RETURN_OFFERS as readonly unknown[]).includes(o.returnOffer)) offer.returnOffer = o.returnOffer as Offer['returnOffer'];
      return offer;
    });
}

const sameJob = (a: { company: string; role: string }, b: { company: string; role: string }) =>
  a.company.trim().toLowerCase() === b.company.trim().toLowerCase() && a.role.trim().toLowerCase() === b.role.trim().toLowerCase();
const unused = (o: Offer) =>
  !o.company.trim() && !o.role.trim() && !num(o.base) && !num(o.grant) && !num(o.hourly) && !num(o.monthly) && !num(o.weeks);

/**
 * Tracker cards at the offer stage, as names in empty cards first, then new ones up to OFFERS_MAX;
 * numbers stay the learner's. A job's deadline (local "YYYY-MM-DD") goes only into a card it fills.
 */
export function importOffers(offers: readonly Offer[], jobs: readonly { company: string; role: string; deadline?: string }[]) {
  const next = [...offers];
  let added = 0,
    skipped = 0;
  for (const job of jobs) {
    if (next.some((o) => sameJob(o, job))) continue;
    const at = next.findIndex(unused);
    const filled = {
      ...(at >= 0 ? next[at] : blankOffer()),
      company: job.company,
      role: job.role,
      ...(job.deadline && { deadline: job.deadline }),
      // The tracker's employment rule (lib/applications.ts).
      kind: /\bintern(ship)?s?\b|实习/i.test(job.role) ? ('intern' as const) : ('fulltime' as const),
    };
    if (at >= 0) next[at] = filled;
    else if (next.length < OFFERS_MAX) next.push(filled);
    else {
      skipped++;
      continue;
    }
    added++;
  }
  return { offers: next, added, skipped };
}

// ---------------------------------------------------------------- decision matrix

export type Factor = { id: string; name: string; weight: number };
/** Factors with weights, each offer's 1–5 score per factor id, and the weight of money in the overall view. */
export type Decision = { factors: Factor[]; scores: Record<string, Record<string, number>>; moneyWeight: number };
export const FACTORS_MAX = 12;
/** The starting factors; the page names them ('visa' also shows the company's H-1B record). */
export const DEFAULT_FACTORS = ['visa', 'growth', 'team', 'balance', 'location', 'stability', 'work'] as const;
const grade = (x: unknown) => (Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 5 ? (x as number) : null);

/** A saved decision matrix, cleaned up; the default factors when there is none. */
export function readDecision(raw: unknown): Decision {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const factors: Factor[] = Array.isArray(d.factors)
    ? d.factors
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object' && !!text(f.id, 40))
        .map((f) => ({ id: text(f.id, 40), name: text(f.name, 40), weight: grade(f.weight) ?? 3 }))
        .filter((f, i, all) => all.findIndex((g) => g.id === f.id) === i)
        .slice(0, FACTORS_MAX)
    : DEFAULT_FACTORS.map((id) => ({ id, name: '', weight: 3 }));
  const scores: Decision['scores'] = {};
  const saved = d.scores && typeof d.scores === 'object' ? Object.entries(d.scores).slice(0, OFFERS_MAX * 4) : [];
  for (const [offer, row] of saved) {
    if (offer.length > 40 || !row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const kept = Object.fromEntries(factors.filter((f) => grade(r[f.id])).map((f) => [f.id, r[f.id] as number]));
    if (Object.keys(kept).length) scores[offer] = kept;
  }
  return { factors, scores, moneyWeight: grade(d.moneyWeight) ?? 3 };
}

/** Σ(weight × score) ÷ Σweight over the factors scored 1–5 (money's score may be fractional), or null with none scored. */
export function decisionScore(factors: readonly Factor[], scores: Readonly<Record<string, number | null>> | undefined) {
  let total = 0,
    weights = 0;
  for (const f of factors) {
    const s = scores?.[f.id];
    if (typeof s !== 'number' || !(s >= 1 && s <= 5)) continue;
    total += f.weight * s;
    weights += f.weight;
  }
  return weights ? total / weights : null;
}

/**
 * Money as a 1–5 score, compared only within the same kind (full-time with full-time, internship
 * with internship): the lowest 1, the highest 5, linear between; all equal is 3. Null for an offer
 * without a value or alone in its kind.
 */
export function moneyScores(items: readonly { kind: Offer['kind']; value: number | null }[]) {
  return items.map(({ kind, value }) => {
    const peers = items.filter((x) => x.kind === kind && x.value !== null).map((x) => x.value as number);
    if (value === null || peers.length < 2) return null;
    const lo = Math.min(...peers),
      hi = Math.max(...peers);
    return hi === lo ? 3 : 1 + (4 * (value - lo)) / (hi - lo);
  });
}

// ---------------------------------------------------------------- share link

// ponytail: rounding blurs exact figures for an anonymous link; an internship's lump sums are small, so finer.
const ROUND: Partial<Record<NumKey, number>> = {
  base: 5000,
  signOn1: 5000,
  signOn2: 5000,
  grant: 5000,
  match401k: 5000,
  relocation: 5000,
  otherAnnual: 5000,
  hourly: 1,
  monthly: 500,
  housingMonthly: 500,
  housing: 500,
  travel: 500,
};
/**
 * The offers as a read-only link carries them: no id, deadline or clawback note, only the fields of
 * each offer's kind, money rounded, company blank when `anon`.
 */
export function shareOffers(offers: readonly Offer[], { anon }: { anon: boolean }) {
  return offers.map(({ id: _id, deadline: _deadline, clawbackNote: _clawback, ...o }) => {
    const out: Omit<Offer, 'id' | 'deadline' | 'clawbackNote'> = { ...o, company: anon ? '' : o.company };
    // The card keeps the other kind's figures for switching back; the link, which shows only this kind, does not.
    if (o.kind === 'intern') {
      for (const key of NUM_KEYS) if (key !== 'relocation') delete out[key];
      delete out.custom;
      out.schedule = 'even';
    } else {
      for (const key of INTERN_KEYS) delete out[key];
      delete out.housingProvided;
      delete out.returnOffer;
    }
    for (const key of [...NUM_KEYS, ...INTERN_KEYS]) {
      const step = key === 'relocation' && o.kind === 'intern' ? 500 : ROUND[key];
      const v = out[key];
      if (step && typeof v === 'number') out[key] = Math.round(v / step) * step;
    }
    return out;
  });
}
