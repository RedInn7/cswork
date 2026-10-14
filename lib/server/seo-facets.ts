import type Database from 'better-sqlite3';
import { experienceColumns, experienceFacts } from '@/lib/experience';
import { employerSlug, OTHER_COMPANY } from '@/lib/oa-company-brands';
import type { SitemapEntry } from '@/lib/seo';
import { companyDirectory, hasHub, type HubCompany, type HubItem } from './company-hub';
import { hiddenCompanies } from './env';

/**
 * Landing pages over the content library's facets: one role (/roles/<role>), one question
 * category (/categories/<cat>), and a company crossed with either (/company/<employer>/role-<role>,
 * /company/<employer>/cat-<cat>). A combination needs MIN_ITEMS public items for a page at all, and
 * INDEX_ITEMS to be indexed and listed in the sitemap, so no thin page is published.
 */
export const MIN_ITEMS = 3;
export const INDEX_ITEMS = 6;
const SHOWN = 60;
const TYPES = ['experience', 'interview_question', 'coding_question'] as const;
const PUBLIC = `listed=1 AND partial=0 AND dup_of IS NULL AND type IN (${TYPES.map((t) => `'${t}'`).join(',')})`;

export type FacetKind = 'role' | 'cat';
/** URL slug of a facet value: "Data Manipulation (SQL/Python)" → data-manipulation-sql-python. */
export const facetSlug = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export type Facet = {
  kind: FacetKind;
  slug: string;
  /** The most used spelling, shown as the name. */
  value: string;
  /** Every library spelling under this slug, for the query. */
  values: string[];
  n: number;
  experiences: number;
  questions: number;
  /** Latest updated or published item, ISO. */
  updatedAt: string | null;
};
type Index = {
  roles: Map<string, Facet>;
  cats: Map<string, Facet>;
  /** Employer → its facets. */
  company: Map<string, { role: Map<string, Facet>; cat: Map<string, Facet> }>;
};
type CountRow = { company: string | null; role: string | null; category: string | null; type: string; n: number; at: string | null };

function add(into: Map<string, Facet & { spellings: Map<string, number> }>, kind: FacetKind, value: string, row: CountRow) {
  const slug = facetSlug(value);
  if (!slug) return;
  let f = into.get(slug);
  if (!f)
    into.set(slug, (f = { kind, slug, value, values: [], n: 0, experiences: 0, questions: 0, updatedAt: null, spellings: new Map() }));
  f.n += row.n;
  if (row.type === 'experience') f.experiences += row.n;
  else f.questions += row.n;
  if (row.at && (!f.updatedAt || row.at > f.updatedAt)) f.updatedAt = row.at;
  f.spellings.set(value, (f.spellings.get(value) ?? 0) + row.n);
}
const done = (m: Map<string, Facet & { spellings: Map<string, number> }>) => {
  for (const f of m.values()) {
    const ranked = [...f.spellings].sort((a, b) => b[1] - a[1]);
    f.value = ranked[0][0];
    f.values = ranked.map(([v]) => v);
    delete (f as Partial<typeof f>).spellings;
  }
  return m as Map<string, Facet>;
};

// Rebuilt libraries open as a new handle; the hidden list is part of the key.
const cache = new WeakMap<Database.Database, { hidden: string; index: Index }>();
/** Every facet with its counts, hidden companies left out of all of them. */
export function facetIndex(db: Database.Database, hidden: ReadonlySet<string> = hiddenCompanies()): Index {
  const key = [...hidden].sort().join(',');
  const cached = cache.get(db);
  if (cached?.hidden === key) return cached.index;
  const rows = db
    .prepare(
      `SELECT company_slug AS company, role, category, type, COUNT(*) AS n, MAX(COALESCE(updated_at, published_at)) AS at
       FROM items WHERE ${PUBLIC} AND (role IS NOT NULL OR category IS NOT NULL)
       GROUP BY company_slug, role, category, type`,
    )
    .all() as CountRow[];
  const roles = new Map(),
    cats = new Map(),
    company = new Map<string, { role: Map<string, Facet & { spellings: Map<string, number> }>; cat: Map<string, Facet & { spellings: Map<string, number> }> }>();
  for (const r of rows) {
    const employer = r.company ? employerSlug(r.company) : null;
    if (r.company && (hidden.has(r.company.toLowerCase()) || hidden.has(employer!))) continue;
    const mine = employer && employer !== OTHER_COMPANY ? (company.get(employer) ?? { role: new Map(), cat: new Map() }) : null;
    if (mine && employer) company.set(employer, mine);
    if (r.role?.trim()) {
      add(roles, 'role', r.role.trim(), r);
      if (mine) add(mine.role, 'role', r.role.trim(), r);
    }
    if (r.category?.trim()) {
      add(cats, 'cat', r.category.trim(), r);
      if (mine) add(mine.cat, 'cat', r.category.trim(), r);
    }
  }
  const index: Index = {
    roles: done(roles),
    cats: done(cats),
    company: new Map([...company].map(([slug, f]) => [slug, { role: done(f.role), cat: done(f.cat) }])),
  };
  cache.set(db, { hidden: key, index });
  return index;
}

export const facetPath = (kind: FacetKind, slug: string, company?: string) =>
  company ? `/company/${company}/${kind}-${slug}` : kind === 'role' ? `/roles/${slug}` : `/categories/${slug}`;
