import { sqlite } from '@/db/sqlite';
import { hiringCycle } from '@/lib/job-tags';

/**
 * When each company's intern and new-grad openings show up per hiring cycle (db/job-openings-schema.ts
 * job_seasons), kept after the openings themselves age out. The cycle is the start year an opening
 * hires for, from its own first sighting or the year in its title (lib/job-tags.ts hiringCycle), never
 * from the sync's clock: a June opening still listed in August stays in June's cycle.
 */
export type JobSeason = {
  companySlug: string;
  kind: 'intern' | 'new-grad';
  cycle: number;
  firstSeenAt: number;
  lastSeenAt: number;
  peak: number;
  /** First seen on the board's first sync: it may have opened earlier. */
  firstSync: boolean;
  /** The board's latest successful fetch, or null. */
  boardSeenAt: number | null;
};

/**
 * Called in a board's sync transaction (lib/server/job-openings.ts), after its openings are upserted
 * with last_seen_at = now: their seasons, by kind and cycle, keep the earliest first sighting, move
 * last_seen_at on and keep the most openings seen at once.
 */
export function recordSeasons(slug: string, now: number) {
  const db = sqlite();
  const rows = db
    .prepare("SELECT kind,title,first_seen_at AS at FROM job_openings WHERE company_slug=? AND last_seen_at=? AND kind<>'board'")
    .all(slug, now) as { kind: string; title: string; at: number }[];
  const seasons = new Map<string, { kind: string; cycle: number; first: number; count: number }>();
  for (const r of rows) {
    const cycle = hiringCycle(r.at, r.title),
      key = `${r.kind}:${cycle}`;
    const s = seasons.get(key);
    if (s) {
      s.first = Math.min(s.first, r.at);
      s.count++;
    } else seasons.set(key, { kind: r.kind, cycle, first: r.at, count: 1 });
  }
  const upsert = db.prepare(
    `INSERT INTO job_seasons(company_slug,kind,cycle,first_seen_at,last_seen_at,peak) VALUES(?,?,?,?,?,?)
    ON CONFLICT(company_slug,kind,cycle) DO UPDATE SET first_seen_at=MIN(first_seen_at,excluded.first_seen_at),
    last_seen_at=MAX(last_seen_at,excluded.last_seen_at),peak=MAX(peak,excluded.peak)`,
  );
  for (const s of seasons.values()) upsert.run(slug, s.kind, s.cycle, s.first, now, s.count);
}

/** Seasons from `fromCycle` on (one company's, or all), with their board's first and latest sync. */
export function jobSeasons(fromCycle: number, company?: string): JobSeason[] {
  // MAX: a remapped board's old row lingers until KEEP_FOR.
  const rows = sqlite()
    .prepare(
      `SELECT s.company_slug AS companySlug,s.kind,s.cycle,s.first_seen_at AS firstSeenAt,s.last_seen_at AS lastSeenAt,s.peak,
      b.first AS boardFirst,b.last AS boardSeenAt FROM job_seasons s
      LEFT JOIN (SELECT company_slug,MAX(first_seen_at) AS first,MAX(last_seen_at) AS last FROM job_openings WHERE kind='board' GROUP BY company_slug) b
      ON b.company_slug=s.company_slug
      WHERE s.cycle>=?${company ? ' AND s.company_slug=?' : ''} ORDER BY s.first_seen_at,s.company_slug`,
    )
    .all(...(company ? [fromCycle, company] : [fromCycle])) as (Omit<JobSeason, 'firstSync'> & { boardFirst: number | null })[];
  return rows.map(({ boardFirst, ...s }) => ({ ...s, firstSync: boardFirst !== null && s.firstSeenAt <= boardFirst }));
}

/** When the season records start: the first sync that found any opening, or null. */
export const seasonsSince = () => sqlite().prepare('SELECT MIN(first_seen_at) FROM job_seasons').pluck().get() as number | null;
