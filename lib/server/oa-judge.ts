import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { HttpError, rows } from './http';

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
export async function oaReadyProblemIds() {
  const versions = await rows<OaPublishedVersion>(
    `SELECT p.id,v.checksum,v.spec_json FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id AND v.problem_id=p.id WHERE p.published=1 AND p.id LIKE 'oa-%'`,
  );
  const trusted = oaJudgeRegistry();
  return new Set(
    versions
      .filter((version) => trusted.isReady(version))
      .map((version) => version.id),
  );
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
