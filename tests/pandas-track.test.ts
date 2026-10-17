import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

// The Pandas track: the SQL track's packages again as pd-xx, judged by PANDAS_HARNESS.
// Runs that need pandas use PANDAS_PYTHON (default python3) and are skipped without it;
// CI installs python3-pandas.
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-pandas-track-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.OJ_ENABLED = 'true';
const python = process.env.PANDAS_PYTHON || 'python3';
const noPandas =
  spawnSync(python, ['-I', '-c', 'import pandas'], { stdio: 'ignore' }).status !== 0 &&
  `${python} cannot import pandas (set PANDAS_PYTHON)`;
const { sqlite } = await import('../db/sqlite');
const { ojImportSchema } = await import('../lib/oj-types');
const { buildPandasTrack, pandasRunner, PACKAGES_FILE, PANDAS_PACKAGES_FILE } = await import(
  '../scripts/sql-track/build'
);
const { PANDAS_SOLUTIONS } = await import('../scripts/sql-track/pandas-solutions');
const { PANDAS_NATIVE } = await import('../scripts/sql-track/pandas-native');
const { compile, run, engineVerdict, matchesOutput } = await import('../lib/server/oj-engine');
const { getJudgeProblem, listPublishedProblems } = await import('../lib/server/oj-problems');
const { createSubmission } = await import('../lib/server/oj-submissions');

const sqlPackages = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const packages = JSON.parse(readFileSync(PANDAS_PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
const student: Person = {
  id: 'student',
  email: 'student@pandas.test',
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
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@pandas.test',1,0,0)",
  ).run();
});
after(() => rmSync(dir, { recursive: true, force: true }));

const DATA = "CREATE TABLE t (id INTEGER, name TEXT, x INTEGER);\nINSERT INTO t VALUES (1, 'b', NULL), (2, 'a', 3);\n";
/** One solve() body on the given datasets: [stdout or null, error] each. */
function solveWith(body: string, inputs = [DATA]) {
  const runner = pandasRunner(python);
  try {
    return runner.run(`import numpy as np\nimport pandas as pd\n\ndef solve(tables):\n${body}\n`, inputs);
  } finally {
    runner.close();
  }
}

test('the harness prints a DataFrame the way SQLite would return it', { skip: noPandas }, () => {
  const [[out, error]] = solveWith(`    t = tables['t']
    print('debug output stays out of the result')
    assert str(t['x'].dtype) == 'Int64' and t['name'].dtype == object
    frame = pd.DataFrame({
        'name': t['name'],
        'x': t['x'],
        'missing': t['x'].isna(),
        'numpy': [np.int64(7), np.float64(2.50004)],
        'nan': [np.nan, pd.NA],
        'day': [pd.Timestamp('2024-02-29'), pd.Timestamp('2024-02-29 10:30:00')],
        'nat': [pd.NaT, np.datetime64('NaT')],
        'gap': [pd.Timedelta(days=3), pd.Timedelta(hours=12)],
        'float': [1 / 3, 6 / 2],
    })
    frame.index = [20, 10]
    return frame`);
  assert.equal(error, '');
  // Unordered: rows sorted as text; the index is ignored.
  assert.equal(
    out,
    'columns: 9\n' +
      '["a", 3, 0, 2.5, null, "2024-02-29 10:30:00", null, 0.5, 3]\n' +
      '["b", null, 1, 7, null, "2024-02-29", null, 3, 0.3333]\n',
  );
  // The ordered marker keeps the returned order.
  const [[ordered]] = solveWith("    return tables['t'][['name']]", [`-- cswork:ordered\n${DATA}`]);
  assert.equal(ordered, 'columns: 1\n["b"]\n["a"]\n');
});

test('the harness rejects what is not a result DataFrame, in both languages', { skip: noPandas }, () => {
  const runner = pandasRunner(python);
  try {
    for (const [code, message] of [
      ['x = 1', /defines no solve\(tables\)/],
      ["def solve(tables):\n    return tables['t']['x']", /returned a Series/],
      ['def solve(tables):\n    return [1]', /must return a pandas DataFrame, not list/],
      ["import pandas as pd\ndef solve(tables):\n    return pd.DataFrame({'a': [[1]]})", /unsupported type: list/],
      ['def solve(tables):\n    return 1 / 0', /ZeroDivisionError/],
    ] as const) {
      const [[out, error]] = runner.run(code, [DATA]);
      assert.equal(out, null, code);
      assert.match(error, message, code);
    }
    const [[out, error]] = runner.run('def solve(tables):\n    return 1', ['CREATE TABLE (']);
    assert.equal(out, null);
    assert.match(error, /^[^\n]*\p{Script=Han}[^\n]* \/ Dataset error/mu);
  } finally {
    runner.close();
  }
});

test('every pandas solution reproduces the SQL expected outputs into the committed packages', { skip: noPandas }, () => {
  const built = buildPandasTrack();
  assert.equal(built.packages, readFileSync(PANDAS_PACKAGES_FILE, 'utf8'), 'rerun scripts/sql-track/build.ts --pandas');
  assert.equal(built.report.length, 63);
});

