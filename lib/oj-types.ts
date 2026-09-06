import { z } from 'zod';
import type { Language, Problem } from './problems';

/** Resource units match the judge protocol: seconds for CPU and KiB for sizes. */
export type OjProblemSpec = Omit<Problem, 'id' | 'sampleIn' | 'sampleOut'> & {
  id: string;
  courseId: string;
  outputLimit: number;
  checker: 'tokens' | 'exact' | 'int-set' | 'string-set' | 'int-multiset';
  languages: Language[];
};

export type OjImportedCase = {
  name: string;
  input: string;
  expectedOutput: string;
  hidden: boolean;
  weight: number;
};

/** Declarative data only. Imports never accept executables, shell commands or checkers. */
export type OjProblemPackage = {
  schemaVersion: 1;
  problem: OjProblemSpec;
  cases: OjImportedCase[];
};

export type OjPublicProblem = Problem & {
  courseId: string;
  versionId: string;
  version: number;
  checksum: string;
  outputLimit: number;
  checker: OjProblemSpec['checker'];
  languages: Language[];
  samples: { name: string; input: string; expectedOutput: string }[];
  caseCount: number;
  totalWeight: number;
};

export type OjJudgeCase = OjImportedCase & { id: string; ordinal: number };
export type OjJudgeSnapshot = {
  problemId: string;
  versionId: string;
  revision: number;
  checksum: string;
  spec: OjProblemSpec;
  cases: OjJudgeCase[];
};

export type OjProblemVersion = {
  id: string;
  revision: number;
  checksum: string;
  createdAt: number;
  createdBy: string;
  caseCount: number;
  hiddenCount: number;
  totalWeight: number;
};

export type OjTeacherProblem = {
  id: string;
  courseId: string;
  lessonId: string;
  published: boolean;
  currentVersionId: string | null;
  title: string;
  updatedAt: number;
  draft: {
    revision: number;
    updatedAt: number;
    payload: OjProblemPackage;
    hasChanges: boolean;
  } | null;
  publishedPayload: OjProblemPackage | null;
  versions: OjProblemVersion[];
};

export const OJ_MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const OJ_MAX_CASE_BYTES = 4 * 1024 * 1024;
export const OJ_MAX_CASES = 64;
/** Fixed, non-executable counted-set protocol shared by import and judging. */
export const OJ_MAX_SET_ITEMS = 1_000_000;
function parseCountedValues(
  output: string,
  checker: 'int-set' | 'string-set',
): string[] | null {
  if (
    output.includes('\0') ||
    // Unicode mode matches lone surrogates, while valid pairs (emoji) stay intact.
    // Reject before TextEncoder can silently replace an invalid code point.
    /[\uD800-\uDFFF]/u.test(output) ||
    new TextEncoder().encode(output).byteLength > OJ_MAX_CASE_BYTES
  )
    return null;
  const normalized = output.replace(/\r\n/g, '\n');
  const newline = normalized.indexOf('\n');
  if (newline < 0) return null;
  const header = normalized.slice(0, newline);
  if (!/^(0|[1-9][0-9]{0,6})$/.test(header)) return null;
  const count = Number(header);
  if (count > OJ_MAX_SET_ITEMS) return null;
  const body = normalized.slice(newline + 1);
  let values: string[];
  if (checker === 'int-set') {
    values = body.split(/[\t\n\v\f\r ]+/).filter(Boolean);
    if (values.length !== count) return null;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!/^[+-]?[0-9]+$/.test(value)) return null;
      // Decimal normalization avoids Number rounding and expensive huge BigInts.
      const negative = value[0] === '-';
      const digits = value.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
      values[i] = negative && digits !== '0' ? '-' + digits : digits;
    }
  } else if (checker === 'string-set') {
    if (!normalized.endsWith('\n') || body.includes('\r')) return null;
    // Remove precisely one record terminator; preserve empty string elements.
    values = body === '' ? [] : body.slice(0, -1).split('\n');
    if (values.length !== count) return null;
  } else {
    return null;
  }
  return values;
}

