import {
  COMPLEX_DESIGN_CHECKERS,
  complexDesignCheckerId,
} from '../lib/oj-complex-contract';
import { matchesComplexDesign } from '../lib/oj-complex-design-checkers';
import { parseFiniteFloats } from '../lib/oj-float-checkers';
import { matchesFractionDecimal } from '../lib/oj-fraction-checker';
import {
  STRING_STRUCTURE_CHECKERS,
  stringStructureCheckerId,
  stringStructureKind,
} from '../lib/oj-string-contract';
import {
  parseStringStructure,
  validStringStructure,
} from '../lib/oj-string-structures';
import {
  validSpecialIdentity,
  validAuxiliaryIdentity,
} from '../lib/oj-special-contract';
import {
  SEMANTIC_CHECKERS,
  SEMANTIC_RESULT_KINDS,
  semanticCheckerId,
} from '../lib/oj-semantic-contract';
import { matchesSemantic, type SemanticId } from '../lib/oj-semantic-checkers';
/** Teacher-only offline publication of hash-bound, sandbox-validated packages. */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../db/sqlite';
import {
  saveProblemDraft,
  publishProblemDraft,
  validateProblemPackage,
  problemChecksum,
} from '../lib/server/oj-problems';
import type { Person } from '../lib/server/auth';
import {
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_EXPECTED_BYTES,
  parseOjSetOutput,
  parseOjMultisetOutput,
} from '../lib/oj-types';
import {
  asciiTokens,
  validStructuredOutput,
  validStructuredResult,
  parseIntegerRowCollection,
  validIntegerRowCollectionResult,
  type IntegerRowChecker,
} from '../lib/oj-result-shapes';

const manifestFile = process.argv[2];
const email = process.argv[3]?.toLowerCase();
if (!process.env.DATABASE_PATH || !manifestFile || !email)
  throw new Error(
    'Set DATABASE_PATH; pass verified manifest and teacher email',
  );
if (
  !(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(email)
)
  throw new Error('Teacher must be configured in ADMIN_EMAILS');
const db = sqlite();
const user = db
  .prepare('SELECT id,name,email,email_verified FROM user WHERE lower(email)=?')
  .get(email) as
  | { id: string; name: string; email: string; email_verified: number }
  | undefined;
if (!user?.email_verified) throw new Error('Verified teacher account required');
const teacher: Person = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: 'teacher',
  verified: true,
};
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const resultKindSchema = z
  .enum([
    'integer',
    'string',
    'integer-array',
    'integer-set',
    'string-set',
    'integer-multiset',
    'nullable-integer-array',
    'integer-rows',
    'integer-row-set',
    'integer-bag-row-set',
    'integer-row-multiset',
    'json-string-array',
    'json-string-rows',
    'float',
    'float-array',
  ])
  .default('integer');
const oracleEncodingSchema = z
  .enum(['legacy-integer', 'jsonl-v1'])
  .default('legacy-integer');
const checkerSchema = z
  .enum([
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
  ])
  .default('tokens');
const resourceLimitsSchema = z
  .object({
    timeLimit: z.number().min(0.1).max(10),
    memoryLimit: z.number().int().min(16384).max(524288),
    outputLimit: z.number().int().min(1).max(65536),
  })
  .default({ timeLimit: 2, memoryLimit: 262144, outputLimit: 64 });
