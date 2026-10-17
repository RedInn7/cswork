import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-sql-track-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { buildSqlTrack, datasetSql, sqlRunner, PACKAGES_FILE, MANIFEST_FILE } = await import(
  '../scripts/sql-track/build'
);
const { PROBLEMS } = await import('../scripts/sql-track/problems');
const { compile, run, engineVerdict, matchesOutput } = await import('../lib/server/oj-engine');
const { getJudgeProblem, listPublishedProblems } = await import('../lib/server/oj-problems');
const { createSubmission } = await import('../lib/server/oj-submissions');
const { SQL_HARNESS, SQL_INDEX, SQL_NAMES } = await import('../lib/server/sql-judge');

const packages = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const student: Person = {
  id: 'student',
  email: 'student@sql.test',
  name: 'Student',
  role: 'student',
  verified: true,
};
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@sql.test',1,0,0)",
  ).run();
});
const runner = sqlRunner();
after(() => {
  runner.close();
  rmSync(dir, { recursive: true, force: true });
});
const table = (rows: string) =>
  `CREATE TABLE t (name TEXT, x);\nINSERT INTO t VALUES ${rows};\n`;

test('the harness compares result sets: unordered, typed, NULL- and float-normalized', () => {
  const data = table("('b', 2), ('a', 1.0), ('c', NULL), ('d', '3')");
  const asc = runner.run('SELECT name, x FROM t ORDER BY name', data);
  const desc = runner.run('select name, x from t order by name desc;', data);
  assert.equal(asc.ok, true, asc.stderr);
  assert.equal(asc.stdout, desc.stdout);
  // 1.0 prints as 1, NULL as null, and the text '3' stays a string.
  assert.equal(asc.stdout, 'columns: 2\n["a", 1]\n["b", 2]\n["c", null]\n["d", "3"]\n');
  assert.notEqual(runner.run('SELECT name, CAST(x AS INTEGER) FROM t', data).stdout, asc.stdout);
  // Floats round to 4 places; an integral float equals the integer; -0.0 is 0.
  assert.equal(
    runner.run('SELECT 1.0 / 3, 2.0 / 3, 6 / 2.0, -0.0, ROUND(2.5), 1e20', '').stdout,
    'columns: 6\n[0.3333, 0.6667, 3, 0, 3, 100000000000000000000]\n',
  );
  assert.equal(
    runner.run('SELECT AVG(x) FROM t WHERE x < 3', data).stdout,
    runner.run('SELECT 1.5', '').stdout,
  );
  // BLOBs and infinities are tagged, so they never equal the text they print as.
  assert.equal(
    runner.run("SELECT x'00ff', 'x00ff', 1e999, -1e999, 'inf'", '').stdout,
    'columns: 5\n[{"blob": "00ff"}, "x00ff", {"float": "inf"}, {"float": "-inf"}, "inf"]\n',
  );
  // Column count and column order count; names do not.
  assert.equal(runner.run('SELECT x AS a, name AS b FROM t', data).stdout.split('\n')[0], 'columns: 2');
  assert.notEqual(runner.run('SELECT x, name FROM t', data).stdout, asc.stdout);
  assert.equal(runner.run('SELECT name AS n, x AS value FROM t', data).stdout, asc.stdout);
  assert.notEqual(runner.run('SELECT name, x, 1 FROM t', data).stdout, asc.stdout);
  // An empty result still states its width.
  assert.equal(runner.run('SELECT name, x FROM t WHERE 0', data).stdout, 'columns: 2\n');
  // Duplicates are a multiset, not a set.
  assert.notEqual(
    runner.run('SELECT name FROM t UNION ALL SELECT name FROM t', data).stdout,
    runner.run('SELECT name FROM t', data).stdout,
  );
});

