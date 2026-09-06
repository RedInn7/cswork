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

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-library-gate-test-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
// createSubmission persists an outbox entry only; these dummy endpoints are
// never contacted and no worker or Redis connection is started by this test.
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';
process.env.GO_JUDGE_TOKEN = 'fixture';
process.env.REDIS_URL = 'redis://127.0.0.1:6381';
const { sqlite } = await import('../db/sqlite');
const {
  getJudgeProblem,
  getPublishedProblem,
  listPublishedProblems,
  saveProblemDraft,
  publishProblemDraft,
} = await import('../lib/server/oj-problems');
const { createSubmission, cancelSubmission } =
  await import('../lib/server/oj-submissions');
const student: Person = {
  id: 'gate-student',
  name: 'Student',
  email: 'gate@example.test',
  role: 'student',
  verified: true,
};
const teacher: Person = { ...student, id: 'gate-teacher', role: 'teacher' };
const libraryId = 'lc-999901';
const courseId = 'course-only-fixture';
const aliasId = 'mapped-library-fixture';
let version: string;
let aliasVersion: string;
const status404 = (e: unknown) =>
  Boolean(e && typeof e === 'object' && 'status' in e && e.status === 404);
const input = (problemId: string, mode = 'judge') => ({
  problemId,
  language: 'python',
  code: 'print(1)',
  mode,
  idempotencyKey: randomUUID(),
  ...(mode === 'run' ? { stdin: '' } : {}),
});
function packageFor(id: string): OjProblemPackage {
  return {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Synthetic gate fixture',
      difficulty: '简单',
      tags: ['test'],
      description: 'Print one.',
      input: 'No input.',
      output: 'One integer.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      {
        name: 'sample',
        input: '',
        expectedOutput: '1\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: 'private-fixture',
        expectedOutput: '1\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
}
async function publish(id: string) {
  const saved = await saveProblemDraft(teacher, packageFor(id), null);
  await publishProblemDraft(teacher, id, saved.draft!.revision);
  return (
    sqlite()
      .prepare('SELECT current_version_id AS id FROM oj_problems WHERE id=?')
      .get(id) as { id: string }
  ).id;
}
function restore() {
  // Version pointers are append-only: revalidate the actual current version,
  // never rewind it or disable an immutability trigger.
  version = (
    sqlite()
      .prepare('SELECT current_version_id AS id FROM oj_problems WHERE id=?')
      .get(libraryId) as { id: string }
  ).id;
  sqlite()
    .prepare(
      "UPDATE study_library SET content_hash='source',judge_problem_id=?,verified_hash=? WHERE id=?",
    )
    .run(libraryId, `source:${version}`, libraryId);
}
async function inaccessible(id: string) {
  await assert.rejects(getPublishedProblem(student, id), status404);
  await assert.rejects(getJudgeProblem(student, id), status404);
  const count = (
    sqlite().prepare('SELECT COUNT(*) AS n FROM submissions').get() as {
      n: number;
    }
  ).n;
  await assert.rejects(createSubmission(student, input(id)), status404);
  await assert.rejects(createSubmission(student, input(id, 'run')), status404);
  assert.equal(
    (
      sqlite().prepare('SELECT COUNT(*) AS n FROM submissions').get() as {
        n: number;
      }
    ).n,
    count,
  );
  assert.ok(!(await listPublishedProblems()).some((p) => p.id === id));
}
before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)",
  ).run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO grants(id,email,course_id,source,created_at) VALUES('gate-grant',?,'gomall','test',0)",
  ).run(student.email);
  version = await publish(libraryId);
  await publish(courseId);
  aliasVersion = await publish(aliasId);
  const insert = db.prepare(
    "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES(?,?,?,'测试','Test','简单','[]','{}','source',2,2,?,?,0)",
  );
  insert.run(libraryId, 999901, 'gate-library', libraryId, `source:${version}`);
  insert.run(
    'lc-999902',
    999902,
    'gate-alias',
    aliasId,
    `source:${aliasVersion}`,
  );
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('validated canonical and mapped library questions allow public read and durable submission', async () => {
  for (const id of [libraryId, aliasId]) {
    const detail = await getPublishedProblem(student, id);
    assert.equal(detail.id, id);
    assert.ok(!JSON.stringify(detail).includes('private-fixture'));
    assert.equal((await getJudgeProblem(student, id)).problemId, id);
    assert.ok((await listPublishedProblems()).some((p) => p.id === id));
    const submitted = await createSubmission(student, input(id));
    assert.ok(
      sqlite()
        .prepare('SELECT submission_id FROM oj_outbox WHERE submission_id=?')
        .get(submitted.id),
    );
    await cancelSubmission(student, submitted.id);
  }
});

void test('missing verification blocks catalogue, detail and both submission modes', async () => {
  try {
    sqlite()
      .prepare('UPDATE study_library SET verified_hash=NULL WHERE id=?')
      .run(libraryId);
    await inaccessible(libraryId);
  } finally {
    restore();
  }
});

void test('changed source hash invalidates the current version', async () => {
  try {
    sqlite()
      .prepare(
        "UPDATE study_library SET content_hash='changed-source' WHERE id=?",
      )
      .run(libraryId);
    await inaccessible(libraryId);
  } finally {
    restore();
  }
});

void test('a different published version needs its own validation binding', async () => {
  const changed = 'gate-new-version';
  sqlite()
    .prepare(
      'INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) SELECT ?,problem_id,revision+1,spec_json,checksum,created_by,created_at FROM oj_problem_versions WHERE id=?',
    )
    .run(changed, version);
  sqlite()
    .prepare(
      'INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) SELECT id || ?,?,ordinal,input,expected_output,hidden,name,weight FROM oj_test_cases WHERE version_id=?',
    )
    .run('-new', changed, version);
  try {
    sqlite()
      .prepare('UPDATE oj_problems SET current_version_id=? WHERE id=?')
      .run(changed, libraryId);
    await inaccessible(libraryId);
  } finally {
    restore();
  }
});

void test('cleared canonical association cannot turn a library question into a normal course problem', async () => {
  try {
    sqlite()
      .prepare('UPDATE study_library SET judge_problem_id=NULL WHERE id=?')
      .run(libraryId);
    await inaccessible(libraryId);
  } finally {
    restore();
  }
});

void test('a noncanonical mapped library problem is gated too', async () => {
  try {
    sqlite()
      .prepare(
        "UPDATE study_library SET verified_hash='stale' WHERE judge_problem_id=?",
      )
      .run(aliasId);
    await inaccessible(aliasId);
  } finally {
    sqlite()
      .prepare(
        'UPDATE study_library SET verified_hash=? WHERE judge_problem_id=?',
      )
      .run(`source:${aliasVersion}`, aliasId);
  }
});

void test('ordinary course problems remain usable while a library binding is invalid', async () => {
  try {
    sqlite()
      .prepare('UPDATE study_library SET verified_hash=NULL WHERE id=?')
      .run(libraryId);
    assert.equal((await getPublishedProblem(student, courseId)).id, courseId);
    assert.equal(
      (await getJudgeProblem(student, courseId)).problemId,
      courseId,
    );
    assert.ok((await listPublishedProblems()).some((p) => p.id === courseId));
    const item = await createSubmission(student, input(courseId));
    assert.ok(item.id);
    await cancelSubmission(student, item.id);
  } finally {
    restore();
  }
});
