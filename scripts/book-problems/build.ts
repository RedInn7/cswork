/**
 * Builds the book problems' judge packages: the 剑指 Offer / 程序员面试金典 rows of
 * lib/content/classic-lists.json that have no LeetCode twin and carry a `judge` id.
 * Each content/book-problems/<id>/ holds CSWork's own statement (statement.zh.md,
 * statement.en.md) and problem.py (reference, case generator, common mistakes), run
 * by run.py on the local python3; the build fails if a mistake survives every hidden
 * case or a package fails the import schema.
 *
 *   node --import tsx scripts/book-problems/build.ts          # write the file
 *   node --import tsx scripts/book-problems/build.ts --check  # fail on drift
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classicLists } from '../../lib/classic-lists';
import { ojImportSchema, type OjProblemPackage } from '../../lib/oj-types';

export const ROOT = 'content/book-problems';
export const PACKAGES_FILE = `${ROOT}/packages.json`;

/** Every judged book row in list order, with the book it cites. */
export function bookJudges() {
  return classicLists.flatMap((list) =>
    list.refLabel
      ? list.groups.flatMap((group) =>
          (group.refs ?? []).flatMap(({ ref, judge }) => (judge ? [{ id: judge, ref, list }] : [])),
        )
      : [],
  );
}

/** A statement file: "# title", the description, then input, output, sample notes and "- " hints. */
export function parseStatement(text: string) {
  const [head, input, output, explanation, hints, ...rest] = text.split(/^## .*$/m).map((part) => part.trim());
  const title = /^# (.+)$/m.exec(head)?.[1].trim();
  if (!title || hints === undefined || rest.length) throw new Error('want "# title" and four "## " sections');
  return {
    title,
    description: head.replace(/^# .+$/m, '').trim(),
    input,
    output,
    explanation,
    hints: hints.split('\n').flatMap((line) => (line.startsWith('- ') ? [line.slice(2).trim()] : [])),
  };
}

type Run = {
  level: '简单' | '中等' | '困难';
  tags: string[];
  checker: 'tokens' | 'float-array';
  samples: number;
  inputs: string[];
  expected: string[];
  kills: Record<string, number>;
  slowest: number;
};

export function buildBookProblems() {
  const report: string[] = [];
  const judges = bookJudges();
  const folders = readdirSync(ROOT).filter((name) => existsSync(join(ROOT, name, 'problem.py')));
  const stray = folders.filter((name) => !judges.some((judge) => judge.id === name));
  if (stray.length) throw new Error(`no classic list row judges ${stray.join(', ')}`);
  const packages = judges.map(({ id, ref, list }): OjProblemPackage => {
    const folder = join(ROOT, id);
    const result = spawnSync('python3', ['-I', '-S', 'scripts/book-problems/run.py', folder], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 300_000,
    });
    if (result.status !== 0) throw new Error(`${id}: ${result.stderr || result.error}`);
    const run = JSON.parse(result.stdout) as Run;
    // ponytail: a local CPU budget for the reference; the judge gives every language 3s.
    if (run.slowest > 1.5) throw new Error(`${id}: the reference takes ${run.slowest}s on one case`);
    report.push(`${id} cases ${run.inputs.length} slowest ${run.slowest}s wrong-killed-on ${Object.values(run.kills).join('/')}`);
    const book = { zh: `《${list.nameZh}》${list.refLabel!.zh} ${ref}`, en: `${list.nameEn}, ${list.refLabel!.en} ${ref}` };
    const [zh, en] = (['zh', 'en'] as const).map((locale) => {
      const statement = parseStatement(readFileSync(join(folder, `statement.${locale}.md`), 'utf8'));
      statement.description +=
        locale === 'zh'
          ? `\n\n出处：${book.zh}。题面、样例和测试数据由 CSWork 重新编写。`
          : `\n\nSource: ${book.en}. Statement, examples and tests written by CSWork.`;
      return statement;
    });
    const payload: OjProblemPackage = {
      schemaVersion: 1,
      problem: {
        id,
        courseId: 'gomall',
        lessonId: '00-overview',
        ...zh,
        difficulty: run.level,
        translations: { en },
        tags: [list.slug === 'sword-offer' ? '剑指 Offer' : '面试金典', ...run.tags],
        timeLimit: 3,
        memoryLimit: 262144,
        outputLimit: 4096,
        checker: run.checker,
        languages: ['python', 'cpp', 'java', 'go'],
      },
      cases: run.inputs.map((input, k) => ({
        name: k < run.samples ? `样例 ${k + 1}` : `测试 ${k + 1 - run.samples}`,
        input,
        expectedOutput: run.expected[k],
        hidden: k >= run.samples,
        weight: 1,
      })),
    };
    const parsed = ojImportSchema.safeParse(payload);
    if (!parsed.success) throw new Error(`${id}: ${parsed.error.message}`);
    return payload;
  });
  return { packages: JSON.stringify(packages) + '\n', report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const built = buildBookProblems();
  console.log(built.report.join('\n'));
  if (process.argv.includes('--check')) {
    if (readFileSync(PACKAGES_FILE, 'utf8') !== built.packages) {
      console.error(`out of date: ${PACKAGES_FILE}; rerun the build`);
      process.exit(1);
    }
  } else writeFileSync(PACKAGES_FILE, built.packages);
}
