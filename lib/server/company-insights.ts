import { sqlite } from '@/db/sqlite';
import { companyTagIndex } from '@/lib/company-tags';
import lcMapFile from '@/lib/content/company-lc-map.json';
import { inWindow, windowCounts, type ReportWindow } from '@/lib/report-windows';
import { employerSlug } from '@/lib/oa-company-brands';
import { library } from './content-library';
import { hiddenCompanies } from './env';
import { recentMemberExperiences } from './experience-submissions';
import { recentSince, reportCompanies } from './learner-cloud';
import { oaLibrary } from './oa-library';
import { oaReadyProblems } from './oa-judge';
import { publicLibraryPath } from './public-library';
import { studyLibrarySummaries } from './study-library';

/**
 * Site-wide views over what companies ask: the most reported LeetCode problems (/company/top) and
 * what was added lately (/library?view=recent). Report counts only, never probabilities; nothing
 * here guesses data the sources do not have (no departments, no unlisted employers).
 */
const DAY = 86400000;

export type TopProblem = {
  id: string;
  number: number;
  titleZh: string;
  titleEn: string;
  difficulty: string;
  judgeProblemId: string | null;
  /** Interview reports mapped to the problem plus learners' "I was asked this" in the recent months. */
  score: number;
  /** The second part of the score. */
  learnerReports: number;
  /** Latest report month, YYYY-MM. */
  last: string;
  /** Employers by reports, most first; `hub` when /company/<slug> exists. */
  companies: { slug: string; name: string; n: number; hub: boolean }[];
};

/**
 * The most reported LeetCode problems across all companies: each company's report count from
 * company-lc-map.json, plus distinct learners who reported being asked it in the last six months.
 * Hidden companies count nowhere; problems not in the Line 500 bank are left out (no title).
 */
export function topProblems(max = 100, now = Date.now(), hidden: ReadonlySet<string> = hiddenCompanies()): TopProblem[] {
  const tally = new Map<string, { score: number; learner: number; last: string; companies: Map<string, { slug: string; name: string; n: number }> }>();
  const entry = (id: string) => {
    let e = tally.get(id);
    if (!e) tally.set(id, (e = { score: 0, learner: 0, last: '', companies: new Map() }));
    return e;
  };
  const bump = (e: ReturnType<typeof entry>, slug: string, name: string, n: number) => {
    const c = e.companies.get(slug) ?? { slug, name, n: 0 };
    c.n += n;
    e.companies.set(slug, c);
  };
  for (const [id, tags] of companyTagIndex(hidden)) {
    const e = entry(id);
    for (const t of tags) {
      e.score += t.count;
      bump(e, t.slug, t.name, t.count);
      if (t.last.slice(0, 7) > e.last) e.last = t.last.slice(0, 7);
    }
  }
  // Employers with a company page; the rest are named without a link.
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  const reports = sqlite()
    .prepare(
      `SELECT problem_id AS id,company,COUNT(DISTINCT user_id) AS n,MAX(asked_month) AS last FROM problem_reports
       WHERE asked_month>=? AND problem_id LIKE 'lc-%' GROUP BY problem_id,company`,
    )
    .all(recentSince(now)) as { id: string; company: string; n: number; last: string }[];
  for (const r of reports) {
    if (r.company && (hidden.has(r.company) || hidden.has(employerSlug(r.company)))) continue;
    const e = entry(r.id);
    e.score += r.n;
    e.learner += r.n;
    if (r.company && names.has(r.company)) bump(e, r.company, names.get(r.company)!, r.n);
    if (r.last > e.last) e.last = r.last;
  }
  const ranked = [...tally].sort((a, b) => b[1].score - a[1].score || b[1].last.localeCompare(a[1].last) || a[0].localeCompare(b[0]));
  const summaries = new Map(studyLibrarySummaries(ranked.map(([id]) => id)).map((s) => [s.id, s]));
  return ranked.flatMap(([id, e]) => {
    const s = summaries.get(id);
    return s
      ? [
          {
            id,
            number: s.number,
            titleZh: s.titleZh,
            titleEn: s.titleEn,
            difficulty: s.difficulty,
            judgeProblemId: s.judgeProblemId,
            score: e.score,
            learnerReports: e.learner,
            last: e.last,
            companies: [...e.companies.values()]
              .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
              .map((c) => ({ ...c, hub: names.has(employerSlug(c.slug)) })),
          },
        ]
      : [];
  }).slice(0, max);
}

// Written pages a library list links to: what public-library.ts serves, guides left out.
const PUBLIC = `listed=1 AND partial=0 AND dup_of IS NULL AND trim(title)<>''
  AND type IN ('algorithm','coding_question','interview_question','experience','concept','article','cheatsheet')
  AND length(slug) BETWEEN 1 AND 300 AND slug NOT GLOB '*[^a-zA-Z0-9_-]*'`;

