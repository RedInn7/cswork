import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-book-problems-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { buildBookProblems, bookJudges, parseStatement, PACKAGES_FILE } = await import('../scripts/book-problems/build');
const { classicList, classicLists, groupEntries } = await import('../lib/classic-lists');
const { isFreeTrack } = await import('../lib/free-tracks');
const { getJudgeProblem, validateProblemPackage } = await import('../lib/server/oj-problems');
const { listClassicLibrary } = await import('../lib/server/study-library');

const packages = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const student: Person = { id: 'student', email: 'student@book.test', name: 'Student', role: 'student', verified: true };
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@book.test',1,0,0)",
  ).run();
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('every judged book row has a package, and only twinless rows are judged', () => {
  const judges = bookJudges();
  assert.deepEqual(
    packages.map((p) => p.problem.id),
    judges.map((j) => j.id),
  );
  for (const list of classicLists.filter((l) => l.refLabel))
    for (const ref of list.groups.flatMap((g) => g.refs!)) {
      if (!ref.judge) continue;
      assert.equal(ref.lc, null, `${ref.judge} has a LeetCode twin`);
      const id = list.slug === 'sword-offer' ? `bk-offer-${ref.ref.toLowerCase()}` : `bk-ctci-${ref.ref.replace('.', '-')}`;
      assert.equal(ref.judge, id);
      assert.ok(isFreeTrack(ref.judge));
    }
  assert.ok(judges.length >= 60, `only ${judges.length} book problems are judged`);
  // Rows keep their leetcode.cn page next to the judge id.
  const offer = classicList('sword-offer')!;
  assert.deepEqual(groupEntries(offer.groups[0])[0], {
    number: null,
    ref: '03',
    refSlug: 'shu-zu-zhong-zhong-fu-de-shu-zi-lcof',
    judge: 'bk-offer-03',
  });
});

test('packages pass the import schema: bilingual, four languages, samples and hidden cases', () => {
  for (const raw of packages) {
    const { problem, cases } = validateProblemPackage(raw);
    assert.deepEqual(problem.languages, ['python', 'cpp', 'java', 'go'], problem.id);
    assert.ok(['tokens', 'float-array'].includes(problem.checker), problem.id);
    assert.match(problem.description, /出处：《.+》.+。题面、样例和测试数据由 CSWork 重新编写。$/, problem.id);
    assert.match(problem.translations!.en!.description, /Source: .+\. Statement, examples and tests written by CSWork\.$/);
    assert.ok(problem.hints.length && problem.translations!.en!.hints.length === problem.hints.length, problem.id);
    assert.ok(cases.filter((c) => c.hidden).length >= 3, problem.id);
    assert.ok(cases.every((c) => c.expectedOutput.endsWith('\n') && c.input.endsWith('\n')), problem.id);
  }
});

test('statement files: a title, four sections and "- " hints', () => {
  assert.deepEqual(parseStatement('# T\nbody\n## a\nin\n## b\nout\n## c\nwhy\n## d\n- one\n- two\n'), {
    title: 'T',
    description: 'body',
    input: 'in',
    output: 'out',
    explanation: 'why',
    hints: ['one', 'two'],
  });
  assert.throws(() => parseStatement('# T\nbody\n## a\nin\n'), /four/);
});

test('run.py: the tests must reach MAX_N, and float answers never expect the -1 sentinel', () => {
  const run = (cases: string[], checker = 'tokens') => {
    const folder = resolve(dir, `bk-run-${cases.join('-')}-${checker}`);
    mkdirSync(folder);
    writeFileSync(
      resolve(folder, 'problem.py'),
      [
        "LEVEL, TAGS, SAMPLES, MAX_N = '简单', ['x'], 1, 10",
        `CHECKER = '${checker}'`,
        "solve = lambda s: '1 ' + s.split()[0]",
        "wrong_a = wrong_b = lambda s: '1 7'",
        `cases = lambda r: ${JSON.stringify(cases)}`,
      ].join('\n'),
    );
    const result = spawnSync('python3', ['-I', '-S', '-B', 'scripts/book-problems/run.py', folder], { encoding: 'utf8' });
    return [result.status, result.stderr.trim()];
  };
  assert.deepEqual(run(['1', '5', '10']), [0, '']);
  assert.deepEqual(run(['1', '5', '9']), [1, 'bk-run-1-5-9-tokens: no hidden case reaches bound 1 of MAX_N, 10']);
  // Only hidden cases count.
  assert.deepEqual(run(['10', '5', '9']), [1, 'bk-run-10-5-9-tokens: no hidden case reaches bound 1 of MAX_N, 10']);
  assert.deepEqual(run(['1', '5', '11']), [1, 'bk-run-1-5-11-tokens: a case exceeds bound 1 of MAX_N, 10']);
  assert.deepEqual(run(['1', '-1', '10'], 'float-array'), [
    1,
    'bk-run-1--1-10-float-array: an expected value is -1, which the float checker matches exactly',
  ]);
});

test('the build reproduces packages.json: references rerun and every mistake fails a hidden case', () => {
  assert.equal(buildBookProblems().packages, readFileSync(PACKAGES_FILE, 'utf8'));
});

test('published book problems judge free and fill their classic list rows', async () => {
  const publish = () =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/publish-book-problems.ts', 'teacher@book.test'], {
      env: { ...process.env, ADMIN_EMAILS: 'teacher@book.test' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  const before = listClassicLibrary(classicList('sword-offer')!, 'student');
  assert.equal(before.groups[0].items[0].judgeProblemId, null, 'external until published');
  const first = publish();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.match(/"published"/g)?.length, packages.length);
  const again = publish();
  assert.equal(again.stdout.match(/"unchanged"/g)?.length, packages.length);
  // No course grant needed: a verified account judges it, like the SQL track.
  const snapshot = await getJudgeProblem(student, 'bk-offer-03');
  assert.equal(snapshot.cases.length, packages[0].cases.length);

  const view = () => listClassicLibrary(classicList('sword-offer')!, 'student');
  const row = view().groups[0].items[0];
  assert.deepEqual(
    [row.ref, row.number, row.judgeProblemId, row.external, row.titleZh, row.titleEn, row.difficulty],
    ['03', null, 'bk-offer-03', false, '找出所有重复的编号', 'Find Every Reused Label', '简单'],
  );
  const judged = bookJudges().filter((j) => j.list.slug === 'sword-offer').length;
  assert.equal(view().collection.ready, before.collection.ready + judged);
  assert.ok(view().sequence.includes('bk-offer-03'));
  // Solved by its own judge id, outside any practice round.
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES('b1','student','bk-offer-03','python','','accepted',1,1,1,'judge')`,
    )
    .run();
  const solved = view().groups[0].items[0];
  assert.deepEqual([solved.solved, solved.progressStatus], [true, 'solved']);
  assert.equal(view().collection.solved, 1);
  assert.equal(listClassicLibrary(classicList('sword-offer')!, 'someone').collection.solved, 0);
});
