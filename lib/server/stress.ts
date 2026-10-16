import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import safe from '@/lib/content/stress-safe.json';
import { CODE_LANGUAGES } from '@/lib/problems';
import { stressCases, type StressRule } from '@/lib/stress-gen';
import type { Person } from './auth';
import { refuseInContest } from './contests';
import { HttpError, json, limit } from './http';
import { leetcodeConstraints, leetcodeParams, LEETCODE_HARNESS_VERSION } from './leetcode-mode';
import { lingEditorial } from './ling-editorials';
import { readJson } from './my-practice';
import { getCompileProblem } from './oj-problems';
import { admit, enqueue, judgeReady, MAX_CODE_BYTES, MAX_STDIN_BYTES } from './oj-submissions';

const rules = safe as Record<string, Record<string, StressRule>>;
const input = z
  .object({
    seed: z.number().int().min(0).max(2 ** 31 - 1),
    language: z.enum(CODE_LANGUAGES),
    code: z.string().min(1).max(MAX_CODE_BYTES),
  })
  .strict();

/**
 * POST oj/problems/<id>/stress: the learner's code and the verified editorial's best approach on
 * the same small cases, which the server draws from `seed` (lib/stress-gen.ts) for a whitelisted
 * Line 500 problem. Never cases the client sends: that would be a bulk expected-output endpoint
 * around oj-expected and the statement bounds. Two unlisted runs in LeetCode mode, 'stress' and
 * 'stress-ref' (a reference run: its code never comes back); components/stress-result.tsx polls
 * both and shows the first case where the outputs differ.
 */
export async function handleStress(request: Request, p: Person, problemId: string): Promise<Response> {
  refuseInContest(p, problemId);
  const editorial = lingEditorial(problemId);
  const params = leetcodeParams(problemId);
  if (!Object.hasOwn(rules, problemId) || !editorial?.verified || !params)
    throw new HttpError(404, '这道题暂不支持对拍');
  const d = input.parse(await readJson(request, MAX_CODE_BYTES * 2));
  if (d.code.includes('\0')) throw new HttpError(400, '内容不能包含空字符');
  if (p.role !== 'teacher' && !p.verified) throw new HttpError(403, '请先验证邮箱，再运行和提交代码');
  const { versionId, spec } = await getCompileProblem(p, problemId);
  // The browser compares outputs as text, so only the exact and tokens checkers qualify.
  if (!['exact', 'tokens'].includes(spec.checker) || !spec.languages.includes('python'))
    throw new HttpError(404, '这道题暂不支持对拍');
  if (!spec.languages.includes(d.language)) throw new HttpError(400, '此题未开放该语言');
  const cases = stressCases(params, leetcodeConstraints(problemId), rules[problemId], d.seed);
  if (!cases) throw new HttpError(404, '这道题暂不支持对拍');
  const customInput = JSON.stringify({ cases });
  if (Buffer.byteLength(customInput) > MAX_STDIN_BYTES) throw new HttpError(413, '代码和自定义输入分别最多 64 KiB');
  if (!judgeReady()) throw new HttpError(503, '判题服务尚未配置，代码草稿已保留');
  await limit(p, 'stress-write', 10, 3600);
  const row = {
    problem_id: problemId,
    problem_version_id: versionId,
    custom_input: customInput,
    request_hash: null,
    total: cases.length,
    practice_round_id: null,
    coding_mode: 'leetcode' as const,
    harness_version: LEETCODE_HARNESS_VERSION,
  };
  const created = sqlite()
    .transaction(() => {
      // The reference side has the reference runs' own two slots; the learner's side is a run.
      admit(p, true);
      const reference = enqueue(p, randomUUID(), {
        ...row,
        language: 'python',
        code: editorial.approaches.at(-1)!.python,
        mode: 'stress-ref',
      });
      admit(p);
      const mine = enqueue(p, randomUUID(), { ...row, language: d.language, code: d.code, mode: 'stress' });
      return { id: mine.id, referenceId: reference.id };
    })
    .immediate();
  return json({ ...created, cases: cases.length }, 201);
}
