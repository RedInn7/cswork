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
};

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
  if (!entry.stats.has(key)) entry.stats.set(key, compute(db, JSON.stringify(spellings), since));
  return entry.stats.get(key)!;
}

/** The same day six months earlier, clamped to that month's last day (08-31 → 02-28), as YYYY-MM-DD. */
export function sixMonthsBefore(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - 6;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), last))).toISOString().slice(0, 10);
}

function compute(db: Database.Database, slugs: string, since: string): CompanyStats | null {
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
  };
}
