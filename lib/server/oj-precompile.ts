import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { HttpError, limit } from './http';
import { getCompileProblem } from './oj-problems';
import { leetcodeContract } from './leetcode-mode';
import { MAX_CODE_BYTES, ojStatus } from './oj-submissions';

export const PRECOMPILE_TTL_MS = 30_000;
export const PRECOMPILE_QUEUE_LIMIT = 32;
export const PRECOMPILE_TIMEOUT_MS = 8_000;
export type PrecompileDraft = {
  user_id: string;
  generation: string;
  problem_id: string;
  problem_version_id: string;
  code: string;
  coding_mode: 'leetcode' | 'acm';
  language: 'cpp' | 'java' | 'go';
  created_at: number;
  expires_at: number;
};
const schema = z
  .object({
    problemId: z.string().min(1).max(80),
    language: z.enum(['cpp', 'python', 'go', 'java']),
    codingMode: z.enum(['leetcode', 'acm']),
    code: z.string().min(1).max(MAX_CODE_BYTES),
  })
  .strict();

export function precompileEnabled() {
  return process.env.OJ_PRECOMPILE_ENABLED !== 'false';
}
export function prunePrecompileDrafts(now = Date.now()) {
  sqlite().prepare('DELETE FROM oj_precompile WHERE expires_at<=?').run(now);
}
export function nextPrecompileDraft(): PrecompileDraft | undefined {
  prunePrecompileDrafts();
  return sqlite()
    .prepare('SELECT * FROM oj_precompile ORDER BY created_at LIMIT 1')
    .get() as PrecompileDraft | undefined;
}
export function precompileDraftCurrent(draft: PrecompileDraft) {
  return Boolean(
    sqlite()
      .prepare(
        'SELECT 1 FROM oj_precompile WHERE user_id=? AND generation=? AND expires_at>?',
      )
      .get(draft.user_id, draft.generation, Date.now()),
  );
}
export function consumePrecompileDraft(draft: PrecompileDraft) {
  sqlite()
    .prepare('DELETE FROM oj_precompile WHERE user_id=? AND generation=?')
    .run(draft.user_id, draft.generation);
}
export function hasForegroundSubmissions() {
  return Boolean(
    sqlite()
      .prepare(
        "SELECT 1 FROM submissions WHERE status IN ('queued','compiling','running') AND cancel_requested=0 LIMIT 1",
      )
      .get(),
  );
}
export async function requestPrecompile(person: Person, input: unknown) {
  const value = schema.parse(input);
  if (Buffer.byteLength(value.code) > MAX_CODE_BYTES)
    throw new HttpError(413, '代码最多 64 KiB');
  if (value.code.includes('\0')) throw new HttpError(400, '代码不能包含空字符');
  // Separate quota: background editing never consumes run/submit allowances.
  await limit(person, 'oj-precompile', 6);
  const snapshot = await getCompileProblem(person, value.problemId);
  if (!snapshot.spec.languages.includes(value.language))
    throw new HttpError(400, '此题未开放该语言');
  if (value.codingMode === 'leetcode' && !leetcodeContract(value.problemId))
    throw new HttpError(400, '此题未开放 LeetCode 模式');
  if (
    !precompileEnabled() ||
    value.language === 'python' ||
    !value.code.trim() ||
    !ojStatus().available
  )
    return { status: 'skipped' as const };
  const db = sqlite();
  return db.transaction(() => {
    prunePrecompileDrafts();
    const current = db
      .prepare('SELECT * FROM oj_precompile WHERE user_id=?')
      .get(person.id) as PrecompileDraft | undefined;
    if (
      current?.problem_version_id === snapshot.versionId &&
      current.code === value.code &&
      current.language === value.language &&
      current.coding_mode === value.codingMode
    )
      return { status: 'queued' as const };
    const count = db
      .prepare('SELECT COUNT(*) AS n FROM oj_precompile')
      .get() as { n: number };
    if (!current && count.n >= PRECOMPILE_QUEUE_LIMIT)
      return { status: 'skipped' as const };
    const now = Date.now();
    db.prepare(`INSERT INTO oj_precompile(user_id,generation,problem_id,problem_version_id,code,coding_mode,created_at,expires_at,language) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET generation=excluded.generation,problem_id=excluded.problem_id,problem_version_id=excluded.problem_version_id,code=excluded.code,coding_mode=excluded.coding_mode,created_at=excluded.created_at,expires_at=excluded.expires_at,language=excluded.language`).run(
      person.id,
      randomUUID(),
      value.problemId,
      snapshot.versionId,
      value.code,
      value.codingMode,
      now,
      now + PRECOMPILE_TTL_MS,
      value.language,
    );
    return { status: 'queued' as const };
  })();
}
