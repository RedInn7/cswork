import type Database from 'better-sqlite3';
import { companyLcProblems, type CompanyProblem } from '@/lib/company-tags';
import presetsFile from '@/lib/content/mock-oa-presets.json';
import { experienceColumns, experienceFacts, type ExperienceFacts } from '@/lib/experience';
import {
  canonicalCompany,
  companyHubPath,
  employerSlug,
  OTHER_COMPANY,
} from '@/lib/oa-company-brands';
import { hiddenCompanies } from './env';
import { catalogue, mockPool } from './mock-oa';
import { mockPresetFor } from './mock-oa-presets';
import { landingCompanies } from './mock-interview';
import { oaLibrary } from './oa-library';
import { studyLibrarySummaries } from './study-library';

/**
 * Company pages (/company/<employer>): an employer's OA problems, most reported LeetCode problems,
 * latest experiences and interview questions, and its mock entries. OA catalog, content library
 * and LeetCode map slugs meet under one employer slug (lib/oa-company-brands.ts).
 */
const QUESTION_TYPES = ['interview_question', 'coding_question'] as const;
const HUB_TYPES = ['experience', ...QUESTION_TYPES] as const;
// The rows public library pages show: complete, listed and not a duplicate.
const PUBLIC = 'listed=1 AND partial=0 AND dup_of IS NULL';
/** A company without OA problems needs this many experiences and questions for a page. */
export const MIN_LIBRARY_ITEMS = 5;

export type HubCompany = {
  slug: string;
  name: string;
  /** Visible OA problems. */
  oa: number;
  experiences: number;
  questions: number;
  /** Library spellings of the employer, most items first (the first one filters SPA lists). */
  library: string[];
};
export const hasHub = (c: HubCompany) =>
  c.oa > 0 || c.experiences + c.questions >= MIN_LIBRARY_ITEMS;

type LibraryCount = { slug: string; name: string; type: string; n: number };
// Rebuilt libraries open as a new handle, so the cache follows the handle.
const counts = new WeakMap<Database.Database, LibraryCount[]>();
function libraryCounts(db: Database.Database) {
  let rows = counts.get(db);
  if (!rows) {
    rows = db
      .prepare(
        `SELECT company_slug AS slug, company_name AS name, type, COUNT(*) AS n FROM items
         WHERE ${PUBLIC} AND company_slug IS NOT NULL AND type IN (${HUB_TYPES.map(() => '?').join(',')})
         GROUP BY company_slug, company_name, type`,
      )
      .all(...HUB_TYPES) as LibraryCount[];
    counts.set(db, rows);
  }
  return rows;
}

const ranked = (tally?: Map<string, number>) =>
  [...(tally ?? [])].sort((a, b) => b[1] - a[1]).map(([key]) => key);

/** Every employer with OA problems or library items, hidden companies left out. */
export function companyDirectory(
  db: Database.Database | null,
  hidden: ReadonlySet<string> = hiddenCompanies(),
) {
  const out = new Map<string, HubCompany>();
  const entry = (slug: string) => {
    let c = out.get(slug);
    if (!c) out.set(slug, (c = { slug, name: '', oa: 0, experiences: 0, questions: 0, library: [] }));
    return c;
  };
  // Already without hidden companies and merged catalog aliases.
  for (const c of oaLibrary().companies())
    if (c.slug !== OTHER_COMPANY) Object.assign(entry(c.slug), { name: c.name, oa: c.count });
  const spellings = new Map<string, Map<string, number>>(),
    names = new Map<string, Map<string, number>>();
  const tally = (into: Map<string, Map<string, number>>, slug: string, key: string, n: number) => {
    const m = into.get(slug) ?? new Map<string, number>();
    into.set(slug, m.set(key, (m.get(key) ?? 0) + n));
  };
  for (const r of db ? libraryCounts(db) : []) {
    const slug = employerSlug(r.slug);
    if (hidden.has(r.slug) || hidden.has(slug) || slug === OTHER_COMPANY) continue;
    const c = entry(slug);
    if (r.type === 'experience') c.experiences += r.n;
    else c.questions += r.n;
    tally(spellings, slug, r.slug, r.n);
    tally(names, slug, r.name, r.n);
  }
  const presets = new Map(presetsFile.companies.map((p) => [p.slug, p.name]));
  for (const c of out.values()) {
    c.library = ranked(spellings.get(c.slug));
    // A preset's name, then the OA catalog's, then the library's most used spelling.
    c.name = presets.get(c.slug) ?? (c.name || ranked(names.get(c.slug))[0] || c.slug);
  }
  return out;
}

/** Company pages for the sitemap. */
export function companyHubPaths(db: Database.Database | null) {
  return [...companyDirectory(db).values()]
    .filter(hasHub)
    .map((c) => ({ path: companyHubPath(c.slug) }));
}

