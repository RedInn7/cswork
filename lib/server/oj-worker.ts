import { runCodecRoundTrip } from './oj-codec-roundtrip';
import { Queue, Worker, type Job } from 'bullmq';
import { sqlite } from '@/db/sqlite';
import { loadJudgeSnapshot, ensureOjSeed } from './oj-problems';
import { seed } from './seed';
import {
  assertSnapshotBudget,
  OJ_WORKER_CONCURRENCY,
} from './oj-worker-policy';
import { ACTIVE, submissionRow, type SubmissionRow } from './oj-submissions';
import {
  compile,
  run,
  cleanup,
  engineHealth,
  engineVerdict,
  matchesOutput,
  type CompiledProgram,
} from './oj-engine';

const QUEUE = process.env.OJ_QUEUE_NAME || 'cswork-judge-v1';
if (!/^[a-zA-Z0-9_-]{1,80}$/.test(QUEUE)) throw new Error('Invalid queue name');
const MAX_ATTEMPTS = 3;
const db = sqlite();
const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6381');
if (!['redis:', 'rediss:'].includes(redisUrl.protocol))
  throw new Error('Invalid Redis protocol');
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: decodeURIComponent(redisUrl.username) || undefined,
  password: decodeURIComponent(redisUrl.password) || undefined,
  db: Number(redisUrl.pathname.slice(1) || 0),
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
  connectTimeout: 5000,
};
const queue = new Queue(QUEUE, {
  connection: {
    ...connection,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  },
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 7 * 86400, count: 1000 },
  },
});
const controllers = new Map<string, AbortController>();
let stopping = false;
let maintaining = false;
let engineAvailable = false;
class LostAttempt extends Error {}
function current(id: string, attempt: number, signal: AbortSignal) {
  const row = submissionRow(id);
  if (!row || row.attempt !== attempt) throw new LostAttempt();
  if (row.cancel_requested || stopping || signal.aborted)
    throw new Error('Execution interrupted');
  return row;
}
function update(
  id: string,
  attempt: number,
  fields: Record<string, string | number | null>,
) {
  const allowed = new Set([
    'status',
    'passed',
    'runtime',
    'memory',
    'message',
    'compile_output',
    'score',
    'finished_at',
  ]);
  if (Object.keys(fields).some((k) => !allowed.has(k)))
    throw new Error('Invalid update field');
  return db
    .prepare(
      `UPDATE submissions SET ${Object.keys(fields)
        .map((k) => `${k}=?`)
        .join(',')},updated_at=? WHERE id=? AND attempt=?`,
    )
    .run(...Object.values(fields), Date.now(), id, attempt);
}
async function judge(job: Job<{ submissionId: string }>) {
  const id = job.data.submissionId;
  const initial = submissionRow(id);
  if (!initial || !ACTIVE.includes(initial.status)) return;
  if (initial.cancel_requested) {
    update(id, initial.attempt, {
      status: 'cancelled',
      finished_at: Date.now(),
    });
    return;
  }
  if (initial.attempt >= 8) {
    update(id, initial.attempt, {
      status: 'system_error',
      finished_at: Date.now(),
      message: '任务多次中断，请重新提交',
    });
    return;
  }
  const claimed = db.transaction(() => {
    const row = db
      .prepare(
        "UPDATE submissions SET attempt=attempt+1,status='compiling',passed=0,score=0,runtime=NULL,memory=NULL,message=NULL,compile_output=NULL,started_at=?,updated_at=? WHERE id=? AND status IN ('queued','compiling','running') AND cancel_requested=0 RETURNING *",
      )
      .get(Date.now(), Date.now(), id) as SubmissionRow | undefined;
    if (row) db.prepare('DELETE FROM oj_results WHERE submission_id=?').run(id);
    return row;
  })();
  if (!claimed) return;
  const attempt = claimed.attempt,
    controller = new AbortController();
  controllers.set(id, controller);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const monitor = setInterval(() => {
    const row = submissionRow(id);
    if (stopping || !row || row.cancel_requested || row.attempt !== attempt)
      controller.abort();
  }, 400);
  let program: CompiledProgram | undefined;
  try {
    const snapshot = await loadJudgeSnapshot(claimed.problem_version_id!);
    assertSnapshotBudget(snapshot.cases);
    const caseCount =
      claimed.mode === 'run' && claimed.custom_input !== null
        ? 1
        : snapshot.cases.filter((c) => claimed.mode === 'judge' || !c.hidden)
            .length;
    // Respect the published per-case budget, including valid long problem sets.
    const totalSeconds =
      80 + caseCount * Math.max(3, snapshot.spec.timeLimit * 3);
    deadline = setTimeout(
      () => controller.abort(new Error('Submission deadline exceeded')),
      totalSeconds * 1000,
    );
    current(id, attempt, controller.signal);
    const compiled = await compile(
      claimed.language,
      claimed.code,
      controller.signal,
    );
    program = compiled.program;
    current(id, attempt, controller.signal);
    if (compiled.result.status !== 'Accepted') {
      update(id, attempt, {
        status: 'compile_error',
        compile_output: (
          (compiled.result.files?.stderr || '') +
            (compiled.result.files?.stdout || '') || compiled.result.status
        ).slice(0, 65536),
        finished_at: Date.now(),
      });
      return;
    }
    update(id, attempt, {
      status: 'running',
      compile_output: (compiled.result.files?.stderr || '').slice(0, 65536),
    });
    const cases =
      claimed.mode === 'run' && claimed.custom_input !== null
        ? [
            {
              ordinal: 0,
              input: claimed.custom_input,
              expectedOutput: null,
              hidden: false,
              weight: 1,
            },
          ]
        : snapshot.cases.filter((c) => claimed.mode === 'judge' || !c.hidden);
    let passed = 0,
      weight = 0,
      runtime = 0,
      memory = 0,
      overall = 'accepted';
    const totalWeight = cases.reduce((sum, c) => sum + c.weight, 0);
    for (const c of cases) {
      current(id, attempt, controller.signal);
      // Codec submissions use the same two fresh executions for judge, sample
      // runs and custom traces; decoding never receives the original tree.
      const result =
        snapshot.spec.checker === 'design-lc-297' ||
        snapshot.spec.checker === 'design-lc-449'
          ? await runCodecRoundTrip(
              program,
              c.input,
              snapshot.spec,
              controller.signal,
              run,
            )
          : await run(program, c.input, snapshot.spec, controller.signal);
      current(id, attempt, controller.signal);
      let status = engineVerdict(result);
      if (
        status === 'accepted' &&
        c.expectedOutput !== null &&
        !matchesOutput(
          result.files?.stdout || '',
          c.expectedOutput,
          snapshot.spec.checker,
          c.input,
        )
      )
        status = 'wrong_answer';
      if (status === 'accepted') {
        passed++;
        weight += c.weight;
      } else if (overall === 'accepted') overall = status;
      const runtimeMs = Math.max(0, (result.time || 0) / 1e6),
        memoryKb = Math.max(0, Math.ceil((result.memory || 0) / 1024));
      runtime = Math.max(runtime, runtimeMs / 1000);
      memory = Math.max(memory, memoryKb);
      db.transaction(() => {
        current(id, attempt, controller.signal);
        db.prepare(
          'INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,?,?,?,?,?,?,?)',
        ).run(
          id,
          c.ordinal,
          claimed.mode === 'run' &&
            c.expectedOutput === null &&
            status === 'accepted'
            ? 'finished'
            : status,
          runtimeMs,
          memoryKb,
          c.hidden ? null : (result.files?.stdout || '').slice(0, 65536),
          c.hidden ? null : (result.files?.stderr || '').slice(0, 65536),
          Number(c.hidden),
        );
        update(id, attempt, {
          passed,
          runtime,
          memory,
          score: Math.round((weight / totalWeight) * 100),
        });
      })();
      // Expensive resource failures stop this submission; unexecuted cases are explicitly skipped.
      if (
        [
          'time_limit',
          'memory_limit',
          'output_limit',
          'runtime_error',
        ].includes(status)
      )
        break;
    }
    current(id, attempt, controller.signal);
    update(id, attempt, {
      status:
        claimed.mode === 'run' && overall === 'accepted' ? 'finished' : overall,
      finished_at: Date.now(),
    });
  } catch (error) {
    const latest = submissionRow(id);
    if (error instanceof LostAttempt || !latest || latest.attempt !== attempt)
      return;
    if (latest.cancel_requested) {
      update(id, attempt, {
        status: 'cancelled',
        finished_at: Date.now(),
        message: '已取消运行',
      });
      return;
    }
    if (stopping || job.attemptsMade + 1 < MAX_ATTEMPTS) {
      update(id, attempt, {
        status: 'queued',
        message: '执行服务暂时中断，正在自动重试',
      });
      throw new Error('Execution interrupted; retry scheduled');
    }
    update(id, attempt, {
      status: 'system_error',
      finished_at: Date.now(),
      message: '判题未能完成，请重试；本次不计入错题',
    });
    throw new Error('Execution failed after bounded retries');
  } finally {
    clearTimeout(deadline);
    clearInterval(monitor);
    if (controllers.get(id) === controller) controllers.delete(id);
    if (program) await cleanup(program);
  }
}
const worker = new Worker<{ submissionId: string }>(QUEUE, judge, {
  connection: { ...connection, maxRetriesPerRequest: null },
  concurrency: OJ_WORKER_CONCURRENCY,
  autorun: false,
  lockDuration: 60000,
  stalledInterval: 30000,
  maxStalledCount: 2,
});
worker.on('error', () => {
  for (const controller of controllers.values()) controller.abort();
  console.error('OJ queue connection interrupted');
});
worker.on('failed', (job) =>
  console.error(
    `OJ job ${job?.id ?? 'unknown'} failed; attempt ${job?.attemptsMade ?? 0}`,
  ),
);
queue.on('error', () => {
  engineAvailable = false;
});
async function maintenance() {
  if (maintaining || stopping) return;
  maintaining = true;
  try {
    // Recover cancelled attempts after a worker crash, including when Redis/runner is down.
    const cancelled = db
      .prepare(
        "SELECT id,attempt FROM submissions WHERE cancel_requested=1 AND status IN ('queued','compiling','running')",
      )
      .all() as { id: string; attempt: number }[];
    for (const row of cancelled) {
      const active = controllers.get(row.id);
      if (active) active.abort();
      else
        update(row.id, row.attempt, {
          status: 'cancelled',
          finished_at: Date.now(),
        });
    }
    await engineHealth();
    await queue.waitUntilReady();
    engineAvailable = true;
    // SQLite is the durable source of truth. Redis can be rebuilt without losing accepted submissions.
    const pending = db
      .prepare(
        "SELECT s.id FROM submissions s JOIN oj_outbox o ON o.submission_id=s.id WHERE s.status IN ('queued','compiling','running') AND s.cancel_requested=0 ORDER BY s.created_at LIMIT 128",
      )
      .all() as { id: string }[];
    for (const { id } of pending) {
      if (stopping) break;
      const existing = await queue.getJob(id);
      if (!existing)
        await queue.add('judge', { submissionId: id }, { jobId: id });
      else if (['failed', 'completed'].includes(await existing.getState())) {
        // Exhausted stalled jobs are terminal; do not create an endless retry cycle.
        db.prepare(
          "UPDATE submissions SET status='system_error',message='判题任务多次中断，请重新提交',finished_at=?,updated_at=? WHERE id=? AND status IN ('queued','compiling','running')",
        ).run(Date.now(), Date.now(), id);
      }
      db.prepare(
        'UPDATE oj_outbox SET dispatched_at=? WHERE submission_id=?',
      ).run(Date.now(), id);
    }
    if (worker.isPaused()) await worker.resume();
  } catch {
    engineAvailable = false;
    // Pause acquisition only; in-flight jobs own their timeout, retry and cancellation.
    if (!worker.isPaused()) await worker.pause(true);
  } finally {
    db.prepare(
      "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,?,?) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,healthy=excluded.healthy,details=excluded.details",
    ).run(
      Date.now(),
      Number(engineAvailable),
      JSON.stringify({ languageVersions: safeVersions() }),
    );
    maintaining = false;
  }
}
function safeVersions() {
  try {
    return JSON.parse(process.env.OJ_LANGUAGE_VERSIONS || '{}') as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}
await seed();
await ensureOjSeed();
await worker.pause(true);
void worker.run().catch(() => {
  console.error('OJ worker stopped unexpectedly');
  process.exitCode = 1;
});
await maintenance();
const timer = setInterval(() => void maintenance(), 5000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  for (const controller of controllers.values()) controller.abort();
  const force = setTimeout(() => process.exit(1), 20000);
  force.unref();
  await worker.close();
  await queue.close();
  db.prepare(
    "UPDATE oj_runtime SET healthy=0,heartbeat_at=? WHERE id='worker'",
  ).run(Date.now());
  clearTimeout(force);
  db.close();
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
console.log('cswork OJ worker started: BullMQ, concurrency 1, go-judge');
