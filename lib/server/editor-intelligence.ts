import { z } from 'zod';
import type { Person } from './auth';
import { boundedText, HttpError, json, limit } from './http';
import { setting } from './env';
import { getPublishedProblem } from './oj-problems';

const documentSchema = z.object({
  problemId: z.string().min(1).max(100),
  documentId: z.uuid(),
  language: z.enum(['python', 'go', 'cpp', 'java']),
});
const requestSchema = documentSchema
  .extend({
    code: z.string().max(65536),
    version: z.number().int().positive().max(2147483647),
    action: z.enum(['completion', 'hover', 'signature', 'diagnostics']),
    position: z
      .object({
        line: z.number().int().nonnegative(),
        character: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();

function brokerConfig() {
  const endpoint = setting('CSWORK_LSP_URL'),
    token = setting('CSWORK_LSP_TOKEN');
  if (!endpoint || !token)
    throw new HttpError(503, '智能补全暂未开放，代码仍可运行和提交');
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new HttpError(503, '智能补全配置不可用');
  }
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new HttpError(503, '智能补全配置不可用');
  return { endpoint: url.origin, token };
}
async function readBroker(response: Response) {
  if (!response.body) throw new HttpError(502, '补全服务未返回结果');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let text = '',
    bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1048576) {
        await reader.cancel();
        throw new HttpError(502, '补全结果过大，请缩小代码范围');
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
export async function handleEditorIntelligence(
  request: Request,
  p: Person,
  close = false,
) {
  // Separate from submission limits: typing must not exhaust the judge quota.
  await limit(
    p,
    close ? 'editor-intelligence-close' : 'editor-intelligence',
    close ? 60 : 240,
  );
  let input: unknown;
  try {
    input = JSON.parse(await boundedText(request, 400000));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, '无效的补全请求');
  }
  const data = close
    ? documentSchema.strict().parse(input)
    : requestSchema.parse(input);
  if (!close) {
    const d = requestSchema.parse(data);
    const problem = await getPublishedProblem(p, d.problemId);
    if (!problem.languages.includes(d.language))
      throw new HttpError(400, '本题不支持该语言');
    if (Buffer.byteLength(d.code, 'utf8') > 65536)
      throw new HttpError(413, '代码超过 64 KiB');
    if (d.action !== 'diagnostics' && !d.position)
      throw new HttpError(400, '缺少光标位置');
    if (d.position) {
      const lines = d.code.split(/\r\n|\r|\n/);
      if (
        d.position.line >= lines.length ||
        d.position.character > lines[d.position.line].length
      )
        throw new HttpError(400, '光标位置超出代码范围');
    }
  }
  const { endpoint, token } = brokerConfig();
  // Neither ownership nor a filesystem URI can be supplied by a browser. Closing
  // an owned document is allowed after revocation, but cannot read its contents.
  const payload = {
    ...data,
    ownerId: p.id,
    documentId: `${data.problemId}:${data.documentId}`,
  };
  delete (payload as { problemId?: string }).problemId;
  try {
    const response = await fetch(
      `${endpoint}/v1/${close ? 'close' : 'request'}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
        redirect: 'error',
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429 || response.status === 503)
        throw new HttpError(503, '补全服务暂忙，继续输入或重新触发即可重试');
      if (response.status === 409)
        throw new HttpError(409, '代码已更新，请重新触发补全');
      throw new HttpError(502, '补全服务暂不可用，代码仍可运行和提交');
    }
    return json(await readBroker(response));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, '补全服务连接中断，继续输入或重新触发即可重试');
  }
}
