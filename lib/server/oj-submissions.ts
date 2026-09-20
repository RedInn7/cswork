import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Language } from '@/lib/problems';
import type { Person } from './auth';
import { HttpError, limit } from './http';
import { ensurePracticeRound, isSelectedProblem } from './practice-rounds';
import { getJudgeProblem } from './oj-problems';
import { leetcodeContract, LEETCODE_HARNESS_VERSION } from './leetcode-mode';
import type { CodingMode } from '@/lib/coding-mode';
import { boundedFeedback, FEEDBACK_BYTES } from './oj-case-store';

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
  mode: 'judge' | 'run';
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
    language: z.enum(['python', 'go', 'java', 'cpp']),
    code: z.string().min(1).max(MAX_CODE_BYTES),
    mode: z.enum(['judge', 'run']).default('judge'),
    codingMode: z.enum(['leetcode', 'acm']).default('acm'),
    stdin: z.string().max(MAX_STDIN_BYTES).optional(),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
  })
  .strict();
export async function createSubmission(p: Person, value: unknown) {
  const d = inputSchema.parse(value);
  if (
    Buffer.byteLength(d.code) > MAX_CODE_BYTES ||
    (d.stdin !== undefined && Buffer.byteLength(d.stdin) > MAX_STDIN_BYTES)
  )
    throw new HttpError(413, '代码和自定义输入分别最多 64 KiB');
  if (d.code.includes('\0') || d.stdin?.includes('\0'))
    throw new HttpError(400, '内容不能包含空字符');
  if (d.mode === 'judge' && d.stdin !== undefined)
    throw new HttpError(400, '正式提交不能携带自定义输入');
  const snapshot = await getJudgeProblem(p, d.problemId);
  if (!snapshot.spec.languages.includes(d.language))
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
  const existing = () => {
    const row = db
      .prepare(
        'SELECT * FROM submissions WHERE user_id=? AND idempotency_key=?',
      )
      .get(p.id, d.idempotencyKey) as SubmissionRow | undefined;
    if (row && row.request_hash !== hash)
      throw new HttpError(409, '此请求编号已经用于另一份代码，请重新提交');
    return row;
  };
  const prior = existing();
  if (prior) return { id: prior.id, status: prior.status };
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(
    p,
    d.mode === 'run' ? 'oj-run' : 'oj-submit',
    d.mode === 'run' ? 12 : 6,
  );
  // Reserve the writer before reading duplicate/queue state. A deferred WAL
  // read transaction cannot safely upgrade while the judge is writing results.
  return db.transaction(() => {
    const duplicate = existing();
    if (duplicate) return { id: duplicate.id, status: duplicate.status };
    const counts = db
      .prepare(
        "SELECT COUNT(*) as total,SUM(user_id=?) as own FROM submissions WHERE status IN ('queued','compiling','running')",
      )
      .get(p.id) as { total: number; own: number };
    if (counts.own >= 2)
      throw new HttpError(
        429,
        '你已有两份代码正在处理，请等待完成或取消后再提交',
      );
    if (counts.total >= 128)
      throw new HttpError(429, '判题队列已满，请稍后重试，代码草稿已保留');
    const id = randomUUID(),
      now = Date.now();
    const total =
      d.mode === 'judge'
        ? snapshot.cases.length
        : d.stdin !== undefined
          ? 1
          : snapshot.cases.filter((c) => !c.hidden).length;
    const practiceRoundId =
      d.mode === 'judge' && isSelectedProblem(d.problemId)
        ? ensurePracticeRound(p.id)
        : null;
    db.prepare(
      'INSERT INTO submissions(id,user_id,problem_id,problem_version_id,language,code,status,mode,custom_input,idempotency_key,request_hash,total,created_at,updated_at,practice_round_id,coding_mode,harness_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      p.id,
      d.problemId,
      snapshot.versionId,
      d.language,
      d.code,
      'queued',
      d.mode,
      d.stdin ?? null,
      d.idempotencyKey,
      hash,
      total,
      now,
      now,
      practiceRoundId,
      d.codingMode,
      d.codingMode === 'leetcode' ? LEETCODE_HARNESS_VERSION : null,
    );
    db.prepare(
      'INSERT INTO oj_outbox(submission_id,created_at) VALUES(?,?)',
    ).run(id, now);
    return { id, status: 'queued' };
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
    mode: s.mode,
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
  const key = `${p.id}:${id}`;
  const previous = lastWatchReply.get(key);
  const started = performance.now();
  const progressAfter = previous ? previous.at + 500 : started + 500;
  const reply = async () => {
    const detail = await submissionDetail(p, id);
    lastWatchReply.delete(key);
    lastWatchReply.set(key, { status: detail.status, at: performance.now() });
    if (lastWatchReply.size > 1024)
      lastWatchReply.delete(lastWatchReply.keys().next().value!);
    return detail;
  };
  if (
    !ACTIVE.includes(initial.status) ||
    (watchToken(initial) !== after &&
      (!previous ||
        previous.status !== initial.status ||
        started >= progressAfter))
  )
    return reply();
  const waiting = waitingByUser.get(p.id) ?? 0;
  if (waiting >= 2) throw new HttpError(429, '等待中的请求过多，请稍后重试');
  waitingByUser.set(p.id, waiting + 1);
  // Vinext's current Node bridge does not propagate socket disconnects into
  // Request.signal. Keep a short hard bound even when abort is unavailable.
  const deadline = performance.now() + Math.min(3_000, Math.max(0, timeoutMs));
  // Fetch only state on each tick; full cases are materialized once on return.
  const query = sqlite().prepare(
    'SELECT user_id,status,passed,total,attempt,cancel_requested,updated_at FROM submissions WHERE id=?',
  );
  try {
    while (performance.now() < deadline) {
      await delay(
        Math.min(100, Math.max(1, deadline - performance.now())),
        undefined,
        { signal },
      );
      const current = query.get(id) as SubmissionRow | undefined;
      if (!current || (current.user_id !== p.id && p.role !== 'teacher'))
        throw new HttpError(404, '提交不存在');
      if (
        !ACTIVE.includes(current.status) ||
        current.status !== initial.status ||
        (watchToken(current) !== after && performance.now() >= progressAfter)
      )
        break;
    }
    signal.throwIfAborted();
    return reply();
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
    s.mode === 'run' && s.custom_input !== null
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
            .all(s.problem_version_id, s.mode) as {
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
            stderr: r?.stderr ?? '',
          }
        : {}),
    };
  });
  const failed =
    s.mode === 'judge' &&
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
  // Old hidden results have no captured output. Do not invent a counterexample
  // for those rows, or reveal any additional cases in the version snapshot.
  if (failed && failed.status === s.status && failed.stdout !== null) {
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
    code: s.code,
    cases,
    firstFailure,
    compileOutput: s.compile_output ?? '',
    queuedPosition: position,
    cancelRequested: Boolean(s.cancel_requested),
    problemVersion: snapshot ? `v${snapshot.revision}` : undefined,
  };
}
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
  const filters = ['user_id=?'];
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
