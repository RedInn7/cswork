import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const folder = mkdtempSync(join(tmpdir(), 'cswork-problem-stats-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'google';
process.env.FEED_HIDDEN_USERS = 'owner';
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { problemStats, MIN_PEOPLE, MIN_SAMPLE } = await import(
  '../lib/server/problem-stats'
);
const db = sqlite();
after(() => rmSync(folder, { recursive: true, force: true }));

let n = 0;
function submit(
  user: string,
  problem: string,
  status: string,
  runtime: number | null = 0.05,
  { mode = 'judge', language = 'python' } = {},
) {
  n++;
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,runtime,created_at,updated_at,mode)
     VALUES(?,?,?,?,'print("SECRET")',?,1,1,?,?,?,?)`,
  ).run(`s${n}`, user, problem, language, status, runtime, n, n, mode);
}

test('nothing shows below the sample floors', () => {
  for (let i = 0; i < MIN_PEOPLE - 1; i++) submit(`few${i}`, 'lc-few', 'accepted');
  assert.deepEqual(problemStats('lc-few', 'python', 10), {
    acceptance: null,
    beats: null,
  });
});

test('counts people, not submissions, and beats against each best runtime', () => {
  const t0 = 1_000_000;
  // 30 people solve it in Python, 10..39 ms; extra and slower retries do not count twice.
  for (let i = 0; i < MIN_SAMPLE; i++) submit(`u${i}`, 'lc-1', 'accepted', (10 + i) / 1000);
  submit('u0', 'lc-1', 'accepted', 0.5);
  submit('u0', 'lc-1', 'wrong_answer');
  // 5 more people only fail; runs, unfinished and cancelled jobs are no attempt.
  for (let i = 0; i < 5; i++) submit(`miss${i}`, 'lc-1', 'wrong_answer');
  submit('runner', 'lc-1', 'finished', 0.001, { mode: 'run' });
  submit('waiting', 'lc-1', 'queued');
  submit('quitter', 'lc-1', 'cancelled');
  // Owner test accounts never count; Go keeps its own distribution.
  submit('owner', 'lc-1', 'accepted', 0.001);
  submit('gopher', 'lc-1', 'accepted', 0.001, { language: 'go' });
  const stats = problemStats('lc-1', 'python', 25, t0);
  assert.deepEqual(stats.acceptance, { attempted: 36, accepted: 31 });
  // 26..39 ms are slower than 25 ms: 14 of 30.
  assert.equal(stats.beats, 46);
  assert.equal(problemStats('lc-1', 'go', 1, t0).beats, null, 'Go has 1 person');
  assert.equal(problemStats('lc-1', 'python', null, t0).beats, null);
  assert.equal(problemStats('lc-1', 'rust', 1, t0).beats, null);
  // Aggregates only: no user ids or code in what the API returns.
  assert.equal(/u0|owner|SECRET/.test(JSON.stringify(stats)), false);
  // Cached for 10 minutes, then recomputed.
  for (let i = 0; i < 4; i++) submit(`late${i}`, 'lc-1', 'accepted', 0.001);
  assert.equal(problemStats('lc-1', 'python', 25, t0 + 60_000).acceptance?.attempted, 36);
  assert.equal(
    problemStats('lc-1', 'python', 25, t0 + 10 * 60_000 + 1).acceptance?.attempted,
    40,
  );
});

test('taken-down companies have no stats', () => {
  for (let i = 0; i < MIN_SAMPLE; i++) {
    submit(`g${i}`, 'oa-google-1', 'accepted', 0.02);
    submit(`a${i}`, 'oa-amazon-1', 'accepted', 0.02);
  }
  assert.deepEqual(problemStats('oa-google-1', 'python', 10), {
    acceptance: null,
    beats: null,
  });
  assert.equal(problemStats('oa-amazon-1', 'python', 10).beats, 100);
});

test('fractional milliseconds: ties and sub-ms gaps are not counted as slower', () => {
  // 29 C++ people at 1.00..1.28 ms (go-judge reports ns), this run's own best 1.30 ms.
  for (let i = 0; i < MIN_SAMPLE - 1; i++)
    submit(`c${i}`, 'lc-fast', 'accepted', (1 + i / 100) / 1000, { language: 'cpp' });
  submit('me', 'lc-fast', 'accepted', 0.0013, { language: 'cpp' });
  assert.equal(problemStats('lc-fast', 'cpp', 0.0013 * 1000).beats, 0, 'slowest beats nobody');
  // 1.28 ms ties c28 and is faster only than me: 1 of 30.
  assert.equal(problemStats('lc-fast', 'cpp', 1.28).beats, 3);
  assert.equal(problemStats('lc-fast', 'cpp', 0.5).beats, 100);
});

test('the endpoint answers only for problems the viewer can see', async () => {
  const { readFileSync } = await import('node:fs');
  const api = readFileSync(new URL('../lib/server/oj-api.ts', import.meta.url), 'utf8');
  const route = api.slice(api.indexOf("resource === 'problem-stats'"));
  assert.match(route.slice(0, 400), /canSeeProblem\(p, id\)/);
});
