/**
 * Real final-protocol HTTP suite, localhost:4319 and an EMPTY migrated test DB.
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
const prefix = `oj-final-protocols:${runId}`;
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
assert.equal(db.prepare('SELECT count(*) AS n FROM oj_problems').get().n, 0, 'Requires empty isolated problem database');
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
      title: `Final protocol integration ${name}`,
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
      ...(options.specialId === undefined ? {} : {specialId: options.specialId}),
      ...(options.stringStructureId === undefined ? {} : {stringStructureId: options.stringStructureId}),
      ...(options.complexDesignId === undefined ? {} : {complexDesignId: options.complexDesignId}),
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
async function verdict(name, problemId, language, code, expected, customInput) {
  const user = identity(name);
  const created = await request('oj/submissions', {
    user,
    status: 201,
    data: {
      problemId,
      language,
      code,
      mode: customInput === undefined ? 'judge' : 'run',
      ...(customInput === undefined ? {} : {stdin: customInput}),
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
  assert.equal(detail?.status, customInput !== undefined && expected === 'accepted' ? 'finished' : expected, `${name}: unexpected verdict`);
  assert.ok(
    db
      .prepare('SELECT dispatched_at FROM oj_outbox WHERE submission_id=?')
      .get(created.id)?.dispatched_at,
    'Outbox was not dispatched',
  );
  assert.ok(detail.total >= (customInput === undefined ? 2 : 1), `${name}: cases missing`);
  if (expected === 'accepted') {
    assert.equal(detail.passed, detail.total);
    assert.equal(detail.score, 100);
  } else assert.ok(detail.passed < detail.total);
  const hidden = detail.cases.filter((c) => c.hidden);
  if (customInput === undefined && expected === 'accepted') assert.ok(hidden.length > 0);
  assert.ok(!JSON.stringify({cases: detail.cases, message: detail.message}).includes('SERIALIZED_PRIVATE_'), 'Intermediate serialized data leaked');
  const storedHidden = db.prepare('SELECT stdout,stderr FROM oj_results WHERE submission_id=? AND hidden=1').all(created.id);
  for (const row of storedHidden) { assert.equal(row.stdout, null); assert.equal(row.stderr, null); }
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

// All programs below are authored synthetic fixtures, never downloaded solutions.
const jsonProgram = body => 'import sys,json\na=json.load(sys.stdin)\n' + body + '\n';
const codecProgram = (failure = '') => `import sys,json,base64,time
p=json.load(sys.stdin)
if p['operation']=='serialize':
 ${failure === 'budget' ? 'start=time.process_time()\n while time.process_time()-start<1.2: pass' : 'pass'}
 print(json.dumps(['SERIALIZED_PRIVATE_'+base64.b64encode(json.dumps(t).encode()).decode() for t in p['trees']]))
else:
 trees=[json.loads(base64.b64decode(s.removeprefix('SERIALIZED_PRIVATE_'))) for s in p['data']]
 if trees[0] and trees[0][0]==9:
  ${failure === 're' ? "raise RuntimeError('SERIALIZED_PRIVATE_hidden')" : failure === 'ole' ? "print('SERIALIZED_PRIVATE_'*20000);sys.exit(0)" : failure === 'budget' ? 'start=time.process_time()\n  while time.process_time()-start<1.2: pass' : 'pass'}
 print(json.dumps(trees))
`;
const trace = tree => JSON.stringify([['Codec','roundTrip'],[[],[tree]]])+'\n';

try {
 teacher=identity('teacher',true);
 await startWorker();
 const roots=await publish('forest','int-set',[
  ['[[1,2,3],[1]]\n','2\n1 2\n'],['[[9,8,7],[9]]\n','2\n1 2\n'],
 ],64,{id:'lc-1110',specialId:1110});
 await verdict('node-original-ids',roots,'python','print("2\\n2 1")\n','accepted');
 await verdict('node-values-are-not-ids',roots,'python','print("2\\n2 3")\n','wrong_answer');
 const cycle=await publish('cycle','tokens',[
  ['[[7,7,7],1]\n','1\n'],['[[8,8],0]\n','0\n'],
 ],64,{id:'lc-142',specialId:142});
 await verdict('cycle-equal-values-identity',cycle,'python',jsonProgram('print(a[1])'),'accepted');
 const groups=await publish('anagrams','strings-lc-49',[
  ['[["ab","ba","ab","x"]]\n','[["ab","ba","ab"],["x"]]\n'],
  ['[["","","a"]]\n','[["",""],["a"]]\n'],
 ],64,{id:'lc-49',stringStructureId:49});
 const groupCode=jsonProgram("g={}\nfor s in a[0]:g.setdefault(''.join(sorted(s)),[]).append(s)\nprint(json.dumps(list(g.values())[::-1]))");
 await verdict('string-group-multiplicity',groups,'python',groupCode,'accepted');
 await verdict('string-group-lost-duplicate',groups,'python',groupCode.replace('list(g.values())[::-1]','[list(set(v)) for v in g.values()]'),'wrong_answer');
 const floats=await publish('float-sentinel','float-array',[
  ['1\n','2\n-1 2\n'],['2\n','2\n-1 3\n'],
 ],64,{id:'lc-399'});
 await verdict('float-tolerance-sentinel',floats,'python','import sys\nv=int(sys.stdin.read());print(2);print(-1,v+1.000001)\n','accepted');
 await verdict('float-sentinel-must-be-exact',floats,'python','import sys\nv=int(sys.stdin.read());print(2);print(-0.999999,v+1)\n','wrong_answer');
 const fraction=await publish('fraction','fraction-lc-166',[
  ['[1,3]\n','0.(3)\n'],['[2,3]\n','0.(6)\n'],
 ],64,{id:'lc-166'});
 await verdict('fraction-equivalent-period',fraction,'python',jsonProgram("print('0.3(3)' if a[0]==1 else '0.6(6)')"),'accepted');
 await verdict('fraction-wrong-finite',fraction,'python','print("0.3")\n','wrong_answer');
 const randomized=await publish('random-members','design-lc-380',[
  ['[["RandomizedSet","insert","insert","getRandom"],[[],[1],[2],[]]]\n','[null,1,1,1]\n'],
  ['[["RandomizedSet","insert","insert","getRandom"],[[],[3],[4],[]]]\n','[null,1,1,3]\n'],
 ],64,{id:'lc-380',complexDesignId:380});
 await verdict('random-noncanonical-member',randomized,'python',jsonProgram('print(json.dumps([None,1,1,a[1][2][0]]))'),'accepted');
 await verdict('random-nonmember',randomized,'python','print("[null,1,1,99]")\n','wrong_answer');
 for (const pid of [297,449]) {
  const trees=pid===297?[[1,null,2],[9,8,10]]:[[2,1,3],[9,8,10]];
  const id=await publish(`codec-${pid}`,`design-lc-${pid}`,trees.map(t=>[trace(t),JSON.stringify([null,t])+'\n']),64,{id:`lc-${pid}`,complexDesignId:pid});
  await verdict(`codec-${pid}-opaque-roundtrip`,id,'python',codecProgram(),'accepted');
  await verdict(`codec-${pid}-echo`,id,'python','import sys\nprint(sys.stdin.read())\n','wrong_answer');
  const ignoresData=jsonProgram("print(json.dumps(['x']*len(a['trees']) if a['operation']=='serialize' else [[]]*len(a['data'])))");
  await verdict(`codec-${pid}-ignores-data`,id,'python',ignoresData,'wrong_answer');
  await verdict(`codec-${pid}-custom-good`,id,'python',codecProgram(),'accepted',trace(trees[1]));
  await verdict(`codec-${pid}-custom-bad`,id,'python',ignoresData,'wrong_answer',trace(trees[1]));
  if(pid===297){
   for(const [mode,status] of [['re','runtime_error'],['ole','output_limit'],['budget','time_limit']])
    await verdict(`codec-stage2-${mode}`,id,'python',codecProgram(mode),status);
   await verdict('codec-custom-echo',id,'python','import sys\nprint(sys.stdin.read())\n','wrong_answer',trace(trees[1]));
  }
 }
 console.log(`PASS final protocols: ${checks} verdicts, ${requests} HTTP requests; peak worker ${peakWorkerRssKiB} KiB`);
} catch(error) {
 console.error(error instanceof Error ? error.message : 'Final protocols integration failed');
 process.exitCode=1;
} finally {await cleanup();}
