import { env } from 'cloudflare:workers';
import { database } from './env';
import { HttpError, json, one } from './http';
import type { Person } from './auth';
const MAX = 2 * 1024 * 1024;
export async function uploadAttachment(
  request: Request,
  p: Person,
  ticketId: string,
) {
  if (!env.FILES) throw new HttpError(503, '附件存储暂不可用');
  const name = (new URL(request.url).searchParams.get('name') || '')
    .split(/[\\/]/)
    .pop()!
    .slice(0, 180);
  if (!/\.(png|jpe?g|pdf|txt|log|go|py|java|cpp)$/i.test(name))
    throw new HttpError(400, '支持图片、PDF、文本或代码文件');
  const count = await one<{ count: number }>(
    'SELECT COUNT(*) as count FROM attachments WHERE ticket_id=?',
    ticketId,
  );
  if ((count?.count || 0) >= 10)
    throw new HttpError(400, '每个工单最多 10 个附件');
  if (Number(request.headers.get('content-length') || 0) > MAX || !request.body)
    throw new HttpError(413, '附件不能超过 2MB');
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX) {
      await reader.cancel();
      throw new HttpError(413, '附件不能超过 2MB');
    }
    chunks.push(value);
  }
  if (!size) throw new HttpError(400, '附件不能为空');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const id = crypto.randomUUID();
  await env.FILES.put(`tickets/${id}`, bytes, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
  try {
    await database()
      .prepare(
        'INSERT INTO attachments(id,ticket_id,user_id,name,size,created_at) VALUES(?,?,?,?,?,?)',
      )
      .bind(id, ticketId, p.id, name, size, Date.now())
      .run();
  } catch (e) {
    await env.FILES.delete(`tickets/${id}`);
    throw e;
  }
  return json({ id, name, size }, 201);
}
export async function downloadAttachment(id: string, name: string) {
  if (!env.FILES) throw new HttpError(503, '附件存储暂不可用');
  const object = await env.FILES.get(`tickets/${id}`);
  if (!object) throw new HttpError(404, '附件不存在');
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
