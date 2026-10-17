/**
 * Builds the ML Coding track's judge packages from content/ml-coding/<slug>/: statement.{zh,en}.md,
 * starter.py, solution.py and gen.py, laid out as scripts/core-skills/build.ts's, in Python only:
 * each problem is "implement it with numpy". gen.py prints the test inputs as JSON
 * ({ samples, tests }) and solution.py's output is each answer. A fixed driver prints a count and
 * then that many numbers in %.6f, judged by the float-array checker (lib/oj-finite-floats.mjs).
 * Runs on ML_PYTHON (default python3), which must import numpy: the judge's numpy comes with its
 * pandas (deploy/oj/Dockerfile.pandas), so ml- problems stay hidden until the worker reports pandas.
 * Nothing draws from np.random: numpy 1.x (CI) and 2.x (the judge) need not agree on its streams,
 * so randomness is a given LCG, given indices or given initial centers. Answers can differ in the
 * last printed digit between numpy versions, so --check compares them as the judge does.
 *
 *   node --import tsx scripts/ml-coding/build.ts          # write the files (left alone when within tolerance)
 *   node --import tsx scripts/ml-coding/build.ts --check  # fail on drift
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { matchesFiniteFloats, parseFiniteFloats } from '../../lib/oj-finite-floats.mjs';
import type { OjProblemPackage } from '../../lib/oj-types';
import { driverOf, exec, parseStatement } from '../core-skills/build';

export const CONTENT_DIR = 'content/ml-coding';
export const PACKAGES_FILE = `${CONTENT_DIR}/packages.json`;
export const MANIFEST_FILE = 'lib/content/ml-coding.json';
export const PYTHON = process.env.ML_PYTHON || 'python3';

export const GROUPS = [
  { key: 'metrics', zh: '评估指标', en: 'Evaluation metrics' },
  { key: 'models', zh: '经典模型', en: 'Classic models' },
  { key: 'deep', zh: '深度学习基础', en: 'Deep learning building blocks' },
  { key: 'stats', zh: '统计与特征', en: 'Statistics & features' },
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
    slug: 'confusion-metrics',
    group: 'metrics',
    difficulty: '简单',
    summary: { zh: '多分类混淆矩阵、逐类 P/R/F1、宏平均与准确率', en: 'A multiclass confusion matrix, per-class P/R/F1, macro-F1 and accuracy' },
  },
  {
    slug: 'roc-auc',
    group: 'metrics',
    difficulty: '中等',
    summary: { zh: '用秩公式算 AUC，并列分数取平均秩', en: 'AUC from the rank formula, tied scores sharing an average rank' },
  },
  {
    slug: 'log-loss',
    group: 'metrics',
    difficulty: '简单',
    summary: { zh: '截断概率后的多分类交叉熵', en: 'Multiclass cross-entropy on clipped probabilities' },
  },
  {
    slug: 'knn',
    group: 'models',
    difficulty: '简单',
    summary: { zh: '平方欧氏距离、按下标打破平局的多数投票', en: 'Squared Euclidean distance and a majority vote with fixed tie-breaks' },
  },
  {
    slug: 'kmeans',
    group: 'models',
    difficulty: '中等',
    summary: { zh: '给定初始中心的 Lloyd 迭代，空簇保留原中心', en: "Lloyd's iterations from given centers; an empty cluster keeps its center" },
  },
  {
    slug: 'linear-regression',
    group: 'models',
    difficulty: '中等',
    summary: { zh: '岭回归闭式解，截距不加惩罚', en: 'Ridge regression in closed form, with an unpenalized intercept' },
  },
  {
    slug: 'logistic-regression',
    group: 'models',
    difficulty: '中等',
    summary: { zh: '批量梯度下降加 L2 正则', en: 'Batch gradient descent with L2 regularization' },
  },
  {
    slug: 'gini-split',
    group: 'models',
    difficulty: '中等',
    summary: { zh: '决策树桩：枚举中点阈值，找加权 Gini 最小的切分', en: 'A decision stump: the midpoint split with the lowest weighted Gini' },
  },
  {
    slug: 'softmax',
    group: 'deep',
    difficulty: '简单',
    summary: { zh: '减去行最大值的 softmax 与 log-softmax', en: 'Softmax and log-softmax, shifted by the row maximum' },
  },
  {
    slug: 'causal-attention',
    group: 'deep',
    difficulty: '中等',
    summary: { zh: '缩放点积注意力与因果掩码', en: 'Scaled dot-product attention with a causal mask' },
  },
  {
    slug: 'conv2d-maxpool',
    group: 'deep',
    difficulty: '中等',
    summary: { zh: '步长、零填充、ReLU 与 2×2 最大池化', en: 'Stride, zero padding, ReLU and 2×2 max pooling' },
  },
  {
    slug: 'tfidf-cosine',
    group: 'stats',
    difficulty: '中等',
    summary: { zh: '平滑 IDF、L2 归一化与余弦相似度', en: 'Smoothed IDF, L2 normalization and cosine similarity' },
  },
  {
    slug: 'bootstrap-ci',
    group: 'stats',
    difficulty: '中等',
    summary: { zh: '用给定 LCG 重抽样，求均值的百分位置信区间', en: 'Resampling with a given LCG for a percentile interval of the mean' },
  },
  {
    slug: 'ewma',
    group: 'stats',
    difficulty: '简单',
    summary: { zh: '递推 EWMA 与偏差修正', en: 'The recursive EWMA and its bias correction' },
  },
  {
    slug: 'pca',
    group: 'stats',
    difficulty: '困难',
    summary: { zh: '协方差特征分解、方差解释比例与符号约定', en: 'Covariance eigendecomposition, explained variance and a sign convention' },
  },
];

/** A driver's output: a count, then that many numbers, each printed with %.6f. */
const FIXED = /^-?\d+\.\d{6}$/;
const IMPORTS = ['numpy', 'math', 'sys'];

