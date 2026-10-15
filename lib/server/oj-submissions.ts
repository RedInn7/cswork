import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { LANGUAGE_IDS, type Language } from '@/lib/problems';
import type { Person } from './auth';
import { HttpError, limit } from './http';
import { ensurePracticeRound, isSelectedProblem } from './practice-rounds';
import { getCompileProblem } from './oj-problems';
import { leetcodeContract, LEETCODE_HARNESS_VERSION } from './leetcode-mode';
import type { CodingMode } from '@/lib/coding-mode';
import type { OjProblemSpec } from '@/lib/oj-types';
import { boundedFeedback, FEEDBACK_BYTES } from './oj-case-store';
import { aiTask } from './ai-tasks';
import {
  PROJECT_MAX_BYTES,
  PROJECT_MAX_FILES,
  PROJECT_PATH,
  PROJECT_RUNS_PER_HOUR,
  projectProblemId,
  type ProjectReport,
} from '@/lib/ai-coding';

export const MAX_CODE_BYTES = 65536;
export const MAX_STDIN_BYTES = 65536;
export const ACTIVE = ['queued', 'compiling', 'running'];
export type SubmissionRow = {
  id: string;
  user_id: string;
  problem_id: string;
  problem_version_id: string | null;
  practice_round_id: string | null;
  language: Language;
  code: string;
  status: string;
  /**
   * playground: /playground runs, no problem, never in history or statistics. reference: the
   * editorial's code on a learner's custom case (createReferenceRun), never shown as theirs.
   * project: an AI-assisted round run (createProjectRun), unlisted like a playground run.
   * drill: an OA debugging drill, judged on every case like judge but unlisted: no points,
   * never solved, out of history and statistics (the learner started from a planted bug).
   * drill-run: a run inside a drill, judged like run but unlisted like drill; its detail reads 'run'.
   */
  mode: 'judge' | 'run' | 'playground' | 'reference' | 'project' | 'drill' | 'drill-run';
  coding_mode: CodingMode;
  harness_version: string | null;
  custom_input: string | null;
  request_hash: string | null;
  passed: number;
  total: number;
  runtime: number | null;
  memory: number | null;
  message: string | null;
  compile_output: string | null;
  score: number;
  attempt: number;
  cancel_requested: number;
  started_at: number | null;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
};
/** Judged on every case, hidden ones included, with a formal verdict: a submission or a drill. */
export const formalMode = (mode: string) => mode === 'judge' || mode === 'drill';
export function judgeReady() {
  if (process.env.OJ_ENABLED === 'true') return true;
  return Boolean(
    process.env.GO_JUDGE_URL &&
    process.env.GO_JUDGE_TOKEN &&
    process.env.REDIS_URL,
  );
}
const inputSchema = z
  .object({
    problemId: z.string().min(1).max(80),
    language: z.enum(LANGUAGE_IDS),
    code: z.string().min(1).max(MAX_CODE_BYTES),
    mode: z.enum(['judge', 'run', 'drill', 'drill-run']).default('judge'),
    codingMode: z.enum(['leetcode', 'acm']).default('acm'),
    stdin: z.string().max(MAX_STDIN_BYTES).optional(),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
  })
  .strict();
/** The problem id of /playground runs; no oj_problems row has it. */
export const PLAYGROUND_PROBLEM_ID = 'playground';
/** Fixed limits for playground runs (seconds, KiB), in the shape the engine reads. */
export const PLAYGROUND_SPEC = {
  id: PLAYGROUND_PROBLEM_ID,
  timeLimit: 3,
  memoryLimit: 262144,
  outputLimit: 64,
} as OjProblemSpec;
/** Per learner per hour, apart from problem runs and submissions. */
export const PLAYGROUND_RUNS_PER_HOUR = 30;
type Queued = Pick<
  SubmissionRow,
  | 'problem_id'
  | 'problem_version_id'
  | 'language'
  | 'code'
  | 'mode'
  | 'custom_input'
  | 'request_hash'
  | 'total'
  | 'practice_round_id'
  | 'coding_mode'
  | 'harness_version'
