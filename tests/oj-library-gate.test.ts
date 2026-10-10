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
  getCompileProblem,
  getJudgeProblem,
  getPublishedProblem,
  listPublishedProblems,
  saveProblemDraft,
  publishProblemDraft,
} = await import('../lib/server/oj-problems');
const { createSubmission, cancelSubmission } =
  await import('../lib/server/oj-submissions');
const { handleOj } = await import('../lib/server/oj-api');
const { getStudySourceStatement } = await import('../lib/server/study-library');
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

void test('POST returns watch-ready detail for new and replayed submissions without exposing hidden cases', async () => {
  const payload = input(libraryId);
  const post = () =>
    handleOj(
      new Request('https://cswork.test/api/oj/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      student,
      ['submissions'],
    );
  const response = await post();
  assert.equal(response.status, 201);
  const created = await response.json();
  try {
    assert.equal(created.code, payload.code);
    assert.equal(typeof created.watchToken, 'string');
    assert.equal(created.total, 2);
    assert.equal(created.cases.length, 2);
    assert.doesNotMatch(JSON.stringify(created), /private-fixture/);
    const detail = await handleOj(
      new Request(`https://cswork.test/api/oj/submissions/${created.id}`),
      student,
      ['submissions', created.id],
    );
    assert.deepEqual(created, await detail.json());
    assert.deepEqual(await (await post()).json(), created);
    await cancelSubmission(student, created.id);
    const replay = await (await post()).json();
    assert.equal(replay.id, created.id);
    assert.equal(replay.status, 'cancelled');
    assert.equal(typeof replay.watchToken, 'string');
    assert.doesNotMatch(JSON.stringify(replay), /private-fixture/);
    sqlite()
      .prepare("UPDATE submissions SET status='accepted',passed=2 WHERE id=?")
      .run(created.id);
    sqlite()
      .prepare(
        "INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,1,'accepted',1,1,'PRIVATE-STDOUT','PRIVATE-STDERR',1)",
      )
      .run(created.id);
    const completed = await (await post()).json();
    assert.equal(completed.status, 'accepted');
    assert.equal(completed.passed, 2);
    assert.equal(completed.cases[1].status, 'accepted');
    assert.doesNotMatch(
      JSON.stringify(completed),
      /private-fixture|PRIVATE-STDOUT|PRIVATE-STDERR/,
    );
  } finally {
    await cancelSubmission(student, created.id);
  }
});

void test('LeetCode submissions preserve raw code, isolate request identity and expose mode in history', async () => {
  const person = { ...student, id: 'coding-mode-student' };
  const selectedVersion = await publish('lc-1');
  sqlite()
    .prepare(
      "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','source',2,2,'lc-1',?,0)",
    )
    .run(`source:${selectedVersion}`);
  const raw =
    'class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]\n';
  const key = randomUUID();
  const legacy = await createSubmission(person, {
    ...input('lc-1'),
    code: raw,
    idempotencyKey: key,
  });
  await cancelSubmission(person, legacy.id);
  const lc = await createSubmission(person, {
    ...input('lc-1'),
    code: raw,
    codingMode: 'leetcode',
  });
  await cancelSubmission(person, lc.id);
  const row = (id: string) =>
    sqlite()
      .prepare(
        'SELECT code,coding_mode,harness_version,request_hash FROM submissions WHERE id=?',
      )
      .get(id) as {
      code: string;
      coding_mode: string;
      harness_version: string | null;
      request_hash: string;
    };
  assert.equal(row(legacy.id).coding_mode, 'acm');
  assert.equal(row(legacy.id).harness_version, null);
  assert.equal(row(lc.id).coding_mode, 'leetcode');
  assert.match(row(lc.id).harness_version || '', /^[a-f0-9]{64}$/);
  assert.equal(row(lc.id).code, raw);
  assert.notEqual(row(legacy.id).request_hash, row(lc.id).request_hash);
  await assert.rejects(
    createSubmission(person, {
      ...input('lc-1'),
      code: raw,
      codingMode: 'leetcode',
      idempotencyKey: key,
    }),
    (e: unknown) =>
      Boolean(e && typeof e === 'object' && 'status' in e && e.status === 409),
  );
  const replay = await createSubmission(person, {
    ...input('lc-1'),
    code: raw,
    codingMode: 'acm',
    idempotencyKey: key,
  });
  assert.equal(replay.id, legacy.id);
  const detail = await handleOj(
    new Request(`https://cswork.test/api/oj/submissions/${lc.id}`),
    person,
    ['submissions', lc.id],
  );
  const body = await detail.json();
  assert.equal(body.codingMode, 'leetcode');
  assert.equal(body.code, raw);
  const history = await handleOj(
    new Request('https://cswork.test/api/oj/submissions?problemId=lc-1'),
    person,
    ['submissions'],
  );
  const items = (await history.json()).items;
  assert.equal(
    items.find((item: { id: string }) => item.id === lc.id).codingMode,
    'leetcode',
  );
  assert.equal(
    items.find((item: { id: string }) => item.id === legacy.id).codingMode,
    'acm',
  );
  const supported = await handleOj(
    new Request('https://cswork.test/api/oj/problems/lc-1'),
    person,
    ['problems', 'lc-1'],
  );
  const supportedBody = await supported.json();
  assert.deepEqual(supportedBody.codingModes, ['leetcode', 'acm']);
  assert.match(
    supportedBody.leetcodeTemplates.python,
    /def twoSum\(self, nums: List\[int\], target: int\) -> List\[int\]:/,
  );
  const unsupported = await handleOj(
    new Request(`https://cswork.test/api/oj/problems/${courseId}`),
    person,
    ['problems', courseId],
  );
  assert.deepEqual((await unsupported.json()).codingModes, ['acm']);
  await assert.rejects(
    createSubmission(person, { ...input(courseId), codingMode: 'leetcode' }),
    (e: unknown) =>
      Boolean(e && typeof e === 'object' && 'status' in e && e.status === 400),
  );
});

void test('workspace serves full bilingual statements separately without changing judge data or leaking private source fields', async () => {
  const sourceStatement = {
    descriptionZh: '完整题意\n\n**示例：**\n\n约束条件：`1 <= n <= 100`。',
    descriptionEn:
      'Full statement\n\n**Example:**\n\nConstraints: `1 <= n <= 100`.',
    sourceUrl: 'https://leetcode.cn/problems/test/',
    sourceEnUrl: 'https://leetcode.com/problems/test/',
    attribution: 'LeetCode; doocs/leetcode, CC-BY-SA-4.0',
  };
  const snapshot = () => ({
    versions: sqlite()
      .prepare('SELECT * FROM oj_problem_versions ORDER BY id')
      .all(),
    cases: sqlite().prepare('SELECT * FROM oj_test_cases ORDER BY id').all(),
    hashes: sqlite()
      .prepare(
        'SELECT id,content_hash,verified_hash FROM study_library ORDER BY id',
      )
      .all(),
  });
  try {
    sqlite()
      .prepare('UPDATE study_library SET payload_json=?')
      .run(
        JSON.stringify({
          ...sourceStatement,
          reference: {
            path: '/private/reference.py',
            source: 'SECRET-SOLUTION',
          },
          cases: [{ input: 'SECRET-INPUT', expected: 'SECRET-ANSWER' }],
          codeSnippets: [{ code: 'SECRET-SNIPPET' }],
          signature: { privateField: 'SECRET-SIGNATURE' },
        }),
      );
    const before = snapshot();
    for (const id of [libraryId, aliasId]) {
      const response = await handleOj(
        new Request(`https://cswork.test/api/oj/problems/${id}`),
        student,
        ['problems', id],
      );
      const detail = await response.json();
      assert.deepEqual(detail.sourceStatement, sourceStatement);
      assert.equal(detail.description, 'Print one.');
      assert.equal(detail.input, 'No input.');
      assert.equal(detail.output, 'One integer.');
      assert.deepEqual(detail.samples, [
        { name: 'sample', input: '', expectedOutput: '1\n' },
      ]);
      assert.doesNotMatch(
        JSON.stringify(detail),
        /SECRET-|\/private\/|private-fixture/,
      );
    }
    assert.deepEqual(snapshot(), before);
    for (const unsafeUrl of [
      'javascript:alert(1)',
      'https://leetcode.com.evil.test/problems/test/',
      'http://leetcode.cn/problems/test/',
      'https://name:password@leetcode.com/problems/test/',
    ]) {
      sqlite()
        .prepare('UPDATE study_library SET payload_json=? WHERE id=?')
        .run(
          JSON.stringify({
            ...sourceStatement,
            sourceUrl: unsafeUrl,
            sourceEnUrl: unsafeUrl,
          }),
          libraryId,
        );
      const source = getStudySourceStatement(libraryId);
      assert.equal(source?.sourceUrl, '');
      assert.equal(source?.sourceEnUrl, '');
      assert.equal(source?.descriptionZh, sourceStatement.descriptionZh);
    }
    assert.equal(getStudySourceStatement('unknown'), null);
    assert.equal(getStudySourceStatement(courseId), null);
    const courseResponse = await handleOj(
      new Request(`https://cswork.test/api/oj/problems/${courseId}`),
      student,
      ['problems', courseId],
    );
    assert.equal((await courseResponse.json()).sourceStatement, null);
    // Library problems judge free for any verified account, without a course grant.
    const freeResponse = await handleOj(
      new Request(`https://cswork.test/api/oj/problems/${libraryId}`),
      { ...student, email: 'not-entitled@example.test' },
      ['problems', libraryId],
    );
    assert.equal((await freeResponse.json()).freeJudge, true);
    await assert.rejects(
      handleOj(
        new Request(`https://cswork.test/api/oj/problems/${libraryId}`),
        { ...student, email: 'not-entitled@example.test', verified: false },
        ['problems', libraryId],
      ),
      (e: unknown) =>
        Boolean(
          e && typeof e === 'object' && 'status' in e && e.status === 403,
        ),
    );
    sqlite()
      .prepare('UPDATE study_library SET verified_hash=NULL WHERE id=?')
      .run(libraryId);
    await assert.rejects(
      handleOj(
        new Request(`https://cswork.test/api/oj/problems/${libraryId}`),
        student,
        ['problems', libraryId],
      ),
      status404,
    );
  } finally {
    sqlite().prepare("UPDATE study_library SET payload_json='{}'").run();
    restore();
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

void test('library problems judge free for verified accounts; course exercises keep the course gate', async () => {
  const status403 = (e: unknown) =>
    Boolean(e && typeof e === 'object' && 'status' in e && e.status === 403);
  // No grant at all: reading, precompiling, running and submitting still work.
  const outsider: Person = { ...student, id: 'gate-outsider', email: 'outsider@example.test' };
  assert.equal((await getPublishedProblem(outsider, libraryId)).freeJudge, true);
  assert.ok((await getCompileProblem(outsider, libraryId)).versionId);
  for (const mode of ['run', 'judge']) {
    const item = await createSubmission(outsider, input(libraryId, mode));
    assert.ok(item.id);
    await cancelSubmission(outsider, item.id);
  }
  // Unverified accounts and course exercises stay closed.
  const unverified = { ...outsider, verified: false };
  await assert.rejects(getJudgeProblem(unverified, libraryId), status403);
  await assert.rejects(getCompileProblem(unverified, libraryId), status403);
  for (const read of [getPublishedProblem, getJudgeProblem, getCompileProblem])
    await assert.rejects(read(outsider, courseId), status403);
  // Owner-only mode hides course exercises from everyone else, catalogue included.
  process.env.COURSE_ACCESS = 'owner';
  process.env.COURSE_OWNER_ID = teacher.id;
  try {
    const ids = (await listPublishedProblems(student)).map((p) => p.id);
    assert.ok(ids.includes(libraryId) && !ids.includes(courseId));
    await assert.rejects(getJudgeProblem(student, courseId), status404);
    assert.equal((await getJudgeProblem(student, libraryId)).problemId, libraryId);
    assert.ok((await listPublishedProblems(teacher)).some((p) => p.id === courseId));
    // Problem packages hold course exercises, so other admins lose the OJ admin too.
    const otherAdmin: Person = { ...teacher, id: 'gate-other-admin' };
    await assert.rejects(
      handleOj(new Request('https://cswork.test/api/oj/admin/problems'), otherAdmin, ['admin', 'problems']),
      status404,
    );
    assert.ok(await handleOj(new Request('https://cswork.test/api/oj/admin/problems'), teacher, ['admin', 'problems']));
  } finally {
    delete process.env.COURSE_ACCESS;
    delete process.env.COURSE_OWNER_ID;
  }
});
