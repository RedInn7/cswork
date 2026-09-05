import { problems, type Language } from '@/lib/problems';
import { database, setting } from './env';
import { HttpError, one, limit } from './http';
import type { Person } from './auth';
// Kept in the server graph. The browser never receives these cases or runner tokens.
export const hiddenCases: Record<
  string,
  { stdin: string; expected_output: string }[]
> = {
  'watch-intervals': [
    { stdin: '1\n0 1\n', expected_output: '1\n' },
    { stdin: '5\n8 10\n0 9\n1 3\n15 20\n20 25\n', expected_output: '20\n' },
    {
      stdin: '3\n0 1000000000\n1 2\n0 1000000000\n',
      expected_output: '1000000000\n',
    },
  ],
  'product-top-k': [
    { stdin: '5 5\n5 4 3 2 1\n', expected_output: '1 1\n2 1\n3 1\n4 1\n5 1\n' },
    { stdin: '6 5\n9 9 9 9 9 9\n', expected_output: '9 6\n' },
    { stdin: '8 3\n2 2 1 1 8 8 9 10\n', expected_output: '1 2\n2 2\n8 2\n' },
  ],
  'study-plan': [
    { stdin: '3 1\n1 2\n', expected_output: '1 2 3\n' },
    { stdin: '3 3\n1 2\n2 3\n3 1\n', expected_output: 'IMPOSSIBLE\n' },
    { stdin: '5 0\n', expected_output: '1 2 3 4 5\n' },
    { stdin: '4 4\n1 3\n1 3\n2 3\n3 4\n', expected_output: '1 2 3 4\n' },
    { stdin: '2 1\n1 1\n', expected_output: 'IMPOSSIBLE\n' },
  ],
  'rate-window': [
    {
      stdin: '4 2 1\n0 0 2 2\n',
      expected_output: 'ACCEPT\nREJECT\nACCEPT\nREJECT\n',
    },
    {
      stdin: '5 10 1\n0 9 10 19 20\n',
      expected_output: 'ACCEPT\nREJECT\nACCEPT\nREJECT\nACCEPT\n',
    },
    {
      stdin: '3 100 100\n0 0 0\n',
      expected_output: 'ACCEPT\nACCEPT\nACCEPT\n',
    },
  ],
};
export function judgeReady() {
  return !!(
    setting('JUDGE0_URL') &&
    setting('JUDGE0_TOKEN') &&
    setting('JUDGE0_LANGUAGE_IDS')
  );
}
async function runner(path: string, init: RequestInit = {}) {
  const base = setting('JUDGE0_URL');
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未连接，你的代码草稿已保留');
  if (!base.startsWith('https://'))
    throw new HttpError(503, '判题服务需要安全连接');
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Auth-Token', setting('JUDGE0_TOKEN'));
  const r = await fetch(base.replace(/\/$/, '') + path, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new HttpError(503, '判题服务暂时不可用，请稍后重试');
  return r.json() as Promise<any>;
}
export async function submit(
  p: Person,
  problemId: string,
  language: Language,
  code: string,
) {
  const problem = problems.find((x) => x.id === problemId);
  if (!problem) throw new HttpError(404, '题目不存在');
  if (!judgeReady())
    throw new HttpError(503, '判题服务尚未连接，你的代码草稿已保留');
  await limit(p, 'judge', 5, 60);
  let ids: Record<string, number>;
  try {
    ids = JSON.parse(setting('JUDGE0_LANGUAGE_IDS'));
  } catch {
    throw new HttpError(503, '判题语言尚未配置');
  }
  const languageId = ids[language];
  if (!Number.isInteger(languageId)) throw new HttpError(503, '此语言暂未开放');
  const tests = [
    { stdin: problem.sampleIn, expected_output: problem.sampleOut },
    ...hiddenCases[problemId],
  ];
  const id = crypto.randomUUID(),
    now = Date.now();
  await database()
    .prepare(
      'INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      p.id,
      problemId,
      language,
      code,
      'submitting',
      tests.length,
      now,
      now,
    )
    .run();
  try {
    const result = await runner('/submissions/batch?base64_encoded=false', {
      method: 'POST',
      body: JSON.stringify({
        submissions: tests.map((t) => ({
          ...t,
          source_code: code,
          language_id: languageId,
          cpu_time_limit: problem.timeLimit,
          wall_time_limit: 10,
          memory_limit: problem.memoryLimit,
          max_processes_and_or_threads: 64,
          max_file_size: 1024,
          enable_network: false,
        })),
      }),
    });
    if (
      !Array.isArray(result) ||
      result.length !== tests.length ||
      result.some((x) => !x.token)
    )
      throw new Error('Runner rejected submission');
    await database()
      .prepare(
        'UPDATE submissions SET status=?,tokens=?,updated_at=? WHERE id=?',
      )
      .bind(
        'pending',
        JSON.stringify(result.map((x) => x.token)),
        Date.now(),
        id,
      )
      .run();
    return { id, status: 'pending' };
  } catch (e) {
    await database()
      .prepare(
        "UPDATE submissions SET status='system_error',message=?,updated_at=? WHERE id=?",
      )
      .bind('提交未完成，请重试', Date.now(), id)
      .run();
    throw e;
  }
}
export async function result(p: Person, id: string) {
  const s = await one<any>('SELECT * FROM submissions WHERE id=?', id);
  if (!s || (s.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '提交不存在');
  if (s.status === 'pending') {
    {
      await limit(p, 'poll', 60);
      const tokens: string[] = JSON.parse(s.tokens);
      const response = await runner(
        `/submissions/batch?tokens=${encodeURIComponent(tokens.join(','))}&base64_encoded=true&fields=status,time,memory,compile_output`,
      );
      if (
        !Array.isArray(response.submissions) ||
        response.submissions.length !== tokens.length
      )
        throw new HttpError(503, '判题状态暂时不可用');
      const rs = response.submissions;
      if (rs.every((r: any) => r.status?.id >= 3)) {
        s.passed = rs.filter((r: any) => r.status.id === 3).length;
        s.runtime = Math.max(...rs.map((r: any) => Number(r.time) || 0));
        s.memory = Math.max(...rs.map((r: any) => Number(r.memory) || 0));
        const failed = rs.find((r: any) => r.status.id !== 3);
        s.status = !failed
          ? 'accepted'
          : failed.status.id === 4
            ? 'wrong_answer'
            : failed.status.id === 5
              ? 'time_limit'
              : failed.status.id === 6
                ? 'compile_error'
                : failed.status.id >= 13
                  ? 'system_error'
                  : 'runtime_error';
        s.message =
          s.status === 'compile_error' && failed.compile_output
            ? new TextDecoder()
                .decode(
                  Uint8Array.from(atob(failed.compile_output), (c) =>
                    c.charCodeAt(0),
                  ),
                )
                .slice(0, 6000)
            : null;
      } else if (Date.now() - s.created_at > 5 * 60 * 1000) {
        s.status = 'system_error';
        s.message = '判题服务仍未完成，请重试';
      }
    }
    if (s.status !== 'pending')
      await database()
        .prepare(
          'UPDATE submissions SET status=?,passed=?,runtime=?,memory=?,message=?,updated_at=? WHERE id=?',
        )
        .bind(
          s.status,
          s.passed,
          s.runtime,
          s.memory,
          s.message,
          Date.now(),
          id,
        )
        .run();
  }
  delete s.tokens;
  return s;
}
