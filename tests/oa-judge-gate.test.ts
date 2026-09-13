import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

test('published but unverified OA cannot be read, compiled or judged; ordinary course RBAC remains', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cswork-oa-gate-'));
  process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
  const { sqlite } = await import('../db/sqlite');
  const {
    saveProblemDraft,
    publishProblemDraft,
    getCompileProblem,
    getJudgeProblem,
    getPublishedProblem,
    listPublishedProblems,
  } = await import('../lib/server/oj-problems');
  const db = sqlite();
  const teacher: Person = {
    id: 'fixture-teacher',
    name: 'Teacher',
    email: 'teacher@example.test',
    role: 'teacher',
    verified: true,
  };
  const student: Person = {
    ...teacher,
    id: 'fixture-student',
    email: 'student@example.test',
    role: 'student',
  };
  try {
    migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
    db.prepare(
      "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)",
    ).run();
    db.prepare(
      "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
    ).run();
    for (const id of ['oa-unverified-fixture-1', 'ordinary-fixture']) {
      const saved = await saveProblemDraft(
        teacher,
        {
          schemaVersion: 1,
          problem: {
            id,
            courseId: 'gomall',
            lessonId: '00-overview',
            title: 'Fixture',
            difficulty: '简单',
            tags: ['test'],
            description: 'Print one',
            input: 'None',
            output: 'One',
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
              expectedOutput: '1',
              hidden: false,
              weight: 1,
            },
            {
              name: 'hidden',
              input: 'private-fixture',
              expectedOutput: '1',
              hidden: true,
              weight: 1,
            },
          ],
        },
        null,
      );
      await publishProblemDraft(teacher, id, saved.draft!.revision);
    }
    for (const fn of [
      getCompileProblem,
      getJudgeProblem,
      getPublishedProblem,
    ]) {
      await assert.rejects(fn(teacher, 'oa-unverified-fixture-1'), {
        status: 409,
      });
      await assert.rejects(fn(teacher, 'oa-missing-fixture-1'), {
        status: 409,
      });
      await assert.rejects(fn(student, 'ordinary-fixture'), { status: 403 });
    }
    const listed = await listPublishedProblems();
    assert(!listed.some((item) => item.id === 'oa-unverified-fixture-1'));
    assert(listed.some((item) => item.id === 'ordinary-fixture'));
    assert(!JSON.stringify(listed).includes('private-fixture'));
    assert.equal(
      (await getJudgeProblem(teacher, 'ordinary-fixture')).problemId,
      'ordinary-fixture',
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
