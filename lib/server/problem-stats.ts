import { sqlite } from '@/db/sqlite';
import { LANGUAGE_IDS } from '@/lib/problems';
import { shownOaSql } from './env';
import { andUnlisted } from './judge-feed';

/**
 * Aggregate standing on one problem, from formal submissions only: how many people tried
 * and solved it, how a runtime and a memory figure compare with everyone's best accepted
 * ones in the same language (judge timings differ by language), the shape of those bests,
 * and the problem's up/down votes. Only counts, edges and percentages leave this module,
 * never ids, names or code, and nothing at all below the sample floors: small groups would
 * read as empty and could point at the few people in them. For the same reason no
 * histogram bucket holds one or two people; such a bucket is merged into a neighbour.
 */
export const MIN_PEOPLE = 20;
export const MIN_SAMPLE = 30;
const TTL = 10 * 60_000;
const LANGUAGES = new Set<string>(LANGUAGE_IDS);
// Settled verdicts; queued/running work and cancelled or broken jobs are no attempt.
const UNSETTLED = `('pending','queued','compiling','running','cancelled','system_error')`;
const BUCKETS = 20;
const MIN_BUCKET = 3;

export type Histogram = { edges: number[]; counts: number[] };
type Best = { runtime: number[]; memory: number[] };
type Entry = {
  at: number;
  attempted: number;
  accepted: number;
  /** Per language, each person's best accepted runtime (whole microseconds) and memory (KB), ascending. */
  best: Map<string, Best>;
  votes: { up: number; down: number };
  shapes: Map<string, { runtime: Histogram | null; memory: Histogram | null }>;
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
  // A person's best runtime and best memory may come from different submissions.
  const rows = db
    .prepare(
      `SELECT s.language language, MIN(s.runtime) runtime, MIN(s.memory) memory FROM submissions s
        WHERE ${where} AND s.status='accepted' AND (s.runtime IS NOT NULL OR s.memory IS NOT NULL)
        GROUP BY s.user_id, s.language`,
    )
    .all(problemId) as { language: string; runtime: number | null; memory: number | null }[];
  const best = new Map<string, Best>();
  for (const row of rows) {
    const lists = best.get(row.language) ?? { runtime: [], memory: [] };
    if (row.runtime !== null) lists.runtime.push(micros(row.runtime * 1000));
    if (row.memory !== null) lists.memory.push(row.memory);
    best.set(row.language, lists);
  }
  for (const lists of best.values()) {
    lists.runtime.sort((a, b) => a - b);
    lists.memory.sort((a, b) => a - b);
  }
  // user_marks_target_mark index; the endpoint already 404s problems the viewer can't see.
  const votes = { up: 0, down: 0 };
  for (const row of db
    .prepare("SELECT mark, COUNT(*) n FROM user_marks WHERE target=? AND mark IN ('up','down') GROUP BY mark")
    .all(`problem:${problemId}`) as { mark: 'up' | 'down'; n: number }[])
    votes[row.mark] = row.n;
  if (cache.size >= 5000) cache.clear();
  const entry = { at: now, ...people, best, votes, shapes: new Map() };
  cache.set(problemId, entry);
  return entry;
}

// Judge timings are fractional ms (ns / 1e6): compare both sides at one precision, so a
// tie (this run against its own best) never counts as slower.
const micros = (ms: number) => Math.round(ms * 1000);

/**
 * Equal-width buckets from the fastest best to the 95th percentile, so one slow outlier
 * can't squash the chart; the slower tail shares the last bucket, whose upper edge is the
 * slowest best. Then any bucket of one or two people merges into its larger neighbour
 * until none is left. `sorted` is ascending with at least MIN_SAMPLE values.
 */
