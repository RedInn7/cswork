import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-submission-tests-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { ensureOjSeed } = await import('../lib/server/oj-problems');
const {
  requestPrecompile,
  nextPrecompileDraft,
  consumePrecompileDraft,
  precompileDraftCurrent,
} = await import('../lib/server/oj-precompile');
const student: Person = {
  id: 'student',
  name: 'Student',
  email: 'student@example.test',
  verified: true,
  role: 'student',
};
const other: Person = {
  ...student,
  id: 'other',
  email: 'other@example.test',
};
const request = (extra = {}) => ({
  problemId: 'watch-intervals',
  language: 'cpp',
  code: 'int main() { return 0; }',
  codingMode: 'acm',
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
  process.env.OJ_ENABLED = 'true';
  sqlite()
    .prepare(
      "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,1,'{}')",
    )
    .run(Date.now());
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

beforeEach(() => {
  sqlite().prepare('DELETE FROM limits').run();
  sqlite().prepare('DELETE FROM oj_precompile').run();
  delete process.env.OJ_PRECOMPILE_ENABLED;
});

void test('authorized background drafts never create submissions, history or outbox records', async () => {
  const counts = () =>
    ['submissions', 'oj_outbox'].map(
      (table) =>
        (
          sqlite().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
            n: number;
          }
        ).n,
    );
  const beforeCounts = counts();
  await assert.rejects(requestPrecompile(other, request()), status(403));
  await assert.rejects(
    requestPrecompile({ ...student, verified: false }, request()),
    status(403),
  );
  assert.deepEqual(await requestPrecompile(student, request()), {
    status: 'queued',
  });
  assert.deepEqual(counts(), beforeCounts);
  assert.equal(nextPrecompileDraft()?.code, request().code);
});
void test('new generation replaces only its owner and old completion cannot remove the new draft', async () => {
  await requestPrecompile(student, request());
  const first = nextPrecompileDraft()!;
  await requestPrecompile(student, request());
  assert.equal(nextPrecompileDraft()?.generation, first.generation);
  await requestPrecompile(
    student,
    request({ code: 'int main() { return 1; }' }),
  );
  const second = nextPrecompileDraft()!;
  assert.notEqual(first.generation, second.generation);
  assert.equal(precompileDraftCurrent(first), false);
  consumePrecompileDraft(first);
  assert.equal(nextPrecompileDraft()?.generation, second.generation);
  assert.equal(precompileDraftCurrent(second), true);
});
void test('expired drafts are removed and full mailbox skips new owners', async () => {
  await requestPrecompile(student, request());
  const draft = nextPrecompileDraft()!;
  sqlite().prepare('UPDATE oj_precompile SET expires_at=0').run();
  assert.equal(precompileDraftCurrent(draft), false);
  assert.equal(nextPrecompileDraft(), undefined);
  const insert = sqlite().prepare(
    'INSERT INTO oj_precompile VALUES(?,?,?,?,?,?,?,?)',
  );
  for (let i = 0; i < 32; i++)
    insert.run(
      `owner-${i}`,
      `generation-${i}`,
      draft.problem_id,
      draft.problem_version_id,
      draft.code,
      draft.coding_mode,
      Date.now(),
      Date.now() + 30000,
    );
  assert.deepEqual(await requestPrecompile(student, request()), {
    status: 'skipped',
  });
  assert.equal(
    (
      sqlite().prepare('SELECT COUNT(*) AS n FROM oj_precompile').get() as {
        n: number;
      }
    ).n,
    32,
  );
});
void test('background rate limit is independent of formal submit and validates byte limits', async () => {
  for (let i = 0; i < 6; i++) await requestPrecompile(student, request());
  await assert.rejects(requestPrecompile(student, request()), status(429));
  assert.equal(
    (
      sqlite()
        .prepare(
          "SELECT COUNT(*) AS n FROM limits WHERE key LIKE '%:oj-submit:%' OR key LIKE '%:oj-write:%'",
        )
        .get() as { n: number }
    ).n,
    0,
  );
  await assert.rejects(
    requestPrecompile(student, request({ code: '中'.repeat(30000) })),
    status(413),
  );
  await assert.rejects(
    requestPrecompile(student, request({ code: '\0' })),
    status(400),
  );
});
void test('unsupported languages and disabled feature skip without drafting', async () => {
  assert.deepEqual(
    await requestPrecompile(student, request({ language: 'python' })),
    { status: 'skipped' },
  );
  process.env.OJ_PRECOMPILE_ENABLED = 'false';
  assert.deepEqual(await requestPrecompile(student, request()), {
    status: 'skipped',
  });
  assert.equal(nextPrecompileDraft(), undefined);
});
