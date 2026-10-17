import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

// The ML Coding track (scripts/ml-coding/build.ts): numpy problems judged in Python with the
// float-array checker. The rebuild needs numpy on ML_PYTHON (default python3) and is skipped
// without it; CI installs python3-pandas, which brings numpy.
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-ml-coding-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.OJ_ENABLED = 'true';
const { PYTHON, PACKAGES_FILE, MANIFEST_FILE, PROBLEMS, buildMlCoding, samePackages } = await import(
  '../scripts/ml-coding/build'
);
const noNumpy =
  spawnSync(PYTHON, ['-I', '-c', 'import numpy'], { stdio: 'ignore' }).status !== 0 &&
  `${PYTHON} cannot import numpy (set ML_PYTHON)`;
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { getJudgeProblem, listPublishedProblems, publishProblemDraft, saveProblemDraft } = await import(
  '../lib/server/oj-problems'
);
const { createSubmission } = await import('../lib/server/oj-submissions');

const packages = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as {
  groups: { key: string; ids: string[] }[];
  problems: { id: string; titleZh: string; titleEn: string; summaryZh: string; summaryEn: string }[];
};
const teacher: Person = { id: 'teacher', email: 'teacher@ml.test', name: 'Teacher', role: 'teacher', verified: true };
const student: Person = { id: 'student', email: 'student@ml.test', name: 'Student', role: 'student', verified: true };
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@ml.test',1,0,0)",
  ).run();
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('every solution reruns to the committed answers (within the judge tolerance); every starter fails', { skip: noNumpy }, () => {
  // The build throws on a solution importing more than numpy/math/sys, np.random anywhere, a changed
  // driver, an answer not in "count, then %.6f" form or holding the -1 sentinel, and a starter that passes.
  const built = buildMlCoding();
  assert.ok(samePackages(built.packages, readFileSync(PACKAGES_FILE, 'utf8')), 'rerun scripts/ml-coding/build.ts');
  assert.equal(built.manifest, readFileSync(MANIFEST_FILE, 'utf8'), 'rerun scripts/ml-coding/build.ts');
  assert.equal(built.report.length, PROBLEMS.length);
});

test('the packages are valid Python-only float-array packages, bilingual, listed in the manifest', () => {
  assert.equal(packages.length, PROBLEMS.length);
  assert.deepEqual(
    manifest.groups.map((group) => group.key),
    ['metrics', 'models', 'deep', 'stats'],
  );
  assert.deepEqual(
    manifest.groups.flatMap((group) => group.ids),
    packages.map((p) => p.problem.id),
  );
  assert.deepEqual(manifest.problems.map((p) => p.id), packages.map((p) => p.problem.id));
  assert.ok(manifest.problems.every((p) => p.titleZh && p.titleEn && p.summaryZh && p.summaryEn));
  for (const pkg of packages) {
    const { problem, cases } = ojImportSchema.parse(pkg);
    assert.match(problem.id, /^ml-[a-z0-9-]+$/);
    assert.deepEqual(problem.languages, ['python']);
    assert.equal(problem.checker, 'float-array');
    assert.ok(problem.memoryLimit >= 262144, problem.id);
    assert.deepEqual(problem.tags.slice(0, 1), ['ML Coding']);
    assert.ok(problem.translations?.en?.description, problem.id);
    assert.ok(cases[0] && !cases[0].hidden, problem.id);
    assert.ok(cases.filter((c) => c.hidden).length >= 3, problem.id);
    assert.ok(problem.starters?.python?.includes('import numpy as np'), problem.id);
  }
  // ml- ids are Python-only float-array problems in the track's home lesson.
  const variant = (problem: object) =>
    ojImportSchema.safeParse({ ...packages[0], problem: { ...packages[0].problem, ...problem } }).success;
  assert.equal(variant({}), true);
  assert.equal(variant({ languages: ['python', 'cpp'] }), false);
  assert.equal(variant({ languages: ['cpp'], starters: { cpp: 'int main() {}' } }), false);
  assert.equal(variant({ checker: 'exact' }), false);
  assert.equal(variant({ memoryLimit: 131072 }), false);
  assert.equal(variant({ courseId: 'private-course' }), false);
});

test('ml- problems are free but hidden until the judge reports pandas (and so numpy)', async () => {
  for (const pkg of packages) {
    const draft = await saveProblemDraft(teacher, pkg, null);
    await publishProblemDraft(teacher, pkg.problem.id, draft.draft!.revision);
  }
  const listed = async () => (await listPublishedProblems(null)).filter((p) => p.id.startsWith('ml-'));
  assert.equal((await listed()).length, 0);
  await assert.rejects(getJudgeProblem(student, 'ml-kmeans'), /尚未发布/);
  const heartbeat = (details: object) =>
    sqlite()
      .prepare(
        "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,1,?) ON CONFLICT(id) DO UPDATE SET details=excluded.details",
      )
      .run(Date.now(), JSON.stringify(details));
  heartbeat({ languageVersions: { python: 'Python 3.13.5' } });
  assert.equal((await listed()).length, 0);
  heartbeat({ languageVersions: { python: 'Python 3.13.5', pandas: 'pandas 2.2.3' } });
  const shown = await listed();
  assert.equal(shown.length, packages.length);
  assert.ok(shown.every((p) => p.freeJudge && p.languages.join() === 'python'));
  const submission = (language: string, key: string) =>
    createSubmission(student, {
      problemId: 'ml-kmeans',
      language,
      code: packages.find((p) => p.problem.id === 'ml-kmeans')!.problem.starters!.python!,
      mode: 'judge',
      idempotencyKey: `ml-coding-${key}`.padEnd(16, '0'),
    });
  assert.equal((await submission('python', 'ok')).status, 'queued');
  await assert.rejects(submission('cpp', 'cpp'), /未开放该语言/);
  // Rolling the image back hides them again.
  heartbeat({ languageVersions: {} });
  assert.equal((await listed()).length, 0);
});
