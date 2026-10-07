import { sqlite } from '@/db/sqlite';
import { curatedEntries } from '@/lib/ling-curated';

type Progress = {
  solved: boolean;
  solvedLocally: boolean;
  attempted: boolean;
  pending: boolean;
  importedSources: ('cn' | 'us')[];
};

/** External history is a separate source, never a fabricated judge verdict. */
export function studyProgress(userId: string, roundId: string | null) {
  const db = sqlite();
  const result = new Map<string, Progress>();
  const local = db
    .prepare(`SELECT l.id,
    MAX(s.status='accepted') AS solved,
    MAX(s.status IN ('pending','submitting','queued','compiling','running','judging','processing')) AS pending
    FROM submissions s JOIN study_library l ON l.judge_problem_id=s.problem_id
    WHERE s.user_id=? AND s.practice_round_id IS ? AND s.mode='judge'
    GROUP BY l.id`)
    .all(userId, roundId) as { id: string; solved: number; pending: number }[];
  for (const row of local)
    result.set(row.id, {
      solved: Boolean(row.solved),
      solvedLocally: Boolean(row.solved),
      attempted: true,
      pending: Boolean(row.pending),
      importedSources: [],
    });
  if (roundId) {
    const external = db
      .prepare(`SELECT DISTINCT l.id,e.region
      FROM leetcode_round_records rr
      JOIN practice_rounds pr ON pr.id=rr.round_id AND pr.user_id=rr.user_id
      JOIN leetcode_accepted_records e ON e.id=rr.record_id AND e.user_id=rr.user_id
      JOIN study_library l ON l.slug=e.slug
      WHERE rr.user_id=? AND rr.round_id=? ORDER BY e.region`)
      .all(userId, roundId) as { id: string; region: 'cn' | 'us' }[];
    for (const row of external) {
      const prior: Progress = result.get(row.id) ?? {
        solved: false,
        solvedLocally: false,
        attempted: false,
        pending: false,
        importedSources: [],
      };
      prior.solved = true;
      prior.importedSources.push(row.region);
      result.set(row.id, prior);
    }
  }
  return result;
}

/** One grouped query for all rounds; counts a problem once across both regions/local AC. */
export function practiceRoundTotals(userId: string) {
  const rows = sqlite()
    .prepare(`WITH completed AS (
      SELECT s.practice_round_id AS round_id,l.id,l.number
      FROM submissions s JOIN study_library l ON l.judge_problem_id=s.problem_id
      JOIN practice_rounds pr ON pr.id=s.practice_round_id AND pr.user_id=s.user_id
      WHERE s.user_id=? AND s.mode='judge' AND s.status='accepted'
      UNION
      SELECT rr.round_id,l.id,l.number FROM leetcode_round_records rr
      JOIN practice_rounds pr ON pr.id=rr.round_id AND pr.user_id=rr.user_id
      JOIN leetcode_accepted_records e ON e.id=rr.record_id AND e.user_id=rr.user_id
      JOIN study_library l ON l.slug=e.slug WHERE rr.user_id=?
    ) SELECT round_id,COUNT(DISTINCT id) AS solved FROM completed
      WHERE number IN (SELECT value FROM json_each(?)) GROUP BY round_id`)
    .all(
      userId,
      userId,
      JSON.stringify(curatedEntries.map((entry) => entry.number)),
    ) as { round_id: string; solved: number }[];
  return new Map(rows.map((row) => [row.round_id, row.solved]));
}
