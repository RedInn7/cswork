import type Database from 'better-sqlite3';
import { RESULTS } from '@/lib/experience';

/**
 * An employer's interview process at a glance, aggregated at request time from the read-only
 * content library: how many experiences, which rounds they mention, the outcomes they report,
 * roles, and the categories of its questions. Reported outcomes come from the minority who post,
 * so they are shares of reports, never a pass rate.
 */
export const MIN_EXPERIENCES = 10;
// The rows public pages show: complete, listed and not a duplicate (as company-hub.ts).
const PUBLIC = 'listed=1 AND partial=0 AND dup_of IS NULL';
const OF = 'company_slug IN (SELECT value FROM json_each(?))';

export type Share = { value: string; n: number };
export type CompanyStats = {
  experiences: number;
  /** Experiences dated (the interview, else the report) within the last six months. */
  recent: number;
  /** How many experiences mention each round, most first. */
  rounds: Share[];
  /** Self-reported outcomes; `reported` experiences give one. */
  results: Share[];
  reported: number;
  roles: Share[];
  /** The employer's interview and coding questions by category. */
  categories: Share[];
  questions: number;
  /** Items per quarter over the last TREND_QUARTERS: experiences, then the top question categories. Null when too sparse. */
  trend: Trend | null;
};
export type Trend = { quarters: string[]; series: { value: string; counts: number[] }[] };
export const TREND_QUARTERS = 6;
const TREND_MIN = 8;

// A rebuilt library opens as a new handle; the day key keeps "last six months" current.
const cache = new WeakMap<Database.Database, { since: string; stats: Map<string, CompanyStats | null> }>();

/** Stats over these library spellings of one employer; null below MIN_EXPERIENCES. */
export function companyStats(
  db: Database.Database | null,
  spellings: readonly string[],
  now = new Date(),
): CompanyStats | null {
  if (!db || !spellings.length) return null;
  const since = sixMonthsBefore(now);
  let entry = cache.get(db);
  if (entry?.since !== since) cache.set(db, (entry = { since, stats: new Map() }));
  const key = spellings.join('\n');
  if (!entry.stats.has(key)) entry.stats.set(key, compute(db, JSON.stringify(spellings), since, lastQuarters(now)));
  return entry.stats.get(key)!;
}

/** The same day six months earlier, clamped to that month's last day (08-31 → 02-28), as YYYY-MM-DD. */
export function sixMonthsBefore(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - 6;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), last))).toISOString().slice(0, 10);
}

/** The current quarter and the ones before it, oldest first: ['2025-Q2', …, '2026-Q3']. */
export function lastQuarters(now: Date, n = TREND_QUARTERS) {
  const at = now.getUTCFullYear() * 4 + Math.floor(now.getUTCMonth() / 3);
  return Array.from({ length: n }, (_, i) => {
    const q = at - (n - 1 - i);
    return `${Math.floor(q / 4)}-Q${(q % 4) + 1}`;
  });
}
// A YYYY-MM-DD… date's quarter in SQL, as lastQuarters writes it.
const quarter = (date: string) => `substr(${date},1,4) || '-Q' || ((CAST(substr(${date},6,2) AS INTEGER) + 2) / 3)`;

function trendOf(db: Database.Database, experiences: string, questions: string, slugs: string, quarters: string[]): Trend | null {
  const date = "COALESCE(json_extract(extra,'$.date'), published_at)";
  const rows = db
    .prepare(
      `SELECT q, series, COUNT(*) AS n FROM (
         SELECT ${quarter(date)} AS q, 'experience' AS series FROM items WHERE ${experiences}
         UNION ALL
         SELECT ${quarter('published_at')} AS q, category AS series FROM items WHERE ${questions} AND category IS NOT NULL AND category != ''
       ) WHERE q >= ? GROUP BY q, series`,
    )
    .all(slugs, slugs, quarters[0]) as { q: string; series: string; n: number }[];
  const at = new Map(quarters.map((q, i) => [q, i]));
  const series = new Map<string, number[]>();
  for (const r of rows) {
    const i = at.get(r.q);
    if (i === undefined) continue;
    const counts = series.get(r.series) ?? quarters.map(() => 0);
    counts[i] += r.n;
    series.set(r.series, counts);
  }
  const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
  const total = [...series.values()].reduce((a, c) => a + sum(c), 0);
  if (total < TREND_MIN) return null;
  const categories = [...series].filter(([v]) => v !== 'experience').sort((a, b) => sum(b[1]) - sum(a[1]) || a[0].localeCompare(b[0]));
  return {
    quarters,
    series: [...(series.has('experience') ? [['experience', series.get('experience')!] as const] : []), ...categories.slice(0, 3)].map(
      ([value, counts]) => ({ value, counts }),
    ),
  };
}

function compute(db: Database.Database, slugs: string, since: string, quarters: string[]): CompanyStats | null {
  const experiences = `type='experience' AND ${PUBLIC} AND ${OF}`;
  const { n, recent } = db
    .prepare(
      `SELECT COUNT(*) AS n,
         COALESCE(SUM(COALESCE(json_extract(extra,'$.date'), substr(published_at,1,10)) >= ?), 0) AS recent
       FROM items WHERE ${experiences}`,
    )
    .get(since, slugs) as { n: number; recent: number };
  if (n < MIN_EXPERIENCES) return null;
  const shares = (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as Share[];
  const results = shares(
    `SELECT json_extract(extra,'$.result') AS value, COUNT(*) AS n FROM items
     WHERE ${experiences} AND json_extract(extra,'$.result') IS NOT NULL GROUP BY value ORDER BY n DESC`,
    slugs,
  ).filter((r) => Object.hasOwn(RESULTS, r.value));
  const questions = `type IN ('interview_question','coding_question') AND ${PUBLIC} AND ${OF}`;
  return {
    experiences: n,
    recent,
    rounds: shares(
      `SELECT r.value AS value, COUNT(DISTINCT e.id) AS n
       FROM (SELECT id, extra FROM items WHERE ${experiences}) e, json_each(e.extra,'$.rounds') r
       WHERE r.type='text' GROUP BY r.value ORDER BY n DESC, r.value`,
      slugs,
    ),
    results,
    reported: results.reduce((sum, r) => sum + r.n, 0),
    roles: shares(
      `SELECT role AS value, COUNT(*) AS n FROM items WHERE ${experiences} AND role IS NOT NULL AND role != ''
       GROUP BY role ORDER BY n DESC, role LIMIT 5`,
      slugs,
    ),
    categories: shares(
      `SELECT category AS value, COUNT(*) AS n FROM items WHERE ${questions} AND category IS NOT NULL AND category != ''
       GROUP BY category ORDER BY n DESC, category LIMIT 6`,
      slugs,
    ),
    questions: (db.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${questions}`).get(slugs) as { n: number }).n,
    trend: trendOf(db, experiences, questions, slugs, quarters),
  };
}
