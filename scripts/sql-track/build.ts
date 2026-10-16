/**
 * Builds the SQL track's judge packages from scripts/sql-track/problems.ts.
 * Every reference, accepted and wrong query runs through the production harness
 * (lib/server/sql-judge.ts) on the local python3's sqlite3; the build fails if
 * an accepted query disagrees anywhere or a wrong query survives every hidden
 * dataset.
 *
 * --pandas builds the Pandas track instead: each SQL package again as pd-xx,
 * same datasets and expected outputs, which scripts/sql-track/pandas-solutions.ts
 * must reproduce exactly through PANDAS_HARNESS. That needs pandas in
 * PANDAS_PYTHON (default python3).
 *
 *   node --import tsx scripts/sql-track/build.ts [--pandas]          # write the files
 *   node --import tsx scripts/sql-track/build.ts [--pandas] --check  # fail on drift
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OjProblemPackage } from '../../lib/oj-types';
import { PANDAS_HARNESS, SQL_HARNESS, SQL_ORDERED } from '../../lib/server/sql-judge';
import { GENERATORS, SCHEMAS, seeded, type Data, type Value } from './datasets';
import { PANDAS_SOLUTIONS, type PandasSolution } from './pandas-solutions';
import { GROUPS, PATTERNS, PROBLEMS, type SqlProblem } from './problems';

export const PACKAGES_FILE = 'content/sql-track/packages.json';
export const MANIFEST_FILE = 'lib/content/sql-track.json';
export const PANDAS_PACKAGES_FILE = 'content/sql-track/pandas-packages.json';
const RANDOM_DATASETS = 2;

export function literal(value: Value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

/** One test's stdin: the ordering marker, the problem's tables and their rows. */
export function datasetSql(problem: SqlProblem, data: Data) {
  const parts = problem.ordered ? [SQL_ORDERED] : [];
  for (const table of problem.tables) parts.push(SCHEMAS[problem.schema][table]);
  for (const table of problem.tables) {
    const rows = data[table] ?? [];
    if (rows.length)
      parts.push(
        `INSERT INTO ${table} VALUES\n${rows.map((row) => `  (${row.map(literal).join(', ')})`).join(',\n')};`,
      );
  }
  return parts.join('\n') + '\n';
}