>;
/** The learner's earlier request under this idempotency key; another program under it is a 409. */
function priorRequest(userId: string, key: string, hash: string) {
  const row = sqlite()
    .prepare('SELECT * FROM submissions WHERE user_id=? AND idempotency_key=?')
    .get(userId, key) as SubmissionRow | undefined;
  if (row && row.request_hash !== hash)
    throw new HttpError(409, '此请求编号已经用于另一份代码，请重新提交');
  return row;
}
/**
 * Inside the caller's IMMEDIATE transaction: two in flight per learner, 128 in all. Reference
 * runs ride beside a custom run, so they have their own two and never block a submit.
 */
function admit(p: Person, reference = false) {
  const counts = sqlite()
    .prepare(
      "SELECT COUNT(*) as total,SUM(user_id=? AND (mode='reference')=?) as own FROM submissions WHERE status IN ('queued','compiling','running')",
    )
    .get(p.id, reference ? 1 : 0) as { total: number; own: number };
  if (counts.own >= 2)
    throw new HttpError(
      429,
      '你已有两份代码正在处理，请等待完成或取消后再提交',
    );
  if (counts.total >= 128)
    throw new HttpError(429, '判题队列已满，请稍后重试，代码草稿已保留');
}
/** Inside the same transaction, after admit: the row and its durable outbox entry. */
function enqueue(p: Person, key: string, row: Queued) {
  const db = sqlite();
  const id = randomUUID(),
    now = Date.now();
  db.prepare(
    'INSERT INTO submissions(id,user_id,problem_id,problem_version_id,language,code,status,mode,custom_input,idempotency_key,request_hash,total,created_at,updated_at,practice_round_id,coding_mode,harness_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    id,
    p.id,
    row.problem_id,
    row.problem_version_id,
    row.language,
    row.code,
    'queued',
    row.mode,
    row.custom_input,
    key,
    row.request_hash,
    row.total,
    now,
    now,
    row.practice_round_id,
    row.coding_mode,
    row.harness_version,
  );
  db.prepare(
    'INSERT INTO oj_outbox(submission_id,created_at) VALUES(?,?)',
  ).run(id, now);
  return { id, status: 'queued' };
}
const playgroundSchema = z
  .object({
    language: z.enum(['python', 'go', 'java', 'cpp']),
    code: z.string().min(1).max(MAX_CODE_BYTES),
    stdin: z.string().max(MAX_STDIN_BYTES).default(''),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
  })
  .strict();
/**
 * A /playground run: the learner's program on their stdin, compiled and run like a
 * custom-input run but with no problem behind it. mode 'playground' keeps it out of
 * history, the status board, statistics, streaks and progress (all read mode='judge').
 */
export async function createPlaygroundRun(p: Person, value: unknown) {
  const d = playgroundSchema.parse(value);
  if (
    Buffer.byteLength(d.code) > MAX_CODE_BYTES ||
    Buffer.byteLength(d.stdin) > MAX_STDIN_BYTES
  )
    throw new HttpError(413, '代码和自定义输入分别最多 64 KiB');
  if (d.code.includes('\0') || d.stdin.includes('\0'))
    throw new HttpError(400, '内容不能包含空字符');
  // Free compute, so the same gate as free problems: a verified address.
  if (p.role !== 'teacher' && !p.verified)
    throw new HttpError(403, '请先验证邮箱，再运行和提交代码');
  const hash = createHash('sha256')
    .update(JSON.stringify([PLAYGROUND_PROBLEM_ID, d.language, d.code, d.stdin]))
    .digest('hex');
  const prior = priorRequest(p.id, d.idempotencyKey, hash);
  if (prior) return { id: prior.id, status: prior.status };
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(p, 'oj-playground', PLAYGROUND_RUNS_PER_HOUR, 3600);
  const db = sqlite();
  return db.transaction(() => {
    const duplicate = priorRequest(p.id, d.idempotencyKey, hash);
    if (duplicate) return { id: duplicate.id, status: duplicate.status };
    admit(p);
    return enqueue(p, d.idempotencyKey, {
      problem_id: PLAYGROUND_PROBLEM_ID,
      problem_version_id: null,
      language: d.language,
      code: d.code,
      mode: 'playground',
      custom_input: d.stdin,
      request_hash: hash,
      total: 1,
      practice_round_id: null,
      coding_mode: 'acm',
      harness_version: null,
    });
  }).immediate();
}
const projectSchema = z
  .object({
    task: z.string().regex(/^[a-z0-9-]{1,60}$/),
    files: z.record(z.string().regex(PROJECT_PATH), z.string().max(PROJECT_MAX_BYTES)),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
  })
  .strict();
