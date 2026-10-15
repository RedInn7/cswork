/**
 * Builds the Core Skills track's judge packages from content/core-skills/<slug>/:
 * statement.{zh,en}.md, starter.{py,cpp,java,go}, solution.{py,cpp,java,go} and gen.py.
 * gen.py prints the test inputs as JSON ({ samples, tests }) and solution.py's output is
 * each test's answer. Every starter is a skeleton above a fixed driver; each solution keeps
 * that driver word for word, must reproduce every answer in its language, and every starter
 * must compile as shipped yet fail the sample. Local toolchains stand in for go-judge:
 * python3, $CXX or g++ (C++20), javac --release 21 and go with -lang=go1.24.
 *
 *   node --import tsx scripts/core-skills/build.ts          # write the files
 *   node --import tsx scripts/core-skills/build.ts --check  # fail on drift
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CodeLanguage } from '../../lib/problems';
import type { OjProblemPackage } from '../../lib/oj-types';

export const CONTENT_DIR = 'content/core-skills';
export const PACKAGES_FILE = `${CONTENT_DIR}/packages.json`;
export const MANIFEST_FILE = 'lib/content/core-skills.json';
/** The line every starter and solution carries once; the driver below it is fixed. */
export const DRIVER_MARK = '—— 以下驱动代码请勿修改';

export const GROUPS = [
  { key: 'linear', zh: '线性结构', en: 'Linear structures' },
  { key: 'hash-heap', zh: '哈希与堆', en: 'Hashing & heaps' },
  { key: 'sort-search', zh: '排序与查找', en: 'Sorting & searching' },
  { key: 'graph', zh: '图', en: 'Graphs' },
  { key: 'advanced', zh: '高级结构', en: 'Advanced structures' },
] as const;

type Problem = {
  slug: string;
  group: (typeof GROUPS)[number]['key'];
  difficulty: '简单' | '中等' | '困难';
  summary: { zh: string; en: string };
};

/** Package order: by group, then as listed. A new problem joins its group's end. */
export const PROBLEMS: Problem[] = [
  {
    slug: 'dynamic-array',
    group: 'linear',
    difficulty: '简单',
    summary: { zh: '定长存储上的扩容与缩容', en: 'Growing and shrinking on fixed-size storage' },
  },
  {
    slug: 'linked-list',
    group: 'linear',
    difficulty: '简单',
    summary: { zh: '头尾指针、插入删除与原地反转', en: 'Head and tail pointers, insert, remove and reverse in place' },
  },
  {
    slug: 'deque',
    group: 'linear',
    difficulty: '中等',
    summary: { zh: '环形缓冲区上的两端进出与随机访问', en: 'Both ends and random access on a ring buffer' },
  },
];

const EXT: Record<CodeLanguage, string> = { python: 'py', cpp: 'cpp', java: 'java', go: 'go' };
const SOURCE: Record<CodeLanguage, string> = { python: 'main.py', cpp: 'main.cpp', java: 'Main.java', go: 'main.go' };
const LANGUAGES = ['python', 'go', 'java', 'cpp'] as const;

type Run = { ok: boolean; stdout: string; stderr: string; ms: number };
function exec(command: string, args: string[], cwd: string, input = ''): Run {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, GOTOOLCHAIN: 'local', GOFLAGS: '', GO111MODULE: 'off', CGO_ENABLED: '0' },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr || (result.error ? String(result.error) : ''),
    ms: Date.now() - started,
  };
}

