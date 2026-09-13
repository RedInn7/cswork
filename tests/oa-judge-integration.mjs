/** Real built web + worker acceptance. Fresh DB only; dedicated loopback runner 5054.
 * Requires REDIS_URL, GO_JUDGE_URL, GO_JUDGE_TOKEN and private sandbox-report.json.
 * This intentionally does not run in CI. Never reads or copies a production DB.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID, createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Queue } from 'bullmq';

const root = resolve('.');
const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(
  runner.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(runner.hostname) &&
    runner.port === '5054',
  'Dedicated loopback runner on 5054 required',
);
assert(
  process.env.REDIS_URL && process.env.GO_JUDGE_TOKEN,
  'Redis and sandbox credentials required',
);
const redis = new URL(process.env.REDIS_URL);
assert(['redis:', 'rediss:'].includes(redis.protocol));
const webEntry = resolve(
  process.env.TEST_WEB_ENTRY || 'dist/standalone/server.js',
);
const artifact = dirname(webEntry);
const workerEntry = resolve(
  process.env.TEST_WORKER_ENTRY || 'dist/standalone/oj-worker/index.mjs',
);
const registry = JSON.parse(
  readFileSync('content/oa-judge/registry.json', 'utf8'),
);
assert.equal(
  registry.items.length,
  6,
  'Expected the reviewed six-question batch',
);
assert.deepEqual(
  JSON.parse(
    readFileSync(join(artifact, 'content/oa-judge/registry.json'), 'utf8'),
  ),
  registry,
  'Built private registry must match source',
);
const dir = mkdtempSync(join(tmpdir(), 'cswork-oa-judge-test-'));
chmodSync(dir, 0o700);
const dbPath = join(dir, 'test.sqlite');
const queueName = `cswork-oa-test-${randomUUID()}`;
const secret = randomUUID() + randomUUID();
const base = 'http://127.0.0.1:4318';
const teacherEmail = `teacher-${randomUUID()}@example.test`;
const env = {
  PATH: process.env.PATH,
  NODE_ENV: 'production',
  NODE_OPTIONS: '--max-old-space-size=768',
  DATABASE_PATH: dbPath,
  APP_URL: base,
  BETTER_AUTH_SECRET: secret,
  ADMIN_EMAILS: teacherEmail,
  HOST: '127.0.0.1',
  PORT: '4318',
  OJ_ENABLED: 'true',
  OJ_QUEUE_NAME: queueName,
  OJ_WORKER_CONCURRENCY: '1',
  OJ_PRECOMPILE_ENABLED: 'false',
  GO_JUDGE_URL: runner.href,
  GO_JUDGE_TOKEN: process.env.GO_JUDGE_TOKEN,
  REDIS_URL: process.env.REDIS_URL,
};
let db,
  web,
  worker,
  queue,
  interrupted = false;
const children = [];
const interrupt = () => {
  interrupted = true;
};
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
function child(args, cwd) {
  const processChild = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(processChild);
  processChild.logs = '';
  for (const stream of [processChild.stdout, processChild.stderr])
    stream.on('data', (chunk) => {
      processChild.logs = (processChild.logs + chunk).slice(-4000);
    });
  processChild.on('error', (error) => {
    processChild.spawnError = error;
  });
  return processChild;
}
async function until(check, budget = 60000) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) {
    assert(!interrupted, 'Integration interrupted');
    for (const processChild of [web, worker].filter(Boolean))
      assert(
        !processChild.spawnError &&
          processChild.exitCode === null &&
          processChild.signalCode === null,
        'Isolated child exited: ' + processChild.logs,
      );
    const value = await check();
    if (value) return value;
    await delay(100);
  }
  throw new Error('OA integration timed out');
}
function identity(email) {
  const uid = randomUUID(),
    token = randomUUID(),
    now = Date.now();
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, 'Synthetic OA learner', email, 1, now, now);
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return {
    uid,
    cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`,
  };
}
async function request(path, user, status = 200, data) {
  const response = await fetch(base + path, {
    method: data ? 'POST' : 'GET',
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(user ? { Cookie: user.cookie } : {}),
      ...(data ? { Origin: base, 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return result;
}
try {
  await new Promise((accept, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(4318, '127.0.0.1', () => probe.close(accept));
  });
  db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  identity(teacherEmail);
  db.prepare(
    "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Synthetic course','Test','1',1)",
  ).run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  const students = registry.items.map(() => {
    const email = `student-${randomUUID()}@example.test`;
    const user = identity(email);
    db.prepare(
      "INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,'gomall','test',?)",
    ).run(randomUUID(), email, Date.now());
    return user;
  });
  const publisher = child(
    [
      '--import',
      'tsx',
      'scripts/publish-oa-judge.ts',
      resolve('content/oa-judge/sandbox-report.json'),
      teacherEmail,
    ],
    root,
  );
  const publishCode = await new Promise((accept, reject) => {
    publisher.once('exit', accept);
    publisher.once('error', reject);
  });
  assert.equal(
    publishCode,
    0,
    'Fresh DB publication failed: ' + publisher.logs,
  );
  assert.equal(
    db.prepare('SELECT count(*) AS n FROM oj_problems WHERE published=1').get()
      .n,
    6,
  );
  worker = child([workerEntry], artifact);
  web = child([webEntry], artifact);
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
  await request('/api/oj/oa-library', null, 401);
  const readyList = await request('/api/oj/oa-library?ready=1', students[0]);
  assert.equal(readyList.total, 6);
  assert(readyList.items.every(item => item.judgeStatus === 'ready' && item.judgeProblemId === item.id));
  const payload = (id, code, mode = 'judge') => ({
    problemId: id,
    language: 'python',
    codingMode: 'acm',
    mode,
    code,
    idempotencyKey: randomUUID(),
  });
  await request(
    '/api/oj/submissions',
    null,
    401,
    payload(registry.items[0].id, 'print(-1)'),
  );
  await request(
    '/api/oj/submissions',
    students[0],
    409,
    payload('oa-unknown-fixture-1', 'print(-1)'),
  );
  const failures = [];
  for (const [index, item] of registry.items.entries()) {
    const student = students[index];
    const pkg = JSON.parse(
      readFileSync(`content/oa-judge/packages/${item.id}.json`, 'utf8'),
    );
    const reference = readFileSync(
      `content/oa-judge/references/${item.id}.py`,
      'utf8',
    );
    const detail = await request(`/api/oj/oa-library/${item.id}`, student);
    assert.equal(detail.judgeStatus, 'ready');
    assert.equal(detail.judgeProblemId, item.id);
    const editorial = await request(
      `/api/oj/oa-library/${item.id}/solution`,
      student,
    );
    assert.equal(editorial.explanation, item.editorial);
    assert.deepEqual(editorial.solutions, item.authoredSolutions);
    for (const mode of ['run', 'judge']) {
      const submitted = await request(
        '/api/oj/submissions',
        student,
        201,
        payload(item.id, reference, mode),
      );
      const terminal = await until(() => {
        const row = db
          .prepare('SELECT status,finished_at FROM submissions WHERE id=?')
          .get(submitted.id);
        return row?.finished_at !== null ? row : null;
      });
      assert.equal(terminal.status, 'accepted', `${item.id} ${mode}`);
      const feedback = await request(
        `/api/oj/submissions/${submitted.id}`,
        student,
      );
      const count =
        mode === 'run'
          ? pkg.cases.filter((c) => !c.hidden).length
          : pkg.cases.length;
      assert.equal(feedback.passed, count);
      assert.equal(
        db
          .prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?')
          .get(submitted.id).n,
        count,
      );
    }
    const start = Date.now();
    const submitted = await request(
      '/api/oj/submissions',
      student,
      201,
      payload(item.id, 'print(-1)\n'),
    );
    await until(
      () =>
        db
          .prepare('SELECT finished_at FROM submissions WHERE id=?')
          .get(submitted.id)?.finished_at !== null,
    );
    const feedback = await request(
      `/api/oj/submissions/${submitted.id}`,
      student,
    );
    assert.equal(feedback.status, 'wrong_answer');
    assert.equal(feedback.firstFailure.ordinal, 0);
    assert.equal(feedback.firstFailure.stdin, pkg.cases[0].input);
    assert.equal(feedback.firstFailure.expected, pkg.cases[0].expectedOutput);
    assert.equal(feedback.firstFailure.stdout.trim(), '-1');
    assert.equal(feedback.passed, 0);
    assert.equal(
      db
        .prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?')
        .get(submitted.id).n,
      1,
    );
    failures.push(submitted.id);
    await request(`/api/oj/submissions/${submitted.id}`, null, 401);
    await request(
      `/api/oj/submissions/${submitted.id}`,
      students[(index + 1) % students.length],
      404,
    );
    console.log(
      JSON.stringify({
        event: 'oa_api_judge_verified',
        id: item.id,
        samples: pkg.cases.filter((c) => !c.hidden).length,
        judgeCases: pkg.cases.length,
        wrongAnswerMs: Date.now() - start,
        firstFailureReturned: true,
      }),
    );
  }
  await delay(1000);
  for (const id of failures)
    assert.equal(
      db
        .prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?')
        .get(id).n,
      1,
      'Later cases persisted after first failure',
    );
  console.log(
    JSON.stringify({
      event: 'oa_judge_integration_complete',
      problems: 6,
      submissions: 18,
      scope:
        'fresh SQLite + isolated queue + real built web/worker + dedicated runner',
      productionDataUsed: false,
    }),
  );
} finally {
  for (const processChild of children.reverse()) {
    if (
      processChild.exitCode !== null ||
      processChild.signalCode !== null ||
      processChild.spawnError
    )
      continue;
    processChild.kill('SIGTERM');
    const deadline = Date.now() + 15000;
    while (
      processChild.exitCode === null &&
      processChild.signalCode === null &&
      Date.now() < deadline
    )
      await delay(100);
    if (processChild.exitCode === null && processChild.signalCode === null) {
      const exited = new Promise((accept) => processChild.once('exit', accept));
      processChild.kill('SIGKILL');
      await exited;
    }
  }
  try {
    assert(/^cswork-oa-test-[a-f0-9-]+$/.test(queueName));
    queue = new Queue(queueName, {
      connection: {
        host: redis.hostname,
        port: Number(redis.port || 6379),
        username: decodeURIComponent(redis.username) || undefined,
        password: decodeURIComponent(redis.password) || undefined,
        db: Number(redis.pathname.slice(1) || 0),
        ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    });
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