const countsSchema = z.object({
  formal: z.number().int().min(2).max(64),
  oracle: z.number().int().min(120),
  negativeControls: z.number().int().min(2),
});
const manifest = z
  .object({
    verifiedAt: z.string().min(1),
    sourceHashesFileSha256: hash,
    problems: z
      .array(
        z.object({
          problemId: z.string().regex(/^lc-\d+$/),
          packageFile: z.string(),
          packageSha256: hash,
          sourceContentHash: hash,
          verified: z.literal(true),
          referenceSha256: hash,
          runnerSha256: hash,
          mutationSha256: hash,
          inputBytesSha256: hash,
          referenceBytesSha256: hash,
          oracleSha256: hash,
          counts: countsSchema,
          resultKind: resultKindSchema,
          oracleEncoding: oracleEncodingSchema,
          checker: checkerSchema,
          semanticId: z.number().int().optional(),
          specialId: z.number().int().optional(),
          auxiliaryId: z.number().int().optional(),
          complexDesignId: z.number().int().optional(),
          stringStructureId: z.number().int().optional(),
          resourceLimits: resourceLimitsSchema,
        }),
      )
      .min(1),
  })
  .parse(JSON.parse(readFileSync(manifestFile, 'utf8')));
const report = z
  .object({
    allPassed: z.literal(true),
    engine: z.literal('go-judge'),
    finishedAt: z.string().min(1),
    sourceHashesFileSha256: hash,
    problems: z
      .array(
        z.object({
          id: z.string().regex(/^lc-\d+$/),
          status: z.literal('verified'),
          sourceContentHash: hash,
          packageSha256: hash,
          referenceSha256: hash,
          wrapperSha256: hash,
          inputBytesSha256: hash,
          referenceBytesSha256: hash,
          oracleSha256: hash,
          mutationSha256: hash,
          counts: countsSchema,
          resultKind: resultKindSchema,
          oracleEncoding: oracleEncodingSchema,
          checker: checkerSchema,
          semanticId: z.number().int().optional(),
          specialId: z.number().int().optional(),
          auxiliaryId: z.number().int().optional(),
          complexDesignId: z.number().int().optional(),
          stringStructureId: z.number().int().optional(),
          resourceLimits: resourceLimitsSchema,
          checks: z.array(z.object({ passed: z.literal(true) })),
        }),
      )
      .min(1),
  })
  .parse(
    JSON.parse(
      readFileSync(
        resolve(dirname(manifestFile), 'verification-report.json'),
        'utf8',
      ),
    ),
  );
if (
  report.finishedAt !== manifest.verifiedAt ||
  report.sourceHashesFileSha256 !== manifest.sourceHashesFileSha256
)
  throw new Error('Verification report does not match manifest run');
const reportEntries = new Map(
  report.problems.map((entry) => [entry.id, entry]),
);
if (
  reportEntries.size !== report.problems.length ||
  new Set(manifest.problems.map((entry) => entry.problemId)).size !==
    manifest.problems.length ||
  reportEntries.size !== manifest.problems.length
)
  throw new Error('Duplicate or mismatched verification identities');
