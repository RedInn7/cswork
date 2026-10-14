import { sqlite } from '@/db/sqlite';
import { shownOaSql } from './env';
import { andUnlisted } from './judge-feed';

/**
 * Aggregate standing on one problem, from formal submissions only: how many people tried
 * and solved it, and how a runtime compares with everyone's best accepted runtime in the
 * same language (judge timings differ by language). Only counts and a percentage leave
 * this module, never ids, names or code, and nothing at all below the sample floors:
 * small groups would read as empty and could point at the few people in them.
 */
export const MIN_PEOPLE = 20;
export const MIN_SAMPLE = 30;
const TTL = 10 * 60_000;
const LANGUAGES = new Set(['python', 'go', 'java', 'cpp']);
// Settled verdicts; queued/running work and cancelled or broken jobs are no attempt.
const UNSETTLED = `('pending','queued','compiling','running','cancelled','system_error')`;

type Entry = {
  at: number;
  attempted: number;
  accepted: number;
  /** Per language, each person's best accepted runtime in ms. */
  best: Map<string, number[]>;
};
// ponytail: whole-entry cache per problem, cleared past 5000 problems; the catalogue is ~3k.
const cache = new Map<string, Entry>();

function load(problemId: string, now: number): Entry {
  const cached = cache.get(problemId);
  if (cached && now - cached.at < TTL) return cached;
  const db = sqlite();
  // Both queries use the submission_problem index; hidden companies and owner test
  // accounts (FEED_HIDDEN_USERS) count nowhere, as on the public status board.
  const where = `s.problem_id=? AND s.mode='judge'${shownOaSql('s.problem_id')}${andUnlisted()}`;
  const people = db
    .prepare(
      `SELECT COUNT(DISTINCT s.user_id) attempted,
              COUNT(DISTINCT CASE WHEN s.status='accepted' THEN s.user_id END) accepted
         FROM submissions s WHERE ${where} AND s.status NOT IN ${UNSETTLED}`,
    )
    .get(problemId) as { attempted: number; accepted: number };
  const rows = db
    .prepare(
      `SELECT s.language language, MIN(s.runtime) best FROM submissions s
        WHERE ${where} AND s.status='accepted' AND s.runtime IS NOT NULL
        GROUP BY s.user_id, s.language`,
    )
    .all(problemId) as { language: string; best: number }[];
  const best = new Map<string, number[]>();
  for (const row of rows) {
    const list = best.get(row.language) ?? [];
    list.push(row.best * 1000);
    best.set(row.language, list);
  }
  if (cache.size >= 5000) cache.clear();
  const entry = { at: now, ...people, best };
  cache.set(problemId, entry);
  return entry;
}

export function problemStats(
  problemId: string,
  language: string | null,
  runtimeMs: number | null,
  now = Date.now(),
) {
  const entry = load(problemId, now);
  const best =
    language && LANGUAGES.has(language) ? entry.best.get(language) ?? [] : [];
  return {
    acceptance:
      entry.attempted >= MIN_PEOPLE
        ? { attempted: entry.attempted, accepted: entry.accepted }
        : null,
    // Share of people whose best is slower than this run: LeetCode's "beats".
    beats:
      best.length >= MIN_SAMPLE && runtimeMs !== null && runtimeMs >= 0
        ? Math.floor(
            (100 * best.filter((ms) => ms > runtimeMs).length) / best.length,
          )
        : null,
  };
}
