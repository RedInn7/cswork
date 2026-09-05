/**
 * Real HTTP -> SQLite outbox -> isolated BullMQ queue -> real go-judge acceptance tests.
 * Run only against a staging app with its own migrated DATABASE_PATH and localhost URL.
 * TEST_WORKER_ENTRY is the built standalone worker; this script owns every child it starts.
 * Optional TEST_RECOVERY=1 exercises worker SIGKILL + pending cancellation recovery.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { Queue } from 'bullmq';

const base = new URL(process.env.TEST_URL || 'http://localhost:4318');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
  base.protocol !== 'http:'
)
  throw new Error('OJ integration tests require a localhost HTTP staging app');
if (
  !process.env.DATABASE_PATH ||
  !/(^|[/_.-])(test|staging)([/_.-]|$)/i.test(process.env.DATABASE_PATH)
)
  throw new Error(
    'DATABASE_PATH must name an isolated test or staging database',
  );
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32)
  throw new Error(
    'Load the staging BETTER_AUTH_SECRET through the environment',
  );
const workerEntry = resolve(process.env.TEST_WORKER_ENTRY || '');
if (!process.env.TEST_WORKER_ENTRY || !existsSync(workerEntry))
  throw new Error(
    'TEST_WORKER_ENTRY must point to the built standalone OJ worker',
  );
const queueName =
  process.env.OJ_QUEUE_NAME || `cswork-oj-test-${randomUUID().slice(0, 12)}`;
if (!/^(cswork-oj-test-|test-)[a-zA-Z0-9_-]+$/.test(queueName))
  throw new Error('OJ_QUEUE_NAME must have a test-only prefix');
const adminEmail = process.env.ADMIN_EMAILS?.split(',')
  .map((s) => s.trim().toLowerCase())
  .find(Boolean);
if (!adminEmail) throw new Error('Staging ADMIN_EMAILS is required');
const origin = process.env.APP_URL || base.origin;
const db = new Database(resolve(process.env.DATABASE_PATH));
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const prefix = `oj-test:${randomUUID()}`;
const identities = [],
  submissionIds = new Set(),
  children = new Set();
let currentWorker;
let workerLog = '';
let requests = 0;
let checks = 0;
let cleaning = false;
const active = new Set(['queued', 'compiling', 'running']);
const solutions = {
  python: `import sys\ndef solve():\n    a=list(map(int,sys.stdin.buffer.read().split()))\n    if not a: return\n    s=sorted(zip(a[1::2],a[2::2]))\n    left,right=s[0]; total=0\n    for l,r in s[1:]:\n        if l>right: total+=right-left; left,right=l,r\n        elif r>right: right=r\n    print(total+right-left)\nsolve()\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n;if(!(cin>>n))return 0;vector<pair<long long,long long>> a(n);for(auto &p:a)cin>>p.first>>p.second;sort(a.begin(),a.end());long long l=a[0].first,r=a[0].second,ans=0;for(int i=1;i<n;i++){if(a[i].first>r){ans+=r-l;l=a[i].first;r=a[i].second;}else r=max(r,a[i].second);}cout<<ans+r-l<<'\\n';}\n`,
  go: `package main\nimport("bufio";"fmt";"os";"sort")\ntype P struct{l,r int64}\nfunc main(){in:=bufio.NewReaderSize(os.Stdin,1<<20);var n int;if _,e:=fmt.Fscan(in,&n);e!=nil{return};a:=make([]P,n);for i:=range a{fmt.Fscan(in,&a[i].l,&a[i].r)};sort.Slice(a,func(i,j int)bool{return a[i].l<a[j].l});l,r,ans:=a[0].l,a[0].r,int64(0);for _,p:=range a[1:]{if p.l>r{ans+=r-l;l,r=p.l,p.r}else if p.r>r{r=p.r}};fmt.Println(ans+r-l)}\n`,
  java: `import java.io.*;import java.util.*;\npublic class Main{static class In{byte[] b=new byte[1<<16];int p,n;int read()throws Exception{if(p==n){n=System.in.read(b);p=0;if(n<0)return -1;}return b[p++];}long next()throws Exception{int c;do{c=read();}while(c<=32&&c>=0);long x=0;while(c>32){x=x*10+c-48;c=read();}return x;}}public static void main(String[]z)throws Exception{In in=new In();int n=(int)in.next();if(n==0)return;long[][]a=new long[n][2];for(int i=0;i<n;i++){a[i][0]=in.next();a[i][1]=in.next();}Arrays.sort(a,Comparator.comparingLong(x->x[0]));long l=a[0][0],r=a[0][1],ans=0;for(int i=1;i<n;i++){if(a[i][0]>r){ans+=r-l;l=a[i][0];r=a[i][1];}else r=Math.max(r,a[i][1]);}System.out.println(ans+r-l);}}\n`,
};

function identity(
  name,
  { teacher = false, verified = true, grant = true } = {},
) {
  const uid = `${prefix}:${name}`,
    email = teacher ? adminEmail : `${name}.${prefix.slice(-12)}@example.test`;
  if (db.prepare('SELECT id FROM user WHERE email=?').get(email))
    throw new Error(`The staging fixture email is already in use: ${email}`);
  const token = randomUUID(),
    now = Date.now();
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, name, email, Number(verified), now, now);
  identities.push({ uid, email });
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  const grantId = `${uid}:grant`;
  if (grant)
    db.prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    ).run(grantId, email, 'gomall', 'oj-integration-test', now);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return {
    uid,
    email,
    grantId,
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
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { error: text.slice(0, 400) };
  }
  assert.equal(
    response.status,
    status,
    `${path}: expected HTTP ${status}, got ${response.status}: ${JSON.stringify(result).slice(0, 1500)}`,
  );
  requests++;
  return result;
}
function startWorker() {
  const child = spawn(process.execPath, [workerEntry], {
    cwd: process.cwd(),
    env: { ...process.env, OJ_QUEUE_NAME: queueName },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  currentWorker = child;
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      workerLog = (workerLog + chunk.toString()).slice(-16000);
    });
  child.on('exit', () => children.delete(child));
  child.on('error', (error) => {
    workerLog = (workerLog + error.message).slice(-16000);
  });
  return child;
}
async function stopWorker(signal = 'SIGTERM') {
  const child = currentWorker;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
  const until = Date.now() + 23000;
  while (
    child.exitCode === null &&
    child.signalCode === null &&
    Date.now() < until
  )
    await delay(100);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    while (child.exitCode === null && child.signalCode === null)
      await delay(50);
  }
}
async function waitHealthy(user) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    if (currentWorker?.exitCode !== null || currentWorker?.signalCode !== null)
      throw new Error(
        `Test worker exited before becoming healthy. ${workerLog}`,
      );
    const state = await request('oj/status', { user });
    if (state.available) return state;
    await delay(1000);
  }
  throw new Error(
    `Runner and worker did not become healthy in 60 seconds. ${workerLog}`,
  );
}
async function create(user, fields = {}, options = {}) {
  const payload = {
    problemId: 'watch-intervals',
    language: 'python',
    code: solutions.python,
    mode: 'judge',
    idempotencyKey: randomUUID().replaceAll('-', ''),
    ...fields,
  };
  const result = await request('oj/submissions', {
    user,
    data: payload,
    status: options.status ?? 201,
  });
  if (result.id) submissionIds.add(result.id);
  return { ...result, payload };
}
async function terminal(user, id, timeout = 120000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await request(`oj/submissions/${id}`, { user });
    if (!active.has(last.status)) return last;
    await delay(800);
  }
  throw new Error(
    `Submission ${id} did not finish: ${JSON.stringify(last)}. ${workerLog}`,
  );
}
function checkHidden(detail) {
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
      assert.equal(Object.hasOwn(c, key), false, `Hidden case exposed ${key}`);
  for (const row of db
    .prepare(
      'SELECT stdout,stderr FROM oj_results WHERE submission_id=? AND hidden=1',
    )
    .all(detail.id)) {
    assert.equal(row.stdout, null);
    assert.equal(row.stderr, null);
  }
}
async function expectVerdict(name, language, code, expected, mode = 'run') {
  const user = identity(name);
  const item = await create(user, {
    language,
    code,
    mode,
    ...(mode === 'run' ? { stdin: '' } : {}),
  });
  const detail = await terminal(user, item.id);
  assert.equal(
    detail.status,
    expected,
    `${name}: ${JSON.stringify(detail).slice(0, 1800)}`,
  );
  assert.ok(detail.finishedAt >= detail.created_at);
  if (expected === 'compile_error') assert.ok(detail.compileOutput.length > 0);
  if (mode === 'judge') checkHidden(detail);
  checks++;
  console.log(`PASS ${name}: ${detail.status}`);
  return { user, item, detail };
}
async function removeOwnQueueJobs() {
  if (!submissionIds.size) return;
  const url = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6381');
  const queue = new Queue(queueName, {
    connection: {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password) || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
  });
  queue.on('error', () => {});
  try {
    for (const id of submissionIds) {
      const job = await queue.getJob(id);
      if (job) await job.remove().catch(() => {}); // A crashed active lease expires naturally; never flush Redis.
    }
  } finally {
    await queue.close();
  }
}
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  await stopWorker();
  for (const child of children) child.kill('SIGKILL');
  await removeOwnQueueJobs().catch((e) =>
    console.error('Test job cleanup:', e.message),
  );
  const remove = db.transaction(() => {
    for (const { uid, email } of identities) {
      db.prepare('DELETE FROM submissions WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM grants WHERE email=? AND source=?').run(
        email,
        'oj-integration-test',
      );
      db.prepare('DELETE FROM limits WHERE key LIKE ?').run(`${uid}:%`);
      db.prepare('DELETE FROM audit WHERE actor_id=?').run(uid);
      db.prepare('DELETE FROM profiles WHERE id=?').run(uid);
      db.prepare('DELETE FROM user WHERE id=?').run(uid);
    }
  });
  remove();
  db.close();
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });

try {
  // The HTTP app must initialize its own original course and immutable exercise seed.
  const guest = await request('bootstrap');
  assert.equal(guest.person, null);
  assert.ok(guest.problems.some((p) => p.id === 'watch-intervals'));
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM oj_problems WHERE published=1').get()
      .n,
    4,
  );
  const teacher = identity('teacher', { teacher: true });
  const outsider = identity('outsider', { grant: false });
  const unverified = identity('unverified', { verified: false });
  assert.equal(
    (await request('bootstrap', { user: teacher })).person.role,
    'teacher',
  );
  await request('oj/status', { status: 401 });
  await request('oj/admin/problems', { user: outsider, status: 403 });
  await request('oj/problems/watch-intervals', { user: outsider, status: 403 });
  await create(unverified, {}, { status: 403 });
  await request('oj/submissions', {
    user: teacher,
    data: {},
    status: 403,
    requestOrigin: 'https://not-cswork.example',
  });
  console.log(
    'PASS HTTP identity, teacher permissions, unverified access, and CSRF. Starting isolated worker…',
  );
  startWorker();
  const health = await waitHealthy(teacher);
  assert.equal(health.configured, true);
  console.log('Real BullMQ worker and go-judge are healthy.');

  const solved = {};
  // Exactly two submissions at a time, matching the production worker concurrency.
  for (const pair of [
    ['cpp', 'python'],
    ['go', 'java'],
  ])
    await Promise.all(
      pair.map(async (language) => {
        const result = await expectVerdict(
          `ac-${language}`,
          language,
          solutions[language],
          'accepted',
          'judge',
        );
        assert.equal(result.detail.passed, result.detail.total);
        assert.equal(result.detail.score, 100);
        assert.ok(result.detail.total >= 6);
        solved[language] = result;
      }),
    );
  const first = solved.cpp;
  const duplicate = await request('oj/submissions', {
    user: first.user,
    data: first.item.payload,
    status: 201,
  });
  assert.equal(duplicate.id, first.item.id);
  assert.equal(
    db
      .prepare(
        'SELECT COUNT(*) AS n FROM submissions WHERE user_id=? AND idempotency_key=?',
      )
      .get(first.user.uid, first.item.payload.idempotencyKey).n,
    1,
  );
  await request('oj/submissions', {
    user: first.user,
    data: { ...first.item.payload, code: 'int main(){}' },
    status: 409,
  });
  await request(`oj/submissions/${first.item.id}`, {
    user: outsider,
    status: 404,
  });
  await request(`oj/submissions/${first.item.id}/cancel`, {
    user: outsider,
    data: {},
    status: 404,
  });
  checkHidden(
    await request(`oj/submissions/${first.item.id}`, { user: teacher }),
  );
  assert.equal(
    (
      await request('oj/submissions?problemId=watch-intervals', {
        user: first.user,
      })
    ).items.length,
    1,
  );
  assert.equal(
    (await request('oj/submissions', { user: outsider })).items.length,
    0,
  );
  await request('oj/submissions?cursor=invalid', {
    user: first.user,
    status: 400,
  });
  checks++;
  console.log(
    'PASS ownership, hidden-case redaction, idempotency, history isolation',
  );

  await Promise.all([
    expectVerdict(
      'wrong-answer',
      'python',
      'import sys\nprint(sys.stdin.read())\n',
      'wrong_answer',
      'judge',
    ),
    expectVerdict('compile-error', 'cpp', 'int main( {', 'compile_error'),
  ]);
  await Promise.all([
    expectVerdict(
      'runtime-error',
      'cpp',
      'int main(){return 42;}\n',
      'runtime_error',
    ),
    expectVerdict(
      'time-limit',
      'cpp',
      'int main(){while(true){asm volatile("");}}\n',
      'time_limit',
    ),
  ]);
  await Promise.all([
    expectVerdict(
      'output-limit',
      'cpp',
      '#include <cstdio>\nint main(){while(true){std::puts("01234567890123456789012345678901234567890123456789");}}\n',
      'output_limit',
    ),
    expectVerdict(
      'memory-limit',
      'cpp',
      '#include <cstdlib>\n#include <cstdio>\nint main(){const size_t n=512UL*1024*1024;volatile unsigned char*p=(volatile unsigned char*)std::malloc(n);if(!p)return 42;for(size_t i=0;i<n;i+=4096)p[i]=1;std::printf("%u\\n",p[n-4096]);}\n',
      'memory_limit',
    ),
  ]);

  const runUser = identity('custom-and-samples');
  const sample = await create(runUser, { mode: 'run' });
  const sampleResult = await terminal(runUser, sample.id);
  assert.equal(sampleResult.status, 'finished');
  assert.equal(sampleResult.total, 1);
  assert.equal(sampleResult.cases[0].stdout.trim(), '30');
  assert.equal(sampleResult.cases[0].hidden, false);
  const custom = await create(runUser, { mode: 'run', stdin: '2\n0 4\n1 9\n' });
  const customResult = await terminal(runUser, custom.id);
  assert.equal(customResult.status, 'finished');
  assert.equal(customResult.cases[0].stdout.trim(), '9');
  assert.equal(customResult.cases[0].stdin, '2\n0 4\n1 9\n');
  assert.equal(Object.hasOwn(customResult.cases[0], 'expected'), false);
  const empty = await create(runUser, {
    mode: 'run',
    stdin: '',
    code: 'import sys\nprint(len(sys.stdin.read()))\n',
  });
  const emptyResult = await terminal(runUser, empty.id);
  assert.equal(emptyResult.status, 'finished');
  assert.equal(emptyResult.cases[0].stdin, '');
  assert.equal(emptyResult.cases[0].stdout.trim(), '0');
  checks++;
  console.log('PASS sample run, custom stdin, explicit empty stdin');

  const revoked = identity('revoked');
  await request('teacher/revoke', {
    user: teacher,
    data: { id: revoked.grantId },
  });
  await create(revoked, {}, { status: 403 });
  const byteLimit = identity('byte-limit');
  await create(byteLimit, { code: '中'.repeat(22000) }, { status: 413 });
  await create(
    byteLimit,
    { mode: 'run', stdin: '中'.repeat(22000) },
    { status: 413 },
  );
  await create(byteLimit, { stdin: '1\n0 1\n' }, { status: 400 });
  checks++;
  console.log('PASS revoked course access and byte-safe request limits');

  await stopWorker();
  const cancellationUser = identity('queue-cancel');
  const cancelled = await create(cancellationUser);
  assert.equal(
    db.prepare('SELECT status FROM submissions WHERE id=?').get(cancelled.id)
      .status,
    'queued',
  );
  const cancelResult = await request(`oj/submissions/${cancelled.id}/cancel`, {
    user: cancellationUser,
    data: {},
  });
  assert.equal(cancelResult.status, 'cancelled');
  startWorker();
  await waitHealthy(teacher);
  await delay(1000);
  assert.equal(
    (
      await request(`oj/submissions/${cancelled.id}`, {
        user: cancellationUser,
      })
    ).status,
    'cancelled',
  );
  assert.equal(
    db.prepare('SELECT attempt FROM submissions WHERE id=?').get(cancelled.id)
      .attempt,
    0,
  );
  checks++;
  console.log('PASS queued cancellation stays terminal after worker restart');

  if (process.env.TEST_RECOVERY === '1') {
    const user = identity('cancel-after-crash');
    const item = await create(user, {
      mode: 'run',
      stdin: '',
      code: 'import time\ntime.sleep(5)\nprint("done")\n',
    });
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      const state = await request(`oj/submissions/${item.id}`, { user });
      if (state.status === 'running') break;
      assert.ok(
        active.has(state.status),
        `Unexpected state before worker crash: ${state.status}`,
      );
      await delay(250);
    }
    assert.equal(
      db.prepare('SELECT status FROM submissions WHERE id=?').get(item.id)
        .status,
      'running',
    );
    await stopWorker('SIGKILL');
    await request(`oj/submissions/${item.id}/cancel`, { user, data: {} });
    startWorker();
    await waitHealthy(teacher);
    const result = await terminal(user, item.id);
    assert.equal(result.status, 'cancelled');
    assert.ok(result.cancelRequested);
    checks++;
    console.log(
      'PASS pending cancellation recovered after test-worker SIGKILL',
    );
  }
  console.log(
    `PASS: ${checks} real-runner scenarios; ${requests} authenticated HTTP requests; ${submissionIds.size} submissions. No production queue or service was changed.`,
  );
} catch (error) {
  console.error('OJ integration failed:', error.stack || error.message);
  if (workerLog) console.error('Test worker recent output:', workerLog);
  process.exitCode = 1;
} finally {
  await cleanup();
}