for (const record of manifest.problems) {
  const entry = reportEntries.get(record.problemId);
  if (
    entry?.resultKind !== record.resultKind ||
    entry?.oracleEncoding !== record.oracleEncoding ||
    entry?.checker !== record.checker ||
    entry?.semanticId !== record.semanticId ||
    entry?.specialId !== record.specialId ||
    entry?.auxiliaryId !== record.auxiliaryId ||
    entry?.complexDesignId !== record.complexDesignId ||
    entry?.stringStructureId !== record.stringStructureId ||
    entry?.resourceLimits.timeLimit !== record.resourceLimits.timeLimit ||
    entry?.resourceLimits.memoryLimit !== record.resourceLimits.memoryLimit ||
    entry?.resourceLimits.outputLimit !== record.resourceLimits.outputLimit ||
    (record.resultKind !== 'integer' && record.oracleEncoding !== 'jsonl-v1')
  )
    throw new Error('Verification result protocol does not match manifest');
  if (
    !entry ||
    entry.counts.formal !== record.counts.formal ||
    entry.counts.oracle !== record.counts.oracle ||
    entry.counts.negativeControls !== record.counts.negativeControls ||
    entry.checks.length !==
      record.counts.formal + record.counts.negativeControls + 1
  )
    throw new Error('Verification report checks do not match manifest');
  if (
    entry.sourceContentHash !== record.sourceContentHash ||
    entry.packageSha256 !== record.packageSha256 ||
    entry.referenceSha256 !== record.referenceSha256 ||
    entry.wrapperSha256 !== record.runnerSha256 ||
    entry.inputBytesSha256 !== record.inputBytesSha256 ||
    entry.referenceBytesSha256 !== record.referenceBytesSha256 ||
    entry.oracleSha256 !== record.oracleSha256 ||
    entry.mutationSha256 !== record.mutationSha256 ||
    record.inputBytesSha256 !== record.packageSha256 ||
    record.referenceBytesSha256 !== record.runnerSha256
  )
    throw new Error('Verification report provenance does not match manifest');
}
function validExpectedShape(kind: string, value: string) {
  if (kind === 'float' || kind === 'float-array')
    return parseFiniteFloats(value, kind === 'float-array') !== null;
  if (kind === 'json-string-array' || kind === 'json-string-rows')
    return (
      parseStringStructure(kind === 'json-string-array' ? 68 : 49, value) !==
      null
    );
  if (
    ['integer-row-set', 'integer-bag-row-set', 'integer-row-multiset'].includes(
      kind,
    )
  )
    return (
      parseIntegerRowCollection(
        value,
        kind.replace('integer-', 'int-') as IntegerRowChecker,
      ) !== null
    );
  if (kind === 'nullable-integer-array' || kind === 'integer-rows')
    return validStructuredOutput(kind, value);
  if (kind === 'integer-multiset') return parseOjMultisetOutput(value) !== null;
  if (kind === 'string') {
    const normalized = value.replace(/\r\n/g, '\n');
    return (
      normalized.endsWith('\n') &&
      !/[\r\n]/.test(normalized.slice(0, -1)) &&
      !normalized.includes('\0') &&
      !/[\uD800-\uDFFF]/u.test(normalized)
    );
  }
  if (kind === 'integer-set' || kind === 'string-set')
    return (
      parseOjSetOutput(
        value,
        kind === 'integer-set' ? 'int-set' : 'string-set',
      ) !== null
    );
  const tokens = asciiTokens(value);
  const first = tokens.next().value;
  if (kind === 'integer')
    return (
      first !== undefined &&
      /^[+-]?[0-9]+$/.test(first) &&
      tokens.next().done === true
    );
  if (
    kind !== 'integer-array' ||
    !first ||
    !/^(0|[1-9][0-9]*)$/.test(first) ||
    Number(first) > 1000000
  )
    return false;
  for (let i = 0; i < Number(first); i++) {
    const token = tokens.next().value;
    if (token === undefined || !/^[+-]?[0-9]+$/.test(token)) return false;
  }
  return tokens.next().done === true;
}
function typedOracleResult(kind: string, value: unknown): boolean {
  const finite = (v: unknown) =>
    (typeof v === 'number' || typeof v === 'bigint') &&
    Number.isFinite(Number(v));
  if (kind === 'float') return finite(value);
  if (kind === 'float-array')
    return Array.isArray(value) && value.length <= 99999 && value.every(finite);
  if (kind === 'json-string-array' || kind === 'json-string-rows')
    return validStringStructure(kind === 'json-string-array' ? 68 : 49, value);
  if (
    ['integer-row-set', 'integer-bag-row-set', 'integer-row-multiset'].includes(
      kind,
    )
  )
    return validIntegerRowCollectionResult(kind, value);
  if (kind === 'nullable-integer-array' || kind === 'integer-rows')
    return validStructuredResult(kind, value);
  const text = (v: unknown): v is string =>
    typeof v === 'string' &&
    !v.includes('\0') &&
    !/[\uD800-\uDFFF]/u.test(v) &&
    Buffer.byteLength(v, 'utf8') <= OJ_MAX_EXPECTED_BYTES;
  if (kind === 'integer') return typeof value === 'bigint';
  if (kind === 'string') return text(value) && !/[\r\n]/.test(value);
  if (!Array.isArray(value) || value.length > 1000000) return false;
  if (kind === 'string-set') {
    if (!value.every((v) => text(v) && !/[\r\n]/.test(v))) return false;
  } else if (
    (kind !== 'integer-array' &&
      kind !== 'integer-set' &&
      kind !== 'integer-multiset') ||
    !value.every((v) => typeof v === 'bigint')
  )
    return false;
  return !kind.endsWith('-set') || new Set(value).size === value.length;
}
function semanticOracleValid(
  id: SemanticId,
  args: unknown,
  value: unknown,
): boolean {
  try {
    const json = (v: unknown) =>
      JSON.stringify(v, (_key, x: unknown) => {
        if (typeof x !== 'bigint') return x;
        const n = Number(x);
        if (!Number.isSafeInteger(n))
          throw new Error('Unsafe semantic integer');
        return n;
      });
    const result = JSON.parse(json(value)) as
      | string
      | number
      | Array<number | null>
      | number[][];
    const kind = SEMANTIC_RESULT_KINDS[id];
    const output =
      kind === 'string'
        ? String(result) + '\n'
        : kind === 'integer'
          ? String(result) + '\n'
          : kind === 'integer-rows'
            ? String((result as number[][]).length) +
              '\n' +
              (result as number[][])
                .map((row) => String(row.length) + ' ' + row.join(' ') + '\n')
                .join('')
            : String((result as Array<number | null>).length) +
              '\n' +
              (result as Array<number | null>)
                .map((v) => (v === null ? 'null' : String(v)))
                .join(' ') +
              '\n';
    return matchesSemantic(id, output, output, json(args));
  } catch {
    return false;
  }
}
// Validate every package before making any change.
const packages = manifest.problems.map((record) => {
  if (record.packageFile !== `${record.problemId}.json`)
    throw new Error(
      'Package must have its exact problem filename beside manifest',
    );
  const packagePath = resolve(dirname(manifestFile), record.packageFile);
  if (
    dirname(realpathSync(packagePath)) !==
    realpathSync(dirname(resolve(manifestFile)))
  )
    throw new Error('Package must not escape manifest directory');
  if (statSync(packagePath).size > OJ_MAX_IMPORT_BYTES)
    throw new Error('Package exceeds 128 MiB');
  const raw = readFileSync(packagePath);
  if (createHash('sha256').update(raw).digest('hex') !== record.packageSha256)
    throw new Error(`Changed verified package: ${record.problemId}`);
  const payload = validateProblemPackage(JSON.parse(raw.toString('utf8')));
  if (!validSpecialIdentity(record.specialId, record.problemId))
    throw new Error('Invalid special adapter identity');
  if (!validAuxiliaryIdentity(record.auxiliaryId, record.problemId))
    throw new Error('Invalid auxiliary identity');
  const complexId = complexDesignCheckerId(record.checker);
  if (
    (complexId !== null &&
      (record.complexDesignId !== complexId ||
        record.problemId !== `lc-${complexId}` ||
        record.resultKind !== 'string' ||
        record.oracleEncoding !== 'jsonl-v1')) ||
    (complexId === null && record.complexDesignId !== undefined)
  )
    throw new Error('Invalid fixed complex design binding');
  const fraction = record.checker === 'fraction-lc-166';
  if (
    fraction &&
    (record.problemId !== 'lc-166' ||
      record.resultKind !== 'string' ||
      record.oracleEncoding !== 'jsonl-v1')
  )
    throw new Error('Invalid fraction identity');
  const stringId = stringStructureCheckerId(record.checker);
  if (
    (stringId !== null &&
      (record.stringStructureId !== stringId ||
        record.problemId !== `lc-${stringId}` ||
        stringStructureKind(stringId) !== record.resultKind ||
        record.oracleEncoding !== 'jsonl-v1')) ||
    (stringId === null && record.stringStructureId !== undefined)
  )
    throw new Error('Invalid fixed string checker binding');
  const semanticId = semanticCheckerId(record.checker);
  if (
    (semanticId !== null &&
      (record.semanticId !== semanticId ||
        record.problemId !== `lc-${semanticId}` ||
        record.oracleEncoding !== 'jsonl-v1' ||
        SEMANTIC_RESULT_KINDS[semanticId] !== record.resultKind)) ||
    (semanticId === null && record.semanticId !== undefined)
  )
    throw new Error(
      'Semantic identity or result type does not match verification',
    );
  const requiredChecker =
    complexId !== null || fraction || stringId !== null || semanticId !== null
      ? record.checker
      : {
          integer: 'tokens',
          string: 'exact',
          'integer-array': 'tokens',
          'integer-set': 'int-set',
          'integer-multiset': 'int-multiset',
          'nullable-integer-array': 'tokens',
          'integer-rows': 'tokens',
          'integer-row-set': 'int-row-set',
          'integer-bag-row-set': 'int-bag-row-set',
          'integer-row-multiset': 'int-row-multiset',
          'string-set': 'string-set',
          float: 'float',
          'float-array': 'float-array',
          'json-string-array': undefined,
          'json-string-rows': undefined,
        }[record.resultKind];
  if (
    payload.problem.semanticId !== record.semanticId ||
    payload.problem.specialId !== record.specialId ||
    payload.problem.auxiliaryId !== record.auxiliaryId ||
    payload.problem.complexDesignId !== record.complexDesignId ||
    payload.problem.stringStructureId !== record.stringStructureId ||
    payload.problem.checker !== requiredChecker ||
    payload.problem.checker !== record.checker ||
    payload.problem.timeLimit !== record.resourceLimits.timeLimit ||
    payload.problem.memoryLimit !== record.resourceLimits.memoryLimit ||
    payload.problem.outputLimit !== record.resourceLimits.outputLimit
  )
    throw new Error(
      'Verification result protocol does not match package checker',
    );
  if (
    payload.problem.id !== record.problemId ||
    payload.cases.length !== record.counts.formal
  )
    throw new Error('Verification manifest does not match package');
  if (
    !payload.cases.every((c) =>
      validExpectedShape(record.resultKind, c.expectedOutput),
    )
  )
    throw new Error('Expected output does not match verified result type');
  if (record.oracleEncoding === 'jsonl-v1') {
    const oraclePath = resolve(
      dirname(manifestFile),
      `${record.problemId}.oracle.json`,
    );
    if (
      dirname(realpathSync(oraclePath)) !==
      realpathSync(dirname(resolve(manifestFile)))
    )
      throw new Error('Oracle must not escape manifest directory');
    if (statSync(oraclePath).size > 32 * 1024 * 1024)
      throw new Error('Oracle exceeds 32 MiB');
    const oracleRaw = readFileSync(oraclePath);
    if (
      oracleRaw.byteLength > 32 * 1024 * 1024 ||
      createHash('sha256').update(oracleRaw).digest('hex') !==
        record.oracleSha256
    )
      throw new Error('Changed verified oracle');
    // Node 22 source-aware parsing preserves arbitrarily large integer literals.
    // Exponents/decimal notation remain Number and fail the strict integer check.
    const oracle = JSON.parse(
      oracleRaw.toString('utf8'),
      (_key: string, value: unknown, context?: { source?: string }) => {
        if (typeof value !== 'number') return value;
        if (!context?.source)
          throw new Error('Oracle requires source-aware JSON parsing');
        return /^-?[0-9]+$/.test(context.source)
          ? BigInt(context.source)
          : value;
      },
    ) as {
      resultKind?: unknown;
      oracleEncoding?: unknown;
      semanticId?: unknown;
      specialId?: unknown;
      auxiliaryId?: unknown;
      complexDesignId?: unknown;
      stringStructureId?: unknown;
      args?: unknown;
      expected?: unknown;
    };
    if (
      oracle.stringStructureId !==
        (record.stringStructureId === undefined
          ? undefined
          : BigInt(record.stringStructureId)) ||
      oracle.complexDesignId !==
        (record.complexDesignId === undefined
          ? undefined
          : BigInt(record.complexDesignId)) ||
      oracle.auxiliaryId !==
        (record.auxiliaryId === undefined
          ? undefined
          : BigInt(record.auxiliaryId)) ||
      oracle.specialId !==
        (record.specialId === undefined
          ? undefined
          : BigInt(record.specialId)) ||
      oracle.semanticId !==
        (record.semanticId === undefined
          ? undefined
          : BigInt(record.semanticId)) ||
      oracle.resultKind !== record.resultKind ||
      oracle.oracleEncoding !== record.oracleEncoding ||
      !Array.isArray(oracle.args) ||
      !Array.isArray(oracle.expected) ||
      oracle.args.length !== record.counts.oracle ||
      oracle.expected.length !== record.counts.oracle ||
      !oracle.expected.every((value) =>
        typedOracleResult(record.resultKind, value),
      )
    )
      throw new Error(
        'Oracle type or count does not match verified result protocol',
      );
    if (complexId !== null) {
      const args = oracle.args as unknown[];
      if (
        !(oracle.expected as unknown[]).every((value, index) =>
          matchesComplexDesign(
            complexId,
            String(value) + '\n',
            String(value) + '\n',
            JSON.stringify(args[index], (_key, v: unknown) => {
              if (typeof v !== 'bigint') return v;
              const n = Number(v);
              if (!Number.isSafeInteger(n))
                throw new Error('Unsafe complex oracle integer');
              return n;
            }),
          ),
        )
      )
        throw new Error('Invalid complex oracle input or result');
    }
    if (fraction) {
      const args = oracle.args as unknown[];
      if (
        !(oracle.expected as unknown[]).every((value, index) =>
          matchesFractionDecimal(
            String(value) + '\n',
            JSON.stringify(args[index], (_key, v: unknown) =>
              typeof v === 'bigint' ? Number(v) : v,
            ),
          ),
        )
      )
        throw new Error('Invalid fraction oracle arguments or expected value');
    }
    if (semanticId !== null) {
      const args = oracle.args as unknown[];
      if (
        !(oracle.expected as unknown[]).every((value, index) =>
          semanticOracleValid(semanticId, args[index], value),
        )
      )
        throw new Error('Semantic oracle is not valid for its bound arguments');
    }
  }
  if (
    !db
      .prepare('SELECT id FROM study_library WHERE id=? AND content_hash=?')
      .get(record.problemId, record.sourceContentHash)
  )
    throw new Error(
      'Source library changed or is missing; revalidate before publication',
    );
  return { record, payload };
});
for (const { record, payload } of packages) {
  const current = db
    .prepare(
      `SELECT p.current_version_id,v.checksum FROM oj_problems p LEFT JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=?`,
    )
    .get(record.problemId) as
    | { current_version_id: string | null; checksum: string | null }
    | undefined;
  let versionId = current?.current_version_id;
  if (!versionId || current?.checksum !== problemChecksum(payload)) {
    const revision = db
      .prepare('SELECT revision FROM oj_problem_drafts WHERE problem_id=?')
      .get(record.problemId) as { revision: number } | undefined;
    const draft = await saveProblemDraft(
      teacher,
      payload,
      revision?.revision ?? null,
    );
    const published = await publishProblemDraft(
      teacher,
      record.problemId,
      draft.draft!.revision,
    );
    versionId = published.versionId;
  }
  if (!versionId) throw new Error('Published version is missing');
  const bound = db
    .prepare(
      "UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':' || ? WHERE id=? AND content_hash=?",
    )
    .run(
      record.problemId,
      versionId,
      record.problemId,
      record.sourceContentHash,
    );
  if (bound.changes !== 1)
    throw new Error(
      'Source library changed during publication; verification was not enabled',
    );
  console.log(
    JSON.stringify({
      problemId: record.problemId,
      versionId,
      formal: record.counts.formal,
      oracle: record.counts.oracle,
    }),
  );
}
db.close();
