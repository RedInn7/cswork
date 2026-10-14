/**
 * Builds the SQL track's judge packages from scripts/sql-track/problems.ts.
 * Every reference, accepted and wrong query runs through the production harness
 * (lib/server/sql-judge.ts) on the local python3's sqlite3; the build fails if
 * an accepted query disagrees anywhere or a wrong query survives every hidden
 * dataset.
 *
 *   node --import tsx scripts/sql-track/build.ts          # write the files
 *   node --import tsx scripts/sql-track/build.ts --check  # fail on drift
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OjProblemPackage } from '../../lib/oj-types';
import { SQL_HARNESS, SQL_ORDERED } from '../../lib/server/sql-judge';
import { GENERATORS, SCHEMAS, seeded, type Data, type Value } from './datasets';
import { GROUPS, PROBLEMS, type SqlProblem } from './problems';

export const PACKAGES_FILE = 'content/sql-track/packages.json';
export const MANIFEST_FILE = 'lib/content/sql-track.json';
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

function statement(problem: SqlProblem, locale: 'zh' | 'en') {
  const zh = locale === 'zh';
  const schema = problem.tables.map((table) => SCHEMAS[problem.schema][table]).join('\n');
  const columns = problem.columns
    .map(([name, meaningZh, meaningEn]) => `- \`${name}\`${zh ? '：' : ': '}${zh ? meaningZh : meaningEn}`)
    .join('\n');
  const order = problem.ordered
    ? zh
      ? `**本题比较行的顺序**，请按题目要求排序。样例输入第一行的 \`${SQL_ORDERED}\` 就是这个标记。`
      : `**Row order is compared in this problem**, so sort as asked. The \`${SQL_ORDERED}\` first line of the sample input marks this.`
    : zh
      ? '行的顺序不限。'
      : 'Rows may come in any order.';
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
      problems: PROBLEMS.map(({ id, title, difficulty }) => ({
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const built = buildSqlTrack();
  console.log(built.report.join('\n'));
  if (process.argv.includes('--check')) {
    const drift = [
      [PACKAGES_FILE, built.packages],
      [MANIFEST_FILE, built.manifest],
    ].filter(([file, text]) => readFileSync(file, 'utf8') !== text);
    if (drift.length) {
      console.error(`out of date: ${drift.map(([file]) => file).join(', ')}; rerun the build`);
      process.exit(1);
    }
  } else {
    writeFileSync(PACKAGES_FILE, built.packages);
    writeFileSync(MANIFEST_FILE, built.manifest);
  }
}
