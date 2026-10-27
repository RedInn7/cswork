// OA guides and extra reference programs (content/oa-judge/guides, solutions): the hint ladder
// on GET problems/<id> replaces the package's own hints for everyone, signed out too, and goes
// away inside the learner's running exam; the editorial gains English and the verified languages.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';
import { passingPrograms, programKey } from '../lib/oa-solution-evidence.mjs';

const dir = mkdtempSync(join(tmpdir(), 'cswork-oa-guides-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { handleOj } = await import('../lib/server/oj-api');

const teacher: Person = { id: 'guide-teacher', name: 'T', email: 't@guides.test', role: 'teacher', verified: true };
const student: Person = { id: 'guide-student', name: 'S', email: 's@guides.test', role: 'student', verified: true };
const GUIDED = 'oa-meta-10';
const PLAIN = 'oa-capital-one-2';
const guide = JSON.parse(readFileSync(`content/oa-judge/guides/${GUIDED}.json`, 'utf8'));
// Only GUIDED's sidecars, so PLAIN stays a problem without a guide however much content ships.
const sidecars = join(dir, 'sidecars');
for (const sub of ['guides', 'solutions', 'reports']) mkdirSync(join(sidecars, sub), { recursive: true });
copyFileSync(`content/oa-judge/guides/${GUIDED}.json`, join(sidecars, 'guides', `${GUIDED}.json`));
copyFileSync(`content/oa-judge/solutions/${GUIDED}.json`, join(sidecars, 'solutions', `${GUIDED}.json`));
copyFileSync('content/oa-judge/reports/solutions-pilot.json', join(sidecars, 'reports', 'solutions-pilot.json'));
(await import('../lib/server/oa-judge')).useOaSidecarRoot(sidecars);

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  for (const id of [GUIDED, PLAIN]) {
    const pkg = JSON.parse(readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8')) as OjProblemPackage;
    const draft = await saveProblemDraft(teacher, pkg, null);
    await publishProblemDraft(teacher, id, draft.draft!.revision);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const get = async (path: string[], p: Person | null) => {
  const response = await handleOj(new Request(`https://cswork.test/api/oj/${path.join('/')}`), p, path);
  return response.json();
};

void test('a guided OA problem serves its ladder to everyone and drops the package hints, English ones included', async () => {
  const problem = await get(['problems', GUIDED], null);
  assert.deepEqual(problem.oaHints, guide.hints);
  assert.deepEqual(problem.hints, []);
  assert.deepEqual(problem.translations.en.hints, []);
  assert.ok(problem.translations.en.description, 'the English statement stays');
  assert.equal(problem.lingHints, null);
  // Without a guide the package's hints stay where they were.
  const plain = await get(['problems', PLAIN], null);
  assert.equal(plain.oaHints, null);
  assert.ok(plain.hints.length > 0 && plain.translations.en.hints.length > 0);
});

void test('failed formal submissions reach the ladder after a reload', async () => {
  const add = sqlite().prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES(?,?,?,'python','',?,1,?,?,?)`,
  );
  add.run('guide-wa', student.id, GUIDED, 'wrong_answer', 1, 1, 'judge');
  add.run('guide-run', student.id, GUIDED, 'wrong_answer', 2, 2, 'run');
  add.run('plain-wa', student.id, PLAIN, 'wrong_answer', 3, 3, 'judge');
  assert.deepEqual((await get(['problems', GUIDED], student)).failedSubmissionIds, ['guide-wa']);
  // No ladder, nothing to unlock.
  assert.deepEqual((await get(['problems', PLAIN], student)).failedSubmissionIds, []);
});

void test('the editorial adds the written write-up and the verified languages; a running exam withholds both', async () => {
  // The written editorial (content/oa-master/editorials) replaces the text; the code stays the registry's.
  const written = (id: string) =>
    JSON.parse(readFileSync(`content/oa-master/editorials/${id}.json`, 'utf8')) as { explanation: string; explanationEn: string };
  const solution = await get(['oa-library', GUIDED, 'solution'], student);
  assert.equal(solution.explanation, written(GUIDED).explanation);
  assert.equal(solution.explanationEn, written(GUIDED).explanationEn);
  assert.match(solution.explanation, /思路/);
  assert.deepEqual(
    solution.solutions.map((item: { language: string }) => item.language),
    ['python', 'cpp', 'java', 'go'],
  );
  const plain = await get(['oa-library', PLAIN, 'solution'], student);
  assert.equal(plain.explanationEn, written(PLAIN).explanationEn);
  assert.equal(plain.solutions.length, 1);
  // A certification exam holding the problem counts as a running contest.
  const now = Date.now();
  sqlite()
    .prepare(
      "INSERT INTO skill_attempts(id,user_id,test,ids_json,started_at,deadline,created_at) VALUES('guide-exam',?,'oa',?,?,?,?)",
    )
    .run(student.id, JSON.stringify([GUIDED]), now - 1000, now + 3_600_000, now - 1000);
  const live = await get(['problems', GUIDED], student);
  assert.equal(live.oaHints, null);
  assert.deepEqual([live.hints, live.translations.en.hints], [[], []]);
  await assert.rejects(get(['oa-library', GUIDED, 'solution'], student), { status: 403 });
  // Another learner, or a visitor, is not in that exam.
  assert.deepEqual((await get(['problems', GUIDED], null)).oaHints, guide.hints);
});

void test('only programs whose latest report passed every case of that package count as verified', () => {
  const root = mkdtempSync(join(tmpdir(), 'cswork-oa-evidence-'));
  try {
    mkdirSync(join(root, 'reports'));
    const base = { id: 'oa-x-1', sha256: 'a'.repeat(64), packageChecksum: 'b'.repeat(64) };
    writeFileSync(
      join(root, 'reports', 'solutions-one.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 3, total: 3 },
          { ...base, language: 'go', passed: 2, total: 3 },
          { ...base, language: 'cpp', passed: 0, total: 0 },
        ],
      }),
    );
    // Not a solutions report: never read.
    writeFileSync(join(root, 'reports', 'batch-one.json'), JSON.stringify({ results: [{ ...base, language: 'python', passed: 1, total: 1 }] }));
    const keys = passingPrograms(root);
    assert.deepEqual([...keys], [programKey({ ...base, language: 'java' })]);
    assert.equal(keys.has(programKey({ ...base, language: 'java', packageChecksum: 'c'.repeat(64) })), false);
    // A later run in another chunk decides: java now fails there, go now passes.
    const at = (day: number) => `2026-10-${day}T00:00:00.000Z`;
    writeFileSync(
      join(root, 'reports', 'solutions-one.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 3, total: 3, verifiedAt: at(10) },
          { ...base, language: 'go', passed: 2, total: 3, verifiedAt: at(10) },
          { ...base, language: 'cpp', passed: 3, total: 3, verifiedAt: at(12) },
        ],
      }),
    );
    writeFileSync(
      join(root, 'reports', 'solutions-two.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 2, total: 3, verifiedAt: at(11) },
          { ...base, language: 'go', passed: 3, total: 3, verifiedAt: at(11) },
          { ...base, language: 'cpp', passed: 0, total: 3, verifiedAt: at(11) },
        ],
      }),
    );
    assert.deepEqual(
      [...passingPrograms(root)].sort(),
      [programKey({ ...base, language: 'go' }), programKey({ ...base, language: 'cpp' })].sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test('a guide binds to the live package and the catalog source it was written from', async () => {
  const { createOaJudgeRegistry } = await import('../lib/server/oa-judge');
  const [source, pkg, other] = ['a', 'b', 'c'].map((c) => c.repeat(64));
  const registry = createOaJudgeRegistry(
    {
      schemaVersion: 1,
      items: [{ id: 'oa-x-1', sourceContentHash: source, packageChecksum: pkg, editorial: 'x', authoredSolutions: [{ language: 'python', code: 'x' }] }],
    },
    new Map([['oa-x-1', source]]),
  );
  assert.equal(registry.isCurrent('oa-x-1', pkg), true);
  assert.equal(registry.isCurrent('oa-x-1', pkg, source), true);
  assert.equal(registry.isCurrent('oa-x-1', pkg, other), false);
  assert.equal(registry.isCurrent('oa-x-1', other, source), false);
  // The English editorial is checked against the registry's own.
  assert.equal(registry.editorialSha256('oa-x-1'), createHash('sha256').update('x').digest('hex'));
  assert.equal(registry.editorialSha256('oa-x-2'), undefined);
});

void test('check-guides fails a guide whose English editorial translates an older registry editorial', () => {
  const root = mkdtempSync(join(tmpdir(), 'cswork-oa-check-guides-'));
  try {
    const judge = join(root, 'content/oa-judge');
    mkdirSync(join(judge, 'guides'), { recursive: true });
    const entry = { id: GUIDED, sourceContentHash: guide.sourceContentHash, packageChecksum: guide.packageChecksum, editorial: '新的题解', authoredSolutions: [{ language: 'python', code: 'x' }] };
    writeFileSync(join(judge, 'registry.json'), JSON.stringify({ schemaVersion: 1, items: [entry] }));
    writeFileSync(join(judge, 'guides', `${GUIDED}.json`), JSON.stringify(guide));
    const run = () => spawnSync(process.execPath, [resolve('scripts/oa-judge/check-guides.mjs')], { cwd: root, encoding: 'utf8' });
    const stale = run();
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /stale editorialSha256/);
    writeFileSync(
      join(judge, 'guides', `${GUIDED}.json`),
      JSON.stringify({ ...guide, editorialSha256: createHash('sha256').update(entry.editorial).digest('hex') }),
    );
    assert.equal(run().status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