test('the packages are the first 50 SQL packages in pandas, then 13 pandas-only problems', () => {
  assert.equal(packages.length, 63);
  assert.equal(Object.keys(PANDAS_SOLUTIONS).length, 50);
  // The advanced and index design SQL problems have no pandas twin.
  assert.ok(!packages.some((pkg) => /^pd-(5[1-9]|6\d|7\d)$/.test(pkg.problem.id)));
  packages.slice(0, 50).forEach((pkg, index) => {
    const parsed = ojImportSchema.parse(pkg);
    const sql = sqlPackages[index];
    assert.equal(parsed.problem.id, `pd-${sql.problem.id.slice(4)}`);
    assert.deepEqual(parsed.problem.languages, ['pandas']);
    assert.deepEqual(parsed.cases, sql.cases);
    assert.equal(parsed.problem.timeLimit, 3);
    assert.ok(parsed.problem.description.includes('def solve(tables'));
    assert.ok(parsed.problem.translations?.en?.description.includes("tables['"));
    assert.ok(!/ROUND\(x/.test(`${parsed.problem.description}${parsed.problem.translations?.en?.description}`));
    assert.equal(parsed.problem.hints.length, 1);
    // Hints render as plain text, so no Markdown backticks.
    assert.ok(![...parsed.problem.hints, ...(parsed.problem.translations?.en?.hints ?? [])].some((hint) => hint.includes('`')));
  });
  // Pandas-only problems: three-digit ids, their own tables and at least three hidden datasets.
  const native = packages.slice(50);
  assert.deepEqual(
    native.map((pkg) => pkg.problem.id),
    PANDAS_NATIVE.map((problem) => problem.id),
  );
  native.forEach((pkg, k) => {
    const parsed = ojImportSchema.parse(pkg);
    assert.equal(parsed.problem.id, `pd-${101 + k}`);
    assert.deepEqual(parsed.problem.languages, ['pandas']);
    assert.equal(parsed.problem.timeLimit, 3);
    assert.ok(parsed.problem.description.includes('def solve(tables'));
    assert.ok(!parsed.problem.input.includes('SQL 版'), 'no SQL twin to point at');
    assert.ok(!parsed.cases[0].hidden && parsed.cases.filter((c) => c.hidden).length >= 3);
    assert.ok(parsed.problem.hints.length >= 1 && !parsed.problem.hints.some((hint) => hint.includes('`')));
  });
  // REAL columns are float64, and the input text says so.
  const trades = native.find((pkg) => pkg.problem.id === 'pd-107')!.problem;
  assert.match(trades.description, /\n {2}price +float64\n/);
  assert.match(trades.input, /REAL 列是 float64/);
  assert.match(trades.translations!.en!.input, /REAL columns are float64/);
  const pandas = packages[0];
  const variant = (problem: Partial<OjProblemPackage['problem']>) =>
    ojImportSchema.safeParse({ ...pandas, problem: { ...pandas.problem, ...problem } }).success;
  assert.equal(variant({}), true);
  assert.equal(variant({ id: 'sql-01' }), false);
  assert.equal(variant({ id: 'lc-1' }), false);
  assert.equal(variant({ languages: ['sql'] }), false);
  assert.equal(variant({ languages: ['pandas', 'python'] }), false);
  assert.equal(variant({ languages: ['python'] }), false);
  assert.equal(variant({ checker: 'tokens' }), false);
  assert.equal(variant({ courseId: 'private-course' }), false);
  assert.equal(variant({ timeLimit: 2 }), false);
  // The worker runs pandas under timeLimits.pandas when set, so the 3 s floor holds there too.
  assert.equal(variant({ timeLimits: { pandas: 1 } }), false);
  assert.equal(variant({ timeLimits: { pandas: 4 } }), true);
  assert.equal(variant({ memoryLimit: 131072 }), false);
});

/** A stand-in go-judge running the command with the local pandas python; records each command. */
async function fakeRunner(commands: { args: string[]; env: string[] }[]): Promise<Server> {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const [command] = (
        JSON.parse(body) as {
          cmd: { args: string[]; env: string[]; files: { content?: string }[]; copyIn: Record<string, { content: string }> }[];
        }
      ).cmd;
      commands.push(command);
      const work = mkdtempSync(join(dir, 'run-'));
      for (const [name, file] of Object.entries(command.copyIn)) writeFileSync(join(work, name), file.content);
      const result = spawnSync(python, command.args.slice(1), { cwd: work, input: command.files[0].content, encoding: 'utf8' });
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

test('the worker engine runs pandas through the harness and the exact checker', { skip: noPandas }, async () => {
  const commands: { args: string[]; env: string[] }[] = [];
  const server = await fakeRunner(commands);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  process.env.GO_JUDGE_URL = `http://127.0.0.1:${address.port}`;
  try {
    const signal = AbortSignal.timeout(60_000);
    for (const pkg of [packages[0], packages[16], packages[38]]) {
      const { result, program } = await compile('pandas', PANDAS_SOLUTIONS[`sql-${pkg.problem.id.slice(3)}`].code, signal);
      assert.equal(result.status, 'Accepted');
      assert.deepEqual(program.cache, {});
      for (const c of pkg.cases) {
        const output = await run(program, c.input, pkg.problem, signal);
        assert.equal(engineVerdict(output), 'accepted', `${pkg.problem.id} ${c.name}`);
        assert.ok(matchesOutput(output.files?.stdout || '', c.expectedOutput, 'exact', c.input));
      }
    }
    // No -S (pandas is in dist-packages) and one BLAS thread.
    assert.deepEqual(commands[0].args, ['/usr/bin/python3', '-I', 'judge.py']);
    assert.ok(commands[0].env.includes('OPENBLAS_NUM_THREADS=1'));
    const pkg = packages[0];
    const wrong = (await compile('pandas', "def solve(tables):\n    return tables['employees'][['id', 'name']]\n", signal)).program;
    const verdicts: boolean[] = [];
    for (const c of pkg.cases) {
      const output = await run(wrong, c.input, pkg.problem, signal);
      verdicts.push(matchesOutput(output.files?.stdout || '', c.expectedOutput, 'exact', c.input));
    }
    assert.equal(verdicts.includes(false), true);
    // A pandas-only problem: the reference passes everywhere, a wrong solution fails a hidden case.
    const fill = packages.find((p) => p.problem.id === 'pd-109')!;
    const problem = PANDAS_NATIVE.find((p) => p.id === 'pd-109')!;
    for (const [code, passes] of [
      [problem.reference, true],
      [problem.wrong[0], false],
    ] as const) {
      const { program } = await compile('pandas', code, signal);
      const matched: boolean[] = [];
      for (const c of fill.cases) {
        const output = await run(program, c.input, fill.problem, signal);
        assert.equal(engineVerdict(output), 'accepted', `${fill.problem.id} ${c.name}`);
        matched.push(matchesOutput(output.files?.stdout || '', c.expectedOutput, 'exact', c.input));
      }
      assert.equal(matched.every(Boolean), passes);
    }
    const broken = (await compile('pandas', "def solve(tables):\n    return tables['nope']\n", signal)).program;
    const failed = await run(broken, pkg.cases[0].input, pkg.problem, signal);
    assert.equal(engineVerdict(failed), 'runtime_error');
    assert.match(failed.files?.stderr || '', /KeyError: 'nope'/);
  } finally {
    server.close();
    delete process.env.GO_JUDGE_URL;
  }
});

test('pd- problems publish with the SQL track but stay hidden until the judge reports pandas', async () => {
  const publish = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/publish-sql-track.ts', 'teacher@pandas.test'], {
    env: { ...process.env, ADMIN_EMAILS: 'teacher@pandas.test' },
    encoding: 'utf8',
  });
  assert.equal(publish.status, 0, publish.stderr);
  assert.equal(publish.stdout.match(/"id":"pd-\d\d","status":"published"/g)?.length, 50);
  assert.equal(publish.stdout.match(/"id":"pd-1\d\d","status":"published"/g)?.length, 13);
  const pandasListed = async () => (await listPublishedProblems(null)).filter((p) => p.id.startsWith('pd-'));
  // An image without pandas: nothing to see, open or submit.
  assert.equal((await pandasListed()).length, 0);
  assert.equal((await listPublishedProblems(null)).filter((p) => p.id.startsWith('sql-')).length, 70);
  await assert.rejects(getJudgeProblem(student, 'pd-01'), /尚未发布/);
  const heartbeat = (details: object) =>
    sqlite()
      .prepare(
        "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,1,?) ON CONFLICT(id) DO UPDATE SET details=excluded.details",
      )
      .run(Date.now(), JSON.stringify(details));
  heartbeat({ languageVersions: { python: 'Python 3.13.5' } });
  assert.equal((await pandasListed()).length, 0);
  // verify-runtime.py recorded pandas and the worker reports it: listed, free for any verified account.
  heartbeat({ languageVersions: { python: 'Python 3.13.5', pandas: 'pandas 2.2.3' } });
  const listed = await pandasListed();
  assert.equal(listed.length, 63);
  assert.ok(listed.every((p) => p.freeJudge && p.languages.join() === 'pandas'));
  assert.equal((await getJudgeProblem(student, 'pd-01')).cases.length, packages[0].cases.length);
  const submission = (language: string, key: string) =>
    createSubmission(student, {
      problemId: 'pd-01',
      language,
      code: PANDAS_SOLUTIONS['sql-01'].code,
      mode: 'judge',
      idempotencyKey: `pandas-track-${key}`.padEnd(16, '0'),
    });
  assert.equal((await submission('pandas', 'ok')).status, 'queued');
  await assert.rejects(submission('sql', 'sql'), /未开放该语言/);
  // A rollback to an image without pandas hides them again.
  heartbeat({ languageVersions: {} });
  assert.equal((await pandasListed()).length, 0);
});
