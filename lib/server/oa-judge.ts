import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { HttpError, one, rows } from './http';
import { formatOaVerifiedStatement } from '../oa-verified-statement';

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
        explanation: entry.editorial,
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
  const versions = await rows<OaPublishedVersion>(
    `SELECT p.id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id LIKE 'oa-%'`,
  );
  const trusted = oaJudgeRegistry();
  const ready = new Map<string, { difficulty?: string; tags: string[] }>();
  for (const version of versions)
    if (trusted.isReady(version)) {
      const spec = JSON.parse(version.spec_json) as {
        difficulty?: string;
        tags?: string[];
      };
      ready.set(version.id, { difficulty: spec.difficulty, tags: spec.tags || [] });
    }
  return ready;
}


export async function requireOaJudgeReady(id: string) {
  if (!id.startsWith('oa-')) return;
  const versions = await rows<OaPublishedVersion>(
    `SELECT p.id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id=?`,
    id,
  );
  if (!versions[0] || !oaJudgeRegistry().isReady(versions[0]))
    throw new HttpError(409, '这道 OA 题的测试数据尚未校验完成，暂不能评测');
}

/** Reading and submitting must use the same corrected rules and visible samples. */
export async function oaVerifiedStatement(id: string) {
  const version = await one<OaPublishedVersion & { version_id: string }>(
    'SELECT p.id,v.id AS version_id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id=?',
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
