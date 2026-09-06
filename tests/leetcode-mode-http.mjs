/**
 * Real practice-round HTTP suite, localhost:4319 and an EMPTY migrated test DB.
 * Starts only its own isolated queue worker; caller owns web app/build lifecycle.
 * Required: DATABASE_PATH, BETTER_AUTH_SECRET, ADMIN_EMAILS, TEST_WORKER_ENTRY.
 * OJ_QUEUE_NAME must also be configured identically on the isolated web app.
 * Synthetic fixtures only; no imported questions, credentials, or hidden data logged.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { removeOwnTestQueueJobs } from './oj-queue-cleanup.mjs';

const base = new URL(process.env.TEST_URL || 'http://localhost:4319');
assert.ok(
  base.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Requires localhost HTTP staging app',
);
assert.ok(
  process.env.DATABASE_PATH &&
    /(^|[/_.-])(test|staging)([/_.-]|$)/i.test(process.env.DATABASE_PATH),
  'Requires isolated test/staging DATABASE_PATH',
);
const secret = process.env.BETTER_AUTH_SECRET;
assert.ok(secret?.length >= 32, 'Requires staging BETTER_AUTH_SECRET');
const workerEntry = resolve(process.env.TEST_WORKER_ENTRY || '');
assert.ok(
  process.env.TEST_WORKER_ENTRY && existsSync(workerEntry),
  'Requires built TEST_WORKER_ENTRY',
);
const runId = randomUUID();
const prefix = `coding-modes:${runId}`;
const queueName = process.env.OJ_QUEUE_NAME || `cswork-oj-test-${runId}`;
assert.match(
  queueName,
  /^(cswork-oj-test-|test-)[a-zA-Z0-9_-]+$/,
  'Requires test-only queue name',
);
const admins = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const adminEmail =
  process.env.TEST_ADMIN_EMAIL?.trim().toLowerCase() || admins[0];
assert.ok(
  adminEmail && admins.includes(adminEmail),
  'Requires unused staging admin identity',
);
const db = new Database(resolve(process.env.DATABASE_PATH));
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
assert.equal(base.port, '4319', 'This suite requires isolated port 4319');
assert.equal(
  db.prepare('SELECT count(*) AS n FROM oj_problems').get().n,
  0,
  'Requires empty isolated problem database',
);
assert.equal(
  db.prepare('SELECT COUNT(*) AS n FROM user').get().n,
  0,
  'Requires fresh isolated identity database',
);
const origin = process.env.APP_URL || base.origin;
const identities = [],
  problemIds = new Set(),
  submissionIds = new Set();
const active = new Set(['queued', 'compiling', 'running']);
let worker,
  workerError,
  cleanupPromise,
  teacher,
  checks = 0,
  requests = 0;
let ownsRuntime = false;
let peakWorkerRssKiB = 0;
function observeWorkerMemory() {
  if (!worker?.pid || process.platform !== 'linux') return;
  try {
    const status = readFileSync(`/proc/${worker.pid}/status`, 'utf8');
    const match = status.match(/^VmHWM:\s+(\d+) kB$/m);
    if (match) peakWorkerRssKiB = Math.max(peakWorkerRssKiB, Number(match[1]));
  } catch {}
}
const previousRuntime = db
  .prepare("SELECT * FROM oj_runtime WHERE id='worker'")
  .get();

function identity(name, isTeacher = false) {
  const uid = `${prefix}:${name}`;
  const email = isTeacher ? adminEmail : `${name}.${runId}@example.test`;
  assert.ok(
    !db.prepare('SELECT id FROM user WHERE email=?').get(email),
    'Fixture identity already exists; refusing to reuse it',
  );
  const now = Date.now(),
    token = randomUUID();
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, name, email, 1, now, now);
  identities.push({ uid, email });
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  db.prepare(
    'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
  ).run(`${uid}:grant`, email, 'gomall', prefix, now);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return {
    uid,
    cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`,
  };
}
async function request(
  path,
  { user, data, status = 200, requestOrigin = origin } = {},
) {
  const response = await fetch(new URL(`/api/${path}`, base), {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(user ? { Cookie: user.cookie } : {}),
      ...(data === undefined
        ? {}
        : { 'Content-Type': 'application/json', Origin: requestOrigin }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });
  requests++;
  // Do not dump response bodies, credentials, runtime configuration, or case data.
  assert.equal(response.status, status, `HTTP ${path}: unexpected status`);
  return response.json();
}
async function startWorker() {
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM submissions WHERE status IN ('queued','compiling','running')",
      )
      .get().n,
    0,
    'Staging has active submissions; refusing to process unrelated work',
  );
  assert.ok(
    !previousRuntime?.healthy ||
      previousRuntime.heartbeat_at < Date.now() - 60000,
    'Stop the existing staging worker before this test',
  );
  worker = spawn(process.execPath, ['--max-old-space-size=3072', workerEntry], {
    cwd: process.cwd(),
    env: { ...process.env, OJ_QUEUE_NAME: queueName },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ownsRuntime = true;
  // Drain pipes without printing potentially sensitive runner diagnostics.
  worker.stdout.resume();
  worker.stderr.resume();
  worker.on('error', () => {
    workerError = true;
  });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    assert.ok(
      !workerError && worker.exitCode === null && worker.signalCode === null,
      'Test worker exited before readiness',
    );
    if ((await request('oj/status', { user: teacher })).available) return;
    await delay(1000);
  }
  throw new Error('Test worker/runner did not become ready in 60 seconds');
}
async function stopWorker() {
  if (!worker?.pid || worker.exitCode !== null || worker.signalCode !== null)
    return;
  observeWorkerMemory();
  worker.kill('SIGCONT');
  worker.kill('SIGTERM');
  const until = Date.now() + 23000;
  while (
    worker.exitCode === null &&
    worker.signalCode === null &&
    Date.now() < until
  )
    await delay(100);
  if (worker.exitCode === null && worker.signalCode === null) {
    worker.kill('SIGKILL');
    while (worker.exitCode === null && worker.signalCode === null)
      await delay(50);
  }
}
async function publish(name, checker, pairs, outputLimit = 64, options = {}) {
  const id = options.id || `oj-final-protocols-${runId}-${name}`;
  assert.ok(
    !db.prepare('SELECT id FROM oj_problems WHERE id=?').get(id),
    'Fixture problem already exists',
  );
  problemIds.add(id);
  const payload = {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: `Coding mode integration ${name}`,
      difficulty: '简单',
      tags: ['集成测试'],
      description:
        'Synthetic staging-only protocol fixture. Echo the supplied data using the specified output format.',
      input: 'Synthetic input supplied by this integration test.',
      output:
        'Preserve values and required whitespace; follow the selected checker protocol.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit,
      checker,
      ...(options.specialId === undefined
        ? {}
        : { specialId: options.specialId }),
      ...(options.stringStructureId === undefined
        ? {}
        : { stringStructureId: options.stringStructureId }),
      ...(options.complexDesignId === undefined
        ? {}
        : { complexDesignId: options.complexDesignId }),
      ...(options.semanticId === undefined
        ? {}
        : { semanticId: options.semanticId }),
      languages: ['python', 'cpp', 'go', 'java'],
    },
    cases: pairs.map(([input, expectedOutput], i) => ({
      name: i ? `hidden-${i}` : 'sample',
      input,
      expectedOutput,
      hidden: i > 0,
      weight: 1,
    })),
  };
  if (options.probeMissingInput) {
    const invalid = structuredClone(payload);
    delete invalid.cases[0].input;
    await request('oj/admin/problems/save', {
      user: teacher,
      status: 400,
      data: { payload: invalid, expectedRevision: null },
    });
    checks++;
    console.log('PASS semantic missing input: HTTP 400');
  }
  const saved = await request('oj/admin/problems/save', {
    user: teacher,
    data: { payload, expectedRevision: null },
  });
  assert.ok(saved.draft?.revision > 0, 'Draft revision missing');
  await request(`oj/admin/problems/${id}/publish`, {
    user: teacher,
    data: { expectedRevision: saved.draft.revision },
  });
  const published = db
    .prepare(
      'SELECT current_version_id FROM oj_problems WHERE id=? AND published=1',
    )
    .get(id);
  assert.ok(published?.current_version_id, 'Fixture was not published');
  return id;
}
function cleanup() {
  return (cleanupPromise ??= (async () => {
    await stopWorker();
    // Recover IDs even if an HTTP response failed after the transaction committed.
    for (const { uid } of identities)
      for (const row of db
        .prepare('SELECT id FROM submissions WHERE user_id=?')
        .all(uid))
        submissionIds.add(row.id);
    await removeOwnTestQueueJobs(
      queueName,
      submissionIds,
      process.env.REDIS_URL,
      (count) =>
        console.log(`Waiting for ${count} owned job leases before cleanup`),
    );
    db.transaction(() => {
      for (const { uid } of identities)
        db.prepare('DELETE FROM submissions WHERE user_id=?').run(uid);
      for (const { uid } of identities)
        db.prepare('DELETE FROM practice_rounds WHERE user_id=?').run(uid);
      for (const id of problemIds) {
        db.prepare('DELETE FROM study_library WHERE judge_problem_id=?').run(
          id,
        );
        assert.equal(
          db
            .prepare('SELECT COUNT(*) AS n FROM submissions WHERE problem_id=?')
            .get(id).n,
          0,
          'Refusing to remove a fixture with unrelated submissions',
        );
        assert.equal(
          db
            .prepare(
              'SELECT COUNT(*) AS n FROM oj_problem_versions WHERE problem_id=? AND created_by<>?',
            )
            .get(id, teacher.uid).n,
          0,
          'Refusing to remove foreign versions',
        );
        // Published versions and cases are immutable, including test fixtures.
        // Withdraw this run's synthetic problems while retaining their history.
        db.prepare('UPDATE oj_problems SET published=0 WHERE id=?').run(id);
      }
      for (const { uid, email } of identities) {
        db.prepare('DELETE FROM grants WHERE email=? AND source=?').run(
          email,
          prefix,
        );
        db.prepare('DELETE FROM limits WHERE key LIKE ?').run(`${uid}:%`);
        db.prepare('DELETE FROM audit WHERE actor_id=?').run(uid);
        db.prepare('DELETE FROM profiles WHERE id=?').run(uid);
        db.prepare('DELETE FROM user WHERE id=?').run(uid);
      }
      if (ownsRuntime) {
        if (previousRuntime)
          db.prepare(
            "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,?,?) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,healthy=excluded.healthy,details=excluded.details",
          ).run(
            previousRuntime.heartbeat_at,
            previousRuntime.healthy,
            previousRuntime.details,
          );
        else db.prepare("DELETE FROM oj_runtime WHERE id='worker'").run();
      }
    })();
  })().finally(() => db.close()));
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });

async function submit(
  user,
  code = 'import sys\nprint(sys.stdin.read())\n',
  mode = 'judge',
) {
  const created = await request('oj/submissions', {
    user,
    status: 201,
    data: {
      problemId: 'lc-26',
      language: 'python',
      code,
      mode,
      idempotencyKey: randomUUID(),
      ...(mode === 'run' ? { stdin: '7\n' } : {}),
    },
  });
  submissionIds.add(created.id);
  return created;
}
async function finish(user, id, expected) {
  const until = Date.now() + 60000;
  let detail;
  do {
    detail = await request(`oj/submissions/${id}`, { user });
    if (!active.has(detail.status)) break;
    await delay(300);
  } while (Date.now() < until);
  assert.equal(detail?.status, expected, 'Unexpected terminal verdict');
  observeWorkerMemory();
  return detail;
}
async function state(user) {
  return request('oj/practice-rounds', { user });
}
async function library(user) {
  return request('oj/library', { user });
}
function passed(name) {
  checks++;
  console.log(`PASS ${name}`);
}
try {
  teacher = identity('teacher', true);
  const learner = identity('learner');
  await startWorker();
  await publish(
    'two-sum',
    'int-set',
    [
      ['4\n2 7 11 15\n9\n', '2\n0 1\n'],
      ['3\n3 2 4\n6\n', '2\n1 2\n'],
    ],
    64,
    { id: 'lc-1' },
  );
  const version = db
    .prepare("SELECT current_version_id FROM oj_problems WHERE id='lc-1'")
    .get().current_version_id;
  db.prepare(
    "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','synthetic',2,2,'lc-1',?,?)",
  ).run('synthetic:' + version, Date.now());
  const metadata = await request('oj/problems/lc-1', { user: learner });
  assert.deepEqual(metadata.codingModes, ['leetcode', 'acm']);
  assert.match(metadata.leetcodeTemplates.python, /def twoSum/);
  assert.ok(!JSON.stringify(metadata).includes('_cswork_runtime'));
  const solutions = {
    python:
      'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, value in enumerate(nums):\n            if target-value in seen: return [seen[target-value],i]\n            seen[value] = i\n',
    cpp: 'class Solution {public: vector<int> twoSum(vector<int>& a,int t){unordered_map<int,int> m;for(int i=0;i<(int)a.size();i++){if(m.count(t-a[i]))return {m[t-a[i]],i};m[a[i]]=i;}return {};}};',
    java: 'class Solution { public int[] twoSum(int[] a, int t) { java.util.Map<Integer,Integer> m=new java.util.HashMap<>(); for(int i=0;i<a.length;i++){if(m.containsKey(t-a[i]))return new int[]{m.get(t-a[i]),i};m.put(a[i],i);}return new int[]{};}}',
    go: 'func twoSum(nums []int, target int) []int { seen:=map[int]int{}; for i,v:=range nums { if j,ok:=seen[target-v];ok{return []int{j,i}};seen[v]=i };return nil }',
  };
  const send = async (data, status = 201) => {
    const value = await request('oj/submissions', {
      user: learner,
      status,
      data: {
        problemId: 'lc-1',
        mode: 'judge',
        idempotencyKey: randomUUID(),
        ...data,
      },
    });
    if (value.id) submissionIds.add(value.id);
    return value;
  };
  for (const [language, code] of Object.entries(solutions)) {
    db.prepare('DELETE FROM limits').run();
    const key = randomUUID();
    const submission = await send({
      language,
      code,
      codingMode: 'leetcode',
      idempotencyKey: key,
    });
    const detail = await finish(learner, submission.id, 'accepted');
    assert.equal(detail.codingMode, 'leetcode');
    assert.equal(detail.code, code);
    assert.equal(detail.passed, 2);
    assert.equal(
      (
        await send({
          language,
          code,
          codingMode: 'leetcode',
          idempotencyKey: key,
        })
      ).id,
      submission.id,
    );
    await send({ language, code, codingMode: 'acm', idempotencyKey: key }, 409);
    const custom = await send({
      language,
      code,
      codingMode: 'leetcode',
      mode: 'run',
      stdin: '[3,2,4]\n6\n',
    });
    const result = await finish(learner, custom.id, 'finished');
    assert.equal(result.codingMode, 'leetcode');
    assert.match(result.cases[0].stdout, /1.*2/s);
    passed(
      language +
        ' real function judge, JSON custom run, idempotency/mode isolation',
    );
  }
  db.prepare('DELETE FROM limits').run();
  const acm =
    'import sys\nv=list(map(int,sys.stdin.read().split()));n=v[0];a=v[1:n+1];t=v[n+1]\nfor i in range(n):\n for j in range(i+1,n):\n  if a[i]+a[j]==t:\n   print(2);print(i,j);raise SystemExit\n';
  const old = await send({ language: 'python', code: acm, codingMode: 'acm' });
  assert.equal((await finish(learner, old.id, 'accepted')).codingMode, 'acm');
  const wrong = await send({
    language: 'python',
    code: 'class Solution:\n def twoSum(self,nums,target): return [0,2]\n',
    codingMode: 'leetcode',
  });
  await finish(learner, wrong.id, 'wrong_answer');
  const compile = await send({
    language: 'cpp',
    code: 'not valid C++',
    codingMode: 'leetcode',
  });
  await finish(learner, compile.id, 'compile_error');
  const history = await request('oj/submissions?problemId=lc-1', {
    user: learner,
  });
  assert.ok(history.items.some((s) => s.codingMode === 'leetcode'));
  assert.ok(history.items.some((s) => s.codingMode === 'acm'));
  passed('ACM compatibility, wrong answer, compilation error and mode history');
  console.log(
    `PASS coding modes: ${checks} scenarios, ${requests} HTTP requests; peak worker ${peakWorkerRssKiB} KiB`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Coding mode integration failed',
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}
