/** Single-user submit latency, end to end on the server: real HTTP POST and
 * watch long-polls -> outbox -> worker -> dedicated runner, one submission at a
 * time on an otherwise idle stack. Splits each submit into before-commit,
 * queue, compile, cases and delivery, so changes can be compared release to release.
 * Excludes the public network, TLS and browser rendering.
 * Required: TEST_ARTIFACT_DIR (a release dir with server.js, oj-worker/index.mjs,
 * node_modules), TEST_MIGRATIONS_DIR (drizzle), GO_JUDGE_URL (loopback 5053),
 * GO_JUDGE_TOKEN, REDIS_URL. Optional: TEST_WEB_PORT=4319, TEST_ROUNDS=5,
 * TEST_LANGUAGES=cpp,python,java,go, TEST_LABEL.
 * Creates an EMPTY private DB and a private queue; never opens production data.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, chmodSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(['127.0.0.1', 'localhost'].includes(runner.hostname) && runner.port === '5053', 'Dedicated loopback 5053 runner required');
assert(process.env.GO_JUDGE_TOKEN && process.env.REDIS_URL, 'Runner and Redis via environment');
const artifact = resolve(process.env.TEST_ARTIFACT_DIR || 'missing');
const migrations = resolve(process.env.TEST_MIGRATIONS_DIR || 'drizzle');
for (const f of ['server.js', 'oj-worker/index.mjs', 'node_modules/better-sqlite3']) assert(existsSync(join(artifact, f)), `missing ${f}`);
assert(existsSync(join(migrations, 'meta/_journal.json')), 'migrations missing');
const Database = createRequire(join(artifact, 'package.json'))('better-sqlite3');
const port = Number(process.env.TEST_WEB_PORT || 4319);
assert(![4317, 5050, 5053, 5054].includes(port));
const rounds = Number(process.env.TEST_ROUNDS || 5);
const languages = (process.env.TEST_LANGUAGES || 'cpp,python,java,go').split(',');
const programs = {
  // Most ACM C++ starts like this; it exercises the runner's stdc++ PCH.
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long a,b;if(cin>>a>>b)cout<<a+b<<"\\n";}\n',
  java: 'public class Main{public static void main(String[]args){java.util.Scanner s=new java.util.Scanner(System.in);long a=s.nextLong(),b=s.nextLong();System.out.println(a+b);}}\n',
  python: 'import sys\na,b=map(int,sys.stdin.read().split())\nprint(a+b)\n',
  go: 'package main\nimport "fmt"\nfunc main(){var a,b int64\nfmt.Scan(&a,&b)\nfmt.Println(a+b)}\n',
};
const solutions = {
  python: 'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, value in enumerate(nums):\n            if target-value in seen: return [seen[target-value],i]\n            seen[value] = i\n',
  cpp: 'class Solution {public: vector<int> twoSum(vector<int>& a,int t){unordered_map<int,int> m;for(int i=0;i<(int)a.size();i++){if(m.count(t-a[i]))return {m[t-a[i]],i};m[a[i]]=i;}return {};}};',
  java: 'class Solution { public int[] twoSum(int[] a, int t) { java.util.Map<Integer,Integer> m=new java.util.HashMap<>(); for(int i=0;i<a.length;i++){if(m.containsKey(t-a[i]))return new int[]{m.get(t-a[i]),i};m.put(a[i],i);}return new int[]{};}}',
  go: 'func twoSum(nums []int, target int) []int { seen:=map[int]int{}; for i,v:=range nums { if j,ok:=seen[target-v];ok{return []int{j,i}};seen[v]=i };return nil }',
};
const modes = (process.env.TEST_MODES || 'acm,leetcode').split(',');
assert(rounds > 0 && rounds <= 50 && languages.every((l) => l in programs) && modes.every((m) => ['acm', 'leetcode'].includes(m)));

const base = `http://127.0.0.1:${port}`, secret = randomUUID() + randomUUID();
const courseId = 'latency-synthetic', lessonId = 'fixture', problemId = 'latency-sum', versionId = randomUUID();
const dir = mkdtempSync(join(tmpdir(), 'cswork-latency-'));
chmodSync(dir, 0o700);
const dbPath = join(dir, 'fresh.sqlite');
const env = {
  PATH: process.env.PATH, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=768',
  DATABASE_PATH: dbPath, APP_URL: base, BETTER_AUTH_SECRET: secret, ADMIN_EMAILS: 'admin-latency@example.test',
  HOST: '127.0.0.1', PORT: String(port), OJ_ENABLED: 'true', OJ_QUEUE_NAME: `cswork-latency-${randomUUID()}`,
  OJ_PRECOMPILE_ENABLED: 'false', OJ_WORKER_CONCURRENCY: '4',
  GO_JUDGE_URL: runner.href, GO_JUDGE_TOKEN: process.env.GO_JUDGE_TOKEN, REDIS_URL: process.env.REDIS_URL,
};
const children = [], compiles = new Map();
let db;
function start(entry, onLine) {
  const child = spawn(process.execPath, [join(artifact, entry)], { cwd: artifact, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) onLine?.(line);
  });
  child.stderr.on('data', () => {});
  return child;
}
async function until(fn, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const c of children) assert(c.exitCode === null, 'child exited');
    if (await fn()) return;
    await delay(50);
  }
  throw new Error('readiness timeout');
}
function identity() {
  const uid = randomUUID(), token = randomUUID(), now = Date.now(), email = `latency-${uid}@example.test`;
  db.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(uid, 'Latency learner', email, 1, now, now);
  db.prepare('INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)').run(randomUUID(), now + 3600000, token, now, now, uid);
  db.prepare('INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), email, courseId, 'latency-probe', now);
  return `better-auth.session_token=${encodeURIComponent(token + '.' + createHmac('sha256', secret).update(token).digest('base64'))}`;
}
async function api(path, cookie, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: cookie, ...(body ? { Origin: base, 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json();
  assert(response.ok, `${path}: HTTP ${response.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}
const TERMINAL = (s) => !['queued', 'compiling', 'running'].includes(s);
async function submit(cookie, language, code, mode = 'acm') {
  const t0 = Date.now(), began = performance.now();
  let detail = await api('/api/oj/submissions', cookie, { problemId: mode === 'leetcode' ? 'lc-1' : problemId, language, code, codingMode: mode, mode: 'judge', idempotencyKey: randomUUID() });
  const postMs = performance.now() - began;
  let watches = 0;
  while (!TERMINAL(detail.status)) {
    detail = await api(`/api/oj/submissions/${detail.id}?wait=1&after=${encodeURIComponent(detail.watchToken || '')}`, cookie);
    watches++;
  }
  const totalMs = performance.now() - began, seen = Date.now();
  assert.equal(detail.status, 'accepted', `${language}: ${detail.status} ${detail.message || ''}`);
  const row = db.prepare('SELECT created_at,started_at,finished_at,passed,total FROM submissions WHERE id=?').get(detail.id);
  assert.equal(row.passed, 28);
  await until(() => compiles.has(detail.id), 5000);
  const compile = compiles.get(detail.id);
  return {
    totalMs, postMs, watches,
    beforeCommitMs: row.created_at - t0,
    queueMs: row.started_at - row.created_at,
    compileMs: compile.durationMs, cacheHit: compile.cacheHit,
    casesMs: row.finished_at - row.started_at - compile.durationMs,
    deliveryMs: seen - row.finished_at,
  };
}
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.max(0, Math.ceil(a.length * p) - 1)];
const report = { label: process.env.TEST_LABEL || null, rounds, results: {} };
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  // Apply drizzle SQL migrations directly so the probe needs only better-sqlite3.
  for (const { tag } of JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8')).entries)
    for (const statement of readFileSync(join(migrations, `${tag}.sql`), 'utf8').split('--> statement-breakpoint'))
      if (statement.trim()) db.exec(statement);
  db.prepare('INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)').run(courseId, 'Latency fixture', 'No production data', '1');
  db.prepare('INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(lessonId, courseId, 'Fixture', 'Test', 'test', 0, '', '1', Date.now());
  const spec = {
    id: problemId, courseId, lessonId, title: 'Latency sum fixture', difficulty: '简单', tags: ['latency'],
    description: 'Read two integers, output their sum.', input: 'Two signed integers.', output: 'Their sum.', hints: [],
    timeLimit: 2, memoryLimit: 262144, outputLimit: 64, checker: 'tokens', languages: ['cpp', 'java', 'python', 'go'],
  };
  const publish = (id, version, problemSpec, cases) => {
    // The worker refuses a snapshot whose package checksum does not match (lib/server/oj-problems.ts problemChecksum).
    const checksum = createHash('sha256').update(JSON.stringify({ schemaVersion: 1, problem: problemSpec, cases })).digest('hex');
    const now = Date.now();
    db.prepare('INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,?,?,0,?,?)').run(id, courseId, lessonId, now, now);
    db.prepare('INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,?,?,?,?)').run(version, id, JSON.stringify(problemSpec), checksum, 'latency', now);
    for (const [i, c] of cases.entries())
      db.prepare('INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), version, i, c.input, c.expectedOutput, Number(c.hidden), c.name, c.weight);
    db.prepare('UPDATE oj_problems SET current_version_id=?,published=1 WHERE id=?').run(version, id);
  };
  publish(problemId, versionId, spec, Array.from({ length: 28 }, (_, i) => ({ name: `sum-${i}`, input: `${i - 11} ${i * i + 3}\n`, expectedOutput: `${i - 11 + i * i + 3}\n`, hidden: i > 0, weight: 1 })));
  // LeetCode function mode needs the reviewed lc-1 contract id and a verified library binding.
  const lcVersion = randomUUID();
  publish('lc-1', lcVersion, { ...spec, id: 'lc-1', title: 'Two Sum latency fixture', checker: 'int-set' }, Array.from({ length: 28 }, (_, k) => {
    const n = k + 2, nums = Array.from({ length: n }, (_, i) => 2 ** i); // powers of two: the only pair is (0, n-1)
    return { name: `two-sum-${k}`, input: `${n}\n${nums.join(' ')}\n${1 + nums[n - 1]}\n`, expectedOutput: `2\n0 ${n - 1}\n`, hidden: k > 0, weight: 1 };
  }));
  db.prepare("INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','synthetic',28,28,'lc-1',?,?)").run('synthetic:' + lcVersion, Date.now());
  start('oj-worker/index.mjs', (line) => {
    try {
      const e = JSON.parse(line);
      if (e.event === 'oj_compile') compiles.set(e.submissionId, e);
    } catch { /* never echo worker text */ }
  });
  start('server.js');
  await until(async () => { try { return (await fetch(base + '/api/bootstrap', { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; } });
  await until(() => db.prepare("SELECT 1 FROM oj_runtime WHERE id='worker' AND healthy=1").get());
  const source = (mode, language, tag) => (mode === 'leetcode' ? solutions : programs)[language] + `\n${language === 'python' ? '#' : '//'} ${tag}\n`;
  const prefix = (mode) => (mode === 'leetcode' ? 'lc-' : '');
  // One unmeasured submit per scenario warms the runner, JIT and page cache.
  for (const mode of modes) for (const language of languages) await submit(identity(), language, source(mode, language, 'warmup'), mode);
  const samples = Object.fromEntries(modes.flatMap((m) => languages.flatMap((l) => [[`${prefix(m)}${l}:cold`, []], [`${prefix(m)}${l}:warm`, []]])));
  for (let round = 0; round < rounds; round++)
    for (const mode of modes)
      for (const language of languages) {
        const cookie = identity(), code = source(mode, language, randomUUID());
        samples[`${prefix(mode)}${language}:cold`].push(await submit(cookie, language, code, mode));
        samples[`${prefix(mode)}${language}:warm`].push(await submit(cookie, language, code, mode));
      }
  for (const [key, list] of Object.entries(samples)) {
    report.results[key] = { cacheHits: list.filter((x) => x.cacheHit).length, watches: pct(list.map((x) => x.watches), 0.5) };
    for (const field of ['totalMs', 'postMs', 'beforeCommitMs', 'queueMs', 'compileMs', 'casesMs', 'deliveryMs'])
      report.results[key][field] = Math.round(pct(list.map((x) => x[field]), 0.5));
  }
  console.log(JSON.stringify(report));
} finally {
  for (const c of children) c.kill('SIGTERM');
  await delay(500);
  for (const c of children) if (c.exitCode === null) c.kill('SIGKILL');
  db?.close();
  rmSync(dir, { recursive: true, force: true });
}
