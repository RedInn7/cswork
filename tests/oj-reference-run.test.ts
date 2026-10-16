import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-reference-run-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
// Rows and outbox entries only: no worker, runner or Redis is contacted.
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
process.env.GO_JUDGE_TOKEN = 'fixture';
process.env.REDIS_URL = 'redis://127.0.0.1:6381';
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { createSubmission, cancelSubmission } = await import('../lib/server/oj-submissions');
const { handleOj } = await import('../lib/server/oj-api');
const { lingEditorial } = await import('../lib/server/ling-editorials');
const { leetcodeParams, LEETCODE_HARNESS_VERSION } = await import('../lib/server/leetcode-mode');
const { leetcodeShape } = await import('../lib/server/oj-worker-policy');

const me: Person = { id: 'ref-me', name: 'Me', email: 'ref@example.test', role: 'student', verified: true };
const teacher: Person = { ...me, id: 'ref-teacher', role: 'teacher' };

function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function status(p: Person, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const expected = (p: Person, stdin: string, codingMode = 'leetcode') =>
  call(p, 'POST', 'problems/lc-1/expected', { stdin, codingMode, idempotencyKey: randomUUID() }).then(
    async (r) => (await r.json()) as { id: string; mode: string; code?: string },
  );
const row = (id: string) =>
  sqlite()
    .prepare('SELECT mode,language,code,coding_mode,harness_version,custom_input FROM submissions WHERE id=?')
    .get(id) as Record<string, string>;

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  const fixture: OjProblemPackage = {
    schemaVersion: 1,
    problem: {
      id: 'lc-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Two Sum',
      difficulty: '简单',
      tags: ['test'],
      description: 'Two Sum.',
      input: 'n, nums, target.',
      output: 'Two indices.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python', 'cpp'],
    },
    cases: [
      { name: 'sample', input: '4 2 7 11 15 9\n', expectedOutput: '0 1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: '2 3 3 6\n', expectedOutput: '0 1\n', hidden: true, weight: 1 },
    ],
  };
  const saved = await saveProblemDraft(teacher, fixture, null);
  await publishProblemDraft(teacher, 'lc-1', saved.draft!.revision);
  const version = (db.prepare("SELECT current_version_id AS id FROM oj_problems WHERE id='lc-1'").get() as { id: string }).id;
  db.prepare(
    "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','source',1,1,'lc-1',?,0)",
  ).run(`source:${version}`);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('custom-case fields follow the function signature; design, Codec and helped problems keep raw text', () => {
  assert.deepEqual(leetcodeParams('lc-1'), [
    { name: 'nums', type: 'integer[]' },
    { name: 'target', type: 'integer' },
  ]);
  for (const id of ['lc-155', 'lc-297', 'lc-160', 'lc-0']) assert.equal(leetcodeParams(id), null, id);
});

void test('a reference run is always wrapped and reads input the way the learner wrote the case', () => {
  const shape = (mode: string, coding_mode: string, custom_input: string | null = 'x') =>
    leetcodeShape({ problem_id: 'lc-1', mode, coding_mode, custom_input });
  assert.deepEqual(shape('reference', 'leetcode'), { wrap: true, leetcodeInput: true });
  assert.deepEqual(shape('reference', 'acm'), { wrap: true, leetcodeInput: false });
  assert.deepEqual(shape('run', 'leetcode'), { wrap: true, leetcodeInput: true });
  assert.deepEqual(shape('run', 'leetcode', null), { wrap: true, leetcodeInput: false });
  assert.deepEqual(shape('judge', 'leetcode', null), { wrap: true, leetcodeInput: false });
  assert.deepEqual(shape('run', 'acm'), { wrap: false, leetcodeInput: false });
  assert.deepEqual(shape('playground', 'acm'), { wrap: false, leetcodeInput: false });
});

void test('the expected output runs the best editorial approach, reused per case, never shown or listed as the learner’s', async () => {
  const editorial = lingEditorial('lc-1')!;
  assert.equal(editorial.verified, true);
  const first = await expected(me, '[2,7,11,15]\n9');
  assert.equal(first.mode, 'reference');
  assert.equal(first.code, undefined, 'the editorial code never comes back');
  assert.deepEqual(row(first.id), {
    mode: 'reference',
    language: 'python',
    code: editorial.approaches.at(-1)!.python,
    coding_mode: 'leetcode',
    harness_version: LEETCODE_HARNESS_VERSION,
    custom_input: '[2,7,11,15]\n9',
  });
  assert.equal((await expected(me, '[2,7,11,15]\n9')).id, first.id, 'the same case reuses its run');
  const acm = await expected(me, '4 2 7 11 15 9\n', 'acm');
  assert.notEqual(acm.id, first.id);
  assert.equal(row(acm.id).coding_mode, 'acm', 'an ACM case keeps its test-file format');
  // Two references are in flight: a third waits, but the learner's own runs are untouched.
  assert.equal(
    await status(me, 'POST', 'problems/lc-1/expected', { stdin: '[3,3]\n6', idempotencyKey: randomUUID() }),
    429,
  );
  const run = () =>
    createSubmission(me, {
      problemId: 'lc-1',
      language: 'python',
      code: 'print(1)',
      mode: 'run',
      stdin: '1',
      idempotencyKey: randomUUID(),
    });
  const runs = [await run(), await run()];
  await assert.rejects(run(), (e: { status?: number }) => e.status === 429);
  const detail = (await (await call(me, 'GET', `submissions/${first.id}`)).json()) as { code?: string };
  assert.equal(detail.code, undefined);
  const history = (await (await call(me, 'GET', 'submissions?problemId=lc-1')).json()) as { items: { id: string }[] };
  assert.deepEqual(history.items.map((i) => i.id).sort(), runs.map((r) => r.id).sort(), 'references stay out of history');
  for (const item of [...runs, first, acm]) await cancelSubmission(me, item.id);
  // A cancelled reference is not reused.
  assert.notEqual((await expected(me, '[2,7,11,15]\n9')).id, first.id);
});

void test('a LeetCode case outside the statement constraints gets a 422 naming the field, before any run', async () => {
  const send = (stdin: string, codingMode = 'leetcode') =>
    call(me, 'POST', 'problems/lc-1/expected', { stdin, codingMode, idempotencyKey: randomUUID() });
  await assert.rejects(send('[1]\n9'), (e: { status?: number; message?: string }) => e.status === 422 && e.message === '超出题目约束：nums 长度 1 < 2');
  await assert.rejects(send('[1,2]\n-1000000001'), (e: { message?: string }) => e.message === '超出题目约束：target 的值 -1000000001 < -1000000000');
  // Without codingMode the schema's default, leetcode, applies here too.
  await assert.rejects(call(me, 'POST', 'problems/lc-1/expected', { stdin: '[1]\n9', idempotencyKey: randomUUID() }), (e: { status?: number }) => e.status === 422);
  // ACM cases (and raw text that doesn't split per parameter) go through unchecked.
  const acm = (await (await send('1 1 9\n', 'acm')).json()) as { id: string };
  await cancelSubmission(me, acm.id);
});

void test('a JSON body of literal null is a 400, not a crash', async () => {
  const { fail } = await import('../lib/server/http');
  const response = await call(me, 'POST', 'problems/lc-1/expected', null).catch((error: unknown) => fail(error));
  assert.equal(response.status, 400);
});

void test('the expected output needs a verified address and a verified editorial, and closes in a running contest', async () => {
  const body = { stdin: '[1,2]\n3', idempotencyKey: randomUUID() };
  assert.equal(await status({ ...me, id: 'ref-unverified', verified: false }, 'POST', 'problems/lc-1/expected', body), 403);
  let bare = 1;
  while (lingEditorial(`lc-${bare}`)) bare++;
  assert.equal(await status(me, 'POST', `problems/lc-${bare}/expected`, body), 404);
  assert.equal(await status(me, 'POST', 'problems/lc-1/expected', body), 201);
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES('room',NULL,'room','custom','["lc-1"]',?,60,'private',0)`,
    )
    .run(Date.now() - 1000);
  sqlite()
    .prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES('room',?,?,0,NULL)")
    .run(me.id, me.id);
  assert.equal(await status(me, 'POST', 'problems/lc-1/expected', body), 403);
});
