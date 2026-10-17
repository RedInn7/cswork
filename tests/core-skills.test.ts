import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-core-skills-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { buildCoreSkills, parseStatement, DRIVER_MARK, PACKAGES_FILE, MANIFEST_FILE, PROBLEMS } = await import(
  '../scripts/core-skills/build'
);
const { getPublishedProblem, listPublishedProblems } = await import('../lib/server/oj-problems');
const { createSubmission } = await import('../lib/server/oj-submissions');

const packages = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const student: Person = { id: 'student', email: 'student@core.test', name: 'Student', role: 'student', verified: true };
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@core.test',1,0,0)",
  ).run();
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('every solution reruns in all four languages to the committed packages; every starter compiles and fails', () => {
  // The build throws on a solution that disagrees anywhere, a solution whose driver differs
  // from its starter's, or a starter that does not compile or already passes the sample.
  const built = buildCoreSkills();
  assert.equal(built.packages, readFileSync(PACKAGES_FILE, 'utf8'), 'rerun scripts/core-skills/build.ts');
  assert.equal(built.manifest, readFileSync(MANIFEST_FILE, 'utf8'), 'rerun scripts/core-skills/build.ts');
  assert.equal(built.report.length, PROBLEMS.length);
});

test('the packages are valid, bilingual, four-language packages with a starter per language', () => {
  assert.equal(packages.length, 36);
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as {
    groups: { key: string; ids: string[] }[];
    problems: { id: string; summaryZh: string; summaryEn: string }[];
  };
  // Every problem sits in one of the seven groups, in package order.
  assert.deepEqual(
    manifest.groups.map((group) => group.key),
    ['linear', 'hash-heap', 'sort-search', 'graph', 'advanced', 'concurrency', 'ood'],
  );
  assert.deepEqual(
    manifest.groups.flatMap((group) => group.ids),
    packages.map((p) => p.problem.id),
  );
  assert.ok(manifest.problems.every((p) => p.summaryZh && p.summaryEn));
  const comment = { python: '# ', cpp: '// ', java: '// ', go: '// ' } as const;
  for (const pkg of packages) {
    const { problem } = ojImportSchema.parse(pkg);
    assert.match(problem.id, /^core-[a-z0-9-]+$/);
    assert.deepEqual(problem.languages, ['python', 'go', 'java', 'cpp']);
    assert.equal(problem.checker, 'tokens');
    assert.ok(problem.translations?.en?.description, problem.id);
    assert.ok(pkg.cases[0] && !pkg.cases[0].hidden, problem.id);
    assert.ok(pkg.cases.filter((c) => c.hidden).length >= 3, problem.id);
    for (const language of ['python', 'go', 'java', 'cpp'] as const) {
      // Each starter carries the driver line once, as a comment in its language.
      const lines = problem.starters![language]!.split('\n').filter((line) => line.includes(DRIVER_MARK));
      assert.equal(lines.length, 1, `${problem.id} ${language}`);
      assert.ok(lines[0].startsWith(comment[language]), `${problem.id} ${language}`);
    }
  }
  // core- ids stay in the track's home lesson; starters are code languages only and bounded.
  const variant = (problem: object) =>
    ojImportSchema.safeParse({ ...packages[0], problem: { ...packages[0].problem, ...problem } }).success;
  assert.equal(variant({}), true);
  assert.equal(variant({ courseId: 'private-course' }), false);
  assert.equal(variant({ lessonId: 'lesson-2' }), false);
  assert.equal(variant({ starters: { sql: 'SELECT 1' } }), false);
  assert.equal(variant({ starters: { python: 'x'.repeat(20001) } }), false);
  assert.equal(variant({ id: 'course-dynamic-array', courseId: 'private-course' }), true);
});

test('concurrency problems: answers depend on the input, and each solution has a racy twin for the stress check', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as { groups: { key: string; ids: string[] }[] };
  const ids = manifest.groups.find((group) => group.key === 'concurrency')!.ids;
  assert.deepEqual(ids, [
    'core-ordered-print',
    'core-foobar-alternate',
    'core-zero-even-odd',
    'core-h2o',
    'core-dining-philosophers',
    'core-bounded-blocking-queue',
    'core-read-write-lock',
  ]);
  for (const id of ids) {
    const pkg = packages.find((p) => p.problem.id === id)!;
    // The drivers print what the threads did to the input, never a fixed "ok": no two cases
    // share an answer, so printing one constant cannot pass.
    const answers = pkg.cases.map((c) => c.expectedOutput);
    assert.equal(new Set(answers).size, answers.length, id);
    assert.ok(pkg.problem.tags.includes('并发'), id);
    // scripts/core-skills/stress.ts reruns each racy variant, which must go wrong at least once.
    for (const ext of ['py', 'go', 'java', 'cpp'])
      assert.ok(existsSync(`content/core-skills/${id.slice('core-'.length)}/racy.${ext}`), `${id} racy.${ext}`);
  }
});

