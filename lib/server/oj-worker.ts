import {
  orderedCaseResults,
  caseConcurrency,
  createSlots,
} from './oj-case-stream';
import { boundedFeedback, persistCase } from './oj-case-store';
import { projectSuite } from './ai-tasks';
import { runCodecRoundTrip } from './oj-codec-roundtrip';
import { CompiledProgramCache } from './oj-compile-cache';
import { PrecompileScheduler } from './oj-precompile-scheduler';
import {
  precompileEnabled,
  nextPrecompileDraft,
  precompileDraftCurrent,
  consumePrecompileDraft,
  hasForegroundSubmissions,
  precompileKey,
  prunePrecompileDrafts,
  type PrecompileDraft,
  PRECOMPILE_TIMEOUT_MS,
} from './oj-precompile';
import type { OjJudgeSnapshot, OjProblemSpec } from '@/lib/oj-types';
import { createOutboxDispatcher, OJ_DISPATCH_INTERVAL_MS } from './oj-dispatch';
import { leetcodeSource, LEETCODE_HARNESS_VERSION } from './leetcode-mode';
import { Queue, Worker, type Job } from 'bullmq';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { sqlite } from '@/db/sqlite';
import { loadJudgeSnapshot, ensureOjSeed } from './oj-problems';
import { sendLearnerReminders } from './reminders';
import { sendCompanyDigest } from './company-follows';
import { syncJobOpenings } from './job-openings';
import { seed } from './seed';
import {
  assertSnapshotBudget,
  OJ_WORKER_CONCURRENCY,
  OJ_CASE_SLOTS,
  exclusiveSubmission,
  leetcodeShape,
  RESOURCE_FAILURES,
  stopJudging,
  SubmissionAdmission,
} from './oj-worker-policy';
import {
  ACTIVE,
  formalMode,
  ownCases,
  PLAYGROUND_SPEC,
  submissionRow,
  type SubmissionRow,
} from './oj-submissions';
import {
  run,
  runSpec,
  cleanup,
  compileBridge,
  engineHealth,
  engineVerdict,
  matchesOutput,
  projectVerdict,
  runProject,
  syntaxCheckOnly,
  type CompiledProgram,
  type EngineResult,
} from './oj-engine';

