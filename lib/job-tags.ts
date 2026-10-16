/**
 * Read-time tags for an opening's title (lib/server/job-openings.ts): its role category, the term
 * it hires for and its hiring cycle, plus the /career/jobs filter they feed. Pure and import-free,
 * so the judge worker's one-file bundle can take it (the saved-search digest in
 * lib/server/company-follows.ts).
 */
export const ROLE_CATEGORIES = ['swe', 'ml', 'data', 'infra', 'security', 'hardware', 'quant', 'pm', 'other'] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number];
export const ROLE_NAMES: Record<RoleCategory, [string, string]> = {
  swe: ['软件开发', 'Software'],
  ml: ['机器学习 / AI', 'ML / AI'],
  data: ['数据', 'Data'],
  infra: ['基础设施', 'Infrastructure'],
  security: ['安全', 'Security'],
  hardware: ['硬件', 'Hardware'],
  quant: ['量化', 'Quant'],
  pm: ['产品 / 项目管理', 'Product / program'],
  other: ['其他', 'Other'],
};

// First match wins. AI and ML are matched in capitals only ("aid", "html" are no AI).
const RULES: [RoleCategory, RegExp][] = [
  ['ml', /\b(?:AI|ML)\b/],
  ['ml', /\b(?:machine learning|deep learning|research scientists?|applied scientists?|computer vision|nlp|llms?)\b|机器学习|人工智能|算法/i],
  ['data', /\bdata (?:scien(?:ce|tists?)|engineer(?:ing|s)?|analy(?:sts?|tics))\b|\banalytics\b|数据/i],
  ['infra', /\b(?:site reliability|sre|devops|infrastructure|platforms?|cloud)\b/i],
  ['security', /\b(?:security|cybersecurity|appsec)\b|安全/i],
  ['hardware', /\b(?:hardware|embedded|firmware|asic|fpga|silicon|electrical)\b|硬件|芯片/i],
  ['quant', /\b(?:quant|quantitative|traders?|trading)\b|量化/i],
  ['pm', /\b(?:product manag(?:er|ement)|program manag(?:er|ement)|tpm|apm)\b|产品经理/i],
];
// A business role named "engineer" (sales engineer, mechanical engineering) is no software role.
const NOT_TECH = /\b(?:marketing|finance|financial|sales|legal|accounting|mechanical|civil|chemical|recruiting)\b/i;
const SOFTWARE = /\b(?:software|developers?|swe|sde)\b|软件/i;
const SWE = /\b(?:software|engineer(?:ing|s)?|developers?|swe|sde|back[- ]?end|front[- ]?end|full[- ]?stack|mobile|ios|android)\b|后端|前端|客户端|开发|软件|研发/i;

/** The kind of role a title names; 'other' for marketing, finance, sales, design and the like. */
export function roleCategory(title: string): RoleCategory {
  for (const [category, words] of RULES) if (words.test(title)) return category;
  if (NOT_TECH.test(title) && !SOFTWARE.test(title)) return 'other';
  return SWE.test(title) ? 'swe' : 'other';
}
/** The default filter, "tech roles": everything but product/program management and other. */
export const isTech = (category: RoleCategory) => category !== 'pm' && category !== 'other';

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export type Term = { season: Season | null; year: number | null; coop: boolean };
const SEASON_NAMES: Record<Season, [string, string]> = { spring: ['春季', 'Spring'], summer: ['夏季', 'Summer'], fall: ['秋季', 'Fall'], winter: ['冬季', 'Winter'] };

/**
 * The term a title hires for: "Summer 2027", "Fall 2026 Co-op", "2027 Start", "Summer '27". A range
 * ("2026–2027") gives its first year.
 */
