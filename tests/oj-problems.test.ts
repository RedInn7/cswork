import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-oj-problems-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const {
  ensureOjSeed,
  getJudgeProblem,
  loadJudgeSnapshot,
  listPublishedProblems,
  listTeacherProblems,
  getTeacherProblem,
  saveProblemDraft,
  publishProblemDraft,
  copyProblemVersion,
  validateProblemPackage,
  OJ_MAX_CASE_BYTES,
} = await import('../lib/server/oj-problems');
const teacher: Person = {
  id: 'teacher',
  email: 'teacher@example.test',
  name: 'Teacher',
  role: 'teacher',
  verified: true,
};
const student: Person = {
  id: 'student',
  email: 'student@example.test',
  name: 'Student',
  role: 'student',
  verified: true,
};
const errorsWithStatus = (status: number) => (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'status' in error &&
  error.status === status;

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
  ).run('gomall', 'GoMall', 'Original exercises', '1');
  for (const id of [
    '00-overview',
    '07-product-search',
    '00-overview-architecture',
    '14-middleware',
  ]) {
    db.prepare(
      'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)',
    ).run(id, 'gomall', id, '', 'chapter', '', '1');
  }
  await ensureOjSeed();
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

async function seedPackage(): Promise<OjProblemPackage> {
  const snapshot = await loadJudgeSnapshot('initial:watch-intervals:1');
  return {
    schemaVersion: 1,
    problem: snapshot.spec,
    cases: snapshot.cases.map(
      ({ name, input, expectedOutput, hidden, weight }) => ({
        name,
        input,
        expectedOutput,
        hidden,
        weight,
      }),
    ),
  };
}

void test('seeding preserves the four original IDs and does not expose private cases', async () => {
  const catalogue = await listPublishedProblems();
  assert.equal(catalogue.length, 4);
  assert.deepEqual(
    new Set(catalogue.map((p) => p.id)),
    new Set(['watch-intervals', 'product-top-k', 'study-plan', 'rate-window']),
  );
  assert.equal(
    catalogue.reduce((n, p) => n + p.caseCount, 0),
    26,
  );
  for (const item of catalogue) {
    assert.equal(item.samples.length, 1);
    assert.ok(item.caseCount > item.samples.length);
    assert.ok(!('cases' in item));
    assert.ok(!JSON.stringify(item).includes('十万'));
    assert.equal(item.sampleIn, item.samples[0].input);
    assert.equal(item.sampleOut, item.samples[0].expectedOutput);
  }
  await ensureOjSeed();
  assert.equal(
    (
      sqlite()
        .prepare('SELECT COUNT(*) AS n FROM oj_problem_versions')
        .get() as { n: number }
    ).n,
    4,
  );
});

void test('all 26 original examples and maximum-boundary cases match independent reference algorithms', async () => {
  for (const problemId of [
    'watch-intervals',
    'product-top-k',
    'study-plan',
    'rate-window',
  ]) {
    const snapshot = await loadJudgeSnapshot(`initial:${problemId}:1`);
    for (const point of snapshot.cases) {
      const a = point.input.trim().split(/\s+/).map(Number);
      let expected: string;
      if (problemId === 'watch-intervals') {
        const ranges = Array.from({ length: a[0] }, (_, i) => [
          a[i * 2 + 1],
          a[i * 2 + 2],
        ]).sort((x, y) => x[0] - y[0]);
        let end = -1,
          total = 0;
        for (const [left, right] of ranges) {
          total += Math.max(0, right - Math.max(end, left));
          end = Math.max(end, right);
        }
        expected = String(total);
      } else if (problemId === 'product-top-k') {
        const counts = new Map<number, number>();
        for (const value of a.slice(2))
          counts.set(value, (counts.get(value) || 0) + 1);
        expected = [...counts]
          .sort((x, y) => y[1] - x[1] || x[0] - y[0])
          .slice(0, a[1])
          .map((pair) => pair.join(' '))
          .join('\n');
      } else if (problemId === 'rate-window') {
        const accepted: number[] = [],
          result: string[] = [];
        let head = 0;
        for (const timestamp of a.slice(3)) {
          while (head < accepted.length && accepted[head] <= timestamp - a[1])
            head++;
          const keep = accepted.length - head < a[2];
          result.push(keep ? 'ACCEPT' : 'REJECT');
          if (keep) accepted.push(timestamp);
        }
        expected = result.join('\n');
      } else {
        const outgoing = Array.from({ length: a[0] + 1 }, () => [] as number[]),
          degree = new Uint32Array(a[0] + 1),
          heap: number[] = [],
          order: number[] = [];
        for (let i = 2; i < a.length; i += 2) {
          outgoing[a[i]].push(a[i + 1]);
          degree[a[i + 1]]++;
        }
        const insert = (value: number) => {
          let i = heap.length;
          heap.push(value);
          while (i) {
            const parent = (i - 1) >> 1;
            if (heap[parent] <= value) break;
            heap[i] = heap[parent];
            i = parent;
          }
          heap[i] = value;
        };
        const pop = () => {
          const result = heap[0],
            value = heap.pop()!;
          if (heap.length) {
            let i = 0;
            while (2 * i + 1 < heap.length) {
              let child = 2 * i + 1;
              if (child + 1 < heap.length && heap[child + 1] < heap[child])
                child++;
              if (heap[child] >= value) break;
              heap[i] = heap[child];
              i = child;
            }
            heap[i] = value;
          }
          return result;
        };
        for (let v = 1; v <= a[0]; v++) if (degree[v] === 0) insert(v);
        while (heap.length) {
          const v = pop();
          order.push(v);
          for (const next of outgoing[v])
            if (--degree[next] === 0) insert(next);
        }
        expected = order.length === a[0] ? order.join(' ') : 'IMPOSSIBLE';
      }
      assert.equal(
        point.expectedOutput.trim(),
        expected,
        `${problemId}: ${point.name}`,
      );
    }
  }
});

