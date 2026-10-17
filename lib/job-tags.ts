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

// A business role is 'other' whatever team it sits on ("Cloud Sales Intern", "Finance Intern, Trading"),
// unless the title also names a technical role; an engineer a business word names ("Sales Engineer",
// "Mechanical Engineering") is none.
const BUSINESS = 'marketing|finance|financial|sales|legal|accounting|account executives?|account managers?|business development|mechanical|civil|chemical|recruiting';
const NOT_TECH = new RegExp(`\\b(?:${BUSINESS})\\b`, 'i');
const TECH_ROLE = new RegExp(
  `(?<!\\b(?:${BUSINESS}) )\\b(?:engineer(?:ing|s)?|developers?|scientists?)\\b|\\b(?:software|swe|sde|data (?:scien|engineer|analy)|(?:product|program) manag)|软件`,
  'i',
);
// Quant first: "Quantitative Finance" is quant. Then first match wins; AI and ML are matched in
// capitals only ("aid", "html" are no AI).
const QUANT = /\b(?:quant|quantitative)\b|量化/i;
const RULES: [RoleCategory, RegExp][] = [
  ['ml', /\b(?:AI|ML)\b/],
  ['ml', /\b(?:machine learning|deep learning|research scientists?|applied scientists?|computer vision|nlp|llms?)\b|机器学习|人工智能|算法/i],
  ['data', /\bdata (?:scien(?:ce|tists?)|engineer(?:ing|s)?|analy(?:sts?|tics))\b|\banalytics\b|数据/i],
  ['infra', /\b(?:site reliability|sre|devops|infrastructure|platforms?|cloud)\b/i],
  ['security', /\b(?:security|cybersecurity|appsec)\b|安全/i],
  ['hardware', /\b(?:hardware|embedded|firmware|asic|fpga|silicon|electrical)\b|硬件|芯片/i],
  ['quant', /\b(?:traders?|trading)\b/i],
  ['pm', /\b(?:product manag(?:er|ement)|program manag(?:er|ement)|tpm|apm)\b|产品经理/i],
];
const SWE = /\b(?:software|engineer(?:ing|s)?|developers?|swe|sde|back[- ]?end|front[- ]?end|full[- ]?stack|mobile|ios|android)\b|后端|前端|客户端|开发|软件|研发/i;

/** The kind of role a title names; 'other' for marketing, finance, sales, design and the like. */
export function roleCategory(title: string): RoleCategory {
  if (QUANT.test(title)) return 'quant';
  if (NOT_TECH.test(title) && !TECH_ROLE.test(title)) return 'other';
  for (const [category, words] of RULES) if (words.test(title)) return category;
  return SWE.test(title) ? 'swe' : 'other';
}
/** The default filter, "tech roles": everything but product/program management and other. */
export const isTech = (category: RoleCategory) => category !== 'pm' && category !== 'other';

// Calendar order: a Winter 2027 term runs January to April 2027, before that spring.
export const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
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

/**
 * job_openings.auth_flags bits: the description says no visa sponsorship, U.S. citizenship or a
 * green card, or a security clearance. AUTH_UNKNOWN (-1, not yet judged) has every bit set, so a
 * filter must be `auth_flags>0 AND auth_flags&?`; an upsert never overwrites a judged (>=0) value with -1.
 */
export const AUTH_FLAGS = { noSponsor: 1, citizenOrGc: 2, clearance: 4 } as const;
export const AUTH_UNKNOWN = -1;