test('the ordered marker makes row order count', () => {
  const data = `-- cswork:ordered\n${table("('b', 2), ('a', 1)")}`;
  const asc = runner.run('SELECT name FROM t ORDER BY name', data);
  const desc = runner.run('SELECT name FROM t ORDER BY name DESC', data);
  assert.equal(asc.stdout, 'columns: 1\n["a"]\n["b"]\n');
  assert.equal(desc.stdout, 'columns: 1\n["b"]\n["a"]\n');
});

test('the names marker adds the column names on stderr and keeps the rows in the query\'s order', () => {
  const data = table("('b', 2), ('a', 1)");
  const query = 'SELECT name AS "名字", x, x + 1 FROM t';
  const plain = runner.run(query, data);
  const named = runner.run(`${SQL_NAMES}\n${query}`, data);
  assert.equal(named.ok, true, named.stderr);
  assert.equal(plain.stdout, 'columns: 3\n["a", 1, 2]\n["b", 2, 3]\n');
  assert.equal(named.stdout, 'columns: 3\n["b", 2, 3]\n["a", 1, 2]\n');
  assert.equal(plain.stderr, '');
  assert.equal(named.stderr, '["名字", "x", "x + 1"]\n');
});

test('the harness rejects anything but one read-only query', () => {
  const data = table("('a', 1)");
  for (const [query, message] of [
    ['', /Empty query/],
    ['   \n  ', /Empty query/],
    ['SELECT 1; SELECT 2', /one (SQL )?statement/],
    ["INSERT INTO t VALUES ('z', 9)", /readonly/],
    ['DROP TABLE t', /readonly/],
    ['SELEC name FROM t', /SQL error/],
    ['SELECT missing FROM t', /no such column/],
    ['WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r) SELECT n FROM r', /more than 100000 rows/],
  ] as const) {
    const result = runner.run(query, data);
    assert.equal(result.ok, false, query);
    assert.match(result.stderr, message, query);
    // One bilingual line: Chinese, then the English after " / ".
    assert.match(result.stderr, /^[^\n]*\p{Script=Han}[^\n]* \/ [A-Z]/u, query);
    assert.equal(result.stdout, '', query);
  }
  // A trailing semicolon and comment are fine; a broken dataset is reported as such.
  assert.equal(runner.run('SELECT name FROM t; -- done', data).ok, true);
  const broken = runner.run('SELECT 1', 'CREATE TABLE (');
  assert.equal(broken.ok, false);
  assert.match(broken.stderr, /Dataset error/);
});