export function termOf(title: string): Term {
  const season = /\b(summer|fall|autumn|winter|spring)\b/i.exec(title)?.[1].toLowerCase();
  const year = /(?:^|[^\d])(20[23]\d)(?!\d)/.exec(title)?.[1] ?? /['’]([23]\d)\b/.exec(title)?.[1];
  return {
    season: season === 'autumn' ? 'fall' : ((season as Season | undefined) ?? null),
    year: year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : null,
    coop: /\bco-?op\b/i.test(title),
  };
}

/** A term's filter value: 'summer-2027', '2027', 'summer', or '' when the title names none. */
export const termKey = ({ season, year }: Term) => (season && year ? `${season}-${year}` : year ? String(year) : (season ?? ''));
export function termLabel(key: string, zh: boolean) {
  const [a, b] = key.split('-');
  const season = (SEASONS as readonly string[]).includes(a) ? SEASON_NAMES[a as Season][zh ? 0 : 1] : '';
  const year = season ? (b ?? '') : a;
  return zh ? [year, season].filter(Boolean).join(' ') : [season, year].filter(Boolean).join(' ');
}
/** Term keys in time order, ones without a year last. */
export function sortTerms(keys: Iterable<string>) {
  const rank = (key: string) => {
    const [a, b] = key.split('-');
    const year = /^\d+$/.test(a) ? Number(a) : b ? Number(b) : 9999;
    return year * 10 + ((SEASONS as readonly string[]).indexOf(/^\d+$/.test(a) ? '' : a) + 1);
  };
  return [...new Set(keys)].filter(Boolean).sort((x, y) => rank(x) - rank(y));
}

/**
 * The start year an opening hires for. A year in the title wins when it is plausible; otherwise one
 * first seen from July on hires for next year (autumn recruiting fills next summer), else this year.
 * Months are UTC.
 */
export function hiringCycle(firstSeenAt: number, title = '') {
  const day = new Date(firstSeenAt),
    year = day.getUTCFullYear();
  const named = termOf(title).year;
  if (named !== null && named >= year - 1 && named <= year + 2) return named;
  return day.getUTCMonth() >= 6 ? year + 1 : year;
}

/** A posting link for comparing: no hash, no tracking parameters, no trailing slash; '' when it is no URL. */
export function jobLinkKey(link: string) {
  try {
    const url = new URL(link);
    url.hash = '';
    // A copy: deleting while iterating the live keys would skip some.
    for (const key of Array.from(url.searchParams.keys())) if (/^(?:utm_.*|gh_src|ref|source)$/i.test(key)) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return '';
  }
}

/** The note holding a learner's one saved search (JSON JobSearch; lib/server/my-practice.ts). */
export const JOB_SEARCH_NOTE = 'career:jobs-search';
/** The /career/jobs filter, also a learner's saved search. H-1B is page-only: the worker never loads that data. */
export type JobSearch = {
  kind: '' | 'intern' | 'new-grad';
  role: 'tech' | 'all' | RoleCategory;
  term: string;
  q: string;
  company: string;
  paid: boolean;
};
export const DEFAULT_SEARCH: JobSearch = { kind: '', role: 'tech', term: '', q: '', company: '', paid: false };
export const ROLE_FILTERS = ['tech', 'all', ...ROLE_CATEGORIES] as const;

/** A filter from query parameters; anything unknown is the default. */
export function searchFromQuery(get: (name: string) => string): JobSearch {
  const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T) => allowed.find((v) => v === value) ?? fallback;
  const term = get('term');
  const company = get('company');
  return {
    kind: pick<JobSearch['kind']>(get('kind'), ['intern', 'new-grad'], ''),
    role: pick<JobSearch['role']>(get('role'), ROLE_FILTERS, 'tech'),
    term: /^[a-z0-9-]{1,20}$/.test(term) ? term : '',
    q: get('q').slice(0, 60),
    company: /^[a-z0-9-]{1,80}$/.test(company) ? company : '',
    paid: get('paid') === '1',
  };
}
/** The filter as /career/jobs query parameters; role is always there, so the saved search is not applied over it. */
export function searchQuery(s: JobSearch) {
  const params = new URLSearchParams({ role: s.role });
  for (const name of ['kind', 'term', 'q', 'company'] as const) if (s[name]) params.set(name, s[name]);
  if (s.paid) params.set('paid', '1');
  return params;
}

type Listed = { title: string; location: string; kind: string; companySlug: string; pay: unknown };
export function matchesSearch(o: Listed, s: JobSearch) {
  const category = roleCategory(o.title);
  return (
    (!s.kind || o.kind === s.kind) &&
    (!s.company || o.companySlug === s.company) &&
    (!s.q || o.location.toLowerCase().includes(s.q.toLowerCase())) &&
    (s.role === 'all' || (s.role === 'tech' ? isTech(category) : category === s.role)) &&
    (!s.term || termKey(termOf(o.title)) === s.term) &&
    (!s.paid || o.pay !== null)
  );
}