void test('strict imports reject executable checker fields, unsupported formats, and oversize data', async () => {
  const valid = await seedPackage();
  assert.equal(validateProblemPackage(valid).problem.id, valid.problem.id);
  assert.throws(() => validateProblemPackage({ ...valid, schemaVersion: 2 }));
  assert.throws(() =>
    validateProblemPackage({ ...valid, command: 'sh checker.sh' }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      problem: { ...valid.problem, checker: 'custom', executable: 'checker' },
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      problem: { ...valid.problem, languages: ['python', 'python'] },
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      cases: valid.cases.map((c) => ({ ...c, hidden: true })),
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      cases: valid.cases.map((c) => ({ ...c, hidden: false })),
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      cases: [
        ...valid.cases,
        {
          ...valid.cases[0],
          name: 'oversize',
          hidden: true,
          input: '中'.repeat(Math.floor(OJ_MAX_CASE_BYTES / 3) + 1),
        },
      ],
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      cases: [
        ...valid.cases,
        { ...valid.cases[0], name: 'binary', hidden: true, input: 'a\0b' },
      ],
    }),
  );
  assert.throws(() =>
    validateProblemPackage({
      ...valid,
      problem: { ...valid.problem, outputLimit: 1 },
      cases: [
        ...valid.cases,
        {
          ...valid.cases[0],
          hidden: true,
          name: 'oversize-output',
          expectedOutput: 'x'.repeat(1025),
        },
      ],
    }),
  );
});

void test('teacher operations and judge snapshots enforce identity and course grants', async () => {
  const payload = await seedPackage();
  await assert.rejects(
    () => listTeacherProblems(student),
    errorsWithStatus(403),
  );
  await assert.rejects(
    () => getTeacherProblem(student, 'watch-intervals'),
    errorsWithStatus(403),
  );
  await assert.rejects(
    () => saveProblemDraft(student, payload, null),
    errorsWithStatus(403),
  );
  await assert.rejects(
    () => publishProblemDraft(student, 'watch-intervals', 1),
    errorsWithStatus(403),
  );
  await assert.rejects(
    () =>
      copyProblemVersion(
        student,
        'watch-intervals',
        'initial:watch-intervals:1',
        null,
      ),
    errorsWithStatus(403),
  );
  await assert.rejects(
    () => getJudgeProblem(student, 'watch-intervals'),
    errorsWithStatus(403),
  );
  sqlite()
    .prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    )
    .run('student-grant', student.email, 'gomall', 'test', Date.now());
  assert.equal((await getJudgeProblem(student, 'watch-intervals')).revision, 1);
  await assert.rejects(
    () => getJudgeProblem({ ...student, verified: false }, 'watch-intervals'),
    errorsWithStatus(403),
  );
  sqlite()
    .prepare('UPDATE grants SET revoked_at=? WHERE id=?')
    .run(Date.now(), 'student-grant');
  await assert.rejects(
    () => getJudgeProblem(student, 'watch-intervals'),
    errorsWithStatus(403),
  );
});