/** The production harness under the local python3, one query file at a time. */
export function sqlRunner() {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-sql-'));
  writeFileSync(join(dir, 'judge.py'), SQL_HARNESS);
  return {
    run(query: string, input: string) {
      writeFileSync(join(dir, 'query.sql'), query);
      const result = spawnSync('python3', ['-I', '-S', 'judge.py'], {
        cwd: dir,
        input,
        encoding: 'utf8',
        timeout: 20_000,
      });
      return { ok: result.status === 0, stdout: result.stdout, stderr: result.stderr };
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const rowCount = (output: string) => output.split('\n').length - 2;

const columnList = (problem: SqlProblem, zh: boolean) =>
  problem.columns
    .map(([name, meaningZh, meaningEn]) => `- \`${name}\`${zh ? '：' : ': '}${zh ? meaningZh : meaningEn}`)
    .join('\n');
const orderNote = (problem: SqlProblem, zh: boolean) =>
  problem.ordered
    ? zh
      ? `**本题比较行的顺序**，请按题目要求排序。样例输入第一行的 \`${SQL_ORDERED}\` 就是这个标记。`
      : `**Row order is compared in this problem**, so sort as asked. The \`${SQL_ORDERED}\` first line of the sample input marks this.`
    : zh
      ? '行的顺序不限。'
      : 'Rows may come in any order.';

function statement(problem: SqlProblem, locale: 'zh' | 'en') {
  const zh = locale === 'zh';
  const schema = problem.tables.map((table) => SCHEMAS[problem.schema][table]).join('\n');
  const columns = columnList(problem, zh);
  const order = orderNote(problem, zh);
  return {
    title: problem.title[locale],
    description: zh
      ? `${problem.task.zh}\n\n数据库中的表（SQLite）：\n\n\`\`\`sql\n${schema}\n\`\`\``
      : `${problem.task.en}\n\nTables in the database (SQLite):\n\n\`\`\`sql\n${schema}\n\`\`\``,
    input: zh
      ? "每个测试点先在空的 SQLite 内存数据库里执行建表和插入数据的 SQL（样例输入就是其中一组），再执行你的查询。只提交一条 SELECT 语句（可以以 WITH 开头，末尾分号可有可无），数据库对你的查询只读。方言是 SQLite 3：字符串用单引号，日期以 'YYYY-MM-DD' 文本保存，可以用 date()、julianday()、strftime() 处理。"
      : "Each test first runs SQL that creates and fills the tables in an empty in-memory SQLite database (the sample input is one such dataset), then runs your query. Submit exactly one SELECT statement (it may start with WITH; the trailing semicolon is optional). The database is read-only to your query. The dialect is SQLite 3: strings use single quotes, dates are 'YYYY-MM-DD' text, and date(), julianday() and strftime() work on them.",
    output: zh
      ? `按以下顺序返回这些列（列名不参与比较，列的顺序参与比较）：\n\n${columns}\n\n${order}\n\n判题器把结果整理成统一格式再比较：第一行是列数，之后每行是一条记录的 JSON 数组。NULL 写作 null；小数四舍五入到 4 位，值为整数的小数与整数相同（3.0 等于 3）；文本和数字不相等（'3' 不等于 3）。`
      : `Return these columns in this order (names are not compared, their order is):\n\n${columns}\n\n${order}\n\nThe judge formats the result before comparing: the first line is the column count, then each row is a JSON array. NULL is null; decimals are rounded to 4 places and an integral decimal equals the integer (3.0 equals 3); text never equals a number ('3' is not 3).`,
    explanation: problem.explanation[locale],
    // Hints render as plain text; only the description and output are Markdown.
    hints: problem.hints[locale].map((hint) => hint.replaceAll('`', '')),
  };
}

export function buildSqlTrack() {
  const runner = sqlRunner();
  const report: string[] = [];
  try {
    const packages = PROBLEMS.map((problem, index): OjProblemPackage => {
      const random = Array.from({ length: RANDOM_DATASETS }, (_, k) =>
        GENERATORS[problem.schema](seeded(1000 * (index + 1) + k)),
      );
      const datasets = [
        { name: '样例 1', data: problem.sample, hidden: false },
        ...problem.hidden.map((data, k) => ({ name: `边界 ${k + 1}`, data, hidden: true })),
        ...random.map((data, k) => ({ name: `随机 ${k + 1}`, data, hidden: true })),
      ].map((item) => ({ ...item, input: datasetSql(problem, item.data) }));
      const expected = datasets.map(({ name, input }) => {
        const result = runner.run(problem.reference, input);
        if (!result.ok) throw new Error(`${problem.id} ${name}: reference failed: ${result.stderr}`);
        return result.stdout;
      });
      for (const query of problem.accepted ?? [])
        datasets.forEach(({ name, input }, k) => {
          const result = runner.run(query, input);
          if (result.stdout !== expected[k])
            throw new Error(`${problem.id} ${name}: accepted query disagrees\n${query}\n${result.stderr || result.stdout}`);
        });
      const kills = problem.wrong.map((query) => {
        const killed = datasets
          .filter(({ input }, k) => runner.run(query, input).stdout !== expected[k])
          .map(({ name }) => name);
        if (!killed.some((name) => !name.startsWith('样例')))
          throw new Error(`${problem.id}: no hidden dataset rejects\n${query}`);
        return killed.length;
      });
      const rows = expected.map(rowCount);
      if (!rows[0] || !rows.slice(1).some(Boolean))
        throw new Error(`${problem.id}: the sample and some hidden dataset need result rows`);
      report.push(`${problem.id} rows ${rows.join('/')} wrong-killed-on ${kills.join('/')}`);
      const zh = statement(problem, 'zh');
      const group = GROUPS.find((item) => item.key === problem.group)!;
      return {
        schemaVersion: 1,
        problem: {
          id: problem.id,
          courseId: 'gomall',
          lessonId: '00-overview',
          title: zh.title,
          difficulty: problem.difficulty,
          translations: { en: statement(problem, 'en') },
          tags: ['SQL', group.zh],
          description: zh.description,
          input: zh.input,
          output: zh.output,
          explanation: zh.explanation,
          hints: zh.hints,
          timeLimit: 2,
          memoryLimit: 131072,
          outputLimit: 64,
          checker: 'exact',
          languages: ['sql'],
        },
        cases: datasets.map(({ name, input, hidden }, k) => ({
          name,
          input,
          expectedOutput: expected[k],
          hidden,
          weight: 1,
        })),
      };
    });
    const manifest = {
      groups: GROUPS.map(({ key, zh, en }) => ({
        key,
        zh,
        en,
        ids: PROBLEMS.filter((problem) => problem.group === key).map((problem) => problem.id),
      })),
      patterns: PATTERNS.map(({ key, zh, en }) => ({ key, zh, en })),
      problems: PROBLEMS.map(({ id, title, difficulty }) => ({
        id,
        titleZh: title.zh,
        titleEn: title.en,
        difficulty,
        patterns: PATTERNS.filter((pattern) => pattern.ids.includes(id)).map((pattern) => pattern.key),
      })),
    };
    return {
      packages: JSON.stringify(packages, null, 1) + '\n',
      manifest: JSON.stringify(manifest, null, 2) + '\n',
      report,
    };
  } finally {
    runner.close();
  }
}

/** pd-xx: the Pandas version of sql-xx. */
export const pandasId = (sqlId: string) => `pd-${sqlId.slice(4)}`;

/** Runs PANDAS_HARNESS's judge() on a list of datasets in one python process (build only). */
const PANDAS_BATCH = `import contextlib, io, json, runpy, sys, traceback
judge = runpy.run_path('judge.py', run_name='cswork_batch')['judge']
results = []
for dataset in json.load(sys.stdin):
    error = io.StringIO()
    try:
        with contextlib.redirect_stderr(error):
            results.append([judge(dataset), ''])
    except SystemExit:
        results.append([None, error.getvalue()])
    except Exception:
        results.append([None, error.getvalue() + traceback.format_exc()])
json.dump(results, sys.stdout)
`;

/** The production pandas harness under PANDAS_PYTHON (default python3), which must have pandas. */
export function pandasRunner(python = process.env.PANDAS_PYTHON || 'python3') {
  if (spawnSync(python, ['-I', '-c', 'import pandas'], { stdio: 'ignore' }).status !== 0)
    throw new Error(
      `The Pandas track needs pandas, which ${python} cannot import. Install it (pip install pandas, or apt install python3-pandas) or set PANDAS_PYTHON to a python3 that has it.`,
    );
  const dir = mkdtempSync(join(tmpdir(), 'cswork-pandas-'));
  writeFileSync(join(dir, 'judge.py'), PANDAS_HARNESS);
  writeFileSync(join(dir, 'batch.py'), PANDAS_BATCH);
  return {
    /** [stdout, ''] per dataset, or [null, the error]. */
    run(code: string, inputs: string[]) {
      writeFileSync(join(dir, 'solution.py'), code);
      const result = spawnSync(python, ['-I', 'batch.py'], {
        cwd: dir,
        input: JSON.stringify(inputs),
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 64 * 1024 * 1024,
      });
      if (result.status !== 0) throw new Error(`pandas batch failed: ${result.stderr}`);
      return JSON.parse(result.stdout) as [string | null, string][];
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A table as solve() receives it: its columns and dtypes, from the CREATE TABLE. */
function frameColumns(table: string, ddl: string) {
  const columns = [...ddl.matchAll(/^\s+(\w+) (\w+)[^-\n]*(?:-- (.*))?$/gm)].map(
    ([, name, type, note]) => [name, type.includes('INT') ? 'Int64' : 'object', note] as const,
  );
  const width = Math.max(...columns.map(([name]) => name.length));
  return [
    `tables['${table}']`,
    ...columns.map(([name, dtype, note]) => `  ${name.padEnd(width)}  ${note ? `${dtype.padEnd(6)}  # ${note}` : dtype}`),
  ].join('\n');
}

function pandasStatement(problem: SqlProblem, solution: PandasSolution, locale: 'zh' | 'en') {
  const zh = locale === 'zh';
  const sql = statement(problem, locale);
  const signature = [
    'import pandas as pd',
    '',
    'def solve(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:',
    ...problem.tables.map((table) => `    ${table} = tables['${table}']`),
    '    ...',
  ].join('\n');
  const frames = problem.tables.map((table) => frameColumns(table, SCHEMAS[problem.schema][table])).join('\n\n');
  // The tasks name SQL's ROUND; pandas rounds with .round().
  const task = problem.task[locale].replace(/`ROUND\(x, (\d)\)`/g, '`.round($1)`');
  return {
    title: `${sql.title}${zh ? '（Pandas）' : ' (Pandas)'}`,
    description: zh
      ? `${task}\n\n写一个函数 \`solve(tables)\`，返回结果 DataFrame：\n\n\`\`\`python\n${signature}\n\`\`\`\n\n\`tables\` 里的 DataFrame 和各列的 dtype：\n\n\`\`\`text\n${frames}\n\`\`\``
      : `${task}\n\nWrite a function \`solve(tables)\` that returns the result DataFrame:\n\n\`\`\`python\n${signature}\n\`\`\`\n\nThe DataFrames in \`tables\` and their column dtypes:\n\n\`\`\`text\n${frames}\n\`\`\``,
    input: zh
      ? "每个测试点先在空的 SQLite 内存数据库里执行建表和插入数据的 SQL（样例输入就是其中一组，和 SQL 版的数据相同），再把每张表读成一个 DataFrame，以 {表名: DataFrame} 的字典传给 solve(tables)。INTEGER 列是可空整数 Int64（NULL 为 pd.NA），TEXT 列是 object（NULL 为 None）；日期以 'YYYY-MM-DD' 文本保存，需要时用 pd.to_datetime 转换。可以使用 pandas 和 numpy；solve 里 print 的内容不算输出。"
      : "Each test first runs SQL that creates and fills the tables in an empty in-memory SQLite database (the sample input is one such dataset, the same data as the SQL version), then reads every table into a DataFrame and passes them to solve(tables) as a {table name: DataFrame} dict. INTEGER columns are the nullable Int64 (NULL is pd.NA) and TEXT columns are object (NULL is None); dates are 'YYYY-MM-DD' text, so convert them with pd.to_datetime when needed. pandas and numpy are available; anything solve prints is not part of the output.",
    output: zh
      ? `返回一个 DataFrame，按以下顺序包含这些列（列名不参与比较，列的顺序参与比较，index 被忽略）：\n\n${columnList(problem, zh)}\n\n${orderNote(problem, zh)}\n\n判题器把返回的 DataFrame 整理成和 SQL 版相同的格式再比较：第一行是列数，之后每行是一条记录的 JSON 数组。缺失值（None、NaN、NaT、pd.NA）写作 null，True / False 写作 1 / 0；小数四舍五入到 4 位，值为整数的小数与整数相同（3.0 等于 3）；Timestamp 写成 'YYYY-MM-DD' 文本（带时间时为 'YYYY-MM-DD HH:MM:SS'），Timedelta 写成天数；文本和数字不相等（'3' 不等于 3）。`
      : `Return a DataFrame with these columns in this order (names are not compared, their order is; the index is ignored):\n\n${columnList(problem, zh)}\n\n${orderNote(problem, zh)}\n\nThe judge formats the returned DataFrame like the SQL version's result before comparing: the first line is the column count, then each row is a JSON array. Missing values (None, NaN, NaT, pd.NA) are null and True / False are 1 / 0; decimals are rounded to 4 places and an integral decimal equals the integer (3.0 equals 3); a Timestamp becomes 'YYYY-MM-DD' text ('YYYY-MM-DD HH:MM:SS' with a time) and a Timedelta its number of days; text never equals a number ('3' is not 3).`,
    explanation: sql.explanation,
    hints: [solution.hint[locale].replaceAll('`', '')],
  };
}

/**
 * The Pandas track from the committed SQL packages: same cases, a pandas
 * statement, and the reference solution checked against every expected output.
 */
export function buildPandasTrack() {
  const sql = JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[];
  const runner = pandasRunner();
  const report: string[] = [];
  try {
    const packages = PROBLEMS.map((problem, index): OjProblemPackage => {
      const source = sql[index];
      const solution = PANDAS_SOLUTIONS[problem.id];
      const id = pandasId(problem.id);
      if (source?.problem.id !== problem.id || !solution)
        throw new Error(`${id}: needs ${problem.id}'s committed package and a pandas solution`);
      runner.run(solution.code, source.cases.map((c) => c.input)).forEach(([stdout, error], k) => {
        if (stdout !== source.cases[k].expectedOutput)
          throw new Error(
            `${id} ${source.cases[k].name}: the pandas solution disagrees with the SQL expected output\n${error || stdout}\nexpected:\n${source.cases[k].expectedOutput}`,
          );
      });
      report.push(`${id} matches ${source.cases.length} datasets`);
      const zh = pandasStatement(problem, solution, 'zh');
      const group = GROUPS.find((item) => item.key === problem.group)!;
      return {
        schemaVersion: 1,
        problem: {
          ...source.problem,
          id,
          title: zh.title,
          translations: { en: pandasStatement(problem, solution, 'en') },
          tags: ['Pandas', group.zh],
          description: zh.description,
          input: zh.input,
          output: zh.output,
          explanation: zh.explanation,
          hints: zh.hints,
          // A fresh python imports pandas per test (~0.5 s) before the learner's code runs.
          timeLimit: 3,
          memoryLimit: 262144,
          languages: ['pandas'],
        },
        cases: source.cases,
      };
    });
    return { packages: JSON.stringify(packages, null, 1) + '\n', report };
  } finally {
    runner.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let outputs: [string, string][];
  if (process.argv.includes('--pandas')) {
    const built = buildPandasTrack();
    console.log(built.report.join('\n'));
    outputs = [[PANDAS_PACKAGES_FILE, built.packages]];
  } else {
    const built = buildSqlTrack();
    console.log(built.report.join('\n'));
    outputs = [
      [PACKAGES_FILE, built.packages],
      [MANIFEST_FILE, built.manifest],
    ];
  }
  if (process.argv.includes('--check')) {
    const drift = outputs.filter(([file, text]) => readFileSync(file, 'utf8') !== text);
    if (drift.length) {
      console.error(`out of date: ${drift.map(([file]) => file).join(', ')}; rerun the build`);
      process.exit(1);
    }
  } else for (const [file, text] of outputs) writeFileSync(file, text);
}
