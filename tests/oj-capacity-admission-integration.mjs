/** Real admission regression, private SQLite backup + unique Redis queue only.
 * Run from the built release/source root (runtime assets are cwd-relative):
 * SOURCE_DATABASE_PATH=/path/live.sqlite TEST_WORKER_ENTRY=/path/worker.mjs \
 * GO_JUDGE_URL=http://127.0.0.1:5054 node tests/oj-capacity-admission-integration.mjs
 * Inherit REDIS_URL/GO_JUDGE_TOKEN. Requires a dedicated FOUR-slot runner on
 * 5053/5054, not shared with another probe. No production database writes.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { Queue } from 'bullmq';

const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(['localhost', '127.0.0.1', '[::1]'].includes(runner.hostname) && ['5053', '5054'].includes(runner.port), 'Dedicated loopback runner on 5053/5054 required');
const sourcePath = resolve(process.env.SOURCE_DATABASE_PATH || 'missing');
const entry = resolve(process.env.TEST_WORKER_ENTRY || 'missing');
assert(existsSync(sourcePath) && existsSync(entry), 'Source database and worker entry required');
const dir = mkdtempSync(join(tmpdir(), 'cswork-oj-admission-'));
chmodSync(dir, 0o700);
const databasePath = join(dir, 'probe.sqlite');
const queueName = `cswork-oj-test-${randomUUID()}`;
const redis = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6381');
assert(['redis:', 'rediss:'].includes(redis.protocol));
const queue = new Queue(queueName, { connection: {
  host: redis.hostname, port: Number(redis.port || 6379),
  username: decodeURIComponent(redis.username) || undefined,
  password: decodeURIComponent(redis.password) || undefined,
  db: Number(redis.pathname.slice(1) || 0),
  ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
  connectTimeout: 5000, maxRetriesPerRequest: 1, enableOfflineQueue: false,
} });
queue.on('error', () => {});
let db, worker, interrupted = false;
const interrupt = () => { interrupted = true; };
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
async function until(fn, label, budget = 30000) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) {
    assert(!interrupted, 'Probe interrupted');
    assert(worker && worker.exitCode === null && worker.signalCode === null, 'Isolated worker exited');
    const value = await fn();
    if (value) return value;
    await delay(20);
  }
  throw new Error(`Admission probe timed out: ${label}`);
}
function insert(table, row) {
  const columns = Object.keys(row);
  db.prepare(`INSERT INTO ${table}(${columns.map(c => `"${c}"`).join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...Object.values(row));
}
try {
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try { await source.backup(databasePath); } finally { source.close(); }
  db = new Database(databasePath);
  db.pragma('busy_timeout = 5000');
  const original = db.prepare("SELECT * FROM submissions WHERE problem_id='lc-1' ORDER BY created_at DESC LIMIT 1").get();
  const baseline = db.prepare("SELECT v.* FROM oj_problem_versions v JOIN oj_problems p ON p.current_version_id=v.id WHERE p.id='lc-1'").get();
  assert(original && baseline, 'Copied lc-1 submission and published version required');
  db.exec("DELETE FROM oj_outbox; DELETE FROM oj_precompile; UPDATE submissions SET status='cancelled',finished_at=0 WHERE status IN ('queued','compiling','running'); DELETE FROM oj_runtime;");
  let revision = db.prepare('SELECT max(revision) AS n FROM oj_problem_versions WHERE problem_id=?').get(baseline.problem_id).n;
  function version(kind) {
    const spec = { ...JSON.parse(baseline.spec_json), timeLimit: 3, memoryLimit: 131072, outputLimit: kind === 'large-output' ? 16384 : 8192, checker: 'tokens' };
    const cases = Array.from({ length: kind === 'large-snapshot' ? 3 : 2 }, (_, ordinal) => ({
      name: `admission-${ordinal}`, input: `${ordinal}\n` + (kind === 'large-snapshot' ? ' '.repeat(3 * 1024 * 1024) : ''),
      expectedOutput: `${ordinal}\n`, hidden: false, weight: 1,
    }));
    const bytes = cases.reduce((n, c) => n + Buffer.byteLength(c.input) + Buffer.byteLength(c.expectedOutput), 0);
    if (kind === 'large-snapshot') assert(bytes > 8 * 1024 * 1024 && bytes < 10 * 1024 * 1024);
    const checksum = createHash('sha256').update(JSON.stringify({ schemaVersion: 1, problem: spec, cases })).digest('hex');
    const row = { ...baseline, id: randomUUID(), revision: ++revision, spec_json: JSON.stringify(spec), checksum, created_at: Date.now() };
    db.transaction(() => {
      insert('oj_problem_versions', row);
      for (const [ordinal, c] of cases.entries()) insert('oj_test_cases', { id: randomUUID(), version_id: row.id, ordinal, input: c.input, expected_output: c.expectedOutput, hidden: 0, weight: c.weight, name: c.name });
      db.prepare('UPDATE oj_problems SET current_version_id=? WHERE id=?').run(row.id, row.problem_id);
    })();
    return { id: row.id, count: cases.length, bytes, outputLimitKb: spec.outputLimit };
  }
  const ordinary = version('ordinary');
  const largeSnapshot = version('large-snapshot');
  const largeOutput = version('large-output');
  worker = spawn(process.execPath, [entry], { env: {
    ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DATABASE_PATH: databasePath,
    OJ_QUEUE_NAME: queueName, OJ_PRECOMPILE_ENABLED: 'false', OJ_WORKER_CONCURRENCY: '2',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  worker.stdout.on('data', () => {});
  worker.stderr.on('data', () => {});
  worker.on('error', () => { interrupted = true; });
  await until(() => db.prepare("SELECT 1 FROM oj_runtime WHERE id='worker' AND healthy=1").get(), 'worker readiness');
  const details = JSON.parse(db.prepare("SELECT details FROM oj_runtime WHERE id='worker'").get().details);
  assert.equal(details.submissionConcurrency, 2, 'Must test the new two-submission worker');
  let sequence = 0;
  function enqueue(name, definition = ordinary, sleepSeconds = 1.25) {
    const id = randomUUID(), now = Date.now();
    // Mark actual sandbox intervals, not inferred compiling/running UI states.
    const code = `import sys,time\nn=int(sys.stdin.readline())\nstart=time.time_ns()\ntime.sleep(${sleepSeconds})\nend=time.time_ns()\nprint(n)\nprint('ADMISSION',start,end,file=sys.stderr)\n`;
    const row = { ...original, id, language: 'python', code, problem_version_id: definition.id, mode: 'judge', coding_mode: 'acm', custom_input: null, total: definition.count, status: 'queued', passed: 0, score: 0, runtime: null, memory: null, message: null, compile_output: null, attempt: 0, cancel_requested: 0, started_at: null, finished_at: null, created_at: now, updated_at: now, idempotency_key: randomUUID(), practice_round_id: null };
    db.transaction(() => {
      insert('submissions', row);
      db.prepare('INSERT INTO oj_outbox(submission_id,created_at) VALUES(?,?)').run(id, now + sequence++);
    })();
    return { id, name, definition };
  }
  const state = job => db.prepare('SELECT * FROM submissions WHERE id=?').get(job.id);
  async function completed(job) {
    const row = await until(() => { const s = state(job); return s.finished_at !== null && s; }, job.name);
    assert.equal(row.status, 'accepted', `${job.name}: ${row.status}`);
    assert.equal(row.attempt, 1, `${job.name}: retries prohibited`);
    assert.equal(row.passed, job.definition.count);
    const results = db.prepare('SELECT status,stderr FROM oj_results WHERE submission_id=? ORDER BY ordinal').all(job.id);
    assert.equal(results.length, job.definition.count);
    const intervals = results.map(c => {
      assert.equal(c.status, 'accepted');
      const match = /^ADMISSION (\d+) (\d+)$/m.exec(c.stderr || '');
      assert(match, `${job.name}: sandbox clock markers missing`);
      return { start: BigInt(match[1]), end: BigInt(match[2]) };
    });
    return { row, start: intervals.reduce((a, b) => a < b.start ? a : b.start, intervals[0].start), end: intervals.reduce((a, b) => a > b.end ? a : b.end, intervals[0].end) };
  }
  const overlapMs = (a, b) => Number((a.end < b.end ? a.end : b.end) - (a.start > b.start ? a.start : b.start)) / 1e6;
  const normalA = enqueue('ordinary-a'), normalB = enqueue('ordinary-b');
  const [a, b] = await Promise.all([completed(normalA), completed(normalB)]);
  assert(overlapMs(a, b) > 200, 'Ordinary submissions must genuinely execute together in the runner');
  console.log(JSON.stringify({ event: 'admission_scenario', name: 'ordinary-overlap', overlapMs: overlapMs(a, b) }));
  for (const [name, definition] of [['large-snapshot-exclusive', largeSnapshot], ['large-output-limit-exclusive', largeOutput]]) {
    const large = enqueue(name, definition), small = enqueue(`${name}-ordinary`);
    const [l, s] = await Promise.all([completed(large), completed(small)]);
    assert(overlapMs(l, s) <= 0, `${name}: sandbox execution must not overlap`);
    assert(l.row.finished_at <= s.row.started_at || s.row.finished_at <= l.row.started_at, `${name}: complete worker lifetimes must not overlap`);
    console.log(JSON.stringify({ event: 'admission_scenario', name, overlapMs: overlapMs(l, s), snapshotBytes: definition.bytes, outputLimitKb: definition.outputLimitKb }));
  }
  const blocker = enqueue('cancellation-blocker', ordinary, 2.5);
  await until(() => state(blocker).status === 'running', 'blocker running');
  const cancelled = enqueue('cancel-waiting-exclusive', largeSnapshot);
  await until(async () => {
    const job = await queue.getJob(cancelled.id);
    return job && await job.getState() === 'active' && state(cancelled).status === 'queued';
  }, 'exclusive waiting inside worker admission');
  const follower = enqueue('ordinary-after-cancel', ordinary, 0.5);
  db.prepare('UPDATE submissions SET cancel_requested=1,updated_at=? WHERE id=?').run(Date.now(), cancelled.id);
  const cancelledRow = await until(() => { const s = state(cancelled); return s.status === 'cancelled' && s; }, 'queued cancellation');
  assert.equal(cancelledRow.attempt, 0, 'Cancelled queued task must never compile/load its snapshot');
  assert.equal(db.prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?').get(cancelled.id).n, 0);
  const [block, follow] = await Promise.all([completed(blocker), completed(follower)]);
  assert(overlapMs(block, follow) > 100, 'Cancelled exclusive admission must release its slot before the blocker finishes');
  console.log(JSON.stringify({ event: 'admission_scenario', name: 'cancel-exclusive-unblocks-follower', overlapMs: overlapMs(block, follow), cancelledAttempt: cancelledRow.attempt }));
  console.log(JSON.stringify({ event: 'admission_complete', scenarios: 4, scope: 'private SQLite backup + actual worker + dedicated four-slot runner; not production/API/browser benchmark' }));
} finally {
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    worker.kill('SIGTERM');
    const deadline = Date.now() + 15000;
    while (worker.exitCode === null && worker.signalCode === null && Date.now() < deadline) await delay(100);
    if (worker.exitCode === null && worker.signalCode === null) {
      const exited = new Promise(resolveExit => worker.once('exit', resolveExit));
      worker.kill('SIGKILL');
      await exited;
    }
  }
  try {
    assert(/^cswork-oj-test-[a-f0-9-]+$/.test(queueName));
    await queue.obliterate({ force: true });
  } finally {
    await queue.close();
    db?.close();
    rmSync(dir, { recursive: true, force: true });
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
