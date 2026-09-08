/** Isolated worker load probe, NOT API/browser E2E.
 * Required: SOURCE_DATABASE_PATH, TEST_WORKER_ENTRY, GO_JUDGE_URL (localhost:5053).
 * Optional: TEST_LANGUAGES=cpp,java,go,python TEST_CONCURRENCY=1,5,10
 * TEST_ROUNDS=3 TEST_GROUPS=cold,warm TEST_TIMEOUT_MS=180000 TEST_HARNESS_VERSION.
 * Inherit Redis/runner credentials from the caller; never print them.
 * Warm means primed, not guaranteed hit: the baseline has only 8 slots;
 * candidate capacities and evictions are observed, never assumed.
 */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, chmodSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { Queue } from 'bullmq';

const runner = new URL(process.env.GO_JUDGE_URL || 'http://invalid');
assert(['localhost', '127.0.0.1', '[::1]'].includes(runner.hostname) && runner.port === '5053', 'Only dedicated local runner port 5053 is allowed');
const sourcePath = resolve(process.env.SOURCE_DATABASE_PATH || 'missing');
const entry = resolve(process.env.TEST_WORKER_ENTRY || 'missing');
assert(existsSync(sourcePath) && existsSync(entry), 'Source database and worker entry are required');
const codes = {
  cpp: 'class Solution {public: vector<int> twoSum(vector<int>& nums,int target){unordered_map<int,int> m;for(int i=0;i<nums.size();i++){auto j=m.find(target-nums[i]);if(j!=m.end())return {i,j->second};m[nums[i]]=i;}return {};}};',
  java: 'class Solution {public int[] twoSum(int[] nums,int target){java.util.Map<Integer,Integer> m=new java.util.HashMap<>();for(int i=0;i<nums.length;i++){Integer j=m.get(target-nums[i]);if(j!=null)return new int[]{i,j};m.put(nums[i],i);}return new int[0];}}',
  go: 'func twoSum(nums []int,target int) []int {m:=make(map[int]int);for i,n:=range nums {if j,ok:=m[target-n];ok{return []int{i,j}};m[n]=i};return nil}',
  python: 'class Solution:\n    def twoSum(self, nums, target):\n        seen={}\n        for i,n in enumerate(nums):\n            if target-n in seen:return [i,seen[target-n]]\n            seen[n]=i\n',
};
const languages = (process.env.TEST_LANGUAGES || 'cpp,java,go,python').split(',');
const concurrency = (process.env.TEST_CONCURRENCY || '1,5,10').split(',').map(Number);
const groups = (process.env.TEST_GROUPS || 'cold,warm').split(',');
const rounds = Number(process.env.TEST_ROUNDS || 3);
const timeout = Number(process.env.TEST_TIMEOUT_MS || 180000);
assert(languages.every(x => x in codes) && concurrency.every(x => [1,5,10].includes(x)) && groups.every(x => ['cold','warm'].includes(x)));
assert(Number.isInteger(rounds) && rounds > 0 && rounds <= 100 && timeout >= 1000 && timeout <= 600000);
const harness = process.env.TEST_HARNESS_VERSION || createHash('sha256').update(JSON.stringify(JSON.parse(readFileSync(new URL('../lib/content/leetcode-contracts.json', import.meta.url), 'utf8')))).digest('hex');
const dir = mkdtempSync(join(tmpdir(), 'cswork-oj-latency-'));
chmodSync(dir, 0o700);
const queueName = `cswork-oj-test-${randomUUID()}`;
const databasePath = join(dir, 'probe.sqlite');
let db, worker, queue, stopped = false, peakRssKb = 0, eventBuffer = '';
const events = [];
const results = [];
const interrupted = () => { stopped = true; };
process.on('SIGINT', interrupted);
process.on('SIGTERM', interrupted);
const percentile = (values, p) => [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(values.length*p)-1)] ?? null;
async function until(fn, budget = timeout) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) {
    assert(!stopped, 'Probe interrupted');
    assert(worker && worker.exitCode === null && worker.signalCode === null, 'Isolated worker exited');
    const value = fn();
    if (value) return value;
    await delay(25);
  }
  throw new Error('Isolated probe timed out');
}
let sampler;
try {
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try { await source.backup(databasePath); } finally { source.close(); }
  db = new Database(databasePath);
  db.pragma('busy_timeout = 5000');
  const original = db.prepare("SELECT * FROM submissions WHERE problem_id='lc-1' ORDER BY created_at DESC LIMIT 1").get();
  assert(original, 'Need an existing lc-1 submission to bind the copied account');
  const version = db.prepare("SELECT current_version_id AS id FROM oj_problems WHERE id='lc-1'").get();
  const total = db.prepare('SELECT count(*) AS n FROM oj_test_cases WHERE version_id=?').get(version.id).n;
  assert.equal(total, 28, 'This probe requires the reviewed complete 28-case snapshot');
  // Only mutate the private backup. Prevent copied unfinished jobs/background work.
  db.exec("DELETE FROM oj_outbox; DELETE FROM oj_precompile; UPDATE submissions SET status='cancelled',finished_at=0 WHERE status IN ('queued','compiling','running'); DELETE FROM oj_runtime;");
  const env = { ...process.env, DATABASE_PATH: databasePath, OJ_QUEUE_NAME: queueName, OJ_PRECOMPILE_ENABLED: 'false' };
  worker = spawn(process.execPath, [entry], { env, stdio: ['ignore','pipe','pipe'] });
  worker.stdout.on('data', chunk => {
    eventBuffer += chunk.toString();
    const lines = eventBuffer.split('\n'); eventBuffer = lines.pop();
    for (const line of lines) {
      try { const e = JSON.parse(line); if (e.event === 'oj_compile') events.push(e); } catch { /* Never echo worker text. */ }
    }
  });
  worker.stderr.on('data', () => {});
  worker.on('error', () => { stopped = true; });
  sampler = setInterval(() => {
    try { peakRssKb = Math.max(peakRssKb, Number(execFileSync('ps', ['-o','rss=','-p',String(worker.pid)], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:1000 }).trim()) || 0); } catch { /* exited */ }
  }, 1000);
  await until(() => db.prepare("SELECT 1 FROM oj_runtime WHERE id='worker' AND healthy=1").get(), 30000);
  async function batch(language, sources) {
    const ids = [];
    db.transaction(() => {
      for (const code of sources) {
        const now = Date.now(), id = randomUUID();
        const row = { ...original, id, language, code, problem_version_id:version.id, harness_version:harness, mode:'judge', coding_mode:'leetcode', custom_input:null, total, status:'queued', passed:0, score:0, runtime:null, memory:null, message:null, compile_output:null, attempt:0, cancel_requested:0, started_at:null, finished_at:null, created_at:now, updated_at:now, idempotency_key:randomUUID() };
        const columns = Object.keys(row);
        db.prepare(`INSERT INTO submissions(${columns.map(x => `"${x}"`).join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...Object.values(row));
        db.prepare('INSERT INTO oj_outbox(submission_id,created_at) VALUES(?,?)').run(id,now);
        ids.push(id);
      }
    })();
    await until(() => ids.every(id => db.prepare('SELECT finished_at FROM submissions WHERE id=?').get(id).finished_at !== null));
    // Give stdout delivery a bounded opportunity; missing telemetry stays null.
    await delay(30);
    return ids.map(id => {
      const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
      const cases = db.prepare('SELECT ordinal,status FROM oj_results WHERE submission_id=? ORDER BY ordinal').all(id);
      const compile = events.find(e => e.submissionId === id);
      const correct = row.status === 'accepted' && row.passed === total && row.total === total && cases.length === total && new Set(cases.map(x=>x.ordinal)).size === total && cases.every(x=>x.status === 'accepted');
      return { status:row.status, correct, passed:row.passed, cases:cases.length, cacheHit:compile?.cacheHit ?? null, compileMs:compile?.durationMs ?? null, queueMs:row.started_at === null ? null : row.started_at-row.created_at, executionMs:row.started_at === null ? null : row.finished_at-row.started_at, totalMs:row.finished_at-row.created_at, retries:Math.max(0,row.attempt-1) };
    });
  }
  for (const language of languages) for (const count of concurrency) for (const group of groups) {
    const measured = [];
    for (let round=0; round<rounds; round++) {
      const sources = Array.from({length:count}, () => `${codes[language]}\n${language === 'python' ? '#' : '//'} latency-probe-${randomUUID()}\n`);
      if (group === 'warm') {
        // Prime distinct binaries; actual capacity eviction remains observable.
        for (const code of sources) assert((await batch(language,[code]))[0].correct, 'Warmup must pass every case');
      }
      measured.push(...await batch(language,sources));
      console.log(JSON.stringify({event:'probe_progress',language,concurrency:count,group,round:round+1,rounds}));
    }
    const metric = key => ({p50:percentile(measured.map(x=>x[key]).filter(x=>x!==null),.5),p95:percentile(measured.map(x=>x[key]).filter(x=>x!==null),.95)});
    const report = {language,concurrency:count,group,samples:measured.length,errors:measured.filter(x=>!x.correct).length,retries:measured.reduce((n,x)=>n+x.retries,0),cacheHits:measured.filter(x=>x.cacheHit===true).length,cacheMisses:measured.filter(x=>x.cacheHit===false).length,unknownCache:measured.filter(x=>x.cacheHit===null).length,totalMs:metric('totalMs'),queueMs:metric('queueMs'),executionMs:metric('executionMs'),compileMs:metric('compileMs'),workerPeakRssKb:peakRssKb,measurements:measured};
    results.push(report); console.log(JSON.stringify({event:'probe_group',...report}));
    assert.equal(report.errors,0,'All submitted programs must pass all 28 cases');
  }
  console.log(JSON.stringify({event:'probe_complete',scope:'isolated copied database + real worker/runner; bypasses API and browser',groups:results.length,workerPeakRssKb:peakRssKb}));
} finally {
  clearInterval(sampler);
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    worker.kill('SIGTERM');
    const deadline = Date.now()+25000;
    while (worker.exitCode === null && worker.signalCode === null && Date.now()<deadline) await delay(100);
    if (worker.exitCode === null && worker.signalCode === null) {
      worker.kill('SIGKILL');
      await new Promise(resolveExit => worker.once('exit',resolveExit));
    }
  }
  try {
    assert(/^cswork-oj-test-[a-f0-9-]+$/.test(queueName));
    const u = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6381');
    queue = new Queue(queueName,{connection:{host:u.hostname,port:Number(u.port||6379),username:decodeURIComponent(u.username)||undefined,password:decodeURIComponent(u.password)||undefined,db:Number(u.pathname.slice(1)||0),...(u.protocol==='rediss:'?{tls:{}}:{}),connectTimeout:5000,maxRetriesPerRequest:1,enableOfflineQueue:false}});
    queue.on('error',()=>{});
    await queue.obliterate({force:true});
  } finally {
    if (queue) await queue.close();
    db?.close();
    rmSync(dir,{recursive:true,force:true});
    process.removeListener('SIGINT',interrupted);
    process.removeListener('SIGTERM',interrupted);
  }
}
