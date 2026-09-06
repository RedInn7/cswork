/**
 * Real HTTP -> SQLite outbox -> isolated BullMQ worker -> go-judge.
 * Run against an exclusive, migrated localhost staging app (no other OJ worker).
 * Uses only synthetic fixtures; never reads or changes imported library questions.
 * Required: DATABASE_PATH, BETTER_AUTH_SECRET, ADMIN_EMAILS, TEST_WORKER_ENTRY.
 * Optional: TEST_URL, TEST_ADMIN_EMAIL (must occur in ADMIN_EMAILS), OJ_QUEUE_NAME.
 * The caller starts the staging app. This script starts and owns only its worker.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { removeOwnTestQueueJobs } from './oj-queue-cleanup.mjs';

const base = new URL(process.env.TEST_URL || 'http://localhost:4318');
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
const prefix = `oj-structured:${runId}`;
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
async function request(path, { user, data, status = 200 } = {}) {
  const response = await fetch(new URL(`/api/${path}`, base), {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(user ? { Cookie: user.cookie } : {}),
      ...(data === undefined
        ? {}
        : { 'Content-Type': 'application/json', Origin: origin }),
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
  worker = spawn(process.execPath, [workerEntry], {
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
async function publish(name, checker, pairs, outputLimit = 64) {
  const id = `oj-structured-${runId}-${name}`;
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
      title: `Structured integration ${name}`,
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
async function verdict(name, problemId, language, code, expected) {
  const user = identity(name);
  const created = await request('oj/submissions', {
    user,
    status: 201,
    data: {
      problemId,
      language,
      code,
      mode: 'judge',
      idempotencyKey: randomUUID().replaceAll('-', ''),
    },
  });
  assert.ok(created.id, 'Submission ID missing');
  submissionIds.add(created.id);
  assert.ok(
    db
      .prepare('SELECT submission_id FROM oj_outbox WHERE submission_id=?')
      .get(created.id),
    'Submission bypassed outbox',
  );
  let detail;
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    detail = await request(`oj/submissions/${created.id}`, { user });
    if (!active.has(detail.status)) break;
    await delay(800);
  }
  assert.equal(detail?.status, expected, `${name}: unexpected verdict`);
  assert.ok(
    db
      .prepare('SELECT dispatched_at FROM oj_outbox WHERE submission_id=?')
      .get(created.id)?.dispatched_at,
    'Outbox was not dispatched',
  );
  assert.ok(detail.total >= 2, `${name}: cases missing`);
  if (expected === 'accepted') {
    assert.equal(detail.passed, detail.total);
    assert.equal(detail.score, 100);
  } else assert.ok(detail.passed < detail.total);
  const hidden = detail.cases.filter((c) => c.hidden);
  assert.ok(hidden.length > 0);
  for (const c of hidden)
    for (const key of [
      'input',
      'stdin',
      'expected',
      'expectedOutput',
      'stdout',
      'stderr',
    ])
      assert.equal(
        Object.hasOwn(c, key),
        false,
        `Hidden fixture exposed ${key}`,
      );
  checks++;
  console.log(`PASS ${name}: ${expected}`);
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
      for (const id of problemIds) {
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
        db.prepare(
          'UPDATE oj_problems SET published=0,current_version_id=NULL WHERE id=?',
        ).run(id);
        db.prepare(
          'DELETE FROM oj_test_cases WHERE version_id IN (SELECT id FROM oj_problem_versions WHERE problem_id=?)',
        ).run(id);
        db.prepare('DELETE FROM oj_problem_versions WHERE problem_id=?').run(
          id,
        );
        db.prepare('DELETE FROM oj_problems WHERE id=?').run(id);
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

const intSolutions = {
  python: `import sys\na=list(map(int,sys.stdin.buffer.read().split())); n=a[0]; a=a[1:]; a.reverse()\nprint(n); print(*a)\n`,
  cpp: `#include <iostream>\n#include <vector>\nusing namespace std; int main(){int n;cin>>n;vector<long long>a(n);for(auto &v:a)cin>>v;cout<<n<<'\\n';for(int i=n-1;i>=0;i--)cout<<a[i]<<' ';cout<<'\\n';}\n`,
  go: `package main\nimport("bufio";"fmt";"os")\nfunc main(){in:=bufio.NewReader(os.Stdin);var n int;fmt.Fscan(in,&n);a:=make([]int64,n);for i:=range a{fmt.Fscan(in,&a[i])};out:=bufio.NewWriter(os.Stdout);defer out.Flush();fmt.Fprintln(out,n);for i:=n-1;i>=0;i--{fmt.Fprint(out,a[i]," ")};fmt.Fprintln(out)}\n`,
  java: `import java.util.*; public class Main{public static void main(String[]args){Scanner s=new Scanner(System.in);int n=s.nextInt();long[]a=new long[n];for(int i=0;i<n;i++)a[i]=s.nextLong();System.out.println(n);for(int i=n-1;i>=0;i--)System.out.print(a[i]+" ");System.out.println();}}\n`,
};
try {
  teacher = identity('teacher', true);
  await startWorker();
  const ints = [
    '3\n9007199254740993 -9007199254740995 9223372036854775807\n',
    '4\n-9223372036854775808 9007199254740992 9007199254740993 0\n',
  ];
  const intId = await publish(
    'int-set',
    'int-set',
    ints.map((s) => [s, s]),
  );
  const languages = Object.keys(intSolutions);
  // Bound compile/run parallelism to the worker's two slots.
  for (let i = 0; i < languages.length; i += 2) {
    const results = await Promise.allSettled(
      languages
        .slice(i, i + 2)
        .map((language) =>
          verdict(
            `int-${language}`,
            intId,
            language,
            intSolutions[language],
            'accepted',
          ),
        ),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  await verdict(
    'int-duplicate',
    intId,
    'python',
    'import sys\na=sys.stdin.read().split(); a[2]=a[1]; print(a[0]); print(*a[1:])\n',
    'wrong_answer',
  );
  const strings = ['3\n\n \n alpha \n', '4\n\n  \n beta\ngamma \n'];
  const stringId = await publish(
    'string-set',
    'string-set',
    strings.map((s) => [s, s]),
  );
  const lines =
    'import sys\nn=int(sys.stdin.readline()); a=[sys.stdin.readline().rstrip("\\n") for _ in range(n)]\n';
  await verdict(
    'string-reordered',
    stringId,
    'python',
    lines + 'print(n)\nfor s in reversed(a): print(s)\n',
    'accepted',
  );
  await verdict(
    'string-duplicate',
    stringId,
    'python',
    lines + 'a[1]=a[0]\nprint(n)\nfor s in a: print(s)\n',
    'wrong_answer',
  );
  const exactId = await publish(
    'exact',
    'exact',
    ['  hello world  \n', '  another   line \n'].map((s) => [s, s]),
  );
  await verdict(
    'exact-spaces',
    exactId,
    'python',
    'import sys\nsys.stdout.write(sys.stdin.read())\n',
    'accepted',
  );
  await verdict(
    'exact-trim',
    exactId,
    'python',
    'import sys\nprint(sys.stdin.read().strip())\n',
    'wrong_answer',
  );
  const orderedId = await publish(
    'ordered',
    'tokens',
    ['3\n1 2 3\n', '4\n9 -2 0 7\n'].map((s) => [s, s]),
  );
  await verdict(
    'ordered-correct',
    orderedId,
    'python',
    'import sys\nsys.stdout.write(sys.stdin.read())\n',
    'accepted',
  );
  await verdict(
    'ordered-reversed',
    orderedId,
    'python',
    intSolutions.python,
    'wrong_answer',
  );
  const largeId = await publish(
    'large',
    'exact',
    [
      ['3\n', 'xxx\n'],
      ['70000\n', 'x'.repeat(70000) + '\n'],
    ],
    128,
  );
  await verdict(
    'output-128k',
    largeId,
    'python',
    'print("x"*int(input()))\n',
    'accepted',
  );
  console.log(
    `PASS structured OJ: ${checks} verdicts, ${requests} HTTP requests`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Structured OJ integration failed',
  );
  process.exitCode = 1;
} finally {
  await cleanup();
}