test('index problems: the reference indexes pass; missing, misordered, wrapped or too many indexes fail', () => {
  const index = PROBLEMS.filter((problem) => problem.index);
  assert.deepEqual(
    index.map((problem) => problem.id),
    ['sql-71', 'sql-72', 'sql-73', 'sql-74', 'sql-75', 'sql-76', 'sql-77', 'sql-78'],
  );
  const pkg = packages.find((p) => p.problem.id === 'sql-71')!;
  const input = pkg.cases[0].input;
  assert.ok(input.startsWith(SQL_INDEX));
  const ok = 'query 1: ok\n';
  assert.equal(runner.run(PROBLEMS.find((p) => p.id === 'sql-71')!.reference, input).stdout, ok);
  // No index, the range column first, a function on the column: the plan line instead of ok.
  for (const script of [
    '',
    '-- nothing yet',
    'CREATE INDEX i ON orders (order_date, customer_id);',
    'CREATE INDEX i ON orders (customer_id, date(order_date));',
  ]) {
    const result = runner.run(script, input);
    assert.equal(result.ok, true, script);
    assert.match(result.stdout, /^query 1: (SCAN|SEARCH) orders[^\n]*\n$/, script);
    assert.notEqual(result.stdout, ok, script);
  }
  assert.equal(runner.run('', input).stdout, 'query 1: SCAN orders\n');
  // Over the limit, or anything but CREATE INDEX: a runtime error, one bilingual line.
  for (const [script, message] of [
    ['CREATE INDEX a ON orders (customer_id, order_date); CREATE INDEX b ON orders (status);', /at most 1 index/],
    ['DROP TABLE orders', /CREATE INDEX statements only/],
    ['DELETE FROM orders', /CREATE INDEX statements only/],
    ["INSERT INTO orders VALUES (99, 1, '2024-01-01', 'paid')", /CREATE INDEX statements only/],
    ['CREATE TABLE t (a)', /CREATE INDEX statements only/],
    ['CREATE TRIGGER t AFTER INSERT ON orders BEGIN SELECT 1; END', /CREATE INDEX statements only/],
    ['PRAGMA writable_schema = ON', /CREATE INDEX statements only/],
    ["ATTACH ':memory:' AS other", /CREATE INDEX statements only/],
    ['ANALYZE', /CREATE INDEX statements only/],
    ['SELECT * FROM orders', /CREATE INDEX statements only/],
    ['CREATE INDEX i ON orders (customer_id, order_date); DROP INDEX i', /CREATE INDEX statements only/],
    // The plan prints index names, so a quoted name must not spell out the needed lookup.
    ['CREATE INDEX "x (customer_id=? AND order_date>? AND order_date<?)" ON orders (customer_id)', /letters, digits and underscores only/],
    ['CREATE INDEX [USING COVERING INDEX z] ON orders (customer_id)', /letters, digits and underscores only/],
    // A CREATE INDEX that SQLite rejects is a plain SQL error.
    ['CREATE INDEX i ON orders (customer_id order_date)', /^SQL 错误 \/ SQL error: near "order_date": syntax error\n$/],
    ['CREATE UNIQUE INDEX i ON orders (customer_id)', /^SQL 错误 \/ SQL error: UNIQUE constraint failed/],
  ] as const) {
    const result = runner.run(script, input);
    assert.equal(result.ok, false, script);
    assert.equal(result.stdout, '', script);
    assert.match(result.stderr, message, script);
    assert.match(result.stderr, /^[^\n]*\p{Script=Han}[^\n]* \/ [A-Z][^\n]*\n$/u, script);
  }
  // Transactions around CREATE INDEX are fine; an unchanged result with every target passing is ok.
  assert.equal(runner.run('BEGIN; CREATE INDEX i ON orders (customer_id, order_date); COMMIT;', input).stdout, ok);
  // Any word characters name an index, CJK included.
  assert.equal(runner.run('CREATE INDEX 客户日期 ON orders (customer_id, order_date);', input).stdout, ok);
  // Every target query gets its own line: one index serving two of sql-78's three queries.
  const three = PROBLEMS.find((p) => p.id === 'sql-78')!;
  const threeInput = datasetSql(three, three.sample);
  assert.equal(runner.run(three.reference, threeInput).stdout, 'query 1: ok\nquery 2: ok\nquery 3: ok\n');
  assert.equal(
    runner.run('CREATE INDEX i ON orders (customer_id, status);', threeInput).stdout,
    'query 1: ok\nquery 2: ok\nquery 3: SEARCH orders USING INDEX i (customer_id=? AND status=?) | USE TEMP B-TREE FOR ORDER BY\n',
  );
  // A tie under LIMIT read in another order through the index: the result changed.
  const tie = `${SQL_INDEX}{"max":1,"queries":[{"sql":"SELECT id FROM t ORDER BY d LIMIT 1"}]}
CREATE TABLE t (id INTEGER PRIMARY KEY, d TEXT);
INSERT INTO t VALUES (1, 'x'), (2, 'x'), (3, 'y');
`;
  assert.equal(runner.run('CREATE INDEX i ON t (d, id DESC);', tie).stdout, 'query 1: result changed\n');
  // Older SQLite's 'SCAN TABLE t (~N rows)' reads like today's 'SCAN t'.
  const check = spawnSync(
    'python3',
    [
      '-I',
      '-S',
      '-c',
      `exec(${JSON.stringify(SQL_HARNESS.split('dataset = sys.stdin.read()')[0])})
for old, new in [('SCAN TABLE orders (~100000 rows)', 'SCAN orders'), ('SEARCH TABLE orders USING INDEX i (customer_id=?) (~10 rows)', 'SEARCH orders USING INDEX i (customer_id=?)')]:
    assert clean_step(old) == new, clean_step(old)
assert bad_step(clean_step('SCAN TABLE orders')) and not bad_step('SCAN orders USING COVERING INDEX i')
assert bad_step('USE TEMP B-TREE FOR ORDER BY') and bad_step('SEARCH o USING AUTOMATIC COVERING INDEX (customer_id=?)')
assert not bad_step('SCAN CONSTANT ROW')`,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(check.status, 0, check.stderr);
});

test('every reference, alternative and wrong query reruns on every dataset to the committed packages', () => {
  // The build throws if an accepted query disagrees on any dataset or a wrong
  // query passes every hidden one; the output must match what is committed.
  const built = buildSqlTrack();
  assert.equal(built.packages, readFileSync(PACKAGES_FILE, 'utf8'), 'rerun scripts/sql-track/build.ts');
  assert.equal(built.manifest, readFileSync(MANIFEST_FILE, 'utf8'), 'rerun scripts/sql-track/build.ts');
  assert.equal(built.report.length, 70);
});

test('the packages are 70 valid, bilingual, SQL-only judge packages', () => {
  assert.equal(packages.length, 70);
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as {
    groups: { ids: string[]; zh: string; en: string }[];
    problems: { id: string }[];
  };
  // Every problem sits in exactly one topic group, in id order within it; ids stay
  // sql-01… in package order, so problems added later join their topic at the end.
  const grouped = manifest.groups.flatMap((group) => group.ids);
  assert.deepEqual(
    [...grouped].sort(),
    packages.map((p) => p.problem.id),
  );
  for (const group of manifest.groups) assert.deepEqual(group.ids, [...group.ids].sort(), group.zh);
  assert.equal(manifest.groups.length, 9);
  assert.ok(manifest.groups.every((group) => group.ids.length >= 3));
  assert.deepEqual(
    manifest.problems.map((p) => p.id),
    packages.map((p) => p.problem.id),
  );
  packages.forEach((pkg, index) => {
    const parsed = ojImportSchema.parse(pkg);
    // sql-01…62, then the index problems sql-71…78.
    assert.equal(parsed.problem.id, `sql-${String(index < 62 ? index + 1 : index + 9).padStart(2, '0')}`);
    assert.equal(parsed.problem.id, PROBLEMS[index].id);
    // Index problems start the editor on a comment-only CREATE INDEX starter; the rest have none.
    assert.equal(!!parsed.problem.starters?.sql, !!PROBLEMS[index].index);
    assert.deepEqual(parsed.problem.languages, ['sql']);
    assert.equal(parsed.problem.checker, 'exact');
    assert.ok(parsed.problem.translations?.en?.description.includes('CREATE TABLE'));
    assert.match(parsed.problem.input, /SQLite/);
    assert.ok(parsed.cases[0] && !parsed.cases[0].hidden);
    assert.ok(parsed.cases.filter((c) => c.hidden).length >= 3);
    // The sample is what the statement shows: its input recreates the data.
    assert.equal(parsed.cases[0].input, datasetSql(PROBLEMS[index], PROBLEMS[index].sample));
  });
  // The sql- prefix (free, public) and the SQL language only go together, SQL-only,
  // exact-checked and in the SQL track's lesson.
  const sql = packages[0];
  const variant = (problem: Partial<OjProblemPackage['problem']>) =>
    ojImportSchema.safeParse({ ...sql, problem: { ...sql.problem, ...problem } }).success;
  assert.equal(variant({}), true);
  assert.equal(variant({ id: 'course-sql' }), false);
  assert.equal(variant({ languages: ['sql', 'python'] }), false);
  assert.equal(variant({ languages: ['python'] }), false);
  assert.equal(variant({ checker: 'tokens' }), false);
  assert.equal(variant({ courseId: 'private-course' }), false);
  assert.equal(variant({ lessonId: 'lesson-2' }), false);
  assert.equal(variant({ id: 'lc-1', languages: ['sql'] }), false);
});

test('interview patterns name known problems, and every problem lists its own', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as {
    patterns: { key: string; zh: string; en: string }[];
    problems: { id: string; patterns: string[] }[];
  };
  const keys = manifest.patterns.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of manifest.patterns) assert.ok(/^[a-z]+(-[a-z]+)*$/.test(p.key) && p.zh && p.en, p.key);
  for (const problem of manifest.problems) for (const key of problem.patterns) assert.ok(keys.includes(key), problem.id);
  // Every pattern has a problem; the classic interview ones are where they belong.
  for (const key of keys) assert.ok(manifest.problems.some((p) => p.patterns.includes(key)), key);
  const of = (id: string) => manifest.problems.find((p) => p.id === id)!.patterns;
  assert.deepEqual(of('sql-19'), ['gaps-islands', 'dedupe']);
  assert.deepEqual(of('sql-04'), ['anti-join']);
  assert.ok(of('sql-16').includes('top-n-per-group') && of('sql-17').includes('running-total'));
  assert.ok(of('sql-20').includes('retention') && of('sql-32').includes('pivot'));
});