export function parseOjSetOutput(
  output: string,
  checker: 'int-set' | 'string-set',
): ReadonlySet<string> | null {
  const values = parseCountedValues(output, checker);
  if (values === null) return null;
  const unique = new Set(values);
  return unique.size === values.length ? unique : null;
}
export function parseOjMultisetOutput(
  output: string,
): ReadonlyMap<string, number> | null {
  const values = parseCountedValues(output, 'int-set');
  if (values === null) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const limitedText = (length: number) => z.string().min(1).max(length);
const testcase = z
  .object({
    name: z.string().trim().min(1).max(100),
    input: z.string().max(OJ_MAX_CASE_BYTES),
    expectedOutput: z.string().max(OJ_MAX_CASE_BYTES),
    hidden: z.boolean(),
    weight: z.number().int().min(1).max(100),
  })
  .strict();

/** Strict and versioned on purpose: executable checkers and runner flags are never data. */
export const ojImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    problem: z
      .object({
        id: identifier,
        courseId: identifier,
        lessonId: identifier,
        title: z.string().trim().min(1).max(180),
        difficulty: z.enum(['简单', '中等', '困难']),
        translations: z
          .object({
            en: z
              .object({
                title: z.string().trim().min(1).max(180),
                description: limitedText(60000),
                input: limitedText(12000),
                output: limitedText(12000),
                explanation: z.string().max(12000),
                hints: z.array(limitedText(2000)).max(10),
              })
              .strict()
              .optional(),
          })
          .strict()
          .optional(),
        tags: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
        description: limitedText(60000),
        input: limitedText(12000),
        output: limitedText(12000),
        explanation: z.string().max(12000),
        hints: z.array(limitedText(2000)).max(10),
        timeLimit: z.number().min(0.1).max(10),
        memoryLimit: z.number().int().min(16384).max(524288),
        outputLimit: z.number().int().min(1).max(4096),
        checker: z.enum([
          'tokens',
          'exact',
          'int-set',
          'string-set',
          'int-multiset',
        ]),
        languages: z
          .array(z.enum(['python', 'go', 'java', 'cpp']))
          .min(1)
          .max(4),
      })
      .strict(),
    cases: z.array(testcase).min(2).max(OJ_MAX_CASES),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.cases.some((c) => !c.hidden))
      ctx.addIssue({
        code: 'custom',
        message: '至少需要一个公开样例',
        path: ['cases'],
      });
    if (!data.cases.some((c) => c.hidden))
      ctx.addIssue({
        code: 'custom',
        message: '至少需要一个隐藏测试点',
        path: ['cases'],
      });
    if (data.cases.filter((c) => !c.hidden).length > 8)
      ctx.addIssue({
        code: 'custom',
        message: '公开样例最多 8 个',
        path: ['cases'],
      });
    if (new Set(data.problem.languages).size !== data.problem.languages.length)
      ctx.addIssue({
        code: 'custom',
        message: '语言不能重复',
        path: ['problem', 'languages'],
      });
    if (new Set(data.cases.map((c) => c.name)).size !== data.cases.length)
      ctx.addIssue({
        code: 'custom',
        message: '测试点名称不能重复',
        path: ['cases'],
      });
    for (const [index, c] of data.cases.entries()) {
      if (
        data.problem.checker === 'int-multiset' &&
        parseOjMultisetOutput(c.expectedOutput) === null
      )
        ctx.addIssue({
          code: 'custom',
          message: '多重集合预期输出格式无效：数量与各值的出现次数必须正确',
          path: ['cases', index, 'expectedOutput'],
        });
      if (
        (data.problem.checker === 'int-set' ||
          data.problem.checker === 'string-set') &&
        parseOjSetOutput(c.expectedOutput, data.problem.checker) === null
      )
        ctx.addIssue({
          code: 'custom',
          message: '集合预期输出格式无效：请检查首行数量、重复项及行格式',
          path: ['cases', index, 'expectedOutput'],
        });
      for (const key of ['input', 'expectedOutput'] as const) {
        if (
          new TextEncoder().encode(c[key]).byteLength > OJ_MAX_CASE_BYTES ||
          c[key].includes('\0')
        )
          ctx.addIssue({
            code: 'custom',
            message: '测试数据超过大小限制或含空字符',
            path: ['cases', index, key],
          });
      }
      if (
        new TextEncoder().encode(c.expectedOutput).byteLength >
        data.problem.outputLimit * 1024
      )
        ctx.addIssue({
          code: 'custom',
          message: '预期输出超过题目输出限制',
          path: ['cases', index, 'expectedOutput'],
        });
      if (
        !c.hidden &&
        (new TextEncoder().encode(c.input).byteLength > 32768 ||
          new TextEncoder().encode(c.expectedOutput).byteLength > 32768)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            '公开样例输入与输出分别最多 32 KiB，请将大数据设为隐藏测试点',
          path: ['cases', index],
        });
    }
  });