/** One program built in its own directory: run() feeds it a test, close() removes it. */
function compile(language: CodeLanguage, source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-core-'));
  writeFileSync(join(dir, SOURCE[language]), source);
  const built =
    language === 'python'
      ? exec('python3', ['-m', 'py_compile', 'main.py'], dir)
      : language === 'cpp'
        ? exec(process.env.CXX || 'g++', ['-std=c++20', '-O2', '-o', 'main', 'main.cpp'], dir)
        : language === 'java'
          ? exec('javac', ['--release', '21', '-encoding', 'UTF-8', 'Main.java'], dir)
          : exec('go', ['build', '-gcflags=-lang=go1.24', '-o', 'main', 'main.go'], dir);
  const [command, args] =
    language === 'python'
      ? ['python3', ['-I', 'main.py']]
      : language === 'java'
        ? ['java', ['-Xss64m', '-cp', '.', 'Main']]
        : [join(dir, 'main'), []];
  return {
    built,
    run: (input: string) => exec(command as string, args as string[], dir, input),
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** `# Title`, the description, then four `## ` sections: input, output, explanation, hints. */
export function parseStatement(text: string, where: string) {
  const parts = text.replace(/\r\n/g, '\n').split(/^## .*$/m);
  const title = /^# (.+)\n/.exec(parts[0] ?? '')?.[1]?.trim();
  if (parts.length !== 5 || !title) throw new Error(`${where}: needs # title and 4 ## sections`);
  // Input, explanation and hints render as plain text; description and output are Markdown.
  const plain = (value: string) => value.trim().replaceAll('`', '');
  const hints = parts[4]
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => plain(line.slice(2)));
  return {
    title,
    description: parts[0].slice(parts[0].indexOf('\n') + 1).trim(),
    input: plain(parts[1]),
    output: parts[2].trim(),
    explanation: plain(parts[3]),
    hints,
  };
}

const driverOf = (source: string, where: string) => {
  const lines = source.split('\n');
  const at = lines.findIndex((line) => line.includes(DRIVER_MARK));
  if (at < 0 || lines.findLastIndex((line) => line.includes(DRIVER_MARK)) !== at)
    throw new Error(`${where}: needs exactly one driver line (${DRIVER_MARK})`);
  return lines.slice(at).join('\n');
};

export function buildCoreSkills() {
  const report: string[] = [];
  const packages = PROBLEMS.map(({ slug, group, difficulty }): OjProblemPackage => {
    const dir = join(CONTENT_DIR, slug);
    const read = (name: string) => readFileSync(join(dir, name), 'utf8');
    const zh = parseStatement(read('statement.zh.md'), `${slug} zh`);
    const en = parseStatement(read('statement.en.md'), `${slug} en`);
    const starters = Object.fromEntries(LANGUAGES.map((l) => [l, read(`starter.${EXT[l]}`)])) as Record<
      CodeLanguage,
      string
    >;
    const solutions = Object.fromEntries(LANGUAGES.map((l) => [l, read(`solution.${EXT[l]}`)])) as Record<
      CodeLanguage,
      string
    >;
    for (const language of LANGUAGES)
      if (driverOf(starters[language], `${slug} starter.${EXT[language]}`) !== driverOf(solutions[language], slug))
        throw new Error(`${slug}: solution.${EXT[language]} must keep the starter's driver unchanged`);

    const generated = exec('python3', ['-I', 'gen.py'], dir);
    if (!generated.ok) throw new Error(`${slug}: gen.py failed\n${generated.stderr}`);
    const { samples, tests } = JSON.parse(generated.stdout) as { samples: string[]; tests: string[] };
    const inputs = [...samples, ...tests];

    const reference = compile('python', solutions.python);
    const expected = inputs.map((input, k) => {
      const result = reference.run(input);
      if (!result.ok || !result.stdout.trim()) throw new Error(`${slug} test ${k + 1}: reference failed\n${result.stderr}`);
      return result.stdout;
    });
    reference.close();
    const slowest: string[] = [];
    for (const language of LANGUAGES) {
      const solution = compile(language, solutions[language]);
      try {
        if (!solution.built.ok) throw new Error(`${slug} solution.${EXT[language]} does not compile\n${solution.built.stderr}`);
        let ms = 0;
        inputs.forEach((input, k) => {
          const result = solution.run(input);
          if (result.stdout !== expected[k])
            throw new Error(`${slug} solution.${EXT[language]} disagrees on test ${k + 1}\n${result.stderr}`);
          ms = Math.max(ms, result.ms);
        });
        slowest.push(`${language} ${ms}ms`);
      } finally {
        solution.close();
      }
      const starter = compile(language, starters[language]);
      try {
        if (!starter.built.ok) throw new Error(`${slug} starter.${EXT[language]} does not compile\n${starter.built.stderr}`);
        if (starter.run(samples[0]).stdout === expected[0])
          throw new Error(`${slug} starter.${EXT[language]} already passes the sample`);
      } finally {
        starter.close();
      }
    }
    report.push(`core-${slug}: ${inputs.length} tests, slowest ${slowest.join(', ')}`);

    const groupName = GROUPS.find((item) => item.key === group)!.zh;
    return {
      schemaVersion: 1,
      problem: {
        id: `core-${slug}`,
        courseId: 'gomall',
        lessonId: '00-overview',
        title: zh.title,
        difficulty,
        translations: { en },
        tags: ['Core Skills', groupName],
        description: zh.description,
        input: zh.input,
        output: zh.output,
        explanation: zh.explanation,
        hints: zh.hints,
        timeLimit: 2,
        memoryLimit: 262144,
        outputLimit: 8192,
        checker: 'tokens',
        languages: [...LANGUAGES],
        starters,
      },
      cases: inputs.map((input, k) => ({
        name: k < samples.length ? `样例 ${k + 1}` : `测试 ${k + 1 - samples.length}`,
        input,
        expectedOutput: expected[k],
        hidden: k >= samples.length,
        weight: 1,
      })),
    };
  });
  const manifest = {
    groups: GROUPS.map(({ key, zh, en }) => ({
      key,
      zh,
      en,
      ids: PROBLEMS.filter((problem) => problem.group === key).map((problem) => `core-${problem.slug}`),
    })),
    problems: PROBLEMS.map(({ slug, difficulty, summary }, k) => ({
      id: `core-${slug}`,
      titleZh: packages[k].problem.title,
      titleEn: packages[k].problem.translations!.en!.title,
      difficulty,
      summaryZh: summary.zh,
      summaryEn: summary.en,
    })),
  };
  return {
    packages: JSON.stringify(packages, null, 1) + '\n',
    manifest: JSON.stringify(manifest, null, 2) + '\n',
    report,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const built = buildCoreSkills();
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
