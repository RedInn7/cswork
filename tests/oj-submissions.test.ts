import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-submission-tests-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { ensureOjSeed } = await import('../lib/server/oj-problems');
const {
  createSubmission,
  submissionDetail,
  submissionHistory,
  cancelSubmission,
  ojStatus,
} = await import('../lib/server/oj-submissions');
const { matchesOutput, engineVerdict } =
  await import('../lib/server/oj-engine');
const student: Person = {
  id: 'student',
  name: 'Student',
  email: 'student@example.test',
  verified: true,
  role: 'student',
};
const other: Person = { ...student, id: 'other', email: 'other@example.test' };
const teacher: Person = { ...student, id: 'teacher', role: 'teacher' };
const request = (extra = {}) => ({
  problemId: 'watch-intervals',
  language: 'python',
  code: 'print(1)',
  mode: 'judge',
  idempotencyKey: randomUUID(),
  ...extra,
});
const status = (n: number) => (e: unknown) =>
  Boolean(e && typeof e === 'object' && 'status' in e && e.status === n);
before(async () => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare(
      'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
    )
    .run('gomall', 'GoMall', 'Tests', '1');
  for (const id of [
    '00-overview',
    '07-product-search',
    '00-overview-architecture',
    '14-middleware',
  ])
    sqlite()
      .prepare(
        'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)',
      )
      .run(id, 'gomall', id, '', 'chapter', '', '1');
  await ensureOjSeed();
  sqlite()
    .prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    )
    .run('grant', student.email, '*', 'test', Date.now());
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});
test('only configured, entitled submissions enter durable outbox', async () => {
  await assert.rejects(createSubmission(student, request()), status(503));
  process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
  process.env.GO_JUDGE_TOKEN = 'test';
  process.env.REDIS_URL = 'redis://127.0.0.1:6381';
  await assert.rejects(createSubmission(other, request()), status(403));
  await assert.rejects(
    createSubmission({ ...student, verified: false }, request()),
    status(403),
  );
  assert.equal(ojStatus().available, false);
});
test('idempotency, global queue ownership and cancellation are atomic', async () => {
  const input = request();
  const first = await createSubmission(student, input);
  assert.deepEqual(await createSubmission(student, input), first);
  await assert.rejects(
    createSubmission(student, { ...input, code: 'print(2)' }),
    status(409),
  );
  assert.equal(
    (
      sqlite()
        .prepare('SELECT COUNT(*) as n FROM oj_outbox WHERE submission_id=?')
        .get(first.id) as { n: number }
    ).n,
    1,
  );
  const second = await createSubmission(student, request());
  await assert.rejects(createSubmission(student, request()), status(429));
  assert.throws(() => cancelSubmission(other, first.id), status(404));
  assert.equal((await cancelSubmission(student, first.id)).status, 'cancelled');
  await cancelSubmission(student, second.id);
});
test('hidden test data and internal identifiers never reach submission responses', async () => {
  const saved = await createSubmission(teacher, request());
  const raw = sqlite()
    .prepare('SELECT problem_version_id FROM submissions WHERE id=?')
    .get(saved.id) as { problem_version_id: string };
  const secret = sqlite()
    .prepare(
      'SELECT ordinal FROM oj_test_cases WHERE version_id=? AND hidden=1 LIMIT 1',
    )
    .get(raw.problem_version_id) as { ordinal: number };
  sqlite()
    .prepare(
      'INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,?,?,?,?,?,?,?)',
    )
    .run(
      saved.id,
      secret.ordinal,
      'wrong_answer',
      12,
      1024,
      'hidden answer',
      'hidden input echoed',
      1,
    );
  const detail = await submissionDetail(teacher, saved.id);
  const hidden = detail.cases.find((c) => c.ordinal === secret.ordinal)!;
  assert.equal(hidden.hidden, true);
  for (const key of ['stdin', 'expected', 'stdout', 'stderr'])
    assert.equal(key in hidden, false);
  assert.equal(JSON.stringify(detail).includes('hidden answer'), false);
  for (const key of ['tokens', 'request_hash', 'idempotency_key', 'user_id'])
    assert.equal(key in detail, false);
  await assert.rejects(submissionDetail(other, saved.id), status(404));
  await cancelSubmission(teacher, saved.id);
});
test('custom runs preserve empty stdin and do not use hidden cases', async () => {
  const saved = await createSubmission(
    teacher,
    request({ mode: 'run', stdin: '' }),
  );
  const detail = await submissionDetail(teacher, saved.id);
  assert.equal(detail.mode, 'run');
  assert.equal(detail.total, 1);
  assert.equal(detail.cases.length, 1);
  assert.equal(detail.cases[0].stdin, '');
  assert.equal(detail.cases[0].expected, undefined);
  await cancelSubmission(teacher, saved.id);
  await assert.rejects(
    createSubmission(teacher, request({ stdin: 'x' })),
    status(400),
  );
  await assert.rejects(
    createSubmission(teacher, request({ code: '中'.repeat(30000) })),
    status(413),
  );
});
test('history is scoped to the current user and cursors are validated', () => {
  assert.deepEqual(submissionHistory(other, null, null), {
    items: [],
    nextCursor: null,
  });
  assert.throws(
    () => submissionHistory(student, null, 'bad-cursor'),
    status(400),
  );
  const history = submissionHistory(student, 'watch-intervals', null);
  assert.equal(history.items.length, 2);
  assert.ok(history.items.every((s) => s.mode === 'judge'));
  assert.ok(history.items.every((s) => !('code' in s)));
});
test('answer checkers distinguish token equivalence from exact output and map engine limits', () => {
  assert.equal(matchesOutput('1 \r\n 2\t', '1 2\n', 'tokens'), true);
  assert.equal(matchesOutput('12\n', '1 2', 'tokens'), false);
  assert.equal(matchesOutput('1\n', '1', 'exact'), false);
  assert.equal(matchesOutput('a\r\n', 'a\n', 'exact'), true);
  assert.equal(matchesOutput('1\u00a02', '1 2', 'tokens'), false);
  assert.equal(
    engineVerdict({ status: 'Memory Limit Exceeded' }),
    'memory_limit',
  );
  assert.equal(
    engineVerdict({ status: 'Output Limit Exceeded' }),
    'output_limit',
  );
});