const QUEUE = process.env.OJ_QUEUE_NAME || 'cswork-judge-v1';
if (!/^[a-zA-Z0-9_-]{1,80}$/.test(QUEUE)) throw new Error('Invalid queue name');
const MAX_ATTEMPTS = 3;
/** A complexity probe's CPU budget across its cases: checked between cases, so the last one may overrun it. */
const PROBE_CPU_MS = 10_000;
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
const compiledPrograms = new CompiledProgramCache();
// LeetCode bridges hold no user code, so one bytecode copy serves every learner.
// The default 5-minute lifetime stays below the runner's -file-timeout=10m
// (deploy/oj/entrypoint.sh), which would otherwise delete a cached bridge.
const bridgePrograms = new CompiledProgramCache(
  (_language, source, signal) => compileBridge(source, signal),
  cleanup,
  32,
);
const precompiles = new PrecompileScheduler();
const admission = new SubmissionAdmission(OJ_WORKER_CONCURRENCY);
const caseSlots = createSlots(OJ_CASE_SLOTS);
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
    // Project runs learn their size from the suites (createProjectRun queues 0).
    'total',
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
  const row = submissionRow(job.data.submissionId);
  if (!row || !ACTIVE.includes(row.status)) return;
  const budget = db
    .prepare(
      `SELECT COALESCE((SELECT SUM(octet_length(input) + octet_length(expected_output))
      FROM oj_test_cases WHERE version_id=v.id),0) AS bytes,
      json_extract(v.spec_json,'$.memoryLimit') AS memoryLimit,
      json_extract(v.spec_json,'$.outputLimit') AS outputLimit
      FROM oj_problem_versions v WHERE v.id=?`,
    )
    .get(row.problem_version_id) as
    | { bytes: number; memoryLimit: number; outputLimit: number }
    | undefined;
  const waiting = new AbortController();
  const monitor = setInterval(() => {
    const latest = submissionRow(row.id);
    if (stopping || !latest || latest.cancel_requested) waiting.abort();
  }, 400);
  let releaseAdmission: (() => void) | undefined;
  let releaseForeground: (() => void) | undefined;
  // Playground and project runs have no version (so no budget row) and small fixed limits.
  const exclusive =
    row.mode !== 'playground' &&
    row.mode !== 'project' &&
    (!budget ||
      exclusiveSubmission(budget.bytes, budget.memoryLimit, budget.outputLimit));
  try {
    releaseAdmission = await admission.acquire(exclusive, waiting.signal);
    // A precompile of this exact program finishes into the cache it then hits.
    releaseForeground = await precompiles.enterForeground(precompileKey(row));
    clearInterval(monitor);
    return await judgeSubmission(job, exclusive);
  } catch (error) {
    if (!waiting.signal.aborted) throw error;
    const latest = submissionRow(row.id);
    if (latest?.cancel_requested && ACTIVE.includes(latest.status)) {
      update(row.id, latest.attempt, {
        status: 'cancelled',
        finished_at: Date.now(),
      });
      return;
    }
    throw new Error('Judge admission interrupted');
  } finally {
    clearInterval(monitor);
    releaseForeground?.();
    releaseAdmission?.();
  }
}
async function judgeSubmission(
  job: Job<{ submissionId: string }>,
  exclusive: boolean,
) {
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
    controller = new AbortController(),
    // A submission or an OA drill: every case, hidden ones too, stopping at the first failure,
    // or, when createSubmission allowed all_cases, through every failure for partial credit.
    formal = formalMode(claimed.mode),
    runAll = formal && claimed.all_cases === 1;
  controllers.set(id, controller);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const monitor = setInterval(() => {
    const row = submissionRow(id);
    if (stopping || !row || row.cancel_requested || row.attempt !== attempt)
      controller.abort();
  }, 400);
  let program: CompiledProgram | undefined;
  let compilation:
    | Awaited<ReturnType<CompiledProgramCache['acquire']>>
    | undefined;
  let bridgeAcquisition:
    | Promise<Awaited<ReturnType<CompiledProgramCache['acquire']>> | undefined>
    | undefined;
  let invalidateCompilation = false;
  // The shared bridge is dropped on runner trouble (including a restart seen
  // as a failed fetch), never because one learner cancelled or ran out of time.
  let invalidateBridge = false;
  let terminalFailureCommitted = false;
  // Cases started beside the compile (see below), settled before anything is released.
  let early: Promise<EngineResult>[] = [];
  const caseController = new AbortController();
  try {
    if (claimed.mode === 'project') {
      // No problem version: the learner's files against the task's two suites (runProject).
      deadline = setTimeout(
        () => controller.abort(new Error('Submission deadline exceeded')),
        80_000,
      );
      // An AI-assisted task, or an ICA level with the hidden tests of its levels so far.
      const task = projectSuite(claimed.problem_id);
      if (!task) {
        update(id, attempt, {
          status: 'system_error',
          message: '练习任务不存在',
          finished_at: Date.now(),
        });
        return;
      }
      update(id, attempt, { status: 'running' });
      const { files } = JSON.parse(claimed.code) as { files: Record<string, string> };
      const [visible, hidden] = await runProject(files, task.hidden, controller.signal, (signal) =>
        caseSlots.acquire(signal),
      );
      const verdict = projectVerdict(visible, hidden, task.hiddenTotal);
      db.transaction(() => {
        current(id, attempt, controller.signal);
        db.prepare(
          'INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,0,?,?,?,?,?,0)',
        ).run(
          id,
          verdict.status,
          verdict.runtimeMs,
          verdict.memoryKb,
          JSON.stringify(verdict.report),
          boundedFeedback(verdict.output).text,
        );
        update(id, attempt, {
          status: verdict.status,
          passed: verdict.passed,
          total: verdict.total,
          runtime: verdict.runtimeMs / 1000,
          memory: verdict.memoryKb,
          finished_at: Date.now(),
        });
      }).immediate();
      return;
    }
    const probe = claimed.mode === 'complexity';
    const loaded: Pick<OjJudgeSnapshot, 'spec' | 'cases'> =
      claimed.mode === 'playground'
        ? { spec: PLAYGROUND_SPEC, cases: [] }
        : await loadJudgeSnapshot(claimed.problem_version_id!);
    // A per-language limit replaces timeLimit everywhere below: cases, codec runs, the deadline.
    const snapshot = {
      ...loaded,
      spec: {
        ...runSpec(loaded.spec, formal),
        timeLimit:
          loaded.spec.timeLimits?.[claimed.language] ??
          loaded.spec.timeLimit,
        // A probe's arrays run to 16384 values: room for its answers, which are timed, never stored.
        ...(probe ? { outputLimit: Math.max(loaded.spec.outputLimit, 1024) } : {}),
      },
    };
    assertSnapshotBudget(snapshot.cases);
    // Runs on the learner's own input: custom-input runs, playground runs and a stress test's cases.
    const ownInput = !formal && claimed.custom_input !== null;
    const own = ownInput ? ownCases(claimed) : [];
    const caseCount = ownInput
      ? own.length
      : snapshot.cases.filter((c) => formal || !c.hidden)
          .length;
    // Respect the published per-case budget, including valid long problem sets.
    const totalSeconds =
      80 + caseCount * Math.max(3, snapshot.spec.timeLimit * 3);
    deadline = setTimeout(
      () => controller.abort(new Error('Submission deadline exceeded')),
      totalSeconds * 1000,
    );
    current(id, attempt, controller.signal);
    const shape = leetcodeShape(claimed);
    if (shape.wrap && claimed.harness_version !== LEETCODE_HARNESS_VERSION) {
      update(id, attempt, {
        status: 'system_error',
        message: '函数驱动版本已更新，请重新提交；原代码已保留。',
        finished_at: Date.now(),
      });
      return;
    }
    const wrapped = shape.wrap
      ? leetcodeSource(
          snapshot.spec.id,
          claimed.language,
          claimed.code,
          snapshot.spec.memoryLimit,
        )
      : { source: claimed.code };
    const cases = ownInput
      ? own.map((input, ordinal) => ({ ordinal, input, expectedOutput: null, hidden: false, weight: 1 }))
      : snapshot.cases.filter((c) => formal || !c.hidden);
    const caseSignal = AbortSignal.any([
      controller.signal,
      caseController.signal,
    ]);
    const runCase = async (c: (typeof cases)[number]) => {
      const release = await caseSlots.acquire(caseSignal);
      try {
        current(id, attempt, controller.signal);
        // Codec decoding still runs in a fresh sandbox and never sees the tree.
        return await (snapshot.spec.checker === 'design-lc-297' ||
        snapshot.spec.checker === 'design-lc-449'
          ? runCodecRoundTrip(program!, c.input, snapshot.spec, caseSignal, run)
          : run(program!, c.input, snapshot.spec, caseSignal));
      } finally {
        release();
      }
    };
    // ponytail: a complexity probe runs its cases one at a time, smallest first, and stops at its
    // first failure or past PROBE_CPU_MS; not exclusive, so other submissions' cases and
    // precompiles still run beside it and nudge its CPU times a little. One probe in flight
    // site-wide and 6 an hour each (lib/server/stress.ts) bound what it costs everyone else.
    const width = probe ? 1 : caseConcurrency(snapshot.spec.memoryLimit, exclusive);
    // A syntax check builds nothing, so the program is known now: its first cases run beside
    // the check, one runner slot short of the width so the check never queues behind them.
    // Their results are read only after a clean compile; anything else aborts them.
    if (syntaxCheckOnly(claimed.language, wrapped.source)) {
      program = { language: 'python', source: wrapped.source, cache: {} };
      const beside = (caseSlots.contended() ? Math.min(2, width) : width) - 1;
      early = cases.slice(0, Math.max(1, beside)).map(runCase);
      for (const p of early) p.catch(() => {});
    }
    const compileStarted = performance.now();
    // Built beside the compile; without it the bridge simply runs from source.
    bridgeAcquisition = wrapped.bridgeSource
      ? bridgePrograms
          .acquire('', 'python', wrapped.bridgeSource, controller.signal)
          .catch(() => undefined)
      : undefined;
    const compiled = await compiledPrograms.acquire(
      claimed.user_id,
      claimed.language,
      wrapped.source,
      controller.signal,
    );
    compilation = compiled;
    const bridge = await bridgeAcquisition;
    console.info(
      JSON.stringify({
        event: 'oj_compile',
        submissionId: id,
        cacheHit: compiled.cacheHit,
        durationMs: Math.round(performance.now() - compileStarted),
      }),
    );
    program = compiled.program;
    program.bridgeSource = wrapped.bridgeSource;
    if (bridge?.result.status === 'Accepted')
      program.bridgeBytecode = bridge.program.cache['bridge.pyc'];
    program.leetcodeInput = shape.leetcodeInput;
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
    if (
      program.leetcodeInput &&
      ['lc-297', 'lc-449'].includes(snapshot.spec.id)
    ) {
      // The codec driver still receives two isolated serialize/deserialize
      // phases; the custom editor accepts the original level-order tree.
      try {
        const tree: unknown = JSON.parse(claimed.custom_input!);
        if (!Array.isArray(tree))
          throw new Error('Expected a level-order tree');
        cases[0].input =
          JSON.stringify([
            ['Codec', 'roundTrip'],
            [[], [tree]],
          ]) + '\n';
      } catch {
        update(id, attempt, {
          status: 'runtime_error',
          message:
            'Codec 自定义输入应是一行 JSON 层序树数组，例如 [1,2,3,null,4]。',
          finished_at: Date.now(),
        });
        return;
      }
    }
    let passed = 0,
      heavy = 0,
      captured = false,
      weight = 0,
      runtime = 0,
      memory = 0,
      overall = 'accepted';
    const totalWeight = cases.reduce((sum, c) => sum + c.weight, 0);
    const started = new Map(cases.map((c, i) => [c, early[i]]));
    const executeCase = (c: (typeof cases)[number]) =>
      started.get(c) ?? runCase(c);
    let probeMs = 0;
    for await (const { item: c, result } of orderedCaseResults(
      cases,
      executeCase,
      () => (caseSlots.contended() ? Math.min(2, width) : width),
      () => caseController.abort(),
    )) {
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
      if (RESOURCE_FAILURES.includes(status)) heavy++;
      // A formal failure publishes the verdict now. all_cases instead keeps the first failure's
      // output for its counterexample and publishes the verdict after the last case.
      const terminal = formal && !runAll && status !== 'accepted',
        capture = runAll && status !== 'accepted' && !captured;
      if (capture) captured = true;
      persistCase(
        db,
        () => {
          current(id, attempt, controller.signal);
        },
        {
          submissionId: id,
          attempt,
          ordinal: c.ordinal,
          status:
            !formal &&
            c.expectedOutput === null &&
            status === 'accepted'
              ? 'finished'
              : status,
          runtimeMs,
          memoryKb,
          stdout: probe ? '' : result.files?.stdout,
          stderr: probe && status === 'accepted' ? '' : result.files?.stderr,
          hidden: c.hidden,
          terminalFailure: terminal,
          capture,
        },
        {
          passed,
          runtime,
          memory,
          score: Math.round((weight / totalWeight) * 100),
        },
      );
      if (terminal) terminalFailureCommitted = true;
      // Unexecuted cases after a stop read as skipped.
      if (stopJudging(status, { formal, runAll, heavy })) break;
      if (probe && (probeMs += runtimeMs) > PROBE_CPU_MS) break;
    }
    if (terminalFailureCommitted) return;
    current(id, attempt, controller.signal);
    update(id, attempt, {
      status:
        !formal && overall === 'accepted' ? 'finished' : overall,
      finished_at: Date.now(),
    });
  } catch (error) {
    // A published verdict is immutable even if shutdown interrupts cleanup.
    if (terminalFailureCommitted) return;
    // A restarted runner may have discarded cached file IDs. The bounded job retry must recompile.
    invalidateCompilation = true;
    invalidateBridge =
      !(error instanceof LostAttempt) && !controller.signal.aborted;
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
    // Keep diagnostic categories, never source, test data, SQL parameters or
    // exception messages. A transient storage failure must remain identifiable.
    const category = (value: unknown) =>
      typeof value === 'string' && /^[A-Za-z_0-9]{1,64}$/.test(value)
        ? value
        : undefined;
    console.error(
      JSON.stringify({
        event: 'oj_attempt_error',
        submissionId: id,
        attempt,
        errorType: category(error instanceof Error ? error.name : undefined),
        code: category(
          error && typeof error === 'object' && 'code' in error
            ? error.code
            : undefined,
        ),
      }),
    );
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
    // Unread early cases (a compile error or failure) stop here, before compilation.release.
    if (early.length) {
      caseController.abort();
      await Promise.allSettled(early);
    }
    clearTimeout(deadline);
    clearInterval(monitor);
    if (controllers.get(id) === controller) controllers.delete(id);
    if (compilation) await compilation.release(invalidateCompilation);
    await (await bridgeAcquisition)?.release(invalidateBridge);
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
queue.on('error', (error) => {
  console.error(JSON.stringify({ event: 'oj_queue_error', error: error.message }));
  engineAvailable = false;
});
async function maintenance() {
  if (maintaining || stopping) return;
  maintaining = true;
  try {
    await compiledPrograms.prune();
    await bridgePrograms.prune();
    prunePrecompileDrafts();
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
  } catch (error) {
    // Logged: a failed round pauses intake until the next one, 5s later (a queue-wait tail).
    console.error(JSON.stringify({ event: 'oj_maintenance_failed', error: error instanceof Error ? error.message : 'unknown' }));
    engineAvailable = false;
    // Pause acquisition only; in-flight jobs own their timeout, retry and cancellation.
    if (!worker.isPaused()) await worker.pause(true);
  } finally {
    db.prepare(
      "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,?,?) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,healthy=excluded.healthy,details=excluded.details",
    ).run(
      Date.now(),
      Number(engineAvailable),
      JSON.stringify({
        languageVersions: safeVersions(),
        submissionConcurrency: OJ_WORKER_CONCURRENCY,
      }),
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
const outboxDispatcher = createOutboxDispatcher(db, async (id) => {
  const started = performance.now();
  await queue.add('judge', { submissionId: id }, { jobId: id });
  const ms = Math.round(performance.now() - started);
  if (ms > 200) console.warn(JSON.stringify({ event: 'oj_enqueue_slow', submissionId: id, durationMs: ms }));
});
// Not gated on engineAvailable: enqueueing needs only Redis, and a paused worker leaves the job
// waiting, so a failed health round no longer holds new submissions in the outbox for 5s.
const dispatchTimer = setInterval(() => {
  if (!stopping)
    void outboxDispatcher.drain().catch(() => {
      // The durable outbox remains pending. Maintenance owns health/recovery.
    });
}, OJ_DISPATCH_INTERVAL_MS);
let activeDraft: PrecompileDraft | undefined;
function precompileTick() {
  if (
    stopping ||
    !engineAvailable ||
    !precompileEnabled() ||
    hasForegroundSubmissions(activeDraft)
  ) {
    void precompiles.cancelBackground();
    return;
  }
  if (!precompiles.canStart) return;
  const draft = nextPrecompileDraft();
  if (!draft) return;
  precompiles.start(
    draft.generation,
    async (signal) => {
      activeDraft = draft;
      // Once a submission adopts this compile it is that submission's own
      // compile: no speculative timeout, and later edits do not cancel it.
      const adopted = () => precompiles.isAdopted(draft.generation);
      const outdated = setInterval(() => {
        if (adopted()) return;
        if (!precompileDraftCurrent(draft) || hasForegroundSubmissions(draft))
          void precompiles.cancelBackground(draft.generation);
      }, OJ_DISPATCH_INTERVAL_MS);
      const timeout = new AbortController();
      const timer = setTimeout(() => {
        if (!adopted()) timeout.abort(new Error('Precompile timed out'));
      }, PRECOMPILE_TIMEOUT_MS);
      const interrupted = AbortSignal.any([signal, timeout.signal]);
      try {
        const version = db
          .prepare(
            'SELECT spec_json FROM oj_problem_versions WHERE id=? AND problem_id=?',
          )
          .get(draft.problem_version_id, draft.problem_id) as
          | { spec_json: string }
          | undefined;
        if (!version) return;
        const spec = JSON.parse(version.spec_json) as OjProblemSpec;
        const source =
          draft.coding_mode === 'leetcode'
            ? leetcodeSource(
                draft.problem_id,
                draft.language,
                draft.code,
                spec.memoryLimit,
              ).source
            : draft.code;
        interrupted.throwIfAborted();
        const started = performance.now();
        const result = await compiledPrograms.warm(
          draft.user_id,
          draft.language,
          source,
          interrupted,
        );
        console.info(
          JSON.stringify({
            event: 'oj_precompile',
            language: draft.language,
            result,
            durationMs: Math.round(performance.now() - started),
          }),
        );
      } finally {
        clearInterval(outdated);
        clearTimeout(timer);
        consumePrecompileDraft(draft);
        if (activeDraft === draft) activeDraft = undefined;
      }
    },
    precompileKey(draft),
  );
}
const precompileTimer = setInterval(() => {
  try {
    precompileTick();
  } catch {
    /* Optional acceleration never stops judging. */
  }
  // Drafts wait 1.5s of idle typing (hooks/use-idle-precompile.ts): no need for dispatch's 20ms.
}, 100);
// Learners' reminder digests and contest reminders (any process TZ); followed companies' new OA
// problems. The worker is the one long-running process with the mail settings, so no separate timer
// unit. One after another, and never two ticks at once, so mails stay under Resend's rate limit.
// One core runs dispatch, BullMQ and every SQLite write: log any minute it stalled past 250ms.
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
const loopTimer = setInterval(() => {
  const maxMs = Math.round(loopDelay.max / 1e6);
  if (maxMs > 250) console.warn(JSON.stringify({ event: 'oj_event_loop_stall', maxMs, p99Ms: Math.round(loopDelay.percentile(99) / 1e6) }));
  loopDelay.reset();
}, 60_000);
loopTimer.unref();
let reminding = false;
const reminderTimer = setInterval(() => {
  if (reminding) return;
  reminding = true;
  void (async () => {
    for (const [name, send] of [
      ['learner reminders', sendLearnerReminders],
      ['company digest', sendCompanyDigest],
    ] as const)
      await send().catch((error: unknown) => console.error(name, error instanceof Error ? error.message : 'unknown'));
  })().finally(() => (reminding = false));
}, 600_000);
// New-grad and intern openings from public ATS boards, about daily (lib/server/job-openings.ts): its
// own timer, so a slow round of boards never holds back the reminders above.
const jobsTimer = setInterval(() => void syncJobOpenings().catch(() => console.error('job openings sync failed')), 600_000);
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearInterval(reminderTimer);
  clearInterval(jobsTimer);
  clearInterval(dispatchTimer);
  clearInterval(precompileTimer);
  for (const controller of controllers.values()) controller.abort();
  const force = setTimeout(() => process.exit(1), 20000);
  force.unref();
  await outboxDispatcher.stop();
  await precompiles.close();
  await worker.close();
  await compiledPrograms.close();
  await bridgePrograms.close();
  await queue.close();
  db.prepare(
    "UPDATE oj_runtime SET healthy=0,heartbeat_at=? WHERE id='worker'",
  ).run(Date.now());
  clearTimeout(force);
  db.close();
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
console.log(
  `cswork OJ worker started: BullMQ, concurrency ${OJ_WORKER_CONCURRENCY}, go-judge`,
);