test('OOD problems: each implements an LLD chapter, with a class diagram and design notes in both languages', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as {
    groups: { key: string; ids: string[] }[];
    problems: { id: string; sdChapter?: string }[];
  };
  const ids = manifest.groups.find((group) => group.key === 'ood')!.ids;
  assert.deepEqual(ids, [
    'core-parking-lot',
    'core-elevator',
    'core-atm',
    'core-vending-machine',
    'core-hotel-booking',
    'core-splitwise',
    'core-movie-tickets',
    'core-amazon-locker',
  ]);
  // The chapter pages link here by sdChapter (app/system-design/[slug]/page.tsx): one problem per chapter.
  const chapters = new Set(
    (JSON.parse(readFileSync('lib/content/system-design-course.json', 'utf8')) as { chapters: { slug: string }[] }).chapters.map(
      (chapter) => chapter.slug,
    ),
  );
  const linked = manifest.problems.filter((p) => p.sdChapter);
  assert.deepEqual(
    linked.map((p) => p.id),
    ids,
  );
  assert.equal(new Set(linked.map((p) => p.sdChapter)).size, ids.length);
  for (const { id, sdChapter } of linked) {
    assert.ok(chapters.has(sdChapter!), `${id}: ${sdChapter}`);
    const { problem, cases } = packages.find((p) => p.problem.id === id)!;
    assert.ok(problem.tags.includes('面向对象设计（LLD）'), id);
    for (const [description, notes] of [
      [problem.description, '### 设计要点'],
      [problem.translations!.en!.description, '### Design notes'],
    ]) {
      assert.match(description, /```mermaid\nclassDiagram\n {2}accTitle: /, id);
      assert.ok(description.includes(notes), `${id}: ${notes}`);
      assert.ok(description.includes(`](/system-design/${sdChapter})`), `${id} links its chapter`);
    }
    // Answers depend on the input: no two tests share one.
    assert.equal(new Set(cases.map((c) => c.expectedOutput)).size, cases.length, id);
  }
});

test('OOD tests fail a solution that breaks one of the stated rules', () => {
  // solution.py with one rule broken: it must still run every case, and at least one answer must differ.
  const late = 'self.failures, self.locked_until = 0, t + LOCKOUT';
  const reversed = 'import heapq\nclass R(str):\n    __lt__ = str.__gt__';
  const variants: [string, string, [string, string][]][] = [
    ['amazon-locker', 'reuses a code still in use', [['while code in self.by_code:', 'while False:']]],
    ['amazon-locker', 'counts attempts while locked', [['return "LOCKED"', 'return setattr(self, "failures", self.failures + 1) or "LOCKED"']]],
    ['amazon-locker', 'keeps the count when it locks', [[late, 'self.locked_until = t + LOCKOUT']]],
    ['amazon-locker', 'locks at >= 5 and keeps the count', [['self.failures == MAX', 'self.failures >= MAX'], [late, 'self.locked_until = t + LOCKOUT']]],
    ['splitwise', 'pays equal payees largest name first', [['import heapq', reversed], ['(-v, u) for u, v', '(-v, R(u)) for u, v']]],
    ['splitwise', 'takes equal payers largest name first', [['import heapq', reversed], ['(v, u) for u, v', '(v, R(u)) for u, v']]],
    ['movie-tickets', 'checks taken seats before TOO_MANY', [['if len(seats) > MAX_SEATS:', 'if len(seats) > MAX_SEATS and not any(self.owner[s] for s in seats):']]],
  ];
  for (const [slug, rule, edits] of variants) {
    let source = readFileSync(`content/core-skills/${slug}/solution.py`, 'utf8');
    for (const [from, to] of edits) {
      assert.ok(source.includes(from), `${slug}: ${from}`);
      source = source.replace(from, to);
    }
    const { cases } = packages.find((p) => p.problem.id === `core-${slug}`)!;
    const runs = cases.map((c) => spawnSync('python3', ['-I', '-c', source], { input: c.input, encoding: 'utf8' }));
    assert.ok(runs.every((run) => run.status === 0), `${slug} (${rule}) crashed`);
    assert.ok(runs.some((run, k) => run.stdout !== cases[k].expectedOutput), `${slug} passes although it ${rule}`);
  }
});

test('statements split into the description, input, output, explanation and plain-text hints', () => {
  const parsed = parseStatement('# Title\n\nBody `code`.\n\n## Input\n\nn **distinct** `x`\n\n## Output\n\nA `b`\n\n## Explanation\n\nWhy\n\n## Hints\n\n- one `h`\n- two\n', 't');
  assert.deepEqual(parsed, {
    title: 'Title',
    description: 'Body `code`.',
    input: 'n distinct x',
    output: 'A `b`',
    explanation: 'Why',
    hints: ['one h', 'two'],
  });
  assert.throws(() => parseStatement('# Title\n\n## Input\n\nx\n', 't'), /4 ## sections/);
});

test('the release publisher publishes once, then skips unchanged packages; Core Skills judge free with their starters', async () => {
  const publish = () =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/publish-core-skills.ts', 'teacher@core.test'], {
      env: { ...process.env, ADMIN_EMAILS: 'teacher@core.test' },
      encoding: 'utf8',
    });
  const first = publish();
  assert.equal(first.status, 0, first.stderr);
  // The same run publishes the ML Coding track (tests/ml-coding.test.ts).
  assert.equal(first.stdout.match(/"id":"core-[a-z0-9-]+","status":"published"/g)?.length, packages.length);
  const again = publish();
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout.match(/"id":"core-[a-z0-9-]+","status":"unchanged"/g)?.length, packages.length);
  // Like the SQL track: listed for everyone, judged for any verified account.
  const listed = (await listPublishedProblems(null)).filter((p) => p.id.startsWith('core-'));
  assert.equal(listed.length, packages.length);
  assert.ok(listed.every((p) => p.freeJudge));
  const problem = await getPublishedProblem(student, packages[0].problem.id);
  assert.deepEqual(problem.starters, packages[0].problem.starters);
  const submission = (language: string, key: string) =>
    createSubmission(student, {
      problemId: packages[0].problem.id,
      language,
      code: packages[0].problem.starters![language as 'python'] ?? 'SELECT 1',
      mode: 'judge',
      idempotencyKey: `core-skills-${key}`.padEnd(16, '0'),
    });
  assert.equal((await submission('java', 'java')).status, 'queued');
  await assert.rejects(submission('sql', 'sql'), /未开放该语言/);
});