/** Over a project's limits (files, bytes in all): runs and the AI pair refuse it with a 413. */
export function projectTooLarge(files: Record<string, string>) {
  const texts = Object.values(files);
  return texts.length > PROJECT_MAX_FILES || texts.reduce((n, text) => n + Buffer.byteLength(text), 0) > PROJECT_MAX_BYTES;
}
/**
 * An AI-assisted round run (/ai-assisted/<task>): the learner's src/ and tests/ against the
 * task's public and hidden suites (lib/server/ai-tasks.ts). `code` holds the files as JSON
 * under their own size limit, not MAX_CODE_BYTES; there is no problem version. mode 'project'
 * keeps it out of history, the status board, statistics, points and the AI tutor's verdicts.
 */
export async function createProjectRun(p: Person, value: unknown) {
  const d = projectSchema.parse(value);
  const task = aiTask(d.task);
  if (!task) throw new HttpError(404, '练习任务不存在');
  const files = Object.entries(d.files).sort(([a], [b]) => (a < b ? -1 : 1));
  if (!files.length || projectTooLarge(d.files))
    throw new HttpError(413, '项目最多 30 个文件，合计 256 KiB');
  if (files.some(([, text]) => text.includes('\0')))
    throw new HttpError(400, '内容不能包含空字符');
  if (p.role !== 'teacher' && !p.verified)
    throw new HttpError(403, '请先验证邮箱，再运行和提交代码');
  const problemId = projectProblemId(task.slug);
  const code = JSON.stringify({ files: Object.fromEntries(files) });
  const hash = createHash('sha256').update(JSON.stringify([problemId, code])).digest('hex');
  const prior = priorRequest(p.id, d.idempotencyKey, hash);
  if (prior) return { id: prior.id, status: prior.status };
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(p, 'oj-project', PROJECT_RUNS_PER_HOUR, 3600);
  return sqlite().transaction(() => {
    const duplicate = priorRequest(p.id, d.idempotencyKey, hash);
    if (duplicate) return { id: duplicate.id, status: duplicate.status };
    admit(p);
    return enqueue(p, d.idempotencyKey, {
      problem_id: problemId,
      problem_version_id: null,
      language: 'python',
      code,
      mode: 'project',
      custom_input: null,
      request_hash: hash,
      // Both suites' sizes are known once they ran; the worker sets it.
      total: 0,
      practice_round_id: null,
      coding_mode: 'acm',
      harness_version: null,
    });
  }).immediate();
}
/** A finished project run's report (the worker's one result row), null before it has one. */
export function projectReport(row: { stdout: string | null; stderr: string | null } | undefined): ProjectReport | null {
  try {
    const value = JSON.parse(row?.stdout ?? 'null') as Omit<ProjectReport, 'output'> | null;
    return value && { visible: value.visible, hidden: value.hidden, output: row?.stderr ?? '' };
  } catch {
    return null;
  }
}
export async function createSubmission(p: Person, value: unknown) {
  const d = inputSchema.parse(value);
  // A drill's run is a run on the examples (or custom input), kept out of the history like the drill.
  const run = d.mode === 'run' || d.mode === 'drill-run';
  if (
    Buffer.byteLength(d.code) > MAX_CODE_BYTES ||
    (d.stdin !== undefined && Buffer.byteLength(d.stdin) > MAX_STDIN_BYTES)
  )
    throw new HttpError(413, '代码和自定义输入分别最多 64 KiB');
  if (d.code.includes('\0') || d.stdin?.includes('\0'))
    throw new HttpError(400, '内容不能包含空字符');
  if (!run && d.stdin !== undefined)
    throw new HttpError(400, '正式提交不能携带自定义输入');
  // Access, publication and OA readiness need only the spec. The worker loads and
  // integrity-checks the test data itself, so this request never reads hidden cases.
  const { versionId, spec } = await getCompileProblem(p, d.problemId);
  if (!spec.languages.includes(d.language))
    throw new HttpError(400, '此题未开放该语言');
  if (d.codingMode === 'leetcode' && !leetcodeContract(d.problemId))
    throw new HttpError(400, '此题未开放 LeetCode 模式');
  const hash = createHash('sha256')
    .update(
      JSON.stringify([
        d.problemId,
        d.language,
        d.code,
        d.mode,
        d.stdin ?? null,
        ...(d.codingMode === 'leetcode'
          ? [d.codingMode, LEETCODE_HARNESS_VERSION]
          : []),
      ]),
    )
    .digest('hex');
  const db = sqlite();
  const caseCount = (hidden: boolean) =>
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM oj_test_cases WHERE version_id=?${hidden ? '' : ' AND hidden=0'}`,
        )
        .get(versionId) as { n: number }
    ).n;
  if (!caseCount(true)) throw new HttpError(503, '题目测试数据尚未就绪');
  const existing = () => priorRequest(p.id, d.idempotencyKey, hash);
  const prior = existing();
  if (prior) return { id: prior.id, status: prior.status };
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(
    p,
    run ? 'oj-run' : 'oj-submit',
    run ? 12 : 6,
  );
  // Reserve the writer before reading duplicate/queue state. A deferred WAL
  // read transaction cannot safely upgrade while the judge is writing results.
  return db.transaction(() => {
    const duplicate = existing();
    if (duplicate) return { id: duplicate.id, status: duplicate.status };
    admit(p);
    const total =
      !run
        ? caseCount(true)
        : d.stdin !== undefined
          ? 1
          : caseCount(false);
    const practiceRoundId =
      d.mode === 'judge' && isSelectedProblem(d.problemId)
        ? ensurePracticeRound(p.id)
        : null;
    return enqueue(p, d.idempotencyKey, {
      problem_id: d.problemId,
      problem_version_id: versionId,
      language: d.language,
      code: d.code,
      mode: d.mode,
      custom_input: d.stdin ?? null,
      request_hash: hash,
      total,
      practice_round_id: practiceRoundId,
      coding_mode: d.codingMode,
      harness_version:
        d.codingMode === 'leetcode' ? LEETCODE_HARNESS_VERSION : null,
    });
  }).immediate();
}
const referenceSchema = z
  .object({
    stdin: z.string().max(MAX_STDIN_BYTES),
    // The custom case's format: LeetCode's JSON lines, or the ACM test-file stdin.
    codingMode: z.enum(['leetcode', 'acm']).default('leetcode'),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
  })
  .strict();
/**
 * The expected output of a learner's custom case: `code` (the verified editorial's best
 * Python approach, a LeetCode Solution class) runs on it as mode 'reference'. The same case
 * reuses its earlier run; the caller checks the editorial and any running contest.
 */
export async function createReferenceRun(p: Person, problemId: string, value: unknown, code: string) {
  const d = referenceSchema.parse(value);
  if (Buffer.byteLength(d.stdin) > MAX_STDIN_BYTES)
    throw new HttpError(413, '代码和自定义输入分别最多 64 KiB');
  if (d.stdin.includes('\0')) throw new HttpError(400, '内容不能包含空字符');
  if (p.role !== 'teacher' && !p.verified)
    throw new HttpError(403, '请先验证邮箱，再运行和提交代码');
  const { versionId, spec } = await getCompileProblem(p, problemId);
  if (!spec.languages.includes('python') || !leetcodeContract(problemId))
    throw new HttpError(404, '这道题没有可用的参考解');
  const hash = createHash('sha256')
    .update(JSON.stringify(['reference', versionId, d.codingMode, d.stdin, code, LEETCODE_HARNESS_VERSION]))
    .digest('hex');
  const db = sqlite();
  const reuse = () =>
    db
      .prepare(
        "SELECT id,status FROM submissions WHERE user_id=? AND mode='reference' AND request_hash=? AND status NOT IN ('cancelled','system_error') ORDER BY created_at DESC LIMIT 1",
      )
      .get(p.id, hash) as { id: string; status: string } | undefined;
  const prior = reuse() ?? priorRequest(p.id, d.idempotencyKey, hash);
  if (prior) return { id: prior.id, status: prior.status };
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(p, 'oj-expected', 60, 3600);
  return db.transaction(() => {
    const duplicate = reuse() ?? priorRequest(p.id, d.idempotencyKey, hash);
    if (duplicate) return { id: duplicate.id, status: duplicate.status };
    admit(p, true);
    return enqueue(p, d.idempotencyKey, {
      problem_id: problemId,
      problem_version_id: versionId,
      language: 'python',
      code,
      mode: 'reference',
      custom_input: d.stdin,
      request_hash: hash,
      total: 1,
      practice_round_id: null,
      // The worker always wraps a reference as LeetCode; this keeps the case's input format.
      coding_mode: d.codingMode,
      harness_version: LEETCODE_HARNESS_VERSION,
    });
  }).immediate();
}
export function submissionRow(id: string) {
  return sqlite().prepare('SELECT * FROM submissions WHERE id=?').get(id) as
    | SubmissionRow
    | undefined;
}
function owned(p: Person, id: string) {
  const s = submissionRow(id);
  if (!s || (s.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '提交不存在');
  return s;
}
function summary(s: SubmissionRow, roundNumbers?: Map<string, number>) {
  return {
    id: s.id,
    problem_id: s.problem_id,
    language: s.language,
    // ponytail: the learner's page shows a drill's run as a run; only the stored mode keeps it unlisted.
    mode: s.mode === 'drill-run' ? 'run' : s.mode,
    codingMode: s.coding_mode || 'acm',
    status: s.status,
    passed: s.passed,
    total: s.total,
    runtime: s.runtime,
    memory: s.memory,
    runtimeMs: s.runtime == null ? null : s.runtime * 1000,
    memoryKb: s.memory,
    score: s.score,
    created_at: s.created_at,
    startedAt: s.started_at,
    finishedAt: s.finished_at,
    message: s.message,
    attempt: s.attempt,
    problemVersion: s.problem_version_id,
    practiceRoundId: s.practice_round_id,
    practiceRoundNumber: s.practice_round_id
      ? (roundNumbers?.get(s.practice_round_id) ??
        (
          sqlite()
            .prepare(
              'SELECT number FROM practice_rounds WHERE id=? AND user_id=?',
            )
            .get(s.practice_round_id, s.user_id) as
            | { number: number }
            | undefined
        )?.number ??
        null)
      : null,
  };
}
// Only public state participates: no source code, test inputs or hidden outputs.
function watchToken(
  s: Pick<
    SubmissionRow,
    | 'status'
    | 'passed'
    | 'total'
    | 'attempt'
    | 'cancel_requested'
    | 'updated_at'
  >,
) {
  return [
    s.status,
    s.passed,
    s.total,
    s.attempt,
    s.cancel_requested,
    s.updated_at,
  ].join(':');
}
const waitingByUser = new Map<string, number>();
// Bounded connection-independent history also coalesces tokens that became stale
// while a response was in flight. It contains no submission content.
const lastWatchReply = new Map<string, { status: string; at: number }>();
/** Detail sent to the browser; its time paces the next non-final reply. */
async function reply(p: Person, id: string) {
  const detail = await submissionDetail(p, id);
  const key = `${p.id}:${id}`;
  lastWatchReply.delete(key);
  lastWatchReply.set(key, { status: detail.status, at: performance.now() });
  if (lastWatchReply.size > 1024)
    lastWatchReply.delete(lastWatchReply.keys().next().value!);
  return detail;
}
const stateQuery = () =>
  sqlite().prepare(
    'SELECT user_id,status,passed,total,attempt,cancel_requested,updated_at FROM submissions WHERE id=?',
  );
// One primary-key read per tick; a verdict shows up at most a tick late.
const TICK_MS = 25;
/**
 * A fresh submit holds its response briefly so a fast verdict reaches the
 * browser in the POST reply: one network round trip instead of a POST plus
 * watch requests. Slower judgements return their current state and are watched.
 */
export const SUBMIT_HOLD_MS = 2_500;
// An idle judge claims a submission within tens of ms. One still queued after
// this is waiting for a slot: reply at once, so the learner sees its queue
// position and can cancel.
const QUEUED_HOLD_MS = 300;
/** A precompile of exactly this program exists: the judge adopts it while still 'queued'. */
function precompiling(id: string) {
  return Boolean(
    sqlite()
      .prepare(
        "SELECT 1 FROM submissions s JOIN oj_precompile p ON p.user_id=s.user_id AND p.problem_version_id IS s.problem_version_id AND p.language=s.language AND p.coding_mode=COALESCE(s.coding_mode,'acm') AND p.code=s.code WHERE s.id=?",
      )
      .get(id),
  );
}
export async function settleSubmission(
  p: Person,
  id: string,
  signal: AbortSignal,
  holdMs = SUBMIT_HOLD_MS,
) {
  // Owner-checked by the caller's create; at most two in flight per learner.
  const query = stateQuery();
  let adopting: boolean | undefined;
  const started = performance.now();
  const deadline = started + holdMs;
  while (performance.now() < deadline) {
    const current = query.get(id) as SubmissionRow | undefined;
    if (!current || !ACTIVE.includes(current.status)) break;
    if (
      current.status === 'queued' &&
      performance.now() - started >= QUEUED_HOLD_MS &&
      !(adopting ??= precompiling(id))
    )
      break;
    await delay(
      Math.min(TICK_MS, Math.max(1, deadline - performance.now())),
      undefined,
      { signal },
    );
  }
  signal.throwIfAborted();
  return reply(p, id);
}
export async function waitForSubmission(
  p: Person,
  id: string,
  after: string,
  signal: AbortSignal,
  timeoutMs = 3_000,
) {
  signal.throwIfAborted();
  // Authorize before retaining a connection or reading any progress.
  const initial = owned(p, id);
  const previous = lastWatchReply.get(`${p.id}:${id}`);
  const started = performance.now();
  // Final verdicts return at once. Any other change, status steps included, is
  // sent at most every 500ms: each one costs the browser a full round trip.
  const progressAfter = previous ? previous.at + 500 : started + 500;
  if (
    !ACTIVE.includes(initial.status) ||
    (watchToken(initial) !== after &&
      (!previous || started >= progressAfter))
  )
    return reply(p, id);
  const waiting = waitingByUser.get(p.id) ?? 0;
  if (waiting >= 2) throw new HttpError(429, '等待中的请求过多，请稍后重试');
  waitingByUser.set(p.id, waiting + 1);
  // Vinext's current Node bridge does not propagate socket disconnects into
  // Request.signal. Keep a short hard bound even when abort is unavailable.
  const deadline = performance.now() + Math.min(3_000, Math.max(0, timeoutMs));
  // Fetch only state on each tick; full cases are materialized once on return.
  const query = stateQuery();
  try {
    while (performance.now() < deadline) {
      await delay(
        Math.min(TICK_MS, Math.max(1, deadline - performance.now())),
        undefined,
        { signal },
      );
      const current = query.get(id) as SubmissionRow | undefined;
      if (!current || (current.user_id !== p.id && p.role !== 'teacher'))
        throw new HttpError(404, '提交不存在');
      if (
        !ACTIVE.includes(current.status) ||
        (watchToken(current) !== after && performance.now() >= progressAfter)
      )
        break;
    }
    signal.throwIfAborted();
    return reply(p, id);
  } finally {
    const remaining = (waitingByUser.get(p.id) ?? 1) - 1;
    if (remaining) waitingByUser.set(p.id, remaining);
    else waitingByUser.delete(p.id);
  }
}
export async function submissionDetail(p: Person, id: string) {
  const s = owned(p, id);
  const snapshot = s.problem_version_id
    ? (sqlite()
        .prepare('SELECT revision FROM oj_problem_versions WHERE id=?')
        .get(s.problem_version_id) as { revision: number } | undefined)
    : undefined;
  const definitions =
    !formalMode(s.mode) && s.custom_input !== null
      ? [
          {
            ordinal: 0,
            input: s.custom_input,
            expectedOutput: undefined,
            hidden: false,
          },
        ]
      : (
          sqlite()
            .prepare(
              "SELECT ordinal,hidden,CASE WHEN hidden=0 THEN input ELSE NULL END as input,CASE WHEN hidden=0 THEN expected_output ELSE NULL END as expectedOutput FROM oj_test_cases WHERE version_id=? AND (?='judge' OR hidden=0) ORDER BY ordinal",
            )
            .all(s.problem_version_id, formalMode(s.mode) ? 'judge' : s.mode) as {
            ordinal: number;
            hidden: number;
            input: string | null;
            expectedOutput: string | null;
          }[]
        ).map((c) => ({
          ...c,
          hidden: Boolean(c.hidden),
          input: c.input ?? undefined,
          expectedOutput: c.expectedOutput ?? undefined,
        }));
  const results = sqlite()
    .prepare('SELECT * FROM oj_results WHERE submission_id=? ORDER BY ordinal')
    .all(id) as {
    ordinal: number;
    status: string;
    runtime_ms: number;
    memory_kb: number;
    stdout: string | null;
    stderr: string | null;
    hidden: number;
  }[];
  const cases = definitions.map((c) => {
    const r = results.find((r) => r.ordinal === c.ordinal);
    return {
      ordinal: c.ordinal,
      hidden: c.hidden,
      status: r?.status ?? (ACTIVE.includes(s.status) ? 'pending' : 'skipped'),
      runtimeMs: r?.runtime_ms ?? null,
      memoryKb: r?.memory_kb ?? null,
      // Never expose hidden inputs, expected answers, stdout or stderr, including to teacher previews.
      ...(!c.hidden
        ? {
            stdin: c.input,
            expected: c.expectedOutput,
            stdout: r?.stdout ?? '',
            // A reference traceback would quote the editorial's code.
            stderr: s.mode === 'reference' ? '' : (r?.stderr ?? ''),
          }
        : {}),
    };
  });
  const failed =
    formalMode(s.mode) &&
    !ACTIVE.includes(s.status) &&
    [
      'wrong_answer',
      'time_limit',
      'memory_limit',
      'output_limit',
      'runtime_error',
    ].includes(s.status)
      ? results.find((r) => r.status !== 'accepted' && r.status !== 'finished')
      : undefined;
  let firstFailure;
  // While the problem is in the owner's running contest or skill exam, a hidden case stays
  // home: one counterexample per submission would hand over the hidden tests the exam scores.
  // The verdict and passed/total still show. Imported lazily: the judge worker bundle stays free of contests.
  const sealed =
    failed &&
    definitions.find((c) => c.ordinal === failed.ordinal)?.hidden !== false &&
    (await import('./contests')).inRunningContest(s.user_id, s.problem_id);
  // Old hidden results have no captured output. Do not invent a counterexample
  // for those rows, or reveal any additional cases in the version snapshot.
  if (failed && !sealed && failed.status === s.status && failed.stdout !== null) {
    const definition = sqlite()
      .prepare(
        'SELECT substr(input,1,?) AS input,substr(expected_output,1,?) AS expected_output FROM oj_test_cases WHERE version_id=? AND ordinal=?',
      )
      // Bound data crossing into JS before applying the exact UTF-8 byte cap.
      .get(
        FEEDBACK_BYTES + 1,
        FEEDBACK_BYTES + 1,
        s.problem_version_id,
        failed.ordinal,
      ) as { input: string; expected_output: string | null } | undefined;
    if (definition) {
      const stdin = boundedFeedback(definition.input),
        expected = boundedFeedback(definition.expected_output ?? ''),
        stdout = boundedFeedback(failed.stdout),
        stderr = boundedFeedback(failed.stderr ?? '');
      firstFailure = {
        ordinal: failed.ordinal,
        status: failed.status,
        stdin: stdin.text,
        expected: expected.text,
        stdout: stdout.text,
        stderr: stderr.text,
        truncated: {
          stdin: stdin.truncated,
          expected: expected.truncated,
          stdout: stdout.truncated,
          stderr: stderr.truncated,
        },
      };
    }
  }
  const position =
    s.status === 'queued'
      ? (
          sqlite()
            .prepare(
              "SELECT COUNT(*) as n FROM submissions WHERE status='queued' AND (created_at<? OR (created_at=? AND id<=?))",
            )
            .get(s.created_at, s.created_at, s.id) as { n: number }
        ).n
      : undefined;
  return {
    ...summary(s),
    watchToken: watchToken(s),
    code: s.mode === 'reference' ? undefined : s.code,
    cases,
    firstFailure,
    compileOutput: s.mode === 'reference' ? '' : (s.compile_output ?? ''),
    queuedPosition: position,
    cancelRequested: Boolean(s.cancel_requested),
    problemVersion: snapshot ? `v${snapshot.revision}` : undefined,
    // A project run has no cases: its one result row holds the suites' report.
    project: s.mode === 'project' ? projectReport(results[0]) : undefined,
  };
}
/** Never the learner's own attempts: /playground, editorial reference runs, ai-assisted projects, OA drills and their runs. */
const UNLISTED_MODES = "('playground','reference','project','drill','drill-run')";
export function submissionHistory(
  p: Person,
  problemId: string | null,
  cursor: string | null,
) {
  let before: { time: number; id: string } | null = null;
  if (cursor) {
    try {
      before = z
        .object({
          time: z.number().int().nonnegative(),
          id: z.string().uuid(),
        })
        .parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
    } catch {
      throw new HttpError(400, '分页游标无效');
    }
  }
  const filters = ['user_id=?', `mode NOT IN ${UNLISTED_MODES}`];
  const params: (string | number)[] = [p.id];
  if (problemId) {
    filters.push('problem_id=?');
    params.push(problemId);
  }
  if (before) {
    filters.push('(created_at<? OR (created_at=? AND id<?))');
    params.push(before.time, before.time, before.id);
  }
  const found = sqlite()
    .prepare(
      `SELECT * FROM submissions WHERE ${filters.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT 21`,
    )
    .all(...params) as SubmissionRow[];
  const items = found.slice(0, 20);
  const last = items.at(-1);
  const roundNumbers = new Map(
    (
      sqlite()
        .prepare('SELECT id,number FROM practice_rounds WHERE user_id=?')
        .all(p.id) as { id: string; number: number }[]
    ).map((r) => [r.id, r.number]),
  );
  return {
    items: items.map((s) => summary(s, roundNumbers)),
    nextCursor:
      found.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ time: last.created_at, id: last.id }),
          ).toString('base64url')
        : null,
  };
}
/** Formal verdicts that failed on the learner's code, within the practice round when given; up to `cap` ids. */
export function failedJudgeIds(userId: string, problemId: string, roundId?: string, cap = 2) {
  return (
    sqlite()
      .prepare(
        `SELECT id FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status IN ('wrong_answer','compile_error','time_limit','memory_limit','output_limit','runtime_error')${roundId ? ' AND practice_round_id=?' : ''} LIMIT ?`,
      )
      .all(userId, problemId, ...(roundId ? [roundId] : []), cap) as { id: string }[]
  ).map((row) => row.id);
}
export const hintEarned = (userId: string, problemId: string, roundId?: string) =>
  failedJudgeIds(userId, problemId, roundId, 1).length > 0;
export function cancelSubmission(p: Person, id: string) {
  owned(p, id);
  sqlite()
    .prepare(
      "UPDATE submissions SET cancel_requested=1,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,finished_at=CASE WHEN status='queued' THEN ? ELSE finished_at END,updated_at=? WHERE id=? AND status IN ('queued','compiling','running')",
    )
    .run(Date.now(), Date.now(), id);
  return submissionDetail(p, id);
}
export function ojStatus() {
  const r = sqlite()
    .prepare("SELECT * FROM oj_runtime WHERE id='worker'")
    .get() as
    | { heartbeat_at: number; healthy: number; details: string }
    | undefined;
  const counts = sqlite()
    .prepare(
      "SELECT SUM(status='queued') as queued,SUM(status IN ('compiling','running')) as active FROM submissions WHERE status IN ('queued','compiling','running')",
    )
    .get() as { queued: number; active: number };
  return {
    configured: judgeReady(),
    available: Boolean(
      judgeReady() && r?.healthy && Date.now() - r.heartbeat_at < 30000,
    ),
    queued: counts.queued || 0,
    active: counts.active || 0,
    maxCodeBytes: MAX_CODE_BYTES,
    maxStdinBytes: MAX_STDIN_BYTES,
    languageVersions: r
      ? ((
          JSON.parse(r.details) as {
            languageVersions?: Record<string, string>;
          }
        ).languageVersions ?? {})
      : {},
  };
}
