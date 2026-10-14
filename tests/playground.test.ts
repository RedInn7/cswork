import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-playground-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
for (const key of ['GO_JUDGE_URL', 'GO_JUDGE_TOKEN', 'REDIS_URL', 'OJ_ENABLED']) delete process.env[key];
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const {
  cancelSubmission,
  createPlaygroundRun,
  submissionDetail,
  submissionHistory,
  PLAYGROUND_RUNS_PER_HOUR,
} = await import('../lib/server/oj-submissions');
const { judgeFeed } = await import('../lib/server/judge-feed');
const { problemStats } = await import('../lib/server/problem-stats');
const { practiceHistory } = await import('../lib/server/my-practice');
const { decodeShare, encodeShare, SHARE_MAX_CHARS } = await import('../lib/playground-share');

const me: Person = { id: 'pg-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'pg-other', email: 'other@example.test' };
const run = (extra = {}) => ({
  language: 'cpp',
  code: 'int main(){}',
  stdin: '3\n1 2 3\n',
  idempotencyKey: randomUUID(),
  ...extra,
});
const status = (n: number) => (e: unknown) => (e as { status?: number }).status === n;

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a playground run needs a configured judge and a verified address', async () => {
  await assert.rejects(createPlaygroundRun(me, run()), status(503));
  process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
  process.env.GO_JUDGE_TOKEN = 'test';
  process.env.REDIS_URL = 'redis://127.0.0.1:6381';
  await assert.rejects(createPlaygroundRun({ ...me, verified: false }, run()), status(403));
  for (const bad of [{ language: 'sql' }, { problemId: 'lc-1' }, { code: '' }, { stdin: 'x'.repeat(65537) }])
    await assert.rejects(createPlaygroundRun(me, run(bad)));
  await assert.rejects(createPlaygroundRun(me, run({ code: 'a\0b' })), status(400));
});

void test('it queues a custom-input run with no problem, owned and idempotent', async () => {
  const input = run();
  const created = await createPlaygroundRun(me, input);
  assert.deepEqual(await createPlaygroundRun(me, input), created);
  await assert.rejects(createPlaygroundRun(me, { ...input, code: 'int main(){return 1;}' }), status(409));
  const row = sqlite().prepare('SELECT * FROM submissions WHERE id=?').get(created.id) as Record<string, unknown>;
  assert.equal(row.mode, 'playground');
  assert.equal(row.problem_id, 'playground');
  assert.equal(row.problem_version_id, null);
  assert.equal(row.custom_input, input.stdin);
  assert.equal(row.total, 1);
  assert.equal(row.practice_round_id, null);
  const outbox = sqlite().prepare('SELECT COUNT(*) AS n FROM oj_outbox WHERE submission_id=?').get(created.id) as { n: number };
  assert.equal(outbox.n, 1);
  const detail = await submissionDetail(me, created.id);
  assert.equal(detail.cases.length, 1);
  assert.equal(detail.cases[0].stdin, input.stdin);
  await assert.rejects(submissionDetail(other, created.id), status(404));
  // Two in flight per learner, as for problem runs.
  const second = await createPlaygroundRun(me, run());
  await assert.rejects(createPlaygroundRun(me, run()), status(429));
  await cancelSubmission(me, created.id);
  await cancelSubmission(me, second.id);
});

void test('playground runs stay out of history, the status board, statistics and practice', async () => {
  const finished = Date.now();
  sqlite()
    .prepare(
      "INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,runtime,mode,created_at,updated_at) VALUES(?,?,'playground','cpp','x','finished',1,1,0.01,'playground',?,?)",
    )
    .run(randomUUID(), me.id, finished, finished);
  assert.equal(submissionHistory(me, null, null).items.length, 0);
  assert.equal(submissionHistory(me, 'playground', null).items.length, 0);
  assert.equal(judgeFeed(me, new URLSearchParams({ mine: '1' })).items.length, 0);
  assert.deepEqual(problemStats('playground', 'cpp', 10), { acceptance: null, beats: null, beatsMemory: null, histogram: null, votes: { up: 0, down: 0 } });
  assert.equal(practiceHistory(me.id).length, 0);
});

void test(`${PLAYGROUND_RUNS_PER_HOUR} runs an hour, then 429; through the API the reply is the run's detail`, async () => {
  sqlite().prepare('DELETE FROM limits').run();
  const request = (body: unknown) =>
    handleOj(
      new Request('https://cswork.test/api/oj/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      other,
      ['playground', 'run'],
    );
  const response = await request(run({ language: 'python', code: 'print(input())', stdin: 'hi' }));
  assert.equal(response.status, 201);
  const detail = (await response.json()) as { id: string; status: string; cases: { stdin: string }[] };
  assert.equal(detail.cases[0].stdin, 'hi');
  await cancelSubmission(other, detail.id);
  for (let i = 1; i < PLAYGROUND_RUNS_PER_HOUR; i++) {
    const created = await createPlaygroundRun(other, run());
    await cancelSubmission(other, created.id);
  }
  await assert.rejects(createPlaygroundRun(other, run()), status(429));
});

void test('share links round-trip and refuse oversized or forged payloads', async () => {
  const state = { language: 'go' as const, code: 'package main\n// 你好\nfunc main() {}\n', stdin: '1 2\n' };
  const value = await encodeShare(state);
  assert.ok(value && /^[A-Za-z0-9_-]+$/.test(value));
  assert.deepEqual(await decodeShare(`#c=${value}`), state);
  assert.equal(await decodeShare(''), null);
  assert.equal(await decodeShare('#c=not-deflate'), null);
  // Random code doesn't compress: past the link cap it is refused rather than truncated.
  const noise = randomBytes(30000).toString('base64');
  assert.equal(await encodeShare({ ...state, code: noise }), null);
  // A tiny link that inflates to megabytes is dropped.
  const bomb = await encodeShare({ ...state, code: 'a'.repeat(60000), stdin: 'b'.repeat(60000) });
  assert.ok(bomb && bomb.length < SHARE_MAX_CHARS);
  assert.ok(await decodeShare(`#c=${bomb}`));
  const zeros = new Blob([new Uint8Array(4 << 20)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const packed = Buffer.from(await new Response(zeros).arrayBuffer()).toString('base64url');
  assert.equal(await decodeShare(`#c=${packed}`), null);
  for (const forged of [{ v: 1, l: 'sql', c: 'x', s: '' }, { v: 1, l: 'go', c: 1, s: '' }]) {
    const raw = new Blob([JSON.stringify(forged)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const link = Buffer.from(await new Response(raw).arrayBuffer()).toString('base64url');
    assert.equal(await decodeShare(`#c=${link}`), null);
  }
});