/** An employer's reported LeetCode problems with their Line 500 titles and judge state. */
function rankedProblems(problems: readonly CompanyProblem[]) {
  const summaries = new Map(studyLibrarySummaries(problems.map((p) => p.id)).map((s) => [s.id, s]));
  return problems.flatMap((p) => {
    const s = summaries.get(p.id);
    return s
      ? [{ ...p, number: s.number, titleZh: s.titleZh, titleEn: s.titleEn, difficulty: s.difficulty, judgeProblemId: s.judgeProblemId }]
      : [];
  });
}

/** A listed experience or question: summary fields only, plus an experience's facts. */
export type HubItem = {
  type: string;
  slug: string;
  title: string;
  role: string | null;
  round: string | null;
  difficulty: string | null;
} & Partial<ExperienceFacts>;

/** Latest public items of these types by the employer's spellings. */
function latest(
  db: Database.Database | null,
  spellings: readonly string[],
  types: readonly string[],
  limit = 6,
): HubItem[] {
  if (!db || !spellings.length) return [];
  return (
    db
      .prepare(
        `SELECT type,slug,title,role,round,difficulty,published_at,${experienceColumns()} FROM items
         WHERE ${PUBLIC} AND type IN (${types.map(() => '?').join(',')})
           AND company_slug IN (${spellings.map(() => '?').join(',')})
         ORDER BY published_at DESC, rowid DESC LIMIT ?`,
      )
      .all(...types, ...spellings, limit) as Record<string, unknown>[]
  ).map((r) => ({
    type: r.type as string,
    slug: r.slug as string,
    title: r.title as string,
    role: (r.role as string | null) ?? null,
    round: (r.round as string | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
    ...(r.type === 'experience' ? experienceFacts(r) : {}),
  }));
}

/**
 * The page's data, or null when there is no page: an alias slug (only canonical links exist),
 * a hidden company, or one with neither OA problems nor MIN_LIBRARY_ITEMS library items.
 * `ready`: OA problems judgeable now.
 */
export function companyHub(db: Database.Database | null, slug: string, ready: ReadonlySet<string> = new Set()) {
  if (slug !== employerSlug(slug)) return null;
  const hidden = hiddenCompanies();
  const company = companyDirectory(db, hidden).get(slug);
  if (!company || !hasHub(company)) return null;
  return {
    company,
    oa: company.oa ? (oaLibrary().company(slug, ready)?.items ?? []) : [],
    // Every reported one: the page ranks them by its report window and shows the top ten.
    leetcode: rankedProblems(companyLcProblems(hidden).get(slug) ?? []),
    experiences: latest(db, company.library, ['experience']),
    questions: latest(db, company.library, QUESTION_TYPES),
    mockOa: mockPresetFor(slug)?.slug ?? null,
    mockInterview: (db && landingCompanies(db).find((c) => employerSlug(c.slug) === slug)?.slug) || null,
  };
}

/**
 * "Practise this company" for an experience or interview question: judgeable OA problems, a timed
 * mock when its pool is deep enough, and the three most reported judgeable LeetCode problems.
 * Null when the company has none of them (or is hidden).
 */
export async function companyPractice(db: Database.Database | null, slug: string | null | undefined) {
  if (!slug) return null;
  const employer = employerSlug(slug),
    hidden = hiddenCompanies();
  if (hidden.has(slug) || hidden.has(employer) || employer === OTHER_COMPANY) return null;
  const cat = await catalogue().catch(() => null);
  let oaReady = 0;
  for (const [company, list] of cat?.oa ?? [])
    if (canonicalCompany(company) === employer && !hidden.has(company)) oaReady += list.length;
  const top = rankedProblems(companyLcProblems(hidden).get(employer) ?? [])
    .filter((p) => p.judgeProblemId)
    .slice(0, 3)
    .map((p) => ({
      id: p.judgeProblemId!,
      number: p.number,
      titleZh: p.titleZh,
      titleEn: p.titleEn,
      count: p.count,
      last: p.last,
    }));
  const preset = mockPresetFor(employer);
  const mock =
    preset && cat && mockPool(cat, preset.aliases, 'mixed', hidden).length >= preset.questions
      ? preset.slug
      : null;
  if (!oaReady && !top.length && !mock) return null;
  const company = companyDirectory(db, hidden).get(employer);
  return {
    slug: employer,
    name: company?.name ?? preset?.name ?? employer,
    oaReady,
    mock,
    top,
    /** The employer has a company page. */
    hub: !!company && hasHub(company),
  };
}
export type CompanyPractice = NonNullable<Awaited<ReturnType<typeof companyPractice>>>;
