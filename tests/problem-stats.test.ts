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
const { problemStats, histogram, MIN_PEOPLE, MIN_SAMPLE } = await import(
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
  { mode = 'judge', language = 'python', memory = null as number | null } = {},
) {
  n++;
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,runtime,memory,created_at,updated_at,mode)
     VALUES(?,?,?,?,'print("SECRET")',?,1,1,?,?,?,?,?)`,
  ).run(`s${n}`, user, problem, language, status, runtime, memory, n, n, mode);
}
const empty = { acceptance: null, beats: null, beatsMemory: null, histogram: null, votes: { up: 0, down: 0 } };

test('nothing shows below the sample floors', () => {
  for (let i = 0; i < MIN_PEOPLE - 1; i++) submit(`few${i}`, 'lc-few', 'accepted');
  assert.deepEqual(problemStats('lc-few', 'python', 10), empty);
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
  const stats = problemStats('lc-1', 'python', 25, null, t0);
  assert.deepEqual(stats.acceptance, { attempted: 36, accepted: 31 });
  // 26..39 ms are slower than 25 ms: 14 of 30.
  assert.equal(stats.beats, 46);
  assert.equal(problemStats('lc-1', 'go', 1, null, t0).beats, null, 'Go has 1 person');
  assert.equal(problemStats('lc-1', 'python', null, null, t0).beats, null);
  assert.equal(problemStats('lc-1', 'rust', 1, null, t0).beats, null);
  // Aggregates only: no user ids or code in what the API returns.
  assert.equal(/u0|owner|SECRET/.test(JSON.stringify(stats)), false);
  // Cached for 10 minutes, then recomputed.
  for (let i = 0; i < 4; i++) submit(`late${i}`, 'lc-1', 'accepted', 0.001);
  assert.equal(problemStats('lc-1', 'python', 25, null, t0 + 60_000).acceptance?.attempted, 36);
  assert.equal(
    problemStats('lc-1', 'python', 25, null, t0 + 10 * 60_000 + 1).acceptance?.attempted,
    40,
  );
});

test('taken-down companies have no stats', () => {
  for (let i = 0; i < MIN_SAMPLE; i++) {
    submit(`g${i}`, 'oa-google-1', 'accepted', 0.02);
    submit(`a${i}`, 'oa-amazon-1', 'accepted', 0.02);
  }
  assert.deepEqual(problemStats('oa-google-1', 'python', 10), empty);
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

test('memory beats and histograms: counts only, no bucket of one or two people', () => {
  // 40 Java people: best runtime 10..49 ms, best memory 40000..79000 KB (from another try).
  for (let i = 0; i < 40; i++) {
    submit(`j${i}`, 'lc-mem', 'accepted', (10 + i) / 1000, { language: 'java', memory: 90000 });
    submit(`j${i}`, 'lc-mem', 'accepted', 0.2, { language: 'java', memory: 40000 + i * 1000 });
  }
  // One far outlier must not squash the chart: it lands in the last bucket.
  submit('slow', 'lc-mem', 'accepted', 9, { language: 'java', memory: 900000 });
  const stats = problemStats('lc-mem', 'java', 20, 60000);
  // 41 people; 20 are slower than 20 ms (21..49 ms and the outlier = 30), 20 use more than 60000 KB.
  assert.equal(stats.beats, Math.floor((100 * 30) / 41));
  assert.equal(stats.beatsMemory, Math.floor((100 * 20) / 41));
  for (const shape of [stats.histogram!.runtime!, stats.histogram!.memory!]) {
    assert.equal(shape.edges.length, shape.counts.length + 1);
    assert.equal(shape.counts.reduce((a, b) => a + b, 0), 41);
    assert.equal(shape.counts.length >= 2 && shape.counts.length <= 20, true);
    assert.equal(shape.counts.every((c) => c === 0 || c >= 3), true, 'no sparse bucket');
    assert.equal(shape.edges.every((edge, i) => i === 0 || edge > shape.edges[i - 1]), true);
  }
  // Runtime edges are ms like runtimeMs; the outlier's 9000 ms closes the last bucket.
  assert.equal(stats.histogram!.runtime!.edges[0], 10);
  assert.equal(stats.histogram!.runtime!.edges.at(-1), 9000);
  assert.equal(/j0|slow|SECRET/.test(JSON.stringify(stats)), false);
  // Below the floor in a language: no histogram, no beats.
  assert.equal(problemStats('lc-mem', 'go', 20, 60000).histogram, null);
  assert.equal(problemStats('lc-mem', 'go', 20, 60000).beatsMemory, null);
});

test('histogram: sparse buckets merge into the larger neighbour; one value fills one bucket', () => {
  const values = [...Array(30).fill(1), 50, 100];
  const shape = histogram(values.sort((a, b) => a - b));
  assert.equal(shape.counts.every((c) => c === 0 || c >= 3), true);
  assert.equal(shape.counts.reduce((a, b) => a + b, 0), 32);
  assert.deepEqual(histogram(Array(30).fill(7)), { edges: [7, 7], counts: [30] });
});

test('votes: counted per problem, cached with the rest', () => {
  const t0 = 5_000_000;
  const vote = (user: string, mark: string) =>
    db.prepare('INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,?,0)').run(user, 'problem:lc-vote', mark);
  vote('a', 'up');
  vote('b', 'up');
  vote('c', 'down');
  vote('d', 'star');
  assert.deepEqual(problemStats('lc-vote', null, null, null, t0).votes, { up: 2, down: 1 });
  vote('e', 'up');
  assert.deepEqual(problemStats('lc-vote', null, null, null, t0 + 1000).votes, { up: 2, down: 1 });
  assert.deepEqual(problemStats('lc-vote', null, null, null, t0 + 10 * 60_000 + 1).votes, { up: 3, down: 1 });
});

test('the endpoint answers only for problems the viewer can see', async () => {
  const { readFileSync } = await import('node:fs');
  const api = readFileSync(new URL('../lib/server/oj-api.ts', import.meta.url), 'utf8');
  const route = api.slice(api.indexOf("resource === 'problem-stats'"));
  assert.match(route.slice(0, 400), /canSeeProblem\(p, id\)/);
});
