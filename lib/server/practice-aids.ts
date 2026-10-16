import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { MAX_SOLVE_SECONDS, type PracticeHistoryItem } from '@/lib/practice-review';
import type { Person } from './auth';
import { body, HttpError, json, limit } from './http';

/**
 * The assisted-solve record (db/practice-aids-schema.ts). hint, ai and editorial keep their first
 * time only: one before the problem's first AC makes that solve assisted, one after it is inert.
 * time is the problem timer's seconds at the first AC. Returns whether a row was written.
 */
export function recordAid(userId: string, problemId: string, kind: 'hint' | 'ai' | 'editorial' | 'time', value = 0) {
  return (
    sqlite()
      .prepare('INSERT OR IGNORE INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES(?,?,?,?,?)')
      .run(userId, problemId, kind, value, Date.now()).changes > 0
  );
}

/** problem id -> the help used before its first AC (any while unsolved) and the first AC's timed seconds. */
export function aidsByProblem(userId: string) {
  const rows = sqlite()
    .prepare(
      `SELECT a.problem_id AS id,MAX(a.kind IN ('ai','editorial')) AS solution,MAX(a.kind='hint') AS hint,
        MAX(CASE WHEN a.kind='time' THEN a.value END) AS seconds
      FROM practice_aids a
      WHERE a.user_id=? AND (a.kind='time' OR NOT EXISTS (
        SELECT 1 FROM submissions s WHERE s.user_id=a.user_id AND s.problem_id=a.problem_id
          AND s.mode='judge' AND s.status='accepted' AND s.created_at<=a.created_at))
      GROUP BY a.problem_id`,
    )
    .all(userId) as { id: string; solution: number; hint: number; seconds: number | null }[];
  return new Map(
    rows.map((r) => [
      r.id,
      {
        help: (r.solution ? 'solution' : r.hint ? 'hint' : 'none') as PracticeHistoryItem['help'],
        solveSeconds: r.seconds,
      },
    ]),
  );
}

const event = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hint') }).strict(),
  z.object({ kind: z.literal('time'), seconds: z.number().int().min(1).max(MAX_SOLVE_SECONDS) }).strict(),
]);

/**
 * POST oj/problems/<id>/aids: a hint past the first opened (components/hint-ladder.tsx), or the
 * problem timer's seconds at an AC (components/problem-workspace.tsx). The editorial and the AI
 * tutor are recorded where the server hands them out. Either only shapes the learner's own record.
 */
export async function handlePracticeAids(request: Request, p: Person, problemId: string): Promise<Response> {
  await limit(p, 'practice-aids-write', 30);
  const data = event.parse(await body(request));
  const db = sqlite();
  if (data.kind === 'time') {
    // The first AC's time only: a review's AC would time a re-solve, and INSERT OR IGNORE cannot tell.
    const acs = db
      .prepare("SELECT COUNT(*) FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted'")
      .pluck()
      .get(p.id, problemId);
    return json({ recorded: acs === 1 && recordAid(p.id, problemId, 'time', data.seconds) });
  }
  // A real problem, or any id would grow the table.
  if (!db.prepare('SELECT 1 FROM oj_problems WHERE id=? AND published=1').get(problemId))
    throw new HttpError(404, '题目不存在或尚未发布');
  return json({ recorded: recordAid(p.id, problemId, 'hint') });
}
