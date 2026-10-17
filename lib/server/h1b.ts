import data from '@/lib/content/h1b-sponsors.json';

/**
 * H-1B petitions per company and fiscal year from the USCIS H-1B Employer Data Hub, built by
 * scripts/h1b/build.mjs: employer-level totals only (petitions by tax ID, not people).
 */
export type H1bYear = { fy: number; newApproved: number; newDenied: number; contApproved: number; contDenied: number };
export type H1bData = {
  /** Build date (YYYY-MM-DD); null before the first build. */
  updated: string | null;
  source: string;
  sourceUrl: string;
  fiscalYears: number[];
  /** `employers`: the most approved names (at most 10) of `employerCount` counted. */
  companies: Record<string, { years: H1bYear[]; employers: string[]; employerCount: number }>;
};
export const H1B = data as H1bData;

/** Approved share of decided petitions, or null when none were decided. */
export const approvalRate = (approved: number, denied: number) =>
  approved + denied ? approved / (approved + denied) : null;

/** The ranking page for the sitemap, only once there is data (an empty page is noindex). */
export const h1bPaths = (d = H1B) => (d.fiscalYears.length ? [{ path: '/career/h1b', updatedAt: d.updated }] : []);

export const h1bCompany = (slug: string, d = H1B) => (Object.hasOwn(d.companies, slug) ? d.companies[slug] : null);

/** Shown companies (`names`: slug → name) by new-employment approvals in the latest fiscal year. */
export function h1bRanking(names: ReadonlyMap<string, string>, d = H1B) {
  const latest = d.fiscalYears.at(-1);
  return Object.entries(d.companies)
    .flatMap(([slug, c]) => {
      const name = names.get(slug),
        year = c.years.find((y) => y.fy === latest);
      return name && year ? [{ slug, name, ...year }] : [];
    })
    .sort((a, b) => b.newApproved - a.newApproved || a.name.localeCompare(b.name));
}
