import {
  COMPLEX_DESIGN_CHECKERS,
  complexDesignCheckerId,
  type ComplexDesignChecker,
} from './oj-complex-contract';
import { matchesComplexDesign } from './oj-complex-design-checkers';
import { parseFiniteFloats } from './oj-float-checkers';
import { matchesFractionDecimal } from './oj-fraction-checker';
import {
  STRING_STRUCTURE_CHECKERS,
  stringStructureCheckerId,
  type StringStructureChecker,
} from './oj-string-contract';
import { parseStringStructure } from './oj-string-structures';
import {
  validSpecialIdentity,
  validAuxiliaryIdentity,
} from './oj-special-contract';
import {
  SEMANTIC_CHECKERS,
  semanticCheckerId,
  type SemanticChecker,
} from './oj-semantic-contract';
import { matchesSemantic } from './oj-semantic-checkers';
import { z } from 'zod';
import { codeiumSequence } from './oa-codeium-sequence-checker.mjs';
import { morganBricks } from './oa-morgan-bricks-checker.mjs';
import { zalandoBlocks } from './oa-zalando-blocks-checker.mjs';
import {
  asciiTokens,
  parseIntegerRowCollection,
  type IntegerRowChecker,
} from './oj-result-shapes';
import type { Language, Problem } from './problems';
import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
  OJ_MAX_CASES,
  OJ_MAX_PUBLIC_CASE_BYTES,
} from './oj-data-budgets.mjs';
export {
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
  OJ_MAX_CASES,
} from './oj-data-budgets.mjs';