export function histogram(sorted: number[]): Histogram {
  const n = sorted.length;
  const lo = sorted[0];
  const hi = sorted[Math.floor(0.95 * (n - 1))];
  const top = sorted[n - 1];
  if (hi <= lo) return { edges: [lo, top], counts: [n] };
  const width = (hi - lo) / BUCKETS;
  const buckets = Array.from({ length: BUCKETS }, (_, i) => ({
    from: lo + i * width,
    to: i === BUCKETS - 1 ? top : lo + (i + 1) * width,
    count: 0,
  }));
  for (const value of sorted) buckets[Math.min(BUCKETS - 1, Math.floor((value - lo) / width))].count++;
  for (let i = buckets.findIndex(sparse); i >= 0; i = buckets.findIndex(sparse)) {
    const left = buckets[i - 1];
    const right = buckets[i + 1];
    const a = !right || (left && left.count > right.count) ? i - 1 : i;
    buckets.splice(a, 2, {
      from: buckets[a].from,
      to: buckets[a + 1].to,
      count: buckets[a].count + buckets[a + 1].count,
    });
  }
  return {
    edges: [buckets[0].from, ...buckets.map((bucket) => bucket.to)],
    counts: buckets.map((bucket) => bucket.count),
  };
}
const sparse = (bucket: { count: number }) => bucket.count > 0 && bucket.count < MIN_BUCKET;

/** Share of people whose best is worse (strictly greater) than `mine`: LeetCode's "beats". */
const beatsOf = (list: number[], mine: number | null) =>
  list.length >= MIN_SAMPLE && mine !== null && mine >= 0
    ? Math.floor((100 * list.filter((value) => value > mine).length) / list.length)
    : null;

export function problemStats(
  problemId: string,
  language: string | null,
  runtimeMs: number | null,
  memoryKb: number | null = null,
  now = Date.now(),
) {
  const entry = load(problemId, now);
  const lang = language && LANGUAGES.has(language) ? language : null;
  const best = (lang && entry.best.get(lang)) || { runtime: [], memory: [] };
  let shape = lang ? entry.shapes.get(lang) : undefined;
  if (lang && !shape) {
    // Runtime edges go out in ms, like the runtimeMs the client compares with them.
    const runtime = best.runtime.length >= MIN_SAMPLE ? histogram(best.runtime) : null;
    shape = {
      runtime: runtime && { edges: runtime.edges.map((us) => us / 1000), counts: runtime.counts },
      memory: best.memory.length >= MIN_SAMPLE ? histogram(best.memory) : null,
    };
    entry.shapes.set(lang, shape);
  }
  return {
    acceptance:
      entry.attempted >= MIN_PEOPLE
        ? { attempted: entry.attempted, accepted: entry.accepted }
        : null,
    beats: beatsOf(best.runtime, runtimeMs === null ? null : micros(runtimeMs)),
    beatsMemory: beatsOf(best.memory, memoryKb),
    histogram: shape && (shape.runtime || shape.memory) ? shape : null,
    votes: { ...entry.votes },
  };
}

let shares: { at: number; map: Map<string, number>; people: Map<string, number> } | null = null;
/**
 * Accepted share of people per LeetCode-bank problem, for the bank's "acceptance" sort: one
 * grouped query for every problem, cached like the per-problem stats. Problems tried by
 * fewer than MIN_PEOPLE are left out (they sort last), so no small group is exposed.
 */
export function acceptanceIndex(now = Date.now()) {
  if (shares && now - shares.at < TTL) return shares.map;
  const rows = sqlite()
    .prepare(
      `SELECT s.problem_id id, COUNT(DISTINCT s.user_id) attempted,
              COUNT(DISTINCT CASE WHEN s.status='accepted' THEN s.user_id END) accepted
         FROM submissions s WHERE s.mode='judge' AND s.problem_id LIKE 'lc-%'
          AND s.status NOT IN ${UNSETTLED}${andUnlisted()}
        GROUP BY s.problem_id HAVING attempted>=?`,
    )
    .all(MIN_PEOPLE) as { id: string; attempted: number; accepted: number }[];
  shares = {
    at: now,
    map: new Map(rows.map((r) => [r.id, r.accepted / r.attempted])),
    people: new Map(rows.map((r) => [r.id, r.accepted])),
  };
  return shares.map;
}
/** People who solved each LeetCode-bank problem, from the same query and floor as acceptanceIndex. */
export function acceptedPeople(now = Date.now()) {
  acceptanceIndex(now);
  return shares!.people;
}
