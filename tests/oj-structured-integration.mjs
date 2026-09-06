/**
 * Real HTTP -> SQLite outbox -> isolated BullMQ worker -> go-judge.
 * Run against an exclusive, migrated localhost staging app (no other OJ worker).
 * Uses only synthetic fixtures; never reads or changes imported library questions.
 * Required: DATABASE_PATH, BETTER_AUTH_SECRET, ADMIN_EMAILS, TEST_WORKER_ENTRY.
 * Optional: TEST_URL, TEST_ADMIN_EMAIL (must occur in ADMIN_EMAILS), OJ_QUEUE_NAME.
 * TEST_LARGE_OUTPUT=1 adds a >16 MiB hidden row answer and real OLE check.
 * The caller starts the staging app. This script starts and owns only its worker.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
  const id = options.id || `oj-structured-${runId}-${name}`;
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
  observeWorkerMemory();
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

const intSolutions = {
  python: `import sys\na=list(map(int,sys.stdin.buffer.read().split())); n=a[0]; a=a[1:]; a.reverse()\nprint(n); print(*a)\n`,
  cpp: `#include <iostream>\n#include <vector>\nusing namespace std; int main(){int n;cin>>n;vector<long long>a(n);for(auto &v:a)cin>>v;cout<<n<<'\\n';for(int i=n-1;i>=0;i--)cout<<a[i]<<' ';cout<<'\\n';}\n`,
  go: `package main\nimport("bufio";"fmt";"os")\nfunc main(){in:=bufio.NewReader(os.Stdin);var n int;fmt.Fscan(in,&n);a:=make([]int64,n);for i:=range a{fmt.Fscan(in,&a[i])};out:=bufio.NewWriter(os.Stdout);defer out.Flush();fmt.Fprintln(out,n);for i:=n-1;i>=0;i--{fmt.Fprint(out,a[i]," ")};fmt.Fprintln(out)}\n`,
  java: `import java.util.*; public class Main{public static void main(String[]args){Scanner s=new Scanner(System.in);int n=s.nextInt();long[]a=new long[n];for(int i=0;i<n;i++)a[i]=s.nextLong();System.out.println(n);for(int i=n-1;i>=0;i--)System.out.print(a[i]+" ");System.out.println();}}\n`,
};
// These intentionally wrong solutions model treating a multiset as a set.
const intDeduplicateSolutions = {
  python: `import sys\na=list(map(int,sys.stdin.buffer.read().split()))[1:]; a=sorted(set(a))\nprint(len(a)); print(*a)\n`,
  cpp: `#include <iostream>\n#include <set>\nusing namespace std;int main(){int n;cin>>n;set<long long>a;for(int i=0;i<n;i++){long long v;cin>>v;a.insert(v);}cout<<a.size()<<'\\n';for(auto v:a)cout<<v<<' ';cout<<'\\n';}\n`,
  go: `package main\nimport("bufio";"fmt";"os")\nfunc main(){in:=bufio.NewReader(os.Stdin);var n int;fmt.Fscan(in,&n);a:=map[int64]bool{};for i:=0;i<n;i++{var v int64;fmt.Fscan(in,&v);a[v]=true};out:=bufio.NewWriter(os.Stdout);defer out.Flush();fmt.Fprintln(out,len(a));for v:=range a{fmt.Fprint(out,v," ")};fmt.Fprintln(out)}\n`,
  java: `import java.util.*;public class Main{public static void main(String[]args){Scanner s=new Scanner(System.in);int n=s.nextInt();Set<Long>a=new TreeSet<>();for(int i=0;i<n;i++)a.add(s.nextLong());System.out.println(a.size());for(long v:a)System.out.print(v+" ");System.out.println();}}\n`,
};
function rowSetSolutions(reverseCells = false) {
  return {
    python: `import sys\nit=iter(sys.stdin.read().split());n=int(next(it));a=[[next(it) for _ in range(int(next(it)))] for _ in range(n)]\n${reverseCells ? 'a=[row[::-1] for row in a]' : 'a.reverse()'}\nprint(n)\nfor row in a: print(len(row),*row)\n`,
    cpp: `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;int main(){int n;cin>>n;vector<vector<string>>a(n);for(auto &row:a){int k;cin>>k;row.resize(k);for(auto &v:row)cin>>v;}${reverseCells ? 'for(auto &row:a)reverse(row.begin(),row.end());' : 'reverse(a.begin(),a.end());'}cout<<n<<'\\n';for(auto &row:a){cout<<row.size();for(auto &v:row)cout<<' '<<v;cout<<'\\n';}}\n`,
    go: `package main\nimport("bufio";"fmt";"os")\nfunc main(){in:=bufio.NewReader(os.Stdin);var n int;fmt.Fscan(in,&n);a:=make([][]string,n);for i:=range a{var k int;fmt.Fscan(in,&k);a[i]=make([]string,k);for j:=range a[i]{fmt.Fscan(in,&a[i][j])}};${reverseCells ? 'for _,row:=range a{for i,j:=0,len(row)-1;i<j;i,j=i+1,j-1{row[i],row[j]=row[j],row[i]}}' : 'for i,j:=0,n-1;i<j;i,j=i+1,j-1{a[i],a[j]=a[j],a[i]}'};out:=bufio.NewWriter(os.Stdout);defer out.Flush();fmt.Fprintln(out,n);for _,row:=range a{fmt.Fprint(out,len(row));for _,v:=range row{fmt.Fprint(out," ",v)};fmt.Fprintln(out)}}\n`,
    java: `import java.util.*;public class Main{public static void main(String[]args){Scanner s=new Scanner(System.in);int n=s.nextInt();List<List<String>>a=new ArrayList<>();for(int i=0;i<n;i++){int k=s.nextInt();List<String>row=new ArrayList<>();for(int j=0;j<k;j++)row.add(s.next());a.add(row);}${reverseCells ? 'for(List<String>row:a)Collections.reverse(row);' : 'Collections.reverse(a);'}System.out.println(n);for(List<String>row:a){System.out.print(row.size());for(String v:row)System.out.print(" "+v);System.out.println();}}}\n`,
  };
}
try {
  teacher = identity('teacher', true);
  await startWorker();
  if (process.env.TEST_SEMANTIC_ONLY !== '1') {
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
    const multisetInputs = [
      '5\n9007199254740993 0 9007199254740993 -2 0\n',
      '6\n-9223372036854775808 7 7 7 -9223372036854775808 0\n',
    ];
    const multisetId = await publish(
      'int-multiset',
      'int-multiset',
      multisetInputs.map((text) => [text, text]),
    );
    // Exercise both AC and clean WA through HTTP in every supported language.
    // Keep only two compilers/runners active at a time, as with the set fixtures.
    for (const { name, solutions, expected } of [
      { name: 'reordered', solutions: intSolutions, expected: 'accepted' },
      {
        name: 'deduplicated',
        solutions: intDeduplicateSolutions,
        expected: 'wrong_answer',
      },
    ]) {
      for (let i = 0; i < languages.length; i += 2) {
        const results = await Promise.allSettled(
          languages
            .slice(i, i + 2)
            .map((language) =>
              verdict(
                `multiset-${name}-${language}`,
                multisetId,
                language,
                solutions[language],
                expected,
              ),
            ),
        );
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
    }
    await verdict(
      'multiset-wrong-count',
      multisetId,
      'python',
      'import sys\na=sys.stdin.read().split(); print(int(a[0])+1); print(*a[1:])\n',
      'wrong_answer',
    );
    await verdict(
      'multiset-wrong-multiplicity',
      multisetId,
      'python',
      'import sys\na=sys.stdin.read().split(); a[-1]=a[1]; print(a[0]); print(*a[1:])\n',
      'wrong_answer',
    );
    const rowInputs = [
      '3\n2 1 2\n0\n2 99999999999999999999999999999999999999999999999999 -0\n',
      '3\n3 3 3 4\n1 -99999999999999999999999999999999999999999999999999\n2 0 9\n',
      '0\n',
    ];
    const rowId = await publish(
      'int-row-set',
      'int-row-set',
      rowInputs.map((text) => [text, text]),
    );
    for (const reverseCells of [false, true]) {
      const solutions = rowSetSolutions(reverseCells);
      for (let i = 0; i < languages.length; i += 2) {
        const results = await Promise.allSettled(
          languages
            .slice(i, i + 2)
            .map((language) =>
              verdict(
                `rows-${reverseCells ? 'inner-wrong' : 'reordered'}-${language}`,
                rowId,
                language,
                solutions[language],
                reverseCells ? 'wrong_answer' : 'accepted',
              ),
            ),
        );
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
    }
    const readRows =
      'import sys\nit=iter(sys.stdin.read().split());n=int(next(it));a=[[next(it) for _ in range(int(next(it)))] for _ in range(n)]\n';
    await verdict(
      'rows-duplicate',
      rowId,
      'python',
      readRows +
        'a=a+[a[0]] if a else a\nprint(len(a))\nfor row in a: print(len(row),*row)\n',
      'wrong_answer',
    );
    await verdict(
      'rows-boundaries',
      rowId,
      'python',
      readRows +
        'a=[[v for row in a for v in row]] if a else a\nprint(len(a))\nfor row in a: print(len(row),*row)\n',
      'wrong_answer',
    );
    await verdict(
      'rows-cpu-limit',
      rowId,
      'python',
      'while True: pass\n',
      'time_limit',
    );
    await verdict(
      'rows-output-limit',
      rowId,
      'python',
      'import sys\nsys.stdout.write("1"*1000000)\n',
      'output_limit',
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
    if (process.env.TEST_LARGE_OUTPUT === '1') {
      const rowOutput = (n) =>
        String(n) +
        '\n' +
        Array.from(
          { length: n },
          (_, i) => '10 ' + i + ' ' + '1234567890 '.repeat(8) + '1234567890\n',
        ).join('');
      const largeRows = rowOutput(200000);
      assert.ok(Buffer.byteLength(largeRows) > 16 * 1024 * 1024);
      const largeRowsId = await publish(
        'large-row-output',
        'int-row-multiset',
        [
          ['2\n', rowOutput(2)],
          ['200000\n', largeRows],
        ],
        32768,
      );
      const emitRows =
        'import sys\nn=int(input());sys.stdout.write(str(n)+"\\n")\nfor i in range(n): sys.stdout.write("10 "+str(i)+" "+"1234567890 "*8+"1234567890\\n")\n';
      await verdict(
        'large-rows-over16m-ac',
        largeRowsId,
        'python',
        emitRows,
        'accepted',
      );
      const overflow =
        'import sys\nn=int(input())\nif n>2: sys.stdout.write("x"*(33*1024*1024))\nelse:\n sys.stdout.write(str(n)+"\\n")\n for i in range(n): sys.stdout.write("10 "+str(i)+" "+"1234567890 "*8+"1234567890\\n")\n';
      await verdict(
        'large-rows-declared32m-ole',
        largeRowsId,
        'python',
        overflow,
        'output_limit',
      );
      const stored = db
        .prepare(
          'SELECT COUNT(*) AS n FROM oj_results WHERE submission_id IN (SELECT id FROM submissions WHERE problem_id=?) AND hidden=1 AND (stdout IS NOT NULL OR stderr IS NOT NULL)',
        )
        .get(largeRowsId);
      assert.equal(
        stored.n,
        0,
        'Hidden large stdout/stderr must not be stored',
      );
      observeWorkerMemory();
      assert.ok(
        peakWorkerRssKiB > 0 && peakWorkerRssKiB < 4 * 1024 * 1024,
        'Worker exceeded its 4 GiB service budget',
      );
      console.log(
        `PASS large output: ${Buffer.byteLength(largeRows)} bytes, worker VmHWM ${peakWorkerRssKiB} KiB`,
      );
    }
  }
  if (process.env.TEST_SEMANTIC_ONLY === '1') {
    const semanticId = await publish(
      'semantic-palindrome',
      'semantic-lc-5',
      [
        ['["babad"]\n', 'bab\n'],
        ['["xbabady"]\n', 'bab\n'],
      ],
      64,
      { id: 'lc-5', semanticId: 5, probeMissingInput: true },
    );
    await verdict(
      'semantic-lc5-aba',
      semanticId,
      'python',
      'print("aba")\n',
      'accepted',
    );
    await verdict(
      'semantic-lc5-bab',
      semanticId,
      'python',
      'print("bab")\n',
      'accepted',
    );
    await verdict(
      'semantic-lc5-xyz',
      semanticId,
      'python',
      'print("xyz")\n',
      'wrong_answer',
    );
  }
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