/** Resource units match the judge protocol: seconds for CPU and KiB for sizes. */
export type OjProblemSpec = Omit<Problem, 'id' | 'sampleIn' | 'sampleOut'> & {
  id: string;
  courseId: string;
  outputLimit: number;
  checker:
    | 'oa-closest-pair'
    | 'oa-peak-index'
    | 'oa-window-averages'
    | 'oa-balanced-circle'
    | 'oa-magic-square'
    | 'oa-newspaper'
    | 'oa-quadratic-minimum'
    | 'oa-compatible-groups'
    | 'oa-football-top-two'
    | 'oa-regional-maxima'
    | 'oa-optimal-loads'
    | 'oa-optimal-distinct'
    | 'oa-dictionary-path'
    | 'oa-ipv4-cidr'
    | 'oa-json-diff'
    | 'oa-longest-palindrome'
    | 'oa-piecewise-linear'
    | 'oa-k-level-permutation'
    | 'oa-tree-max-path'
    | 'oa-codeium-sequence'
    | 'oa-morgan-bricks'
    | 'oa-wayfair-bricks'
    | 'oa-zalando-blocks'
    | 'float'
    | 'float-array'
    | 'fraction-lc-166'
    | 'tokens'
    | 'exact'
    | 'int-set'
    | 'string-set'
    | 'int-multiset'
    | 'int-row-set'
    | 'int-bag-row-set'
    | 'int-row-multiset'
    | SemanticChecker
    | StringStructureChecker
    | ComplexDesignChecker;
  semanticId?: number;
  specialId?: number;
  auxiliaryId?: number;
  complexDesignId?: number;
  stringStructureId?: number;
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

/** Fixed, non-executable counted-set protocol shared by import and judging. */
export const OJ_MAX_SET_ITEMS = 1_000_000;
function parseCountedValues(
  output: string,
  checker: 'int-set' | 'string-set',
): ReadonlyMap<string, number> | null {
  if (
    output.includes('\0') ||
    /[\uD800-\uDFFF]/u.test(output) ||
    new TextEncoder().encode(output).byteLength > OJ_MAX_EXPECTED_BYTES
  )
    return null;
  const normalized = output.replace(/\r\n/g, '\n');
  const newline = normalized.indexOf('\n');
  if (newline < 0) return null;
  const header = normalized.slice(0, newline);
  if (
    !/^(0|[1-9][0-9]{0,6})$/.test(header) ||
    Number(header) > OJ_MAX_SET_ITEMS
  )
    return null;
  const count = Number(header),
    values = new Map<string, number>();
  let seen = 0;
  const add = (value: string) => {
    seen++;
    if (seen > count) return false;
    values.set(value, (values.get(value) || 0) + 1);
    return true;
  };
  if (checker === 'int-set') {
    for (const token of asciiTokens(normalized.slice(newline + 1))) {
      if (!/^[+-]?[0-9]+$/.test(token)) return null;
      const digits = token.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
      if (!add(token.startsWith('-') && digits !== '0' ? '-' + digits : digits))
        return null;
    }
  } else {
    if (!normalized.endsWith('\n')) return null;
    let start = newline + 1;
    while (start < normalized.length) {
      const end = normalized.indexOf('\n', start);
      if (end < 0) return null;
      const value = normalized.slice(start, end);
      if (value.includes('\r') || !add(value)) return null;
      start = end + 1;
    }
  }
  return seen === count ? values : null;
}

export function parseOjSetOutput(
  output: string,
  checker: 'int-set' | 'string-set',
): ReadonlySet<string> | null {
  const values = parseCountedValues(output, checker);
  if (values === null) return null;
  for (const count of values.values()) if (count !== 1) return null;
  return new Set(values.keys());
}
export function parseOjMultisetOutput(
  output: string,
): ReadonlyMap<string, number> | null {
  return parseCountedValues(output, 'int-set');
}

const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const limitedText = (length: number) => z.string().min(1).max(length);
const testcase = z
  .object({
    name: z.string().trim().min(1).max(100),
    input: z.string().max(OJ_MAX_CASE_BYTES),
    expectedOutput: z.string().max(OJ_MAX_EXPECTED_BYTES),
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
        outputLimit: z.number().int().min(1).max(65536),
        checker: z.enum([
          'oa-closest-pair',
          'oa-peak-index',
          'oa-window-averages',
          'oa-balanced-circle',
          'oa-magic-square',
          'oa-newspaper',
          'oa-quadratic-minimum',
          'oa-compatible-groups',
          'oa-football-top-two',
          'oa-regional-maxima',
          'oa-optimal-loads',
          'oa-optimal-distinct',
          'oa-dictionary-path',
          'oa-ipv4-cidr',
          'oa-json-diff',
          'oa-longest-palindrome',
          'oa-piecewise-linear',
          'oa-k-level-permutation',
          'oa-tree-max-path',
          'oa-codeium-sequence',
          'oa-morgan-bricks',
          'oa-wayfair-bricks',
          'oa-zalando-blocks',
          'float',
          'float-array',
          'fraction-lc-166',
          'tokens',
          'exact',
          'int-set',
          'string-set',
          'int-multiset',
          'int-row-set',
          'int-bag-row-set',
          'int-row-multiset',
          ...SEMANTIC_CHECKERS,
          ...STRING_STRUCTURE_CHECKERS,
          ...COMPLEX_DESIGN_CHECKERS,
        ]),
        semanticId: z.number().int().optional(),
        specialId: z.number().int().optional(),
        auxiliaryId: z.number().int().optional(),
        complexDesignId: z.number().int().optional(),
        stringStructureId: z.number().int().optional(),
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
    if (
      (data.problem.checker === 'oa-closest-pair' &&
        data.problem.id !== 'oa-meta-16') ||
      (data.problem.checker === 'oa-peak-index' &&
        data.problem.id !== 'oa-meta-17') ||
      (data.problem.checker === 'oa-window-averages' &&
        data.problem.id !== 'oa-meta-23') ||
      (data.problem.checker === 'oa-balanced-circle' &&
        data.problem.id !== 'oa-microsoft-15') ||
      (data.problem.checker === 'oa-magic-square' &&
        data.problem.id !== 'oa-google-17') ||
      (data.problem.checker === 'oa-newspaper' &&
        data.problem.id !== 'oa-uber-6') ||
      (data.problem.checker === 'oa-quadratic-minimum' &&
        data.problem.id !== 'oa-uber-25') ||
      (data.problem.checker === 'oa-compatible-groups' &&
        data.problem.id !== 'oa-uber-34') ||
      (data.problem.checker === 'oa-football-top-two' &&
        data.problem.id !== 'oa-uber-38') ||
      (data.problem.checker === 'oa-regional-maxima' &&
        data.problem.id !== 'oa-uber-57') ||
      (data.problem.checker === 'oa-optimal-loads' &&
        data.problem.id !== 'oa-amazon-136') ||
      (data.problem.checker === 'oa-optimal-distinct' &&
        data.problem.id !== 'oa-microsoft-63') ||
      (data.problem.checker === 'oa-dictionary-path' &&
        data.problem.id !== 'oa-nvidia-7') ||
      (data.problem.checker === 'oa-ipv4-cidr' &&
        data.problem.id !== 'oa-openai-9') ||
      (data.problem.checker === 'oa-json-diff' &&
        data.problem.id !== 'oa-ibm-10') ||
      (data.problem.checker === 'oa-longest-palindrome' &&
        data.problem.id !== 'oa-cisco-29') ||
      (data.problem.checker === 'oa-piecewise-linear' &&
        data.problem.id !== 'oa-two-sigma-5') ||
      (data.problem.checker === 'oa-k-level-permutation' &&
        data.problem.id !== 'oa-amazon-151') ||
      (data.problem.checker === 'oa-tree-max-path' &&
        data.problem.id !== 'oa-uber-19') ||
      (data.problem.checker === 'oa-codeium-sequence' &&
        data.problem.id !== 'oa-codeium-1') ||
      (data.problem.checker === 'oa-morgan-bricks' &&
        data.problem.id !== 'oa-morgan-stanley-1') ||
      (data.problem.checker === 'oa-wayfair-bricks' &&
        data.problem.id !== 'oa-wayfair-3') ||
      (data.problem.checker === 'oa-zalando-blocks' &&
        data.problem.id !== 'oa-zalando-1')
    )
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'checker'],
        message: 'Invalid fixed OA checker identity',
      });
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
    if (!validSpecialIdentity(data.problem.specialId, data.problem.id))
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'specialId'],
        message: 'Invalid fixed node adapter identity',
      });
    if (!validAuxiliaryIdentity(data.problem.auxiliaryId, data.problem.id))
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'auxiliaryId'],
        message: 'Invalid auxiliary identity',
      });
    if (
      data.problem.checker === 'fraction-lc-166' &&
      data.problem.id !== 'lc-166'
    )
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'checker'],
        message: 'Invalid fraction identity',
      });
    const complexId = complexDesignCheckerId(data.problem.checker);
    if (
      (complexId !== null &&
        (data.problem.complexDesignId !== complexId ||
          data.problem.id !== `lc-${complexId}`)) ||
      (complexId === null && data.problem.complexDesignId !== undefined)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'checker'],
        message: 'Invalid fixed design binding',
      });
    const stringId = stringStructureCheckerId(data.problem.checker);
    if (
      (stringId !== null &&
        (data.problem.stringStructureId !== stringId ||
          data.problem.id !== `lc-${stringId}`)) ||
      (stringId === null && data.problem.stringStructureId !== undefined)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['problem', 'checker'],
        message: 'Invalid fixed string checker binding',
      });
    const semanticId = semanticCheckerId(data.problem.checker);
    if (
      (semanticId !== null &&
        (data.problem.semanticId !== semanticId ||
          data.problem.id !== `lc-${semanticId}`)) ||
      (semanticId === null && data.problem.semanticId !== undefined)
    )
      ctx.addIssue({
        code: 'custom',
        message: '语义判题器必须绑定对应题号',
        path: ['problem', 'checker'],
      });
    for (const [index, c] of data.cases.entries()) {
      if (
        data.problem.checker === 'oa-zalando-blocks' &&
        !zalandoBlocks(c.expectedOutput, undefined, c.input)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid Zalando blocks input or optimal expected output',
        });
      if (
        (data.problem.checker === 'oa-morgan-bricks' ||
          data.problem.checker === 'oa-wayfair-bricks') &&
        !morganBricks(c.expectedOutput, undefined, c.input)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid Morgan bricks ACM input or optimal expected output',
        });
      if (
        data.problem.checker === 'oa-codeium-sequence' &&
        !codeiumSequence(c.expectedOutput, undefined, c.input)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message:
            'Invalid Codeium sequence ACM input or optimal expected output',
        });
      if (
        complexId !== null &&
        !matchesComplexDesign(
          complexId,
          c.expectedOutput,
          c.expectedOutput,
          c.input,
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid design input or expected result',
        });
      if (
        (data.problem.checker === 'float' ||
          data.problem.checker === 'float-array') &&
        parseFiniteFloats(
          c.expectedOutput,
          data.problem.checker === 'float-array',
        ) === null
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid finite float expected output',
        });
      if (
        data.problem.checker === 'fraction-lc-166' &&
        !matchesFractionDecimal(c.expectedOutput, c.input)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid fraction input or expected output',
        });
      if (
        stringId !== null &&
        parseStringStructure(stringId, c.expectedOutput) === null
      )
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'expectedOutput'],
          message: 'Invalid JSON string result',
        });
      if (
        semanticId !== null &&
        !matchesSemantic(
          semanticId,
          c.expectedOutput,
          c.expectedOutput,
          c.input,
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: '语义判题输入或预期答案不合法',
          path: ['cases', index, 'expectedOutput'],
        });

      if (
        ['int-row-set', 'int-bag-row-set', 'int-row-multiset'].includes(
          data.problem.checker,
        ) &&
        parseIntegerRowCollection(
          c.expectedOutput,
          data.problem.checker as IntegerRowChecker,
        ) === null
      )
        ctx.addIssue({
          code: 'custom',
          message: '整数行集合格式无效：请检查行数、每行长度及重复行',
          path: ['cases', index, 'expectedOutput'],
        });
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
          new TextEncoder().encode(c[key]).byteLength >
            (key === 'input' ? OJ_MAX_CASE_BYTES : OJ_MAX_EXPECTED_BYTES) ||
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
        (new TextEncoder().encode(c.input).byteLength >
          OJ_MAX_PUBLIC_CASE_BYTES ||
          new TextEncoder().encode(c.expectedOutput).byteLength >
            OJ_MAX_PUBLIC_CASE_BYTES)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            '公开样例输入与输出分别最多 32 KiB，请将大数据设为隐藏测试点',
          path: ['cases', index],
        });
    }
  });
