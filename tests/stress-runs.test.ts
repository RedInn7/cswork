import test, { before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-stress-runs-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
// Rows and outbox entries only: no worker, runner or Redis is contacted.
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
process.env.GO_JUDGE_TOKEN = 'fixture';
process.env.REDIS_URL = 'redis://127.0.0.1:6381';
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { cancelSubmission } = await import('../lib/server/oj-submissions');
const { handleOj } = await import('../lib/server/oj-api');
const { lingEditorial } = await import('../lib/server/ling-editorials');
const { LEETCODE_HARNESS_VERSION } = await import('../lib/server/leetcode-mode');
const { leetcodeShape } = await import('../lib/server/oj-worker-policy');
const { oaJudgeRegistry } = await import('../lib/server/oa-judge');
const { oaLibrary } = await import('../lib/server/oa-library');
const { STRESS_CASES } = await import('../lib/stress-gen');

const me: Person = { id: 'stress-me', name: 'Me', email: 'stress@example.test', role: 'student', verified: true };
const teacher: Person = { ...me, id: 'stress-teacher', role: 'teacher' };
// Python and C++ registry programs (content/oa-judge/registry.json).
const OA_PY = 'oa-airbnb-1',
  OA_CPP = 'oa-airbnb-6';

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
const row = (id: string) =>
  sqlite()
    .prepare('SELECT mode,language,code,coding_mode,harness_version,custom_input,total FROM submissions WHERE id=?')
    .get(id) as Record<string, string | number | null>;
const stress = (p: Person, body: Record<string, unknown> = {}) =>
  call(p, 'POST', 'problems/lc-53/stress', { seed: 42, language: 'python', code: 'class Solution: pass', ...body }).then(
    async (r) => ({ status: r.status, ...((await r.json()) as { id: string; referenceId: string; cases: number }) }),
  );

async function publish(id: string, checker: string, languages: string[]) {
  const fixture: OjProblemPackage = {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: id,
      difficulty: '简单',
      tags: ['test'],
      description: id,
      input: 'In.',
      output: 'Out.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker,
      languages,
    } as OjProblemPackage['problem'],
    cases: [
      { name: 'sample', input: '1\n', expectedOutput: '1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: '2\n', expectedOutput: '2\n', hidden: true, weight: 1 },
    ],
  };
  const saved = await saveProblemDraft(teacher, fixture, null);
  await publishProblemDraft(teacher, id, saved.draft!.revision);
  return (sqlite().prepare('SELECT current_version_id AS id FROM oj_problems WHERE id=?').get(id) as { id: string }).id;
}

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  for (const [id, checker] of [
    ['lc-53', 'tokens'],
    ['lc-9', 'float'],
  ]) {
    const version = await publish(id, checker, ['python', 'cpp', 'java', 'go']);
    db.prepare(
      "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES(?,?,?,'t','t','简单','[]','{}','source',1,1,?,?,0)",
    ).run(id, Number(id.slice(3)), id, id, `source:${version}`);
  }
  await publish(OA_PY, 'tokens', ['python', 'cpp', 'java', 'go']);
  await publish(OA_CPP, 'tokens', ['python', 'cpp', 'java', 'go']);
  // The fixture packages are not the verified ones; the registry's own programs still are.
  mock.method(oaJudgeRegistry(), 'isReady', () => true);
});
after(() => {
  mock.restoreAll();
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('an OA reference is the package program run as ACM, never wrapped; a Line 500 one stays wrapped', () => {
  const shape = (problem_id: string, mode: string, coding_mode: string) =>
    leetcodeShape({ problem_id, mode, coding_mode, custom_input: 'x' }).wrap;
  assert.equal(shape('oa-x-1', 'reference', 'acm'), false);
  assert.equal(shape('lc-1', 'reference', 'acm'), true);
  assert.equal(shape('lc-1', 'stress-ref', 'leetcode'), true);
  assert.equal(shape('lc-1', 'stress', 'leetcode'), true);
});

void test('an OA custom case gets the registry program’s output: Python first, else C++, ACM input', async () => {
  const expected = async (id: string, codingMode = 'leetcode') =>
    (await (
      await call(me, 'POST', `problems/${id}/expected`, { stdin: '3\n1 2 3\n', codingMode, idempotencyKey: randomUUID() })
    ).json()) as { id: string; code?: string };
  const py = await expected(OA_PY);
  assert.equal(py.code, undefined, 'the reference code never comes back');
  const python = oaLibrary().solution(OA_PY).solutions.find((s) => s.language === 'python')!;
  assert.deepEqual(row(py.id), {
    mode: 'reference',
    language: 'python',
    code: python.code,
    coding_mode: 'acm',
    harness_version: null,
    custom_input: '3\n1 2 3\n',
    total: 1,
  });
  const cppSolutions = oaLibrary().solution(OA_CPP).solutions;
  const cpp = await expected(OA_CPP, 'acm');
  const want = cppSolutions.find((s) => s.language === 'python') ?? cppSolutions[0];
  assert.equal(row(cpp.id).language, want.language);
  assert.equal(row(cpp.id).code, want.code);
  // The same case reuses its run; the request hash covers the language.
  assert.equal((await expected(OA_PY)).id, py.id);
  for (const item of [py, cpp]) await cancelSubmission(me, item.id);
});

void test('a stress test draws its cases on the server and queues an unlisted pair, the reference one sealed', async () => {
  const created = await stress(me);
  assert.equal(created.status, 201);
  assert.equal(created.cases, STRESS_CASES);
  const mine = row(created.id),
    ref = row(created.referenceId);
  assert.equal(mine.mode, 'stress');
  assert.equal(mine.code, 'class Solution: pass');
  assert.equal(ref.mode, 'stress-ref');
  assert.equal(ref.code, lingEditorial('lc-53')!.approaches.at(-1)!.python);
  for (const r of [mine, ref]) {
    assert.equal(r.coding_mode, 'leetcode');
    assert.equal(r.harness_version, LEETCODE_HARNESS_VERSION);
    assert.equal(r.total, STRESS_CASES);
  }
  assert.equal(mine.custom_input, ref.custom_input, 'both sides run the same cases');
  const cases = (JSON.parse(String(mine.custom_input)) as { cases: string[] }).cases;
  assert.equal(cases.length, STRESS_CASES);
  // The same seed draws the same cases; the client never sends them.
  const again = await stress(me);
  assert.equal(row(again.id).custom_input, mine.custom_input);
  assert.equal(await status(me, 'POST', 'problems/lc-53/stress', { seed: 1, language: 'python', code: 'x', cases: ['[1]'] }), 400);
  // The detail shows every case, public, with input; the reference's code and stderr never come back.
  const detail = (await (await call(me, 'GET', `submissions/${created.referenceId}`)).json()) as {
    code?: string;
    cases: { ordinal: number; stdin?: string; hidden: boolean }[];
  };
  assert.equal(detail.code, undefined);
  assert.deepEqual(
    detail.cases.map((c) => [c.ordinal, c.stdin, c.hidden]),
    cases.map((input, i) => [i, input, false]),
  );
  // Out of the history, statistics and scoring.
  const history = (await (await call(me, 'GET', 'submissions?problemId=lc-53')).json()) as { items: unknown[] };
  assert.deepEqual(history.items, []);
  for (const item of [created, again]) {
    await cancelSubmission(me, item.id);
    await cancelSubmission(me, item.referenceId);
  }
});

void test('stress needs a whitelisted problem with a text checker, a verified address and no running contest', async () => {
  const body = { seed: 1, language: 'python', code: 'x' };
  // lc-9 is whitelisted, but this fixture's checker isn't text: no stress test.
  assert.equal(await status(me, 'POST', 'problems/lc-9/stress', body), 404);
  assert.equal(await status(me, 'POST', 'problems/lc-1/stress', body), 404, 'not whitelisted');
  assert.equal(await status(me, 'POST', `problems/${OA_PY}/stress`, body), 404, 'no OA stress tests');
  assert.equal(await status({ ...me, id: 'stress-unverified', verified: false }, 'POST', 'problems/lc-53/stress', body), 403);
  assert.equal(await status(me, 'POST', 'problems/lc-53/stress', { ...body, language: 'sql' }), 400);
  // 30,000 CJK characters pass zod's length check but are about 88 KiB of UTF-8.
  assert.equal(await status(me, 'POST', 'problems/lc-53/stress', { ...body, code: '中'.repeat(30000) }), 413);
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES('room',NULL,'room','custom','["lc-53"]',?,60,'private',0)`,
    )
    .run(Date.now() - 1000);
  sqlite()
    .prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES('room',?,?,0,NULL)")
    .run(me.id, me.id);
  assert.equal(await status(me, 'POST', 'problems/lc-53/stress', body), 403);
});

const { ownCases, probeCases } = await import('../lib/server/oj-submissions');
const probe = (p: Person, id = 'lc-53') => call(p, 'POST', `problems/${id}/complexity`, { language: 'python', code: 'class Solution: pass' });
const failure = async (p: Person, id = 'lc-53') => {
  try {
    await probe(p, id);
  } catch (error) {
    return [(error as { status: number }).status, (error as Error).message];
  }
  assert.fail('expected a refusal');
};

void test('a complexity probe keeps only its seed, redraws its cases in the worker and stays unlisted', async () => {
  const prober: Person = { ...me, id: 'probe-me' };
  const response = await probe(prober);
  assert.equal(response.status, 201);
  const created = (await response.json()) as { id: string; sizes: number[] };
  const saved = row(created.id);
  assert.equal(saved.mode, 'complexity');
  assert.equal(saved.coding_mode, 'leetcode');
  assert.equal(saved.harness_version, LEETCODE_HARNESS_VERSION);
  // Up to 512 KiB of input is never stored: the row holds the server's seed, the worker redraws.
  const { seed } = JSON.parse(String(saved.custom_input)) as { seed: number };
  assert.deepEqual(Object.keys(JSON.parse(String(saved.custom_input))), ['seed']);
  const drawn = probeCases('lc-53', seed)!;
  assert.deepEqual(created.sizes, drawn.sizes);
  assert.equal(saved.total, drawn.cases.length);
  const full = sqlite().prepare('SELECT * FROM submissions WHERE id=?').get(created.id) as Parameters<typeof ownCases>[0];
  assert.deepEqual(ownCases(full), drawn.cases);
  // The detail polls carry times and verdicts, never the inputs.
  const detail = (await (await call(prober, 'GET', `submissions/${created.id}`)).json()) as { cases: { stdin?: string; status: string }[] };
  assert.equal(detail.cases.length, drawn.cases.length);
  assert.ok(detail.cases.every((c) => c.stdin === undefined && c.status === 'pending'));
  const history = (await (await call(prober, 'GET', 'submissions?problemId=lc-53')).json()) as { items: unknown[] };
  assert.deepEqual(history.items, []);
  // Someone else's probe waits for this one: one in flight site-wide, and waiting costs no quota.
  const other: Person = { ...me, id: 'probe-other' };
  for (let i = 0; i < 7; i++) assert.deepEqual(await failure(other), [429, '另一次复杂度测量正在运行，请稍后再试']);
  await cancelSubmission(prober, created.id);
  const theirs = await probe(other);
  assert.equal(theirs.status, 201);
  await cancelSubmission(other, ((await theirs.json()) as { id: string }).id);
  // Six an hour each: the seventh is refused.
  for (let i = 2; i <= 6; i++) {
    const next = await probe(prober);
    assert.equal(next.status, 201);
    await cancelSubmission(prober, ((await next.json()) as { id: string }).id);
  }
  assert.deepEqual(await failure(prober), [429, '操作有些频繁，请稍后再试']);
});

void test('a probe needs a whitelisted problem with something to scale, and no running contest', async () => {
  const someone: Person = { ...me, id: 'probe-gate' };
  assert.equal((await failure(someone, 'lc-1'))[0], 404, 'not whitelisted');
  assert.equal((await failure(someone, 'lc-9'))[0], 404, 'no text checker here, nor a length');
  assert.equal((await failure({ ...someone, verified: false }))[0], 403);
  assert.equal(await status(someone, 'POST', 'problems/lc-53/complexity', { language: 'python', code: 'x', seed: 1 }), 400, 'the seed is the server’s');
  // `me` joined a room with lc-53 running (the stress test above).
  assert.equal((await failure(me))[0], 403);
});
