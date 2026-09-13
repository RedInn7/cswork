/** Real worker/runner acceptance probe; no production writes or API/browser claims.
 * SOURCE_DATABASE_PATH=/path/live.sqlite TEST_WORKER_ENTRY=/path/worker.mjs
 * GO_JUDGE_URL=http://127.0.0.1:5053 node tests/oj-failfast-integration.mjs
 * Inherit REDIS_URL and runner credentials. Use a dedicated TWO-slot runner on
 * port 5053 or 5054. Never point this test at the production runner.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { Queue } from 'bullmq';

const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(['localhost', '127.0.0.1', '[::1]'].includes(runner.hostname) && ['5053', '5054'].includes(runner.port), 'Dedicated local runner port 5053/5054 required');
const sourcePath = resolve(process.env.SOURCE_DATABASE_PATH || 'missing');
const entry = resolve(process.env.TEST_WORKER_ENTRY || 'missing');
assert(existsSync(sourcePath) && existsSync(entry), 'Source database and worker entry required');
const latencyLimit = Number(process.env.TEST_FAILFAST_LIMIT_MS || 3500);
assert(latencyLimit >= 500 && latencyLimit < 5000, 'Latency limit must be below the 5-second sleeping neighbour');
const dir = mkdtempSync(join(tmpdir(), 'cswork-oj-failfast-'));
chmodSync(dir, 0o700);
const databasePath = join(dir, 'probe.sqlite');
const queueName = `cswork-oj-test-${randomUUID()}`;
let db, worker, queue, sampler, stopped = false, peakRssKb = 0;
const interrupt = () => { stopped = true; };
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
async function until(fn, budget = 30000) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) {
    assert(!stopped, 'Probe interrupted or resource guard triggered');
    assert(worker && worker.exitCode === null && worker.signalCode === null, 'Isolated worker exited');
    const result = fn();
    if (result) return result;
    await delay(15);
  }
  throw new Error('Isolated fail-fast probe timed out');
}
const insert = (table, row) => {
  const columns = Object.keys(row);
  db.prepare(`INSERT INTO ${table}(${columns.map(c => `"${c}"`).join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...Object.values(row));
};
try {
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try { await source.backup(databasePath); } finally { source.close(); }
  db = new Database(databasePath);
  db.pragma('busy_timeout = 5000');
  const original = db.prepare("SELECT * FROM submissions WHERE problem_id='lc-1' ORDER BY created_at DESC LIMIT 1").get();
  assert(original, 'Existing lc-1 submission required only to bind a copied account');
  const version = db.prepare("SELECT v.* FROM oj_problem_versions v JOIN oj_problems p ON p.current_version_id=v.id WHERE p.id='lc-1'").get();
  assert(version, 'Published lc-1 version required');
  // All mutation is confined to the private online backup; no copied jobs run.
  db.exec("DELETE FROM oj_outbox; DELETE FROM oj_precompile; UPDATE submissions SET status='cancelled',finished_at=0 WHERE status IN ('queued','compiling','running'); DELETE FROM oj_runtime;");
  const spec = { ...JSON.parse(version.spec_json), timeLimit: 3, memoryLimit: 131072, checker: 'tokens' };
  const cases = Array.from({ length: 5 }, (_, ordinal) => ({ name: `synthetic-${ordinal}`, input: `${ordinal}\n`, expectedOutput: `${ordinal}\n`, hidden: ordinal >= 2, weight: 1 }));
  // Match loadJudgeSnapshot/problemChecksum property order exactly.
  const checksum = createHash('sha256').update(JSON.stringify({ schemaVersion: 1, problem: spec, cases })).digest('hex');
  db.transaction(() => {
    db.prepare('DELETE FROM oj_test_cases WHERE version_id=?').run(version.id);
    for (const [ordinal, c] of cases.entries()) insert('oj_test_cases', { id: randomUUID(), version_id: version.id, ordinal, input: c.input, expected_output: c.expectedOutput, hidden: Number(c.hidden), weight: c.weight, name: c.name });
    db.prepare('UPDATE oj_problem_versions SET spec_json=?,checksum=? WHERE id=?').run(JSON.stringify(spec), checksum, version.id);
  })();
  worker = spawn(process.execPath, [entry], { env: { ...process.env, DATABASE_PATH: databasePath, OJ_QUEUE_NAME: queueName, OJ_PRECOMPILE_ENABLED: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  // Drain logs without exposing copied account identifiers, programs or secrets.
  worker.stdout.on('data', () => {});
  worker.stderr.on('data', () => {});
  worker.on('error', () => { stopped = true; });
  sampler = setInterval(() => {
    try {
      const rss = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(worker.pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim()) || 0;
      peakRssKb = Math.max(peakRssKb, rss);
      if (rss > 512 * 1024) { stopped = true; worker.kill('SIGTERM'); }
    } catch { /* Child termination is checked by until. */ }
  }, 1000);
  await until(() => db.prepare("SELECT 1 FROM oj_runtime WHERE id='worker' AND healthy=1").get());
  async function submit(name, code, mode = 'judge') {
    const id = randomUUID(), now = Date.now();
    const row = { ...original, id, language: 'python', code, problem_version_id: version.id, mode, coding_mode: 'acm', custom_input: null, total: mode === 'run' ? 2 : cases.length, status: 'queued', passed: 0, score: 0, runtime: null, memory: null, message: null, compile_output: null, attempt: 0, cancel_requested: 0, started_at: null, finished_at: null, created_at: now, updated_at: now, idempotency_key: randomUUID(), practice_round_id: null };
    db.transaction(() => { insert('submissions', row); db.prepare('INSERT INTO oj_outbox(submission_id,created_at) VALUES(?,?)').run(id, now); })();
    const terminal = await until(() => { const s = db.prepare('SELECT * FROM submissions WHERE id=?').get(id); return s.finished_at !== null ? s : null; });
    const feedbackMs = Date.now() - now;
    const results = db.prepare('SELECT * FROM oj_results WHERE submission_id=? ORDER BY ordinal').all(id);
    assert.equal(terminal.attempt, 1, `${name}: no retry permitted`);
    console.log(JSON.stringify({ event: 'failfast_scenario', name, status: terminal.status, passed: terminal.passed, persistedCases: results.length, feedbackMs, serverMs: terminal.finished_at - terminal.created_at }));
    return { id, terminal, results, feedbackMs };
  }
  const correct = 'n=int(input())\nprint(n)\n';
  const accepted = async (name) => {
    const r = await submit(name, correct);
    assert.equal(r.terminal.status, 'accepted');
    assert.equal(r.terminal.passed, cases.length);
    assert.equal(r.results.length, cases.length);
    assert.deepEqual(r.results.map(c => c.ordinal), [0, 1, 2, 3, 4]);
    assert(r.results.every(c => c.status === 'accepted'));
    return r;
  };
  await accepted('all-cases-pass');
  const early = await submit('first-WA-with-sleeping-neighbour', 'import time\nn=int(input())\nif n==1: time.sleep(5)\nprint(999 if n==0 else n)\n');
  assert.equal(early.terminal.status, 'wrong_answer');
  assert.equal(early.terminal.passed, 0);
  assert.equal(early.results.length, 1);
  assert.equal(early.results[0].ordinal, 0);
  assert.equal(early.results[0].status, 'wrong_answer');
  assert.equal(early.results[0].stdout.trim(), '999');
  assert(early.feedbackMs < latencyLimit, `First WA feedback took ${early.feedbackMs} ms; limit ${latencyLimit}`);
  const following = await accepted('accepted-immediately-after-cancellation');
  assert(following.feedbackMs < latencyLimit, `Next job blocked for ${following.feedbackMs} ms after cancellation`);
  const later = await submit('two-pass-then-WA', 'n=int(input())\nprint(999 if n==2 else n)\n');
  assert.equal(later.terminal.status, 'wrong_answer');
  assert.equal(later.terminal.passed, 2);
  assert.deepEqual(later.results.map(c => c.status), ['accepted', 'accepted', 'wrong_answer']);
  assert.deepEqual(later.results.map(c => c.ordinal), [0, 1, 2]);
  assert.equal(later.results[2].hidden, 1);
  assert.equal(later.results[2].stdout.trim(), '999', 'The first failed hidden case must retain feedback');
  const samples = await submit('run-retains-all-sample-results', 'n=int(input())\nprint(999 if n==0 else n)\n', 'run');
  assert.equal(samples.terminal.status, 'wrong_answer');
  assert.equal(samples.terminal.passed, 1);
  assert.deepEqual(samples.results.map(c => c.ordinal), [0, 1]);
  assert.deepEqual(samples.results.map(c => c.status), ['wrong_answer', 'accepted']);
  // Observe past the slow neighbour's natural exit: it must never persist later results.
  await delay(Math.max(0, early.terminal.created_at + 5500 - Date.now()));
  assert.equal(db.prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?').get(early.id).n, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?').get(later.id).n, 3);
  console.log(JSON.stringify({ event: 'failfast_complete', scenarios: 5, peakRssKb, scope: 'private database + real worker + dedicated runner; not API/browser E2E' }));
} finally {
  clearInterval(sampler);
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    worker.kill('SIGTERM');
    const deadline = Date.now() + 15000;
    while (worker.exitCode === null && worker.signalCode === null && Date.now() < deadline) await delay(100);
    if (worker.exitCode === null && worker.signalCode === null) { const exited = new Promise(r => worker.once('exit', r)); worker.kill('SIGKILL'); await exited; }
  }
  try {
    assert(/^cswork-oj-test-[a-f0-9-]+$/.test(queueName));
    const u = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6381');
    queue = new Queue(queueName, { connection: { host: u.hostname, port: Number(u.port || 6379), username: decodeURIComponent(u.username) || undefined, password: decodeURIComponent(u.password) || undefined, db: Number(u.pathname.slice(1) || 0), ...(u.protocol === 'rediss:' ? { tls: {} } : {}), connectTimeout: 5000, maxRetriesPerRequest: 1, enableOfflineQueue: false } });
    queue.on('error', () => {});
    await queue.obliterate({ force: true });
  } finally {
    if (queue) await queue.close();
    db?.close();
    rmSync(dir, { recursive: true, force: true });
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
