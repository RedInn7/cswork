// Offer comparison (/career/offers): pre-tax pay year by year for the first four years. Pure, so
// components/offer-compare.tsx and tests/offer-math.test.ts share it; nothing here leaves the browser.

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
export type NumKey = (typeof NUM_KEYS)[number];
export type Year = { base: number; bonus: number; stock: number; signOn: number; other: number; total: number };

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export const blankOffer = (id = Math.random().toString(36).slice(2)): Offer => ({
  id,
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
        company: text(o.company, 120),
        role: text(o.role, 120),
        deadline: typeof o.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : '',
        clawbackNote: text(o.clawbackNote, 300),
        schedule: typeof o.schedule === 'string' && o.schedule in SCHEDULES ? (o.schedule as Schedule) : 'even',
      };
      const custom: unknown = o.custom;
      if (Array.isArray(custom)) offer.custom = [0, 1, 2, 3].map((i) => (Number.isFinite(custom[i]) ? (custom[i] as number) : undefined));
      for (const key of NUM_KEYS) if (Number.isFinite(o[key])) offer[key] = o[key] as number;
      return offer;
    });
}

const sameJob = (a: { company: string; role: string }, b: { company: string; role: string }) =>
  a.company.trim().toLowerCase() === b.company.trim().toLowerCase() && a.role.trim().toLowerCase() === b.role.trim().toLowerCase();
const unused = (o: Offer) => !o.company.trim() && !o.role.trim() && !num(o.base) && !num(o.grant);

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
