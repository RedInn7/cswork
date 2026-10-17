import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { MAX_SOLVE_SECONDS, type PracticeHistoryItem, type ReviewGrade } from '@/lib/practice-review';
import { firstMismatch } from '@/lib/stress-gen';
import type { Person } from './auth';
import { refuseInContest } from './contests';
import { body, HttpError, json, limit } from './http';
import { ACTIVE, ownCases, type SubmissionRow } from './oj-submissions';

/**
 * The assisted-solve record (db/practice-aids-schema.ts). hint, ai and editorial keep their first
 * time only: one before the problem's first AC makes that solve assisted, one after it is inert.
 * time is the problem timer's seconds at the first AC. whiteboard is the first whiteboard-mode
 * submission (value 1 accepted, 0 failed); brute, a stress test that agreed before the first AC.
 * Returns whether a row was written.
 */
export function recordAid(
  userId: string,
  problemId: string,
  kind: 'hint' | 'ai' | 'editorial' | 'time' | 'whiteboard' | 'brute',
  value = 0,
) {
  return (
    sqlite()
      .prepare('INSERT OR IGNORE INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES(?,?,?,?,?)')
      .run(userId, problemId, kind, value, Date.now()).changes > 0
  );
}

/**
 * problem id -> the help used before its first AC (any while unsolved), the first AC's timed
 * seconds, the first whiteboard attempt (1 passed, 0 failed) and a stress test agreeing before AC.
 */
export function aidsByProblem(userId: string) {
  const rows = sqlite()
    .prepare(
      `SELECT a.problem_id AS id,MAX(a.kind IN ('ai','editorial')) AS solution,MAX(a.kind='hint') AS hint,
        MAX(CASE WHEN a.kind='time' THEN a.value END) AS seconds,
        MAX(CASE WHEN a.kind='whiteboard' THEN a.value END) AS whiteboard,MAX(a.kind='brute') AS brute
      FROM practice_aids a
      WHERE a.user_id=? AND a.kind NOT LIKE 'grade:%' AND (a.kind IN ('time','whiteboard','brute') OR NOT EXISTS (
        SELECT 1 FROM submissions s WHERE s.user_id=a.user_id AND s.problem_id=a.problem_id
          AND s.mode='judge' AND s.status='accepted' AND s.created_at<=a.created_at))
      GROUP BY a.problem_id`,
    )
    .all(userId) as {
    id: string;
    solution: number;
    hint: number;
    seconds: number | null;
    whiteboard: 0 | 1 | null;
    brute: number;
  }[];
  return new Map(
    rows.map((r) => [
      r.id,
      {
        help: (r.solution ? 'solution' : r.hint ? 'hint' : 'none') as PracticeHistoryItem['help'],
        solveSeconds: r.seconds,
        whiteboard: r.whiteboard,
        brute: !!r.brute,
      },
    ]),
  );
}

/** problem id -> its review self-grades, [the graded AC's time, grade] (lib/practice-review.ts replays them). */
export function gradesByProblem(userId: string) {
  const rows = sqlite()
    .prepare(
      `SELECT a.problem_id AS id,s.created_at AS at,a.value AS grade FROM practice_aids a
      JOIN submissions s ON s.id=substr(a.kind,7) AND s.user_id=a.user_id
      WHERE a.user_id=? AND a.kind LIKE 'grade:%'`,
    )
    .all(userId) as { id: string; at: number; grade: ReviewGrade }[];
  const grades = new Map<string, [number, ReviewGrade][]>();
  for (const r of rows) {
    const list = grades.get(r.id);
    if (list) list.push([r.at, r.grade]);
    else grades.set(r.id, [[r.at, r.grade]]);
  }
  return grades;
}

const id = z.uuid();
const event = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hint') }).strict(),
  z.object({ kind: z.literal('time'), seconds: z.number().int().min(1).max(MAX_SOLVE_SECONDS) }).strict(),
  z.object({ kind: z.literal('whiteboard'), submissionId: id }).strict(),
  z.object({ kind: z.literal('brute'), submissionId: id, referenceId: id }).strict(),
  z.object({ kind: z.literal('grade'), grade: z.number().int().min(1).max(4), submissionId: id }).strict(),
]);
// The verdicts a whiteboard attempt fails on; a judge fault or a cancel is no attempt.
const FAILED = ['wrong_answer', 'compile_error', 'time_limit', 'memory_limit', 'output_limit', 'runtime_error'];