/** "role-software-engineer" → its parts, or null. */
export function parseFacet(raw: string): { kind: FacetKind; slug: string } | null {
  const m = /^(role|cat)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(raw);
  return m && m[2].length <= 80 ? { kind: m[1] as FacetKind, slug: m[2] } : null;
}

export type FacetPage = {
  facet: Facet;
  company: HubCompany | null;
  experiences: HubItem[];
  questions: (HubItem & { category: string | null; company: string | null })[];
  /** 3–5 items: a page, but not one for search engines. */
  noindex: boolean;
  /** Role or category pages: companies with an indexable page for this facet. Company pages: its other facets. */
  related: { kind: FacetKind; path: string; name: string; n: number }[];
};

/**
 * A facet page's data, or null when there is no page: an unknown slug, an alias company slug,
 * a company without a company page, or fewer than MIN_ITEMS items.
 */
export function facetPage(
  db: Database.Database | null,
  kind: FacetKind,
  slug: string,
  companySlug?: string,
  hidden: ReadonlySet<string> = hiddenCompanies(),
): FacetPage | null {
  if (!db) return null;
  const index = facetIndex(db, hidden);
  let company: HubCompany | null = null;
  let facet: Facet | undefined;
  if (companySlug !== undefined) {
    if (companySlug !== employerSlug(companySlug)) return null;
    company = companyDirectory(db, hidden).get(companySlug) ?? null;
    if (!company || !hasHub(company)) return null;
    facet = index.company.get(companySlug)?.[kind].get(slug);
  } else facet = (kind === 'role' ? index.roles : index.cats).get(slug);
  if (!facet || facet.n < MIN_ITEMS) return null;
  const column = kind === 'role' ? 'role' : 'category';
  const where = [`${PUBLIC}`, `TRIM(${column}) IN (${facet.values.map(() => '?').join(',')})`];
  const args: string[] = [...facet.values];
  if (company) {
    where.push(`company_slug IN (${company.library.map(() => '?').join(',')})`);
    args.push(...company.library);
  } else if (hidden.size) {
    where.push(`LOWER(COALESCE(company_slug,'')) NOT IN (${[...hidden].map(() => '?').join(',')})`);
    args.push(...hidden);
  }
  const rows = db
    .prepare(
      `SELECT type,slug,title,role,round,difficulty,category,company_name,${experienceColumns()} FROM items
       WHERE ${where.join(' AND ')} ORDER BY published_at DESC, rowid DESC LIMIT ${SHOWN}`,
    )
    .all(...args) as Record<string, unknown>[];
  const item = (r: Record<string, unknown>) => ({
    type: r.type as string,
    slug: r.slug as string,
    title: r.title as string,
    role: (r.role as string | null) ?? null,
    round: (r.round as string | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
  });
  const directory = company ? null : companyDirectory(db, hidden);
  const related = company
    ? (['role', 'cat'] as const).flatMap((k) =>
        [...(index.company.get(company!.slug)?.[k].values() ?? [])]
          .filter((f) => f.n >= MIN_ITEMS && !(k === kind && f.slug === slug))
          .map((f) => ({ kind: k, path: facetPath(k, f.slug, company!.slug), name: f.value, n: f.n })),
      )
    : [...index.company]
        .flatMap(([employer, f]) => {
          const mine = f[kind].get(slug);
          const c = directory!.get(employer);
          return mine && mine.n >= INDEX_ITEMS && c && hasHub(c) ? [{ kind, path: facetPath(kind, slug, employer), name: c.name, n: mine.n }] : [];
        })
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
        .slice(0, 30);
  return {
    facet,
    company,
    experiences: rows.filter((r) => r.type === 'experience').map((r) => ({ ...item(r), ...experienceFacts(r) })),
    questions: rows
      .filter((r) => r.type !== 'experience')
      .map((r) => ({ ...item(r), category: (r.category as string | null) ?? null, company: (r.company_name as string | null) ?? null })),
    noindex: facet.n < INDEX_ITEMS,
    related: related.sort((a, b) => b.n - a.n),
  };
}

/** Indexable facet pages for the sitemap, with their latest item as lastmod. */
export function facetPaths(db: Database.Database | null, hidden: ReadonlySet<string> = hiddenCompanies()): SitemapEntry[] {
  if (!db) return [];
  const index = facetIndex(db, hidden);
  const directory = companyDirectory(db, hidden);
  const entry = (kind: FacetKind, f: Facet, company?: string) =>
    f.n >= INDEX_ITEMS ? [{ path: facetPath(kind, f.slug, company), updatedAt: f.updatedAt }] : [];
  return [
    ...[...index.roles.values()].flatMap((f) => entry('role', f)),
    ...[...index.cats.values()].flatMap((f) => entry('cat', f)),
    ...[...index.company].flatMap(([employer, f]) => {
      const c = directory.get(employer);
      if (!c || !hasHub(c)) return [];
      return [...[...f.role.values()].flatMap((x) => entry('role', x, employer)), ...[...f.cat.values()].flatMap((x) => entry('cat', x, employer))];
    }),
  ];
}

/** A company page's own facets worth linking to: indexable ones, most items first. */
export function companyFacets(db: Database.Database | null, employer: string, hidden: ReadonlySet<string> = hiddenCompanies()) {
  const f = db ? facetIndex(db, hidden).company.get(employer) : undefined;
  if (!f) return [];
  return (['role', 'cat'] as const)
    .flatMap((kind) => [...f[kind].values()].filter((x) => x.n >= INDEX_ITEMS).map((x) => ({ kind, path: facetPath(kind, x.slug, employer), name: x.value, n: x.n })))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
}