function python(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-ml-'));
  writeFileSync(join(dir, 'main.py'), source);
  return {
    run: (input: string) => exec(PYTHON, ['-I', 'main.py'], dir, input),
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Starters and solutions import numpy, math and sys only, and never draw from np.random. */
function checkSource(source: string, where: string) {
  for (const [, module] of source.matchAll(/^\s*(?:import|from)\s+([A-Za-z_]\w*)/gm))
    if (!IMPORTS.includes(module)) throw new Error(`${where} imports ${module}: only ${IMPORTS.join(', ')}`);
  if (/\b(?:np|numpy)\.random\b/.test(source)) throw new Error(`${where} uses np.random`);
}

/** What the float-array checker accepts as an answer, minus -1: it is the checker's exact-match sentinel. */
function checkAnswer(output: string, where: string) {
  const tokens = output.trim().split(/\s+/);
  const values = parseFiniteFloats(output, true);
  if (!values || !tokens.slice(1).every((token) => FIXED.test(token)))
    throw new Error(`${where}: the driver must print a count and then %.6f numbers`);
  if (values.includes(-1)) throw new Error(`${where}: -1.000000 is the float-array sentinel; change the data`);
}

export function buildMlCoding() {
  const report: string[] = [];
  const packages = PROBLEMS.map(({ slug, group, difficulty }): OjProblemPackage => {
    const dir = join(CONTENT_DIR, slug);
    const read = (name: string) => readFileSync(join(dir, name), 'utf8');
    const zh = parseStatement(read('statement.zh.md'), `${slug} zh`);
    const en = parseStatement(read('statement.en.md'), `${slug} en`);
    const starter = read('starter.py');
    const solution = read('solution.py');
    checkSource(starter, `${slug} starter.py`);
    checkSource(solution, `${slug} solution.py`);
    if (driverOf(starter, `${slug} starter.py`) !== driverOf(solution, slug))
      throw new Error(`${slug}: solution.py must keep the starter's driver unchanged`);

    const generated = exec(PYTHON, ['-I', 'gen.py'], dir);
    if (!generated.ok) throw new Error(`${slug}: gen.py failed\n${generated.stderr}`);
    const { samples, tests } = JSON.parse(generated.stdout) as { samples: string[]; tests: string[] };
    const inputs = [...samples, ...tests];

    const reference = python(solution);
    let ms = 0;
    const expected = inputs.map((input, k) => {
      const result = reference.run(input);
      if (!result.ok) throw new Error(`${slug} test ${k + 1}: reference failed\n${result.stderr}`);
      checkAnswer(result.stdout, `${slug} test ${k + 1}`);
      ms = Math.max(ms, result.ms);
      return result.stdout;
    });
    reference.close();
    const shipped = python(starter);
    try {
      const result = shipped.run(samples[0]);
      if (matchesFiniteFloats(result.stdout, expected[0], true)) throw new Error(`${slug} starter.py already passes the sample`);
    } finally {
      shipped.close();
    }
    report.push(`ml-${slug}: ${inputs.length} tests, slowest ${ms}ms`);

    return {
      schemaVersion: 1,
      problem: {
        id: `ml-${slug}`,
        courseId: 'gomall',
        lessonId: '00-overview',
        title: zh.title,
        difficulty,
        translations: { en },
        tags: ['ML Coding', GROUPS.find((item) => item.key === group)!.zh],
        description: zh.description,
        input: zh.input,
        output: zh.output,
        explanation: zh.explanation,
        hints: zh.hints,
        timeLimit: 2,
        memoryLimit: 262144,
        outputLimit: 8192,
        checker: 'float-array',
        languages: ['python'],
        starters: { python: starter },
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
      ids: PROBLEMS.filter((problem) => problem.group === key).map((problem) => `ml-${problem.slug}`),
    })),
    problems: PROBLEMS.map(({ slug, difficulty, summary }, k) => ({
      id: `ml-${slug}`,
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

/** Built packages equal to the committed ones, answers compared as the judge compares them. */
export function samePackages(built: string, committed: string) {
  const ours = JSON.parse(built) as OjProblemPackage[];
  const theirs = JSON.parse(committed) as OjProblemPackage[];
  if (ours.length !== theirs.length) return false;
  ours.forEach((pkg, i) =>
    pkg.cases.forEach((c, k) => {
      const other = theirs[i].cases[k]?.expectedOutput;
      if (other !== undefined && matchesFiniteFloats(c.expectedOutput, other, true)) c.expectedOutput = other;
    }),
  );
  return JSON.stringify(ours) === JSON.stringify(theirs);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const built = buildMlCoding();
  console.log(built.report.join('\n'));
  const committed = (file: string) => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  };
  const packagesDrift = !committed(PACKAGES_FILE) || !samePackages(built.packages, committed(PACKAGES_FILE));
  const manifestDrift = committed(MANIFEST_FILE) !== built.manifest;
  if (process.argv.includes('--check')) {
    const drift = [packagesDrift && PACKAGES_FILE, manifestDrift && MANIFEST_FILE].filter(Boolean);
    if (drift.length) {
      console.error(`out of date: ${drift.join(', ')}; rerun the build`);
      process.exit(1);
    }
  } else {
    if (packagesDrift) writeFileSync(PACKAGES_FILE, built.packages);
    if (manifestDrift) writeFileSync(MANIFEST_FILE, built.manifest);
  }
}