/** Both sides of one stress test finished and every case agreed, as components/stress-result.tsx shows it. */
function stressAgreed(userId: string, problemId: string, mineId: string, referenceId: string) {
  const db = sqlite();
  type Row = Pick<SubmissionRow, 'mode' | 'status' | 'custom_input' | 'problem_version_id' | 'problem_id'>;
  const row = (sid: string) =>
    db
      .prepare('SELECT mode,status,custom_input,problem_version_id,problem_id FROM submissions WHERE id=? AND user_id=? AND problem_id=?')
      .get(sid, userId, problemId) as Row | undefined;
  const mine = row(mineId);
  const reference = row(referenceId);
  // Same cases (one seed), or the comparison would mean nothing.
  if (mine?.mode !== 'stress' || reference?.mode !== 'stress-ref' || mine.custom_input !== reference.custom_input)
    throw new HttpError(404, '提交不存在');
  if (ACTIVE.includes(mine.status) || ACTIVE.includes(reference.status)) throw new HttpError(409, '还在判题，判完后再记录');
  if (reference.status !== 'finished') return false;
  const spec = db.prepare('SELECT spec_json FROM oj_problem_versions WHERE id=?').pluck().get(reference.problem_version_id) as
    | string
    | undefined;
  const cases = (sid: string) => {
    const results = new Map(
      (
        db.prepare('SELECT ordinal,status,stdout FROM oj_results WHERE submission_id=?').all(sid) as {
          ordinal: number;
          status: string;
          stdout: string | null;
        }[]
      ).map((r) => [r.ordinal, { status: r.status, stdout: r.stdout ?? '' }]),
    );
    return ownCases(reference).map((_, i) => results.get(i) ?? { status: 'skipped', stdout: '' });
  };
  const references = cases(referenceId);
  return (
    references.length > 0 &&
    references.every((r) => r.status === 'finished') &&
    firstMismatch(cases(mineId), references, (spec && (JSON.parse(spec) as { checker?: string }).checker) || 'exact') < 0
  );
}

/**
 * POST oj/problems/<id>/aids: a hint past the first opened (components/hint-ladder.tsx), the
 * problem timer's seconds at an AC, a whiteboard submission's outcome (components/whiteboard-mode.tsx,
 * the learner's latest formal submission once judged) or a stress test that agreed before the
 * first AC (components/stress-result.tsx), or a review AC's self-grade (components/review-grade.tsx,
 * closed in a running contest or exam). The editorial and the AI tutor are recorded where the
 * server hands them out. Each only shapes the learner's own record.
 */
export async function handlePracticeAids(request: Request, p: Person, problemId: string): Promise<Response> {
  await limit(p, 'practice-aids-write', 30);
  const data = event.parse(await body(request));
  const db = sqlite();
  if (data.kind === 'grade') {
    refuseInContest(p, problemId);
    // A review's AC only: the learner's own formal AC on this problem, with an earlier AC before it.
    const review = db
      .prepare(
        `SELECT 1 FROM submissions s WHERE s.id=? AND s.user_id=? AND s.problem_id=? AND s.mode='judge' AND s.status='accepted'
        AND EXISTS (SELECT 1 FROM submissions e WHERE e.user_id=s.user_id AND e.problem_id=s.problem_id
          AND e.mode='judge' AND e.status='accepted' AND e.created_at<s.created_at)`,
      )
      .get(data.submissionId, p.id, problemId);
    if (!review) throw new HttpError(404, '提交不存在');
    // Grading again replaces the grade (recordAid keeps the first).
    db.prepare('INSERT OR REPLACE INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES(?,?,?,?,?)').run(
      p.id,
      problemId,
      `grade:${data.submissionId}`,
      data.grade,
      Date.now(),
    );
    return json({ recorded: true });
  }
  if (data.kind === 'time') {
    // The first AC's time only: a review's AC would time a re-solve, and INSERT OR IGNORE cannot tell.
    const acs = db
      .prepare("SELECT COUNT(*) FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted'")
      .pluck()
      .get(p.id, problemId);
    return json({ recorded: acs === 1 && recordAid(p.id, problemId, 'time', data.seconds) });
  }
  if (data.kind === 'whiteboard') {
    // The latest formal submission only: any older one would let a past AC pass for a whiteboard.
    const last = db
      .prepare(
        "SELECT id,status FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' ORDER BY created_at DESC,id DESC LIMIT 1",
      )
      .get(p.id, problemId) as { id: string; status: string } | undefined;
    if (last?.id !== data.submissionId) throw new HttpError(404, '提交不存在');
    if (ACTIVE.includes(last.status)) throw new HttpError(409, '还在判题，判完后再记录');
    const passed = last.status === 'accepted';
    if (!passed && !FAILED.includes(last.status)) return json({ recorded: false });
    return json({ recorded: recordAid(p.id, problemId, 'whiteboard', passed ? 1 : 0) });
  }
  if (data.kind === 'brute') {
    const agreed = stressAgreed(p.id, problemId, data.submissionId, data.referenceId);
    const solved = db
      .prepare("SELECT 1 FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted'")
      .get(p.id, problemId);
    return json({ recorded: agreed && !solved && recordAid(p.id, problemId, 'brute') });
  }
  // A real problem, or any id would grow the table.
  if (!db.prepare('SELECT 1 FROM oj_problems WHERE id=? AND published=1').get(problemId))
    throw new HttpError(404, '题目不存在或尚未发布');
  return json({ recorded: recordAid(p.id, problemId, 'hint') });
}
