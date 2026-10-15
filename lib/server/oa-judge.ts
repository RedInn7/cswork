import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { shownOaSql } from './env';
import { HttpError, one, rows } from './http';
import {
  cleanOaEditorial,
  cleanOaStatement,
  formatOaVerifiedStatement,
} from '../oa-verified-statement';
import { passingPrograms, programKey } from '../oa-solution-evidence.mjs';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const registrySchema = z.object({
  schemaVersion: z.literal(1),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^oa-[a-z0-9-]+$/),
        sourceContentHash: digest,
        packageChecksum: digest,
        editorial: z.string().min(1),
        authoredSolutions: z
          .array(
            z.object({
              language: z.string().regex(/^[a-z0-9+#-]+$/),
              code: z.string().min(1),
            }),
          )
          .min(1),
      }),
    )
    .max(20000),
});
export type OaPublishedVersion = {
  id: string;
  checksum: string;
  spec_json: string;
};

/** The registry is a private release artifact, never inferred from imported reference code. */
export function createOaJudgeRegistry(
  input: unknown,
  sourceHashes: Map<string, string>,
) {
  const parsed = registrySchema.parse(input);
  const entries = new Map(parsed.items.map((item) => [item.id, item]));
  if (entries.size !== parsed.items.length)
    throw new Error('Duplicate OA judge registry entry');
  function current(id: string) {
    const entry = entries.get(id);
    return entry && sourceHashes.get(id) === entry.sourceContentHash
      ? entry
      : undefined;
  }
  return {
    /** Bound to the live package (and, when given, to the catalog source it was built from). */
    isCurrent(id: string, checksum: string, sourceContentHash?: string) {
      const entry = current(id);
      return (
        entry?.packageChecksum === checksum &&
        (sourceContentHash === undefined || entry.sourceContentHash === sourceContentHash)
      );
    },
    isReady(version: OaPublishedVersion) {
      const entry = current(version.id);
      if (!entry || entry.packageChecksum !== version.checksum) return false;
      try {
        return JSON.parse(version.spec_json).id === version.id;
      } catch {
        return false;
      }
    },
    solution(id: string, sourceContentHash?: string) {
      const entry = current(id);
      if (
        !entry ||
        (sourceContentHash !== undefined &&
          entry.sourceContentHash !== sourceContentHash)
      )
        throw new HttpError(409, '这道题的题解和测试数据正在校验，暂未开放');
      return {
        explanation: cleanOaEditorial(entry.editorial),
        solutions: entry.authoredSolutions,
      };
    },
  };
}
let registry: ReturnType<typeof createOaJudgeRegistry> | undefined;
export function oaJudgeRegistry() {
  if (!registry) {
    const file = resolve('content/oa-judge/registry.json');
    if (!existsSync(file))
      return createOaJudgeRegistry({ schemaVersion: 1, items: [] }, new Map());
    const source = resolve('content/oa-master/catalog.json');
    if (
      statSync(file).size > 64 * 1024 * 1024 ||
      statSync(source).size > 64 * 1024 * 1024
    )
      throw new Error('OA judge content exceeds size budget');
    const catalog = JSON.parse(readFileSync(source, 'utf8')) as {
      items: { id: string; contentHash: string }[];
    };
    registry = createOaJudgeRegistry(
      JSON.parse(readFileSync(file, 'utf8')),
      new Map(catalog.items.map((item) => [item.id, item.contentHash])),
    );
  }
  return registry;
}

/** One batch query: catalog pages must not perform a query for every question. */
/** Trusted published OA problems with the list-safe parts of their spec. */
export async function oaReadyProblems() {
  // SQLite extracts the few list fields; full statements are never parsed per request.
  const versions = await rows<{
    id: string;
    checksum: string;
    spec_id: string | null;
    difficulty: string | null;
    tags: string | null;
    created_at: number;
    first_at: number;
  }>(
    `SELECT p.id,v.checksum,v.created_at,(SELECT MIN(created_at) FROM oj_problem_versions WHERE problem_id=p.id) AS first_at,json_extract(v.spec_json,'$.id') AS spec_id,json_extract(v.spec_json,'$.difficulty') AS difficulty,json_extract(v.spec_json,'$.tags') AS tags FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id LIKE 'oa-%'${shownOaSql('p.id')}`,
  );
  const trusted = oaJudgeRegistry();
  const ready = new Map<
    string,
    { difficulty?: string; tags: string[]; updatedAt: number; firstAt: number }
  >();
  for (const v of versions)
    if (v.spec_id === v.id && trusted.isCurrent(v.id, v.checksum))
      ready.set(v.id, {
        difficulty: v.difficulty ?? undefined,
        tags: v.tags ? (JSON.parse(v.tags) as string[]) : [],
        // Publish time of the live version: the sitemap's lastmod for its OA page.
        updatedAt: v.created_at,
        // First version's time: when the problem went online ("new this week").
        firstAt: v.first_at,
      });
  return ready;
}

export async function requireOaJudgeReady(id: string) {
  if (!id.startsWith('oa-')) return;
  const versions = await rows<OaPublishedVersion>(
    `SELECT p.id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id=?${shownOaSql('p.id')}`,
    id,
  );
  if (!versions[0] || !oaJudgeRegistry().isReady(versions[0]))
    throw new HttpError(409, '这道 OA 题的测试数据尚未校验完成，暂不能评测');
}