/** A stand-in go-judge: writes copyIn files and runs the command with local executables. */
async function fakeRunner(): Promise<Server> {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const { cmd } = JSON.parse(body) as {
        cmd: { args: string[]; files: { content?: string }[]; copyIn: Record<string, { content: string }> }[];
      };
      const [command] = cmd;
      const work = mkdtempSync(join(dir, 'run-'));
      for (const [name, file] of Object.entries(command.copyIn)) writeFileSync(join(work, name), file.content);
      // go-judge resolves /usr/bin/python3 inside its image; here use whatever python3 is on PATH.
      const executable = command.args[0] === '/usr/bin/python3' ? 'python3' : command.args[0];
      const result = spawnSync(executable, command.args.slice(1), {
        cwd: work,
        input: command.files[0].content,
        encoding: 'utf8',
      });
      rmSync(work, { recursive: true, force: true });
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify([
          {
            status: result.status === 0 ? 'Accepted' : 'Nonzero Exit Status',
            exitStatus: result.status,
            time: 1e6,
            memory: 1024,
            files: { stdout: result.stdout, stderr: result.stderr },
          },
        ]),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return server;
}

test('the worker engine runs SQL through the harness and the exact checker', async () => {
  const server = await fakeRunner();
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  process.env.GO_JUDGE_URL = `http://127.0.0.1:${address.port}`;
  try {
    const signal = AbortSignal.timeout(60_000);
    for (const [index, pkg] of packages.entries()) {
      const { result, program } = await compile('sql', PROBLEMS[index].reference, signal);
      assert.equal(result.status, 'Accepted');
      assert.deepEqual(program.cache, {});
      for (const c of pkg.cases) {
        const output = await run(program, c.input, pkg.problem, signal);
        assert.equal(engineVerdict(output), 'accepted', `${pkg.problem.id} ${c.name}`);
        assert.ok(matchesOutput(output.files?.stdout || '', c.expectedOutput, 'exact', c.input));
      }
    }
    const pkg = packages[3];
    const wrong = (await compile('sql', PROBLEMS[3].wrong[0], signal)).program;
    const verdicts: boolean[] = [];
    for (const c of pkg.cases) {
      const output = await run(wrong, c.input, pkg.problem, signal);
      verdicts.push(matchesOutput(output.files?.stdout || '', c.expectedOutput, 'exact', c.input));
    }
    assert.equal(verdicts.includes(false), true);
    const broken = (await compile('sql', 'SELECT nope FROM customers', signal)).program;
    const failed = await run(broken, pkg.cases[0].input, pkg.problem, signal);
    assert.equal(engineVerdict(failed), 'runtime_error');
    assert.match(failed.files?.stderr || '', /no such column/);
    // The workspace's plan view: EXPLAIN QUERY PLAN passes the read-only harness.
    const explain = (await compile('sql', `EXPLAIN QUERY PLAN ${PROBLEMS[3].reference}`, signal)).program;
    const plan = await run(explain, pkg.cases[0].input, pkg.problem, signal);
    assert.equal(engineVerdict(plan), 'accepted');
    assert.match(plan.files?.stdout || '', /^columns: 4\n(\[\d+, \d+, \d+, "[A-Z][^\n]*"\]\n)+$/);
  } finally {
    server.close();
    delete process.env.GO_JUDGE_URL;
  }
});

