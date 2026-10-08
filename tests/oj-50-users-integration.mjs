/** Isolated 50 distinct users -> real HTTP -> outbox -> worker -> dedicated runner.
 * Required: TEST_WEB_ENTRY, TEST_WORKER_ENTRY, GO_JUDGE_URL(loopback5053/5054),
 * GO_JUDGE_TOKEN, REDIS_URL. Optional TEST_WEB_PORT=4318,
 * TEST_MIGRATIONS_DIR=drizzle, TEST_ARTIFACT_DIR=dirname(web entry),
 * TEST_TERMINAL_TIMEOUT_MS=180000, TEST_SCENARIO=all-ac|mixed-wa,
 * TEST_LANGUAGES=cpp,java,python (or java), TEST_REPORT_PATH=new file, TMPDIR.
 * Run BOTH scenarios for a complete baseline.
 * Creates an EMPTY private DB, never copies/opens production data. Synthetic
 * sessions are seeded locally, but every submission/cancel/watch uses real API.
 * This is queued admission/correct completion, NOT50 simultaneous executions
 * or a subsecond SLA. The small28-case fixture is not a full-problem stress mix.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  chmodSync,
  existsSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Queue } from 'bullmq';

const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(
  runner.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(runner.hostname) &&
    ['5053', '5054'].includes(runner.port),
  'Dedicated loopback5053/5054 runner required',
);
assert(
  process.env.GO_JUDGE_TOKEN && process.env.REDIS_URL,
  'Runner and Redis credentials required via environment',
);
assert(
  process.env.TEST_WEB_ENTRY && process.env.TEST_WORKER_ENTRY,
  'Explicit built web/worker paths required',
);
const webEntry = resolve(process.env.TEST_WEB_ENTRY),
  workerEntry = resolve(process.env.TEST_WORKER_ENTRY);
const artifact = resolve(process.env.TEST_ARTIFACT_DIR || dirname(webEntry));
const migrations = resolve(process.env.TEST_MIGRATIONS_DIR || 'drizzle');
assert(
  existsSync(webEntry) &&
    existsSync(workerEntry) &&
    existsSync(join(migrations, 'meta/_journal.json')),
  'Built entries/migrations missing',
);
const port = Number(process.env.TEST_WEB_PORT || 4318);
assert(
  Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535 &&
    ![4317, 5050, 5053, 5054].includes(port),
  'Use an isolated web port, not production/runner',
);
const budget = Number(process.env.TEST_TERMINAL_TIMEOUT_MS || 180000);
assert(Number.isInteger(budget) && budget >= 1000 && budget <= 180000);
const scenario = process.env.TEST_SCENARIO || 'all-ac';
assert(['all-ac', 'mixed-wa'].includes(scenario));
const languages = (process.env.TEST_LANGUAGES ?? 'cpp,java,python')
  .split(',')
  .map((language) => language.trim());
assert(
  languages.length > 0 &&
    languages.every((language) =>
      ['cpp', 'java', 'python'].includes(language),
    ) &&
    new Set(languages).size === languages.length,
  'TEST_LANGUAGES must be a nonempty unique subset of cpp,java,python',
);
const reportPath =
  process.env.TEST_REPORT_PATH && resolve(process.env.TEST_REPORT_PATH);
if (reportPath) assert(!existsSync(reportPath), 'Report must be a new file');
const base = `http://127.0.0.1:${port}`,
  queueName = `cswork-oj-50-test-${randomUUID()}`;
const secret = randomUUID() + randomUUID(),
  courseId = 'oj-capacity-synthetic',
  lessonId = 'fixture';
const problemId = 'capacity-50-sum',
  versionId = randomUUID();
const dir = mkdtempSync(join(tmpdir(), 'cswork-oj-50-'));
chmodSync(dir, 0o700);
const dbPath = join(dir, 'fresh-test.sqlite');
const redis = new URL(process.env.REDIS_URL);
assert(['redis:', 'rediss:'].includes(redis.protocol));
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: decodeURIComponent(redis.username) || undefined,
  password: decodeURIComponent(redis.password) || undefined,
  db: Number(redis.pathname.slice(1) || 0),
  ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
};
const env = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  NODE_OPTIONS: '--max-old-space-size=768',
  DATABASE_PATH: dbPath,
  APP_URL: base,
  BETTER_AUTH_SECRET: secret,
  ADMIN_EMAILS: 'admin-capacity@example.test',
  HOST: '127.0.0.1',
  PORT: String(port),
  OJ_ENABLED: 'true',
  OJ_QUEUE_NAME: queueName,
  OJ_PRECOMPILE_ENABLED: 'false',
  OJ_WORKER_CONCURRENCY: process.env.OJ_WORKER_CONCURRENCY || '2',
  GO_JUDGE_URL: runner.href,
  GO_JUDGE_TOKEN: process.env.GO_JUDGE_TOKEN,
  REDIS_URL: process.env.REDIS_URL,
};
const programs = {
  cpp: '#include <cstdio>\nint main(){long long a,b;if(scanf("%lld%lld",&a,&b)==2)printf("%lld\\n",a+b);}\n',
  java: 'public class Main{public static void main(String[]args){java.util.Scanner s=new java.util.Scanner(System.in);long a=s.nextLong(),b=s.nextLong();System.out.println(a+b);}}\n',
  python: 'import sys\na,b=map(int,sys.stdin.read().split())\nprint(a+b)\n',
};
const children = [],
  requests = [],
  measurements = [];
let db,
  queue,
  interrupted = false;
const stop = () => {
  interrupted = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const terminal = new Set([
  'accepted',
  'wrong_answer',
  'compile_error',
  'runtime_error',
  'time_limit',
  'memory_limit',
  'output_limit',
  'system_error',
  'cancelled',
]);
const report = {
  event: 'oj_50_users_report',
  schemaVersion: 1,
  status: 'running',
  scope:
    'fresh synthetic DB +50 unique authenticated users +real API/web/worker +dedicated runner; queued admission, not50 execution slots',
  productionDataUsed: false,
  users: 50,
  scenario,
  languages,
  casesPerCorrectSubmission: 28,
  terminalBudgetMs: budget,
  workerConcurrency: Number(env.OJ_WORKER_CONCURRENCY),
  runnerPort: Number(runner.port),
  cacheMode: 'unique source per user; no explicit prewarm',
  artifactHashes: {
    webEntrySha256: createHash('sha256')
      .update(readFileSync(webEntry))
      .digest('hex'),
    workerEntrySha256: createHash('sha256')
      .update(readFileSync(workerEntry))
      .digest('hex'),
    harnessSha256: createHash('sha256')
      .update(readFileSync(new URL(import.meta.url)))
      .digest('hex'),
  },
  thresholds: {
    acceptedHttp201: 50,
    httpAcceptP95Ms: 2000,
    unexpected429: 0,
    unexpected5xx: 0,
    correctTerminalOutcomes: 50,
    maxClientTerminalMs: budget,
  },
};
function startChild(entry) {
  const child = spawn(process.execPath, [entry], {
    cwd: artifact,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', () => {});
  child.on('error', () => {
    child.spawnFailed = true;
    interrupted = true;
  });
  return child;
}
function healthy() {
  assert(!interrupted, 'Interrupted or child spawn failed');
  for (const c of children)
    assert(
      c.exitCode === null && c.signalCode === null,
      'Isolated child exited',
    );
}
async function until(fn, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    healthy();
    const result = await fn();
    if (result) return result;
    await delay(100);
  }
  throw new Error('Isolated readiness deadline exceeded');
}
function identity(i) {
  const uid = randomUUID(),
    token = randomUUID(),
    now = Date.now(),
    email = `capacity-${i}-${randomUUID()}@example.test`;
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, 'Synthetic capacity learner', email, 1, now, now);
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  db.prepare(
    'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
  ).run(randomUUID(), email, courseId, 'isolated-50-users', now);
  return {
    uid,
    cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + createHmac('sha256', secret).update(token).digest('base64'))}`,
  };
}
async function api(
  path,
  user,
  data,
  expectedStatus = 200,
  phase = 'assertion',
) {
  const began = performance.now();
  let response;
  try {
    response = await fetch(base + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...(user ? { Cookie: user.cookie } : {}),
        ...(data !== undefined
          ? { Origin: base, 'Content-Type': 'application/json' }
          : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    requests.push({
      phase,
      status: response.status,
      ms: performance.now() - began,
      expectedStatus,
    });
    assert.equal(
      response.status,
      expectedStatus,
      `${phase}: unexpected HTTP${response.status}`,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return body;
  } catch (error) {
    if (!response)
      requests.push({
        phase,
        status: 0,
        ms: performance.now() - began,
        expectedStatus,
      });
    throw error;
  }
}
const payload = (language, code) => ({
  problemId,
  language,
  code,
  codingMode: 'acm',
  mode: 'judge',
  idempotencyKey: randomUUID(),
});
const percentile = (a, p) =>
  [...a].sort((x, y) => x - y)[Math.max(0, Math.ceil(a.length * p) - 1)] ??
  null;
const summary = (a) => ({
  samples: a.length,
  p50: percentile(a, 0.5),
  p95: percentile(a, 0.95),
  max: a.length ? Math.max(...a) : null,
});
let failure;
try {
  await new Promise((accept, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(accept));
  });
  db = new Database(dbPath);
  db.pragma('busy_timeout=5000');
  migrate(drizzle(db), { migrationsFolder: migrations });
  db.prepare(
    'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
  ).run(
    courseId,
    'Synthetic capacity fixture',
    'No production course data',
    '1',
  );
  db.prepare(
    'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
  ).run(lessonId, courseId, 'Fixture', 'Test', 'test', 0, '', '1', Date.now());
  const users = Array.from({ length: 50 }, (_, i) => identity(i));
  assert.equal(new Set(users.map((x) => x.uid)).size, 50);
  const spec = {
    id: problemId,
    courseId,
    lessonId,
    title: 'Synthetic sum capacity fixture',
    difficulty: '简单',
    tags: ['isolated capacity'],
    description: 'Read two integers, output their sum.',
    input: 'Two signed integers.',
    output: 'Their sum.',
    hints: [],
    timeLimit: 2,
    memoryLimit: 262144,
    outputLimit: 64,
    checker: 'tokens',
    languages: ['cpp', 'java', 'python'],
  };
  const cases = Array.from({ length: 28 }, (_, i) => ({
    name: `sum-${i}`,
    input: `${i - 11} ${i * i + 3}\n`,
    expectedOutput: `${i - 11 + i * i + 3}\n`,
    hidden: i > 0,
    weight: 1,
  }));
  const checksum = createHash('sha256')
    .update(JSON.stringify({ schemaVersion: 1, problem: spec, cases }))
    .digest('hex');
  db.transaction(() => {
    const now = Date.now();
    db.prepare(
      'INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,?,?,0,?,?)',
    ).run(problemId, courseId, lessonId, now, now);
    db.prepare(
      'INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,?,?,?,?)',
    ).run(
      versionId,
      problemId,
      JSON.stringify(spec),
      checksum,
      users[0].uid,
      now,
    );
    for (const [ordinal, c] of cases.entries())
      db.prepare(
        'INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        versionId,
        ordinal,
        c.input,
        c.expectedOutput,
        Number(c.hidden),
        c.name,
        c.weight,
      );
    db.prepare(
      'UPDATE oj_problems SET current_version_id=?,published=1 WHERE id=?',
    ).run(versionId, problemId);
  })();
  report.fixtureChecksum = checksum;
  queue = new Queue(queueName, { connection });
  queue.on('error', () => {});
  startChild(workerEntry);
  startChild(webEntry);
  await until(async () => {
    try {
      return (
        await fetch(base + '/api/bootstrap', {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      return false;
    }
  });
  await until(() =>
    db
      .prepare("SELECT 1 FROM oj_runtime WHERE id='worker' AND healthy=1")
      .get(),
  );
  // Exercise the actual per-user admission gate while ONLY our own queue is paused.
  await queue.pause();
  const guardA = await api(
    '/api/oj/submissions',
    users[0],
    payload('python', programs.python),
    201,
    'guard-first',
  );
  const guardB = await api(
    '/api/oj/submissions',
    users[0],
    payload('python', programs.python + '#second\n'),
    201,
    'guard-second',
  );
  await api(
    '/api/oj/submissions',
    users[0],
    payload('python', programs.python + '#third\n'),
    429,
    'expected-own-inflight-rejection',
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM submissions WHERE user_id=? AND status IN ('queued','compiling','running')",
      )
      .get(users[0].uid).n,
    2,
  );
  for (const id of [guardA.id, guardB.id])
    await api(
      `/api/oj/submissions/${id}/cancel`,
      users[0],
      {},
      200,
      'guard-cancel',
    );
  await queue.resume();
  report.sameUserInflightProtected = true;
  const burstStart = performance.now();
  const submitted = await Promise.allSettled(
    users.map(async (user, i) => {
      const language = languages[i % languages.length],
        wrong = scenario === 'mixed-wa' && i >= 45;
      const wrongPrograms = {
        cpp: '#include <cstdio>\nint main(){puts("-999999");}\n',
        java: 'public class Main{public static void main(String[]args){System.out.println(-999999);}}\n',
        python: 'print(-999999)\n',
      };
      const code =
        (wrong ? wrongPrograms[language] : programs[language]) +
        `${language === 'python' ? '#' : '//'} user-${i}-${randomUUID()}\n`;
      const actualLanguage = language;
      const began = performance.now();
      const response = await api(
        '/api/oj/submissions',
        user,
        payload(actualLanguage, code),
        201,
        'burst-submit',
      );
      return {
        user,
        index: i,
        id: response.id,
        expected: wrong ? 'wrong_answer' : 'accepted',
        language: actualLanguage,
        dispatchMs: began - burstStart,
        acceptedMs: performance.now() - began,
        began,
        response,
      };
    }),
  );
  const jobs = submitted
    .filter((x) => x.status === 'fulfilled')
    .map((x) => x.value);
  report.acceptedSubmissions = jobs.length;
  report.dispatchSpreadMs = jobs.length
    ? Math.max(...jobs.map((x) => x.dispatchMs)) -
      Math.min(...jobs.map((x) => x.dispatchMs))
    : null;
  assert.equal(jobs.length, 50, 'All50 distinct users must receive HTTP201');
  assert.equal(
    new Set(jobs.map((x) => x.id)).size,
    50,
    'Each request gets a distinct submission',
  );
  await api(
    `/api/oj/submissions/${jobs[0].id}`,
    users[1],
    undefined,
    404,
    'tenant-isolation',
  );
  await api(
    `/api/oj/submissions/${jobs[0].id}`,
    null,
    undefined,
    401,
    'authentication',
  );
  report.tenantIsolationVerified = true;
  console.log(
    JSON.stringify({
      event: 'oj_50_users_admitted',
      users: 50,
      http201: 50,
      dispatchSpreadMs: report.dispatchSpreadMs,
    }),
  );
  const outcomes = await Promise.allSettled(
    jobs.map(async (job) => {
      let result = job.response;
      while (!terminal.has(result.status)) {
        healthy();
        assert(
          performance.now() - job.began <= budget,
          `User${job.index}: terminal deadline exceeded`,
        );
        result = await api(
          `/api/oj/submissions/${job.id}?wait=1&after=${encodeURIComponent(result.watchToken || '')}`,
          job.user,
          undefined,
          200,
          'burst-watch',
        );
        await delay(50);
      }
      const clientTerminalMs = performance.now() - job.began;
      assert(
        clientTerminalMs <= budget,
        `User${job.index}: terminal response exceeded budget`,
      );
      assert.equal(
        result.status,
        job.expected,
        `User${job.index}: wrong verdict`,
      );
      const row = db
        .prepare('SELECT * FROM submissions WHERE id=?')
        .get(job.id);
      assert.equal(row.user_id, job.user.uid);
      assert.equal(row.attempt, 1, 'No retry may hide a baseline failure');
      const rows = db
        .prepare(
          'SELECT ordinal,status FROM oj_results WHERE submission_id=? ORDER BY ordinal',
        )
        .all(job.id);
      if (job.expected === 'accepted') {
        assert.equal(result.passed, 28);
        assert.equal(result.total, 28);
        assert.equal(rows.length, 28);
        assert(
          rows.every((r, i) => r.ordinal === i && r.status === 'accepted'),
        );
      } else {
        assert.equal(result.passed, 0);
        assert.equal(rows.length, 1, 'EarlyWA must stop at firstcase');
        assert.equal(rows[0].ordinal, 0);
        assert.equal(rows[0].status, 'wrong_answer');
      }
      assert(
        result.cases
          .filter((c) => c.hidden)
          .every(
            (c) =>
              !('stdin' in c) &&
              !('expected' in c) &&
              !('stdout' in c) &&
              !('stderr' in c),
          ),
        'No hidden payload leakage',
      );
      measurements.push({
        userIndex: job.index,
        language: job.language,
        expected: job.expected,
        status: result.status,
        httpAcceptMs: job.acceptedMs,
        queueMs: row.started_at - row.created_at,
        executionMs: row.finished_at - row.started_at,
        serverTotalMs: row.finished_at - row.created_at,
        clientTerminalMs,
        passed: result.passed,
        total: result.total,
        retries: row.attempt - 1,
      });
      if (measurements.length % 10 === 0)
        console.log(
          JSON.stringify({
            event: 'oj_50_users_progress',
            completed: measurements.length,
            total: 50,
            clientTerminalMs: Math.round(clientTerminalMs),
          }),
        );
    }),
  );
  const errors = outcomes.filter((x) => x.status === 'rejected');
  assert.equal(
    errors.length,
    0,
    errors.map((x) => x.reason?.message).join('; '),
  );
  assert.equal(measurements.length, 50);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM submissions WHERE status IN ('queued','compiling','running')",
      )
      .get().n,
    0,
  );
  assert(
    percentile(
      requests.filter((x) => x.phase === 'burst-submit').map((x) => x.ms),
      0.95,
    ) <= 2000,
    'HTTP admission p95 exceeds fixed2000ms budget',
  );
  report.status = 'passed';
} catch (error) {
  failure = error;
  report.status = 'failed';
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  report.measurements = measurements;
  report.httpAcceptMs = summary(
    requests.filter((x) => x.phase === 'burst-submit').map((x) => x.ms),
  );
  for (const key of [
    'queueMs',
    'executionMs',
    'serverTotalMs',
    'clientTerminalMs',
  ])
    report[key] = summary(measurements.map((x) => x[key]));
  report.unexpectedHttp = requests
    .filter((x) => x.status !== x.expectedStatus)
    .map(({ phase, status }) => ({ phase, status }));
  report.httpStatusCounts = requests.reduce(
    (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
    {},
  );
  report.expectedGuard429 = requests.filter(
    (x) => x.phase === 'expected-own-inflight-rejection' && x.status === 429,
  ).length;
  const terminalP95 = percentile(
    measurements.map((x) => x.clientTerminalMs),
    0.95,
  );
  report.resultP95Within30Seconds =
    measurements.length === 50 && terminalP95 <= 30000;
  report.resultP95Within60Seconds =
    measurements.length === 50 && terminalP95 <= 60000;
  for (const child of [...children].reverse()) {
    if (
      child.spawnFailed ||
      child.exitCode !== null ||
      child.signalCode !== null
    )
      continue;
    child.kill('SIGTERM');
    const end = Date.now() + 15000;
    while (
      child.exitCode === null &&
      child.signalCode === null &&
      Date.now() < end
    )
      await delay(100);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((r) => child.once('exit', r));
      child.kill('SIGKILL');
      await exited;
    }
  }
  try {
    if (queue) {
      assert(/^cswork-oj-50-test-[a-f0-9-]+$/.test(queueName));
      await queue.obliterate({ force: true });
    }
  } catch (error) {
    report.status = 'failed';
    report.cleanupFailure = error.message;
    process.exitCode = 1;
  } finally {
    if (queue) await queue.close();
    db?.close();
    assert(
      dirname(dbPath) === dir &&
        dir.startsWith(join(tmpdir(), 'cswork-oj-50-')),
    );
    rmSync(dir, { recursive: true, force: true });
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  console.log(JSON.stringify(report));
  if (reportPath)
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
}
if (failure)
  console.error('Isolated50-user baseline failed: ' + failure.message);