/** /library?view=recent: library pages, approved member experiences and judgeable OA problems of the last `days`. */
export async function recentAdditions(
  now = Date.now(),
  days = 30,
  hidden: ReadonlySet<string> = hiddenCompanies(),
  /** Judgeable OA problems and when each went online; the live judge's by default. */
  ready?: ReadonlyMap<string, { firstAt: number }>,
) {
  const since = now - days * DAY;
  const db = library();
  // Hidden companies include the library spellings merged into them (lib/oa-company-brands.ts).
  const where = `${PUBLIC} AND published_at>=?${hidden.size ? ` AND LOWER(COALESCE(company_slug,'')) NOT IN (${[...hidden].map(() => '?').join(',')})` : ''}`;
  const args = [new Date(since).toISOString().slice(0, 10), ...hidden];
  const items = db
    ? (db
        .prepare(
          `SELECT type,slug,title,company_name AS company,published_at AS at FROM items
           WHERE ${where} ORDER BY published_at DESC, rowid DESC LIMIT 60`,
        )
        .all(...args) as { type: string; slug: string; title: string; company: string | null; at: string }[])
    : [];
  const counts = Object.fromEntries(
    db ? (db.prepare(`SELECT type, COUNT(*) AS n FROM items WHERE ${where} GROUP BY type`).all(...args) as { type: string; n: number }[]).map((r) => [r.type, r.n]) : [],
  ) as Record<string, number>;
  const members = recentMemberExperiences(since, 20);
  const oa = [...(ready ?? (await oaReadyProblems()))]
    .filter(([, meta]) => meta.firstAt >= since)
    .sort((a, b) => b[1].firstAt - a[1].firstAt)
    .flatMap(([id, meta]) => {
      const found = oaLibrary().problem(id);
      return found
        ? [{ id, title: found.item.title, number: found.item.number, company: found.company.name, companySlug: found.item.companySlug, at: new Date(meta.firstAt).toISOString() }]
        : [];
    });
  return {
    since: new Date(since).toISOString(),
    library: items.map((r) => ({ ...r, path: publicLibraryPath(r.type, r.slug) })),
    libraryCounts: counts,
    members: members.items,
    membersTotal: members.total,
    oa: oa.slice(0, 40),
    oaTotal: oa.length,
  };
}

/** A report behind company-lc-map.json: its library row's date and, when it has a public page, its title. */
export type SourceItem = { type: string; slug: string; title: string; date: string | null; page: boolean };
// ponytail: every source of the map in one query (a few hundred slugs), kept 10 minutes.
let sources: { at: number; hidden: string; value: Map<string, SourceItem> } | null = null;
/**
 * Content slug → its listed library row, for every source in company-lc-map.json. Hidden companies'
 * and unlisted rows are left out (their reports then count as undated). A slug can name rows of
 * several types; the coding question wins, as the map's sources are coding questions.
 */
export function sourceDates(now = Date.now(), hidden: ReadonlySet<string> = hiddenCompanies()) {
  const key = [...hidden].sort().join(',');
  if (sources && sources.hidden === key && now - sources.at < 10 * 60_000) return sources.value;
  const value = new Map<string, SourceItem>();
  const slugs = Object.values(lcMapFile.companies).flatMap((entries) => entries.flatMap((e) => e.sources));
  const rows = (library()
    ?.prepare(
      `SELECT type,slug,title,COALESCE(json_extract(extra,'$.date'), substr(published_at,1,10)) AS date,
         (partial=0 AND dup_of IS NULL AND trim(title)<>'') AS page
       FROM items WHERE listed=1 AND type IN ('coding_question','interview_question','experience')
         AND slug IN (SELECT value FROM json_each(?))
         ${hidden.size ? `AND LOWER(COALESCE(company_slug,'')) NOT IN (${[...hidden].map(() => '?').join(',')})` : ''}
       ORDER BY type<>'coding_question', type<>'interview_question'`,
    )
    .all(JSON.stringify(slugs), ...hidden) ?? []) as (Omit<SourceItem, 'page'> & { page: number })[];
  for (const r of rows) if (!value.has(r.slug)) value.set(r.slug, { ...r, page: !!r.page });
  sources = { at: now, hidden: key, value };
  return value;
}

/**
 * A company's problems by their reports inside the window (`n`), none left at zero, with the reports
 * behind each that have a public page (`refs`, newest first).
 */
export function rankInWindow<P extends { sources: string[]; last: string }>(
  problems: readonly P[],
  period: ReportWindow,
  dated: ReadonlyMap<string, SourceItem>,
  now = Date.now(),
) {
  const counted = (slugs: readonly string[]) => inWindow(windowCounts(slugs, dated, now), period);
  return problems
    .map((p) => ({
      ...p,
      n: counted(p.sources),
      refs: p.sources
        .flatMap((slug) => (dated.get(slug)?.page && counted([slug]) ? [dated.get(slug)!] : []))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));
}
