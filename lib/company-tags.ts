import lcMapFile from '@/lib/content/company-lc-map.json';
import presetsFile from '@/lib/content/mock-oa-presets.json';
import { employerSlug } from '@/lib/oa-company-brands';
import type { ReportWindows } from '@/lib/report-windows';

/** A judgeable problem one company reported, merged across the company's slugs. */
export type CompanyProblem = {
  id: string;
  rounds: string[];
  /** Distinct interview reports. */
  count: number;
  /** Latest report date, YYYY-MM-DD. */
  last: string;
  /** Content slugs of the reports, one per report. */
  sources: string[];
};
/** A company that reported asking a problem: how often, how recently and in which rounds. */
export type CompanyTag = Omit<CompanyProblem, 'id'> & {
  slug: string;
  name: string;
  /** Reported in an Online Assessment. */
  oa: boolean;
};
/** A problem's company as the problem payload sends it: report slugs stay on the server, their ages come instead. */
export type CompanyChip = Omit<CompanyTag, 'sources'> & { windows?: ReportWindows };
/** lib/content/company-lc-map.json v2: `sources` are every content slug, `count` distinct reports. */
type MapEntry = {
  id: string;
  rounds: readonly string[];
  sources: readonly string[];
  count: number;
  last: string;
};
type CompanyMap = Readonly<Record<string, readonly MapEntry[]>>;

const LC = /^lc-\d{1,6}$/;
const OA_ROUND = 'Online Assessment';
const byFrequency = (a: { count: number; last: string }, b: { count: number; last: string }) =>
  b.count - a.count || b.last.localeCompare(a.last);
const byRank = (a: CompanyTag, b: CompanyTag) =>
  Number(b.oa) - Number(a.oa) || byFrequency(a, b) || a.name.localeCompare(b.name, 'en');

/**
 * Employer slug → the judgeable problems it reported, most reported (then most recent) first.
 * Library spellings merge under one employer (bytedance → tiktok, j-p-morgan → jpmorgan-chase);
 * hidden companies are left out.
 */
export function companyLcProblems(
  hidden: ReadonlySet<string> = new Set(),
  map: CompanyMap = lcMapFile.companies,
) {
  const merged = new Map<string, Map<string, CompanyProblem>>();
  for (const [slug, entries] of Object.entries(map)) {
    const employer = employerSlug(slug);
    if (hidden.has(slug) || hidden.has(employer)) continue;
    const problems = merged.get(employer) ?? new Map<string, CompanyProblem>();
    merged.set(employer, problems);
    for (const e of entries) {
      if (!LC.test(e.id)) continue;
      const p = problems.get(e.id) ?? { id: e.id, rounds: [], count: 0, last: '', sources: [] };
      problems.set(e.id, p);
      // Two spellings never share a report: a source belongs to one company.
      p.count += e.count;
      if (e.last > p.last) p.last = e.last;
      for (const r of e.rounds) if (!p.rounds.includes(r)) p.rounds.push(r);
      for (const src of e.sources) if (!p.sources.includes(src)) p.sources.push(src);
    }
  }
  return new Map(
    [...merged].map(([slug, problems]) => [slug, [...problems.values()].sort(byFrequency)]),
  );
}

/**
 * lc id → companies that asked it. A preset's name wins (one "TikTok / ByteDance"), then the
 * map's display names. Sorted OA first, then by report count, latest report and name.
 */
export function companyTagIndex(
  hidden: ReadonlySet<string> = new Set(),
  map: CompanyMap = lcMapFile.companies,
  presets: readonly { slug: string; name: string }[] = presetsFile.companies,
  names: Readonly<Record<string, string>> = lcMapFile.names,
) {
  const nameOf = new Map<string, string>();
  for (const [slug, name] of Object.entries(names))
    if (slug === employerSlug(slug) || !nameOf.has(employerSlug(slug)))
      nameOf.set(employerSlug(slug), name);
  for (const p of presets) nameOf.set(p.slug, p.name);
  const index = new Map<string, CompanyTag[]>();
  for (const [slug, problems] of companyLcProblems(hidden, map))
    for (const { id, ...problem } of problems) {
      const tags = index.get(id) ?? [];
      index.set(id, tags);
      tags.push({ slug, name: nameOf.get(slug) ?? slug, oa: problem.rounds.includes(OA_ROUND), ...problem });
    }
  for (const tags of index.values()) tags.sort(byRank);
  return index;
}

/** Content coding question slug (any report's) → the judgeable lc id it maps to. */
export const lcIdBySource = new Map(
  Object.values(lcMapFile.companies as CompanyMap).flatMap((entries) =>
    entries.flatMap((e) => (LC.test(e.id) ? e.sources.map((s) => [s, e.id] as const) : [])),
  ),
);
