import { sqlite } from '@/db/sqlite';
import { companyTagIndex } from '@/lib/company-tags';
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
  /** Employers by reports, most first. */
  companies: { slug: string; name: string; n: number }[];
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
            companies: [...e.companies.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
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
    members: recentMemberExperiences(since, 20),
    oa: oa.slice(0, 40),
    oaTotal: oa.length,
  };
}