test('the release publisher publishes once, then skips unchanged packages; SQL problems judge free', async () => {
  const report = join(dir, 'rest-sandbox-report.json');
  const publish = () =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/publish-sql-track.ts', 'teacher@sql.test'], {
      env: { ...process.env, ADMIN_EMAILS: 'teacher@sql.test', REST_API_REPORT: report },
      encoding: 'utf8',
    });
  const first = publish();
  assert.equal(first.status, 0, first.stderr);
  // The SQL packages and their pandas versions (tests/pandas-track.test.ts).
  assert.equal(first.stdout.match(/"id":"sql-\d\d","status":"published"/g)?.length, 70);
  assert.equal(first.stdout.match(/"published"/g)?.length, 133);
  // The REST API problems (tests/oa-rest-fixtures.test.ts) wait for go-judge's own run of them.
  const rest = JSON.parse(readFileSync('content/rest-api/packages.json', 'utf8')) as OjProblemPackage[];
  assert.equal(first.stdout.match(/"id":"rest-\d\d","status":"unverified"/g)?.length, rest.length);
  const sha256 = (pkg: OjProblemPackage) => createHash('sha256').update(JSON.stringify(pkg)).digest('hex');
  const verified = rest.map((pkg) => ({ id: pkg.problem.id, packageSha256: sha256(pkg) }));
  writeFileSync(report, JSON.stringify({ engine: 'go-judge', allPassed: true, problems: verified.slice(1) }));
  const again = publish();
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout.match(/"unchanged"/g)?.length, 133);
  assert.equal(again.stdout.match(/"id":"rest-\d\d","status":"published"/g)?.length, rest.length - 1);
  assert.match(again.stdout, new RegExp(`"id":"${rest[0].problem.id}","status":"unverified"`));
  writeFileSync(report, JSON.stringify({ engine: 'go-judge', allPassed: false, problems: verified }));
  const partial = publish();
  assert.notEqual(partial.status, 0);
  assert.match(partial.stderr, /Incomplete REST API sandbox report/);
  // Like OA problems: listed for everyone, judged for any verified account.
  const listed = (await listPublishedProblems(null)).filter((p) => p.id.startsWith('sql-'));
  assert.equal(listed.length, 70);
  assert.ok(listed.every((p) => p.freeJudge && p.languages.join() === 'sql'));
  const snapshot = await getJudgeProblem(student, 'sql-01');
  assert.equal(snapshot.cases.length, packages[0].cases.length);
  const submission = (code: string, language: string, key: string) =>
    createSubmission(student, {
      problemId: 'sql-01',
      language,
      code,
      mode: 'judge',
      idempotencyKey: `sql-track-${key}`.padEnd(16, '0'),
    });
  assert.equal((await submission(PROBLEMS[0].reference, 'sql', 'ok')).status, 'queued');
  await assert.rejects(submission('print(1)', 'python', 'py'), /未开放该语言/);
});