// Read sentence by sentence, lower-cased, "U.S." as "us". Each kind first skips a sentence that
// says the opposite ("we will sponsor", "no clearance required"), then tries its own phrases.
const VISA = '(?:(?:visa|immigration|employment|employer|company|work|h-?1b|any|current|now|or|future)\\s+)*';
const NO_SPONSOR = new RegExp(
  [
    // "unable to sponsor", "will not be sponsoring", "does not offer relocation or visa sponsorship", "isn't eligible for sponsorship"
    `\\b(?:unable to|not able to|cannot|can ?not|can't|will not|won't|do not|does not|don't|doesn't|not eligible for|ineligible for|is not|are not|isn't|aren't)\\s+(?:(?:currently|presently|now|be|able to|in a position to)\\s+)*(?:(?:provide|offer|support|accommodate|consider|qualify for|eligible for)\\s+)?(?:(?:\\S+\\s+){1,2}(?:or|and)\\s+)?${VISA}sponsor`,
    `\\bno\\s+${VISA}sponsorship`,
    `\\bsponsorship\\s*(?::\\s*|is\\s+|will\\s+)?not\\s+(?:be\\s+)?(?:available|offered|provided|possible)`,
    // "must not now or in the future require sponsorship", "do not apply if you will need sponsorship"
    `\\b(?:must not|will not|do not|does not|should not|cannot|won't|don't|doesn't)\\s+(?:\\S+\\s+){0,6}?(?:require|need)s?\\s+(?:\\S+\\s+){0,3}?sponsorship`,
    `\\bwithout\\s+(?:the\\s+)?(?:(?:need|requirement)\\s+(?:for|of)\\s+|requiring\\s+|needing\\s+)?${VISA}sponsorship`,
    // "candidates requiring sponsorship will not be considered"
    `\\b(?:requir|need)\\w*\\s+(?:\\S+\\s+){0,3}?sponsorship\\b(?:\\s+\\S+){0,4}?\\s+(?:(?:will not|won't|cannot|can't)\\s+be|are not|aren't|is not|isn't)\\s+(?:considered|eligible)`,
  ].join('|'),
);
const SPONSORS =
  /(?<!(?:\bnot|\bnever|n't)\s+(?:\S+\s+){0,3})\b(?:we|will|can|do|does|happy to|glad to|able to)\s+(?:(?:also|gladly|do|does|still)\s+)?(?:sponsor\b|(?:offer|provide|support)\s+(?:(?:visa|immigration|h-?1b)\s+)*sponsorship)|(?<!\bno\s+(?:\S+\s+){0,3})\bsponsorship\s+(?:is\s+|may be\s+|will be\s+)?(?:available|offered|provided)\b/;
// A negation near "required" and the word: "does not require a clearance", "citizenship is not required", "no clearance required".
const notRequired = (word: string) =>
  `(?:\\bno\\b|\\bnot\\b|n't\\b|\\bnever\\b)(?:\\s+\\S+){0,3}?\\s+(?:require[ds]?|requirement|necessary|needed)\\b(?:\\s+\\S+){0,3}?\\s+${word}` +
  `|${word}(?:\\s+\\S+){0,3}?\\s+(?:is\\s+|are\\s+)?(?:not|n't)\\s+(?:\\S+\\s+)?(?:required|necessary|needed)` +
  `|\\bno\\b(?:\\s+\\S+){0,2}?\\s+${word}(?:\\s+\\S+){0,2}?\\s+(?:required|necessary|needed|requirements?)`;
const CIT = '(?:(?:us|usa|united states|american)\\s+citizen(?:ship|s)?|(?:us\\s+)?green\\s+card(?:\\s+holders?)?|(?:us\\s+)?(?:lawful\\s+)?permanent\\s+residen(?:ts?|cy|ce))';
const CITIZEN = new RegExp(
  [
    `\\bmust\\s+(?:be|hold|have|possess|maintain)\\s+(?:an?\\s+)?(?:active\\s+|current\\s+)?${CIT}`,
    `\\b${CIT}(?:\\s*(?:,|or|and|\\/)\\s*${CIT})*\\s+(?:status\\s+)?(?:is\\s+|are\\s+)?(?:required|mandatory)`,
    `\\brequir(?:es?|ed|ing)\\s+(?:(?:applicants|candidates)\\s+to\\s+(?:be|hold|have)\\s+|to\\s+(?:be|hold|have)\\s+)?(?:an?\\s+)?${CIT}`,
    `\\bonly\\s+(?:(?:open|available)\\s+to\\s+)?${CIT}`,
    `\\b(?:(?:open|available)\\s+only|limited|restricted)\\s+to\\s+${CIT}`,
  ].join('|'),
);
// "May require", "preferred": no requirement.
const MAYBE = String.raw`|\b(?:may|might|could|some)\s+(?:\S+\s+)?(?:require|be required|need)|\b(?:preferred|a plus|nice to have|bonus)\b`;
// Work-authorization notices list citizens with refugees and asylees (EEO, E-Verify, export control's
// "U.S. person", "protected individual", "or eligible to obtain the required authorizations"), or accept
// any work authorization ("or hold a valid work visa"). Another country's citizenship or residency is no US one.
const NOT_CITIZEN = new RegExp(
  `\\b(?:refugees?|asylees?|asylum|otherwise authorized|us persons?|protected individuals?|required authorizations?|department of state|regard(?:less)? (?:of|to)|discriminat\\w*|e-?verify)\\b` +
    `|\\bor\\s+(?:be\\s+|those\\s+|persons\\s+|individuals\\s+)?(?:otherwise\\s+)?(?:lawfully\\s+)?(?:eligible|authori[sz]ed)\\b` +
    `|\\bor\\s+(?:have|hold|possess)\\s+(?:an?\\s+)?(?:valid\\s+)?(?:(?:work|employment)\\s+(?:authori[sz]ation|visa|permit)|ead)\\b` +
    `|\\b(?:permanent residen\\S*|citizen\\S*)\\s+of\\s+(?!(?:the\\s+)?(?:us|usa|united states|america)\\b)\\w` +
    `|\\b(?:canadian|australian|british|uk|eu|european|japanese|indian|singaporean|mexican)\\s+(?:citizen|permanent\\s+residen)|${notRequired('(?:citizen\\S*|green card|permanent residen\\S*)')}${MAYBE}`,
);
const KIND = '(?:ts\\/sci|top secret|secret|security|dod|government|federal|active|current)';
const CLEARANCE = new RegExp(
  [
    `\\bmust\\s+(?:also\\s+)?(?:be\\s+able\\s+to\\s+|be\\s+)?(?:obtain|hold|have|possess|maintain|get|receive|granted|eligible\\s+(?:for|to\\s+obtain))\\s+(?:\\S+\\s+){0,4}?clearances?\\b`,
    `\\bmust\\b(?:\\s+\\S+){0,8}?\\s+(?:able|eligible)\\s+to\\s+(?:obtain|get|hold|receive)\\s+(?:\\S+\\s+){0,4}?clearances?\\b`,
    `\\b${KIND}\\s+(?:\\S+\\s+){0,2}?clearance\\s+(?:is\\s+)?(?:required|needed|mandatory)`,
    `\\brequir(?:es?|ed|ing)\\s+(?:(?:an?|the)\\s+)?(?:ability\\s+to\\s+(?:obtain|get)\\s+(?:and\\s+maintain\\s+)?(?:an?\\s+)?|to\\s+(?:obtain|hold|have|maintain)\\s+(?:and\\s+maintain\\s+)?(?:an?\\s+)?)?${KIND}\\s+(?:\\S+\\s+){0,2}?clearance`,
    `\\b(?:ts\\/sci|top secret)\\b(?:\\s+\\S+){0,3}?\\s+(?:is\\s+)?required`,
  ].join('|'),
);
// A medical, customs or tax "clearance" is no security clearance.
const NOT_CLEARANCE = new RegExp(notRequired('clearances?') + MAYBE + String.raw`|\b(?:medical|health|customs|tax|credit|drug|background)\s+clearances?\b`);

/**
 * The AUTH_FLAGS bits a job description states. Citizenship and clearance count only with a must,
 * required or only: a bare "permanent resident", "U.S. person" or export-control line is none.
 * ponytail: phrase rules, so unusual wording is missed (the pages say so); a model pass over the
 * descriptions if misses turn out to matter.
 */
export function authFlags(text: string) {
  let flags = 0;
  const sentences = text
    .replace(/[’‘]/g, "'")
    .replace(/\bU\.\s?S\b\.?(?:A\b\.?)?/gi, 'US')
    .toLowerCase()
    .split(/[.!?;]+(?:\s+|$)|[\n\r•]+/);
  for (const raw of sentences) {
    const s = raw.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (!SPONSORS.test(s) && NO_SPONSOR.test(s)) flags |= AUTH_FLAGS.noSponsor;
    if (!NOT_CITIZEN.test(s) && CITIZEN.test(s)) flags |= AUTH_FLAGS.citizenOrGc;
    if (!NOT_CLEARANCE.test(s) && CLEARANCE.test(s)) flags |= AUTH_FLAGS.clearance;
  }
  return flags;
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
/** The note holding the companies a learner blocked: a JSON array of up to JOB_BLOCKED_MAX company slugs. */
export const JOB_BLOCKED_NOTE = 'career:jobs-blocked';
export const JOB_BLOCKED_MAX = 100;
/** The /career/jobs filter, also a learner's saved search. H-1B is page-only: the worker never loads that data. */
export type JobSearch = {
  kind: '' | 'intern' | 'new-grad';
  role: 'tech' | 'all' | RoleCategory;
  term: string;
  q: string;
  company: string;
  paid: boolean;
  /** Leave out openings whose description rules out sponsorship or needs citizenship or a clearance. */
  sponsorOk: boolean;
};
export const DEFAULT_SEARCH: JobSearch = { kind: '', role: 'tech', term: '', q: '', company: '', paid: false, sponsorOk: false };
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
    sponsorOk: get('sponsor') === '1',
  };
}
/** The filter as /career/jobs query parameters; role is always there, so the saved search is not applied over it. */
export function searchQuery(s: JobSearch) {
  const params = new URLSearchParams({ role: s.role });
  for (const name of ['kind', 'term', 'q', 'company'] as const) if (s[name]) params.set(name, s[name]);
  if (s.paid) params.set('paid', '1');
  if (s.sponsorOk) params.set('sponsor', '1');
  return params;
}

type Listed = { title: string; location: string; kind: string; companySlug: string; pay: unknown; authFlags: number };
export function matchesSearch(o: Listed, s: JobSearch) {
  const category = roleCategory(o.title);
  return (
    (!s.kind || o.kind === s.kind) &&
    (!s.company || o.companySlug === s.company) &&
    (!s.q || o.location.toLowerCase().includes(s.q.toLowerCase())) &&
    (s.role === 'all' || (s.role === 'tech' ? isTech(category) : category === s.role)) &&
    (!s.term || termKey(termOf(o.title)) === s.term) &&
    (!s.paid || o.pay !== null) &&
    // Not yet judged (AUTH_UNKNOWN) stays listed.
    (!s.sponsorOk || !(o.authFlags > 0))
  );
}