void test('draft changes are private, optimistic updates reject lost edits, and publication is atomic', async () => {
  const original = await seedPackage();
  const draft = await copyProblemVersion(
    teacher,
    'watch-intervals',
    'initial:watch-intervals:1',
    null,
  );
  assert.equal(draft.draft?.revision, 1);
  const revised = structuredClone(original);
  revised.problem.title = '合并观看进度 · 修订';
  revised.cases.push({
    name: '新增边界',
    input: '2\n0 1\n1 2\n',
    expectedOutput: '2\n',
    hidden: true,
    weight: 10,
  });
  const results = await Promise.allSettled([
    saveProblemDraft(teacher, revised, 1),
    saveProblemDraft(
      teacher,
      {
        ...revised,
        problem: { ...revised.problem, title: '不能覆盖的并发保存' },
      },
      1,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter(
      (r) => r.status === 'rejected' && errorsWithStatus(409)(r.reason),
    ).length,
    1,
  );
  assert.equal(
    (await listPublishedProblems()).find((p) => p.id === original.problem.id)
      ?.title,
    original.problem.title,
  );
  await assert.rejects(
    () => publishProblemDraft(teacher, original.problem.id, 1),
    errorsWithStatus(409),
  );
  const publications = await Promise.allSettled([
    publishProblemDraft(teacher, original.problem.id, 2),
    publishProblemDraft(teacher, original.problem.id, 2),
  ]);
  assert.equal(publications.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    publications.filter(
      (r) => r.status === 'rejected' && errorsWithStatus(409)(r.reason),
    ).length,
    1,
  );
  const now = await getTeacherProblem(teacher, original.problem.id);
  assert.equal(now.versions.length, 2);
  assert.equal(now.versions[0].revision, 2);
  assert.equal(now.draft?.revision, 3);
  assert.equal(
    (await loadJudgeSnapshot('initial:watch-intervals:1')).spec.title,
    original.problem.title,
  );
  assert.equal(
    (await loadJudgeSnapshot('initial:watch-intervals:1')).cases.length,
    original.cases.length,
  );
  assert.equal(
    (await getJudgeProblem(teacher, original.problem.id)).cases.length,
    original.cases.length + 1,
  );
  await assert.rejects(
    () => saveProblemDraft(teacher, revised, 2),
    errorsWithStatus(409),
  );
  await assert.rejects(
    () => publishProblemDraft(teacher, original.problem.id, 3),
    errorsWithStatus(409),
  );
});

void test('restoring a historical version creates a new draft and keeps the immutable history', async () => {
  const existing = await getTeacherProblem(teacher, 'watch-intervals');
  const copy = await copyProblemVersion(
    teacher,
    'watch-intervals',
    'initial:watch-intervals:1',
    existing.draft!.revision,
  );
  assert.equal(copy.draft?.revision, existing.draft!.revision + 1);
  const published = await publishProblemDraft(
    teacher,
    'watch-intervals',
    copy.draft!.revision,
  );
  assert.equal(published.problem.versions[0].revision, 3);
  assert.notEqual(published.versionId, 'initial:watch-intervals:1');
  assert.equal(
    (await getJudgeProblem(teacher, 'watch-intervals')).checksum,
    (await loadJudgeSnapshot('initial:watch-intervals:1')).checksum,
  );
  await assert.rejects(
    () =>
      copyProblemVersion(
        teacher,
        'rate-window',
        'initial:watch-intervals:1',
        null,
      ),
    errorsWithStatus(404),
  );
});

void test('new imports remain drafts and cannot point to a lesson in another course', async () => {
  const payload = await seedPackage();
  payload.problem.id = 'teacher-original';
  payload.problem.title = '老师原创';
  await assert.rejects(
    () => saveProblemDraft(teacher, payload, 1),
    errorsWithStatus(409),
  );
  assert.equal(
    sqlite()
      .prepare('SELECT id FROM oj_problems WHERE id=?')
      .get(payload.problem.id),
    undefined,
  );
  const draft = await saveProblemDraft(teacher, payload, null);
  assert.equal(draft.published, false);
  await assert.rejects(
    () => getJudgeProblem(teacher, payload.problem.id),
    errorsWithStatus(404),
  );
  assert.ok(
    !(await listPublishedProblems()).some((p) => p.id === payload.problem.id),
  );
  await assert.rejects(
    () =>
      saveProblemDraft(
        teacher,
        { ...payload, problem: { ...payload.problem, courseId: 'not-gomall' } },
        1,
      ),
    errorsWithStatus(400),
  );
  assert.equal(
    (await getTeacherProblem(teacher, payload.problem.id)).draft?.revision,
    1,
  );
  const result = await publishProblemDraft(teacher, payload.problem.id, 1);
  assert.equal(result.problem.versions[0].revision, 1);
});

void test('SQLite prevents mutation of published versions and their cases', async () => {
  const db = sqlite();
  assert.throws(() =>
    db
      .prepare('UPDATE oj_problem_versions SET spec_json=? WHERE id=?')
      .run('{}', 'initial:watch-intervals:1'),
  );
  assert.throws(() =>
    db
      .prepare('DELETE FROM oj_problem_versions WHERE id=?')
      .run('initial:watch-intervals:1'),
  );
  assert.throws(() =>
    db
      .prepare('UPDATE oj_test_cases SET expected_output=? WHERE version_id=?')
      .run('bad', 'initial:watch-intervals:1'),
  );
  assert.throws(() =>
    db
      .prepare('DELETE FROM oj_test_cases WHERE version_id=?')
      .run('initial:watch-intervals:1'),
  );
  assert.throws(() =>
    db
      .prepare(
        'INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) VALUES(?,?,?,?,?,?,?,?)',
      )
      .run(
        'append',
        'initial:watch-intervals:1',
        99,
        '1\n0 1\n',
        '1\n',
        1,
        'late case',
        10,
      ),
  );
  assert.throws(() =>
    db
      .prepare('UPDATE oj_problems SET current_version_id=? WHERE id=?')
      .run('initial:watch-intervals:1', 'watch-intervals'),
  );
  assert.throws(() =>
    db
      .prepare(
        'UPDATE oj_problems SET current_version_id=NULL,published=0 WHERE id=?',
      )
      .run('watch-intervals'),
  );
});