/** Reading and submitting must use the same corrected rules and visible samples. */
export async function oaVerifiedStatement(id: string) {
  const version = await one<OaPublishedVersion & { version_id: string }>(
    `SELECT p.id,v.id AS version_id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id=?${shownOaSql('p.id')}`,
    id,
  );
  if (!version || !oaJudgeRegistry().isReady(version))
    throw new HttpError(409, '这道 OA 题的版本正在校验，请刷新后重试');
  const spec = JSON.parse(version.spec_json);
  const samples = await rows<{ input: string; expectedOutput: string }>(
    'SELECT input,expected_output AS expectedOutput FROM oj_test_cases WHERE version_id=? AND hidden=0 ORDER BY ordinal',
    version.version_id,
  );
  return formatOaVerifiedStatement(spec, samples);
}

export function assertOaVersionReady(
  id: string,
  checksum: string,
  spec_json: string,
) {
  if (
    id.startsWith('oa-') &&
    !oaJudgeRegistry().isReady({ id, checksum, spec_json })
  )
    throw new HttpError(409, '这道 OA 题的版本已变化，请等待重新校验');
}

const englishStatement = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    packageChecksum: z.string(),
    en: z.object({
      title: z.string().trim().min(1).max(180),
      description: z.string().min(1).max(60000),
      input: z.string().min(1).max(12000),
      output: z.string().min(1).max(12000),
      explanation: z.string().max(12000),
      hints: z.array(z.string().min(1).max(2000)).max(10),
    }),
  })
  .strict();
const englishCache = new Map<
  string,
  z.infer<typeof englishStatement> | null
>();
/**
 * English statement for an OA problem, kept beside the judge package so translating never
 * changes verified packages. Served only while bound to the package that is currently live.
 */
export function oaEnglishStatement(id: string) {
  if (!/^oa-[a-z0-9-]+$/.test(id)) return undefined;
  if (!englishCache.get(id)) {
    // Only parsed files are cached; a missing file is re-checked so later additions appear.
    const file = resolve(`content/oa-judge/translations/${id}.json`);
    try {
      if (existsSync(file) && statSync(file).size < 1024 * 1024) {
        const value = englishStatement.parse(
          JSON.parse(readFileSync(file, 'utf8')),
        );
        // Translations mirror the package, provenance notes included; display drops them.
        englishCache.set(id, { ...value, en: cleanOaStatement(value.en) });
      }
    } catch {
      // An unreadable translation simply falls back to the Chinese statement.
    }
  }
  const value = englishCache.get(id);
  return value && value.id === id && oaJudgeRegistry().isCurrent(id, value.packageChecksum)
    ? value.en
    : undefined;
}

const hintList = z.array(z.string().trim().min(1).max(2000)).length(3);
const guideSchema = z
  .object({
    id: z.string(),
    packageChecksum: digest,
    sourceContentHash: digest,
    hints: z.object({ zh: hintList, en: hintList }).strict(),
    explanationEn: z.string().trim().min(1).max(20000),
  })
  .strict();
const programsSchema = z
  .object({
    id: z.string(),
    packageChecksum: digest,
    programs: z
      .array(
        z
          .object({
            language: z.enum(['python', 'cpp', 'java', 'go']),
            code: z.string().min(1).max(200000),
            sha256: digest,
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
const sidecars = new Map<string, unknown>();
/** content/oa-judge/<dir>/<id>.json, parsed once; a missing file is looked for again next time. */
function sidecar<S extends z.ZodTypeAny>(dir: 'guides' | 'solutions', id: string, schema: S) {
  const key = `${dir}/${id}`;
  if (!sidecars.has(key) && /^oa-[a-z0-9-]+$/.test(id)) {
    const file = resolve(`content/oa-judge/${key}.json`);
    try {
      if (existsSync(file) && statSync(file).size < 1024 * 1024)
        sidecars.set(key, schema.parse(JSON.parse(readFileSync(file, 'utf8'))));
    } catch {
      // An unreadable sidecar is simply not shown; scripts/oa-judge/check-guides.mjs fails on it.
    }
  }
  const value = sidecars.get(key) as z.infer<S> | undefined;
  return value?.id === id ? value : undefined;
}

/**
 * A problem's guide (content/oa-judge/guides/<id>.json): three hints in Chinese and English
 * (observation, approach, steps) and the editorial in English, kept beside the verified package
 * like translations. Served only while bound to the live package and its catalog source.
 */
export function oaGuide(id: string): z.infer<typeof guideSchema> | undefined {
  const guide = sidecar('guides', id, guideSchema);
  return guide && oaJudgeRegistry().isCurrent(id, guide.packageChecksum, guide.sourceContentHash)
    ? guide
    : undefined;
}

let passing: Set<string> | undefined;
/**
 * Reference programs beyond the registry's own (content/oa-judge/solutions/<id>.json): only those a
 * solutions report (scripts/oa-judge/verify-solutions.mjs) saw pass every case of the live package,
 * their code unchanged since.
 */
export function oaExtraPrograms(id: string): { language: string; code: string }[] {
  const extra = sidecar('solutions', id, programsSchema);
  if (!extra || !oaJudgeRegistry().isCurrent(id, extra.packageChecksum)) return [];
  passing ??= passingPrograms(resolve('content/oa-judge'));
  return extra.programs
    .filter(
      (program) =>
        createHash('sha256').update(program.code).digest('hex') === program.sha256 &&
        passing!.has(programKey({ id, ...program, packageChecksum: extra.packageChecksum })),
    )
    .map(({ language, code }) => ({ language, code }));
}
