/** Real built web + worker acceptance. Fresh DB only; dedicated loopback runner 5054.
 * Requires REDIS_URL, GO_JUDGE_URL, GO_JUDGE_TOKEN and private sandbox-report.json.
 * This intentionally does not run in CI. Never reads or copies a production DB.
 */
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  chmodSync,
  readFileSync,
  rmSync,
  statSync,
  statfsSync,
} from 'node:fs';
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
import { probeLargeInputs } from './oj-large-input-probe.mjs';

// Public firstFailure contract: each field is capped at 32 KiB, without
// splitting a UTF-8 character (oj-case-store.ts / submissionDetail).
// Check exact content for small fields and the exact bounded prefix for large
// fields, including the explicit truncation flag; never relax the server cap.
function assertFailureField(failure, field, original) {
  const limit = 32768;
  let bytes = 0;
  const prefix = [];
  for (const character of original) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > limit) break;
    prefix.push(character);
    bytes += size;
  }
  assert.equal(
    failure[field],
    prefix.join(''),
    `${field}: exact UTF-8-safe feedback prefix`,
  );
  assert(
    Buffer.byteLength(failure[field], 'utf8') <= limit,
    `${field}: feedback exceeds 32 KiB`,
  );
  assert.equal(
    failure.truncated[field],
    Buffer.byteLength(original, 'utf8') > limit,
    `${field}: truncation flag`,
  );
}

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
const batchName = process.argv[2];
if (batchName) assert.match(batchName, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const selected = batchName
  ? JSON.parse(
      readFileSync(`content/oa-judge/batches/${batchName}.json`, 'utf8'),
    )
  : registry;
assert(selected.items.length >= 2 && selected.items.length <= 100);
for (const entry of selected.items)
  assert.deepEqual(
    registry.items.find((item) => item.id === entry.id),
    entry,
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
  OJ_WORKER_CONCURRENCY: process.env.TEST_LARGE_INPUT === '1' ? '2' : '1',
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
  // SQLite publication can temporarily hold the main DB, WAL and transaction
  // copies. Refuse to start before that can exhaust a shared production disk.
  const storage = statfsSync(dir, { bigint: true });
  const packageBytes = selected.items.reduce(
    (total, item) =>
      total +
      BigInt(statSync(`content/oa-judge/packages/${item.id}.json`).size),
    0n,
  );
  const requiredBytes = 512n * 1024n * 1024n + packageBytes * 6n;
  assert(
    storage.bavail * storage.bsize >= requiredBytes,
    'Insufficient disk reserve for isolated OA publication; free rebuildable cache before testing',
  );
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
  const students = selected.items.map(() => {
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
      ...(batchName
        ? ['--batch', batchName]
        : [resolve('content/oa-judge/sandbox-report.json')]),
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
    selected.items.length,
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
  assert.equal(readyList.total, selected.items.length);
  assert(
    readyList.items.every(
      (item) => item.judgeStatus === 'ready' && item.judgeProblemId === item.id,
    ),
  );
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
    payload(selected.items[0].id, 'print(-1)'),
  );
  await request(
    '/api/oj/submissions',
    students[0],
    409,
    payload('oa-unknown-fixture-1', 'print(-1)'),
  );
  const failures = [];
  const equivalentPrograms = {
    'oa-uber-6': `import sys
d=sys.stdin.read().split();w,p=map(int,d[:2]);i=2
print('*'*(w+4))
for _ in range(p):
 n=int(d[i]);i+=1
 for word in d[i:i+n]:
  extra=w-len(word)
  print('* '+' '*(extra//2)+word+' '*((extra+1)//2)+' *')
 i+=n
print('*'*(w+4))
`,
    // Independent correct implementations with deliberately different choices
    // or formatting. These must be accepted by the real built worker too.
    'oa-meta-16': `import sys, bisect
d=list(map(int,sys.stdin.read().split())); n,k=d[:2]; a=d[2:]; best=None; pair=None
for i in range(n-1):
    at=bisect.bisect_left(a,k-a[i],i+1)
    for j in (at-1,at):
        if i<j<n:
            error=abs(a[i]+a[j]-k)
            if best is None or error<=best: best=error; pair=(a[j],a[i])
print(*pair)
`,
    'oa-meta-17': `import sys
d=list(map(int,sys.stdin.read().split())); a=d[1:][::-1]; lo=0; hi=len(a)-1
while lo<hi:
    mid=(lo+hi)//2
    if a[mid]<a[mid+1]:lo=mid+1
    else:hi=mid
print(len(a)-1-lo)
`,
    'oa-meta-23': `import sys
d=list(map(int,sys.stdin.read().split())); n,w=d[:2]; prefix=[0]
for value in d[2:]:prefix.append(prefix[-1]+value)
answers=[format((prefix[i+w]-prefix[i])/w,'.9e') for i in range(max(0,n-w+1))]
print(len(answers)); print(' '.join(answers))
`,
    'oa-microsoft-15': `import sys
from collections import Counter
d=list(map(int,sys.stdin.read().split())); counts=Counter(d[1:]); current=best=0; previous=None; start=0; bounds=None
for height in sorted(counts):
    if previous is None or height!=previous+1: current=0; start=height
    current+=counts[height]
    if current>=best: best=current; bounds=(start,height)
    if counts[height]==1: current=1; start=height
    previous=height
left,right=bounds; circle=[]
for height in range(left,right+1): circle.append(height); counts[height]-=1
for height in range(right,left-1,-1): circle.extend([height]*counts[height])
circle.reverse(); print(len(circle)); print(*circle)
`,
  };
  for (const id of [
    'oa-uber-25',
    'oa-uber-34',
    'oa-uber-38',
    'oa-uber-57',
    'oa-amazon-136',
    'oa-microsoft-63',
    'oa-nvidia-7',
    'oa-openai-9',
    'oa-ibm-10',
  ])
    if (selected.items.some((item) => item.id === id))
      equivalentPrograms[id] = readFileSync(
        `content/oa-judge/positive-controls/${id}.py`,
        'utf8',
      );
  const wrongOutput = 'CSWORK_DELIBERATE_WRONG_ANSWER';
  for (const [index, item] of selected.items.entries()) {
    const student = students[index];
    const pkg = JSON.parse(
      readFileSync(`content/oa-judge/packages/${item.id}.json`, 'utf8'),
    );
    const reference = readFileSync(
      `content/oa-judge/references/${item.id}.py`,
      'utf8',
    );
    if (item.id === 'oa-google-17') {
      equivalentPrograms[item.id] = `import io,contextlib,math
capture=io.StringIO()
with contextlib.redirect_stdout(capture):
    exec(${JSON.stringify(reference)}, {'__name__':'__main__'})
cells=capture.getvalue().split()
if cells==['null']: print('null')
else:
    n=math.isqrt(len(cells))
    for row in range(n): print(' '.join(cells[(n-1-column)*n+row] for column in range(n)))
`;
    }
    const detail = await request(`/api/oj/oa-library/${item.id}`, student);
    assert.equal(detail.judgeStatus, 'ready');
    assert.equal(detail.judgeProblemId, item.id);
    assert(detail.statement.includes(pkg.problem.description));
    assert(detail.statement.includes(pkg.problem.input));
    assert(detail.statement.includes(pkg.problem.output));
    for (const sample of pkg.cases.filter((c) => !c.hidden)) {
      assert(detail.statement.includes(sample.input.trim()));
      assert(detail.statement.includes(sample.expectedOutput.trim()));
    }
    assert(!('cases' in detail), 'No hidden test suite in OA reader');
    assert(pkg.cases.every((c) => c.expectedOutput.trim() !== wrongOutput));
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
      assert.equal(
        terminal.status,
        mode === 'run' ? 'finished' : 'accepted',
        `${item.id} ${mode}`,
      );
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
    if (equivalentPrograms[item.id]) {
      const submitted = await request(
        '/api/oj/submissions',
        student,
        201,
        payload(item.id, equivalentPrograms[item.id]),
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
      assert.equal(
        feedback.status,
        'accepted',
        `${item.id}: equivalent output rejected`,
      );
      assert.equal(feedback.passed, pkg.cases.length);
      console.log(
        JSON.stringify({
          event: 'oa_equivalent_answer_verified',
          id: item.id,
          cases: pkg.cases.length,
        }),
      );
    }
    const start = Date.now();
    const submitted = await request(
      '/api/oj/submissions',
      student,
      201,
      payload(item.id, `print(${JSON.stringify(wrongOutput)})\n`),
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
    assertFailureField(feedback.firstFailure, 'stdin', pkg.cases[0].input);
    assertFailureField(
      feedback.firstFailure,
      'expected',
      pkg.cases[0].expectedOutput,
    );
    assertFailureField(feedback.firstFailure, 'stdout', wrongOutput + '\n');
    assertFailureField(feedback.firstFailure, 'stderr', '');
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
  // A program that memorizes public samples must fail on a hidden case and
  // expose only that first counterexample, never the rest of the hidden suite.
  const first = selected.items[0];
  const firstPackage = JSON.parse(
    readFileSync(`content/oa-judge/packages/${first.id}.json`, 'utf8'),
  );
  const known = Object.fromEntries(
    firstPackage.cases
      .filter((c) => !c.hidden)
      .map((c) => [c.input, c.expectedOutput]),
  );
  const bad = `import sys, json\nknown=json.loads(${JSON.stringify(JSON.stringify(known))})\nprint(known.get(sys.stdin.read(), ${JSON.stringify(wrongOutput)}), end='')\n`;
  const hiddenOrdinal = firstPackage.cases.findIndex(
    (c) => c.hidden && !(c.input in known),
  );
  assert(hiddenOrdinal >= 3);
  const hiddenSubmit = await request(
    '/api/oj/submissions',
    students[0],
    201,
    payload(first.id, bad),
  );
  await until(
    () =>
      db
        .prepare('SELECT finished_at FROM submissions WHERE id=?')
        .get(hiddenSubmit.id)?.finished_at !== null,
  );
  const hiddenFeedback = await request(
    `/api/oj/submissions/${hiddenSubmit.id}`,
    students[0],
  );
  assert.equal(hiddenFeedback.status, 'wrong_answer');
  assert.equal(hiddenFeedback.firstFailure.ordinal, hiddenOrdinal);
  assertFailureField(
    hiddenFeedback.firstFailure,
    'stdin',
    firstPackage.cases[hiddenOrdinal].input,
  );
  assertFailureField(
    hiddenFeedback.firstFailure,
    'expected',
    firstPackage.cases[hiddenOrdinal].expectedOutput,
  );
  assertFailureField(hiddenFeedback.firstFailure, 'stdout', wrongOutput);
  assertFailureField(hiddenFeedback.firstFailure, 'stderr', '');
  assert.equal(
    db
      .prepare('SELECT count(*) AS n FROM oj_results WHERE submission_id=?')
      .get(hiddenSubmit.id).n,
    hiddenOrdinal + 1,
  );
  assert(
    hiddenFeedback.cases
      .filter((c) => c.hidden)
      .every((c) => !('stdin' in c) && !('expected' in c)),
  );
  if (process.env.TEST_LARGE_INPUT === '1')
    await probeLargeInputs({ db, request, identity, until, web, worker });
  console.log(
    JSON.stringify({
      event: 'oa_judge_integration_complete',
      problems: selected.items.length,
      submissions: db.prepare('SELECT count(*) AS n FROM submissions').get().n,
      hiddenCounterexampleVerified: true,
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
