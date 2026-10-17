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
import { PANDAS_HARNESS, SQL_HARNESS, SQL_INDEX, SQL_ORDERED } from '../../lib/server/sql-judge';
import { GENERATORS, SCHEMAS, seeded, type Data, type Value } from './datasets';
import { PANDAS_GROUPS, PANDAS_NATIVE, type PandasProblem } from './pandas-native';
import { PANDAS_SOLUTIONS } from './pandas-solutions';
import { GROUPS, PATTERNS, PROBLEMS, type GroupKey, type SqlProblem } from './problems';

export const PACKAGES_FILE = 'content/sql-track/packages.json';
export const MANIFEST_FILE = 'lib/content/sql-track.json';
export const PANDAS_PACKAGES_FILE = 'content/sql-track/pandas-packages.json';
const RANDOM_DATASETS = 2;

export function literal(value: Value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

/** One test's stdin: the ordering or index marker, the problem's tables and their rows. */
export function datasetSql(problem: SqlProblem, data: Data) {
  const marker = problem.ordered ? [SQL_ORDERED] : problem.index ? [SQL_INDEX + JSON.stringify(problem.index)] : [];
  return writeDataset(
    marker,
    problem.tables.map((table) => [table, SCHEMAS[problem.schema][table]]),
    data,
  );
}

function writeDataset(marker: string[], tables: [string, string][], data: Data) {
  const parts = [...marker, ...tables.map(([, ddl]) => ddl)];
  for (const [table] of tables) {
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

type Shape = Pick<SqlProblem, 'columns' | 'ordered'>;
const columnList = (problem: Shape, zh: boolean) =>
  problem.columns
    .map(([name, meaningZh, meaningEn]) => `- \`${name}\`${zh ? '：' : ': '}${zh ? meaningZh : meaningEn}`)
    .join('\n');
const orderNote = (problem: Shape, zh: boolean) =>
  problem.ordered
    ? zh
      ? `**本题比较行的顺序**，请按题目要求排序。样例输入第一行的 \`${SQL_ORDERED}\` 就是这个标记。`
      : `**Row order is compared in this problem**, so sort as asked. The \`${SQL_ORDERED}\` first line of the sample input marks this.`
    : zh
      ? '行的顺序不限。'
      : 'Rows may come in any order.';

/** An index problem's editor starter: comments only, so as it stands it builds no index. */
export const indexStarter = (max: number) =>
  `-- 只写 CREATE INDEX 语句，最多 ${max} 个 / CREATE INDEX statements only, at most ${max}\n-- CREATE INDEX idx_name ON table_name (column1, column2);\n`;

function indexStatement(problem: SqlProblem, index: NonNullable<SqlProblem['index']>, schema: string, zh: boolean) {
  const queries = index.queries
    .map(({ sql }, k) => `-- ${zh ? '查询' : 'query'} ${k + 1}\n${sql};`)
    .join('\n\n');
  return {
    title: problem.title[zh ? 'zh' : 'en'],
    description: zh
      ? `${problem.task.zh}\n\n数据库中的表（SQLite）：\n\n\`\`\`sql\n${schema}\n\`\`\`\n\n目标查询：\n\n\`\`\`sql\n${queries}\n\`\`\`\n\n**最多建 ${index.max} 个索引。**`
      : `${problem.task.en}\n\nTables in the database (SQLite):\n\n\`\`\`sql\n${schema}\n\`\`\`\n\nTarget queries:\n\n\`\`\`sql\n${queries}\n\`\`\`\n\n**Create at most ${index.max} index${index.max === 1 ? '' : 'es'}.**`,
    input: zh
      ? `每个测试点先在空的 SQLite 内存数据库里建表、插入数据（样例输入就是其中一组；第一行 \`${SQL_INDEX.trim()}\` 后面是判题器读的上限和目标查询），然后执行你的脚本。脚本只能包含 CREATE INDEX 语句，可以写多条，用分号隔开；SELECT、INSERT、DELETE、DROP、CREATE TABLE、PRAGMA、ANALYZE 等其他语句都会被拒绝。判题器不运行 ANALYZE，所以执行计划不取决于数据。`
      : `Each test first creates and fills the tables in an empty in-memory SQLite database (the sample input is one such dataset; after \`${SQL_INDEX.trim()}\` on its first line come the limit and the target queries the judge reads), then runs your script. The script may hold only CREATE INDEX statements, as many as you like separated by semicolons; SELECT, INSERT, DELETE, DROP, CREATE TABLE, PRAGMA, ANALYZE and every other statement are refused. The judge never runs ANALYZE, so the plans do not depend on the data.`,
    output: zh
      ? '每条目标查询按编号输出一行：\n\n- `query k: ok`：结果和建索引之前完全相同；EXPLAIN QUERY PLAN 里没有扫描整张表的 `SCAN 表名`（`SCAN … USING INDEX` 不算）、没有 `USE TEMP B-TREE`、没有 SQLite 临时建的 `AUTOMATIC` 索引，并且用上了题目要求的查找方式。\n- `query k: result changed`：结果变了。\n- 否则是这条查询的执行计划，各步骤用 ` | ` 连成一行，方便你看到 SQLite 实际怎么执行。\n\n建的索引超过上限，或者脚本里有 CREATE INDEX 以外的语句，判为运行错误。'
      : 'One line per target query, in order:\n\n- `query k: ok`: the result is the same as before your indexes, and its EXPLAIN QUERY PLAN has no `SCAN table` reading a whole table (`SCAN … USING INDEX` is fine), no `USE TEMP B-TREE`, no `AUTOMATIC` index SQLite builds on the fly, and uses the lookup the task asks for.\n- `query k: result changed`: the result changed.\n- Otherwise the query’s plan, its steps joined by ` | ` on one line, so you see what SQLite actually does.\n\nMore indexes than the limit, or any statement other than CREATE INDEX, is a runtime error.',
    explanation: problem.explanation[zh ? 'zh' : 'en'],
    hints: problem.hints[zh ? 'zh' : 'en'].map((hint) => hint.replaceAll('`', '')),
  };
}

function statement(problem: SqlProblem, locale: 'zh' | 'en') {
  const zh = locale === 'zh';
  const schema = problem.tables.map((table) => SCHEMAS[problem.schema][table]).join('\n');
  if (problem.index) return indexStatement(problem, problem.index, schema, zh);
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
      if (problem.index) {
        // The reference passes every target query everywhere; there are no result rows to count.
        if (expected.some((output) => output !== problem.index!.queries.map((_, k) => `query ${k + 1}: ok\n`).join('')))
          throw new Error(`${problem.id}: the reference index fails a target query\n${expected.join('')}`);
        report.push(`${problem.id} index ok on ${expected.length} wrong-killed-on ${kills.join('/')}`);
      } else {
        const rows = expected.map(rowCount);
        if (!rows[0] || !rows.slice(1).some(Boolean))
          throw new Error(`${problem.id}: the sample and some hidden dataset need result rows`);
        report.push(`${problem.id} rows ${rows.join('/')} wrong-killed-on ${kills.join('/')}`);
      }
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
          ...(problem.index ? { starters: { sql: indexStarter(problem.index.max) } } : {}),
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
      // Pandas-only problems (pandas-native.ts): listed in the track's Pandas mode only.
      pandasGroups: PANDAS_GROUPS.map(({ key, zh, en }) => ({
        key,
        zh,
        en,
        ids: PANDAS_NATIVE.filter((problem) => problem.group === key).map((problem) => problem.id),
      })),
      pandasProblems: PANDAS_NATIVE.map(({ id, title, difficulty }) => ({
        id,
        titleZh: title.zh,
        titleEn: title.en,
        difficulty,
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
    ([, name, type, note]) =>
      [name, type.includes('INT') ? 'Int64' : type === 'REAL' ? 'float64' : 'object', note] as const,
  );
  const width = Math.max(...columns.map(([name]) => name.length));
  const typeWidth = Math.max(6, ...columns.map(([, dtype]) => dtype.length));
  return [
    `tables['${table}']`,
    ...columns.map(
      ([name, dtype, note]) => `  ${name.padEnd(width)}  ${note ? `${dtype.padEnd(typeWidth)}  # ${note}` : dtype}`,
    ),
  ].join('\n');
}

type PandasText = { title: string; task: string; explanation: string; hints: string[] };

/** A pandas statement: an SQL problem's twin, or (native) a pandas-only problem with its own tables. */
function pandasStatement(
  problem: Shape,
  tables: [string, string][],
  text: PandasText,
  locale: 'zh' | 'en',
  native = false,
) {
  const zh = locale === 'zh';
  const signature = [
    'import pandas as pd',
    '',
    'def solve(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:',
    ...tables.map(([table]) => `    ${table} = tables['${table}']`),
    '    ...',
  ].join('\n');
  const frames = tables.map(([table, ddl]) => frameColumns(table, ddl)).join('\n\n');
  const real = tables.some(([, ddl]) => /^\s+\w+ REAL\b/m.test(ddl));
  return {
    title: text.title,
    description: zh
      ? `${text.task}\n\n写一个函数 \`solve(tables)\`，返回结果 DataFrame：\n\n\`\`\`python\n${signature}\n\`\`\`\n\n\`tables\` 里的 DataFrame 和各列的 dtype：\n\n\`\`\`text\n${frames}\n\`\`\``
      : `${text.task}\n\nWrite a function \`solve(tables)\` that returns the result DataFrame:\n\n\`\`\`python\n${signature}\n\`\`\`\n\nThe DataFrames in \`tables\` and their column dtypes:\n\n\`\`\`text\n${frames}\n\`\`\``,
    input: zh
      ? `每个测试点先在空的 SQLite 内存数据库里执行建表和插入数据的 SQL（样例输入就是其中一组${native ? '' : '，和 SQL 版的数据相同'}），再把每张表读成一个 DataFrame，以 {表名: DataFrame} 的字典传给 solve(tables)。INTEGER 列是可空整数 Int64（NULL 为 pd.NA），${real ? 'REAL 列是 float64（NULL 为 NaN），' : ''}TEXT 列是 object（NULL 为 None）；${native ? '日期和时间以文本保存（格式见各列的注释）' : "日期以 'YYYY-MM-DD' 文本保存"}，需要时用 pd.to_datetime 转换。可以使用 pandas 和 numpy；solve 里 print 的内容不算输出。`
      : `Each test first runs SQL that creates and fills the tables in an empty in-memory SQLite database (the sample input is one such dataset${native ? '' : ', the same data as the SQL version'}), then reads every table into a DataFrame and passes them to solve(tables) as a {table name: DataFrame} dict. INTEGER columns are the nullable Int64 (NULL is pd.NA)${real ? ', REAL columns are float64 (NULL is NaN)' : ''} and TEXT columns are object (NULL is None); ${native ? 'dates and times are text (each column’s note gives the format)' : "dates are 'YYYY-MM-DD' text"}, so convert them with pd.to_datetime when needed. pandas and numpy are available; anything solve prints is not part of the output.`,
    output: zh
      ? `返回一个 DataFrame，按以下顺序包含这些列（列名不参与比较，列的顺序参与比较，index 被忽略）：\n\n${columnList(problem, zh)}\n\n${orderNote(problem, zh)}\n\n判题器把返回的 DataFrame 整理成${native ? '统一的' : '和 SQL 版相同的'}格式再比较：第一行是列数，之后每行是一条记录的 JSON 数组。缺失值（None、NaN、NaT、pd.NA）写作 null，True / False 写作 1 / 0；小数四舍五入到 4 位，值为整数的小数与整数相同（3.0 等于 3）；Timestamp 写成 'YYYY-MM-DD' 文本（带时间时为 'YYYY-MM-DD HH:MM:SS'），Timedelta 写成天数；文本和数字不相等（'3' 不等于 3）。`
      : `Return a DataFrame with these columns in this order (names are not compared, their order is; the index is ignored):\n\n${columnList(problem, zh)}\n\n${orderNote(problem, zh)}\n\nThe judge formats the returned DataFrame ${native ? 'into one canonical form' : "like the SQL version's result"} before comparing: the first line is the column count, then each row is a JSON array. Missing values (None, NaN, NaT, pd.NA) are null and True / False are 1 / 0; decimals are rounded to 4 places and an integral decimal equals the integer (3.0 equals 3); a Timestamp becomes 'YYYY-MM-DD' text ('YYYY-MM-DD HH:MM:SS' with a time) and a Timedelta its number of days; text never equals a number ('3' is not 3).`,
    explanation: text.explanation,
    hints: text.hints.map((hint) => hint.replaceAll('`', '')),
  };
}

/** SQL groups without a pandas twin: recursive SQL, JSON functions and SQLite's own indexes. */
export const SQL_ONLY_GROUPS: GroupKey[] = ['advanced', 'indexing'];

/** A pandas-only problem: its datasets run through the reference, with the SQL track's checks. */
function nativePackage(problem: PandasProblem, runner: ReturnType<typeof pandasRunner>, report: string[]): OjProblemPackage {
  const datasets = [
    { name: '样例 1', data: problem.sample, hidden: false },
    ...problem.hidden.map((data, k) => ({ name: `边界 ${k + 1}`, data, hidden: true })),
  ].map((item) => ({ ...item, input: writeDataset(problem.ordered ? [SQL_ORDERED] : [], problem.tables, item.data) }));
  const inputs = datasets.map(({ input }) => input);
  const expected = runner.run(problem.reference, inputs).map(([stdout, error], k) => {
    if (stdout === null) throw new Error(`${problem.id} ${datasets[k].name}: reference failed: ${error}`);
    return stdout;
  });
  for (const code of problem.accepted ?? [])
    runner.run(code, inputs).forEach(([stdout, error], k) => {
      if (stdout !== expected[k])
        throw new Error(`${problem.id} ${datasets[k].name}: accepted solution disagrees\n${code}\n${error || stdout}`);
    });
  const kills = problem.wrong.map((code) => {
    const killed = runner
      .run(code, inputs)
      .flatMap(([stdout], k) => (stdout !== expected[k] ? [datasets[k].name] : []));
    if (!killed.some((name) => !name.startsWith('样例')))
      throw new Error(`${problem.id}: no hidden dataset rejects\n${code}`);
    return killed.length;
  });
  const rows = expected.map(rowCount);
  if (!rows[0] || !rows.slice(1).some(Boolean))
    throw new Error(`${problem.id}: the sample and some hidden dataset need result rows`);
  report.push(`${problem.id} rows ${rows.join('/')} wrong-killed-on ${kills.join('/')}`);
  const text = (locale: 'zh' | 'en') =>
    pandasStatement(
      problem,
      problem.tables,
      {
        title: problem.title[locale],
        task: problem.task[locale],
        explanation: problem.explanation[locale],
        hints: problem.hints[locale],
      },
      locale,
      true,
    );
  const zh = text('zh');
  return {
    schemaVersion: 1,
    problem: {
      id: problem.id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: zh.title,
      difficulty: problem.difficulty,
      translations: { en: text('en') },
      tags: ['Pandas', PANDAS_GROUPS.find((group) => group.key === problem.group)!.zh],
      description: zh.description,
      input: zh.input,
      output: zh.output,
      explanation: zh.explanation,
      hints: zh.hints,
      timeLimit: 3,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'exact',
      languages: ['pandas'],
    },
    cases: datasets.map(({ name, input, hidden }, k) => ({ name, input, expectedOutput: expected[k], hidden, weight: 1 })),
  };
}

/**
 * The Pandas track: each committed SQL package outside SQL_ONLY_GROUPS again as
 * pd-xx (same cases, a pandas statement, the reference solution checked against
 * every expected output), then the pandas-only problems.
 */
export function buildPandasTrack() {
  const sql = new Map(
    (JSON.parse(readFileSync(PACKAGES_FILE, 'utf8')) as OjProblemPackage[]).map((pkg) => [pkg.problem.id, pkg]),
  );
  const runner = pandasRunner();
  const report: string[] = [];
  try {
    const twins = PROBLEMS.filter((problem) => !SQL_ONLY_GROUPS.includes(problem.group)).map(
      (problem): OjProblemPackage => {
        const source = sql.get(problem.id);
        const solution = PANDAS_SOLUTIONS[problem.id];
        const id = pandasId(problem.id);
        if (!source || !solution) throw new Error(`${id}: needs ${problem.id}'s committed package and a pandas solution`);
        runner.run(solution.code, source.cases.map((c) => c.input)).forEach(([stdout, error], k) => {
          if (stdout !== source.cases[k].expectedOutput)
            throw new Error(
              `${id} ${source.cases[k].name}: the pandas solution disagrees with the SQL expected output\n${error || stdout}\nexpected:\n${source.cases[k].expectedOutput}`,
            );
        });
        report.push(`${id} matches ${source.cases.length} datasets`);
        const text = (locale: 'zh' | 'en'): PandasText => {
          const statementText = statement(problem, locale);
          return {
            title: `${statementText.title}${locale === 'zh' ? '（Pandas）' : ' (Pandas)'}`,
            // The tasks name SQL's ROUND; pandas rounds with .round().
            task: problem.task[locale].replace(/`ROUND\(x, (\d)\)`/g, '`.round($1)`'),
            explanation: statementText.explanation,
            hints: [solution.hint[locale]],
          };
        };
        const tables = problem.tables.map((table): [string, string] => [table, SCHEMAS[problem.schema][table]]);
        const zh = pandasStatement(problem, tables, text('zh'), 'zh');
        const group = GROUPS.find((item) => item.key === problem.group)!;
        return {
          schemaVersion: 1,
          problem: {
            ...source.problem,
            id,
            title: zh.title,
            translations: { en: pandasStatement(problem, tables, text('en'), 'en') },
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
      },
    );
    const native = PANDAS_NATIVE.map((problem) => nativePackage(problem, runner, report));
    return { packages: JSON.stringify([...twins, ...native], null, 1) + '\n', report };
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
