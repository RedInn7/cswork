import { mkdir, writeFile, readFile, unlink, statfs } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { database } from './env';
import { HttpError, json, one } from './http';
import type { Person } from './auth';
const MAX = 2 * 1024 * 1024;
const DISK_RESERVE = BigInt(3 * 1024 * 1024 * 1024);
function attachmentPath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, '附件不存在');
  return join(resolve(process.env.ATTACHMENTS_PATH || 'data/attachments'), id);
}
export async function uploadAttachment(
  request: Request,
  p: Person,
  ticketId: string,
) {
  const ticket = await one<{ user_id: string }>(
    'SELECT user_id FROM tickets WHERE id=?',
    ticketId,
  );
  if (!ticket || (ticket.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '工单不存在');
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
  const folder=resolve(process.env.ATTACHMENTS_PATH || 'data/attachments');
  await mkdir(folder, {
    recursive: true,
    mode: 0o700,
  });
  const maximum=Number(process.env.ATTACHMENTS_MAX_BYTES ?? 1024*1024*1024);
  if(!Number.isSafeInteger(maximum)||maximum<0)throw new HttpError(503,'附件空间配置无效，请联系老师');
  const disk=await statfs(folder,{bigint:true});
  const diskBudget=disk.bavail*disk.bsize-DISK_RESERVE;
  if(diskBudget<BigInt(size))throw new HttpError(507,'磁盘可用空间不足，暂时不能上传附件');
  const budget=Math.min(maximum,Number(diskBudget>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):diskBudget));
  // Reserve space in SQLite before writing. The single INSERT includes every
  // concurrent reservation and conservatively counts existing files as well.
  const inserted=database().prepare('INSERT INTO attachments(id,ticket_id,user_id,name,size,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM attachments WHERE ticket_id=?)<10 AND (SELECT COALESCE(SUM(size),0) FROM attachments)+?<=? RETURNING id').bind(id,ticketId,p.id,name,size,Date.now(),ticketId,size,budget).first();
  if(!inserted) {
    const current=await one<{count:number}>('SELECT COUNT(*) AS count FROM attachments WHERE ticket_id=?',ticketId);
    if((current?.count||0)>=10)throw new HttpError(400,'每个工单最多 10 个附件');
    throw new HttpError(507,'站点附件空间已满，请联系老师清理后再试');
  }
  try {
    await writeFile(attachmentPath(id), bytes, { flag: 'wx', mode: 0o600 });
    if(!await one('SELECT id FROM attachments WHERE id=?',id))throw new HttpError(409,'附件已被删除，请重新上传');
  } catch (e) {
    database().prepare('DELETE FROM attachments WHERE id=?').bind(id).run();
    await unlink(attachmentPath(id)).catch(() => {});
    throw e;
  }
  return json({ id, name, size }, 201);
}
export async function deleteAttachment(p: Person, id: string) {
  const row = await one<{ user_id: string; ticket_id: string }>(
    'SELECT user_id,ticket_id FROM attachments WHERE id=?',
    id,
  );
  if (!row || (p.role !== 'teacher' && row.user_id !== p.id))
    throw new HttpError(404, '附件不存在');
  const ticket = await one<{ user_id: string }>(
    'SELECT user_id FROM tickets WHERE id=?',
    row.ticket_id,
  );
  if (!ticket || (p.role !== 'teacher' && ticket.user_id !== p.id))
    throw new HttpError(404, '附件不存在');
  try {
    await unlink(attachmentPath(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  database().prepare('DELETE FROM attachments WHERE id=?').bind(id).run();
  return { saved: true };
}
export async function downloadAttachment(id: string, name: string) {
  let content: Buffer;
  try {
    content = await readFile(attachmentPath(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      throw new HttpError(404, '附件不存在');
    throw e;
  }
  return new Response(new Uint8Array(content), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
