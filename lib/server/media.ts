import { z } from 'zod';
import { createReadStream } from 'node:fs';
import { mkdir, open, stat, statfs, chmod, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { requireCourseOwner, requireCourseVisible } from './course-visibility';
import { setting } from './env';
import {
  body,
  HttpError,
  json,
  requirePerson,
  requireTeacher,
  requireCourse,
  limit,
} from './http';

const CHUNK = 4 * 1024 * 1024;
const MAX_VIDEO = 2 * 1024 * 1024 * 1024;
// The deployed service has one web process. A process-local guard remains held
// across slow filesystem operations, even if the recoverable SQLite lease expires.
const activeWrites = new Set<string>();
const GiB = 1024 ** 3;
async function withUploadWrite<T>(
  id: string,
  work: () => Promise<T>,
): Promise<T> {
  if (activeWrites.has(id))
    throw new HttpError(409, '上传位置已变化，请恢复上传');
  activeWrites.add(id);
  try {
    return await work();
  } finally {
    activeWrites.delete(id);
  }
}
async function ensureDiskSpace(bytes = CHUNK) {
  const disk = await statfs(mediaRoot());
  if (disk.bavail * disk.bsize < 3 * GiB + bytes)
    throw new HttpError(507, '视频存储空间不足，请联系管理员');
}
async function cleanupExpiredUploads() {
  const db = sqlite();
  const stale = db
    .prepare(
      "SELECT a.*,u.id AS upload_id FROM media_uploads u JOIN media_assets a ON a.id=u.asset_id WHERE u.expires_at<? AND u.lock_until<? AND a.status='uploading' LIMIT 20",
    )
    .all(Date.now(), Date.now()) as (Asset & { upload_id: string })[];
  for (const a of stale) {
    if (activeWrites.has(a.upload_id)) continue;
    await unlink(assetPath(a)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
    db.transaction(() => {
      db.prepare('DELETE FROM media_uploads WHERE id=?').run(a.upload_id);
      db.prepare(
        "DELETE FROM media_assets WHERE id=? AND status='uploading'",
      ).run(a.id);
    })();
  }
}
type Asset = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  storage_key: string;
  status: string;
  duration: number | null;
  created_by: string;
  created_at: number;
};
type Upload = {
  id: string;
  asset_id: string;
  owner_id: string;
  offset: number;
  expires_at: number;
  lock_token: string | null;
  lock_until: number;
};
type VideoLesson = {
  id: string;
  course_id: string;
  published: number;
  course_published: number;
  video_asset_ids: string;
  stream_uid: string | null;
};
export function mediaRoot() {
  return resolve(setting('MEDIA_PATH') || 'data/media');
}
function assetPath(asset: Asset) {
  if (!/^[a-zA-Z0-9_-]+\.(mp4|webm)$/.test(asset.storage_key))
    throw new HttpError(500, '素材存储信息无效');
  return join(mediaRoot(), asset.storage_key);
}
function info(a: Asset) {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mime_type,
    size: a.size,
    status: a.status,
    duration: a.duration,
    createdAt: a.created_at,
  };
}
async function lessonAccess(p: Person, id: string) {
  const l = sqlite()
    .prepare(
      'SELECT l.*,c.published AS course_published FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?',
    )
    .get(id) as VideoLesson | undefined;
  if (!l || (p.role !== 'teacher' && (!l.published || !l.course_published)))
    throw new HttpError(404, '章节不存在');
  requireCourseVisible(p, l.course_id);
  await requireCourse(p, l.course_id);
  return l;
}
function ids(l: VideoLesson): string[] {
  try {
    const parsed = JSON.parse(l.video_asset_ids);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}
function getAsset(id: string) {
  const a = sqlite()
    .prepare('SELECT * FROM media_assets WHERE id=?')
    .get(id) as Asset | undefined;
  if (!a) throw new HttpError(404, '素材不存在');
  return a;
}

/** Range parsing is used only in local/staging; production delegates file transport to nginx. */
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0)
    throw new HttpError(416, '视频范围无效');
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end = match[1]
    ? match[2]
      ? Math.min(size - 1, Number(match[2]))
      : size - 1
    : size - 1;
  if (
    (!match[1] && Number(match[2]) === 0) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= size
  )
    throw new HttpError(416, '视频范围无效');
  return { start, end };
}
async function streamAsset(request: Request, a: Asset) {
  if (a.status !== 'ready') throw new HttpError(404, '视频尚未就绪');
  let size: number;
  try {
    size = (await stat(assetPath(a))).size;
  } catch {
    throw new HttpError(503, '视频文件暂不可用，请联系老师');
  }
  if (size !== a.size) throw new HttpError(503, '视频文件尚未完整写入');
  const headers: Record<string, string> = {
    'Content-Type': a.mime_type,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    Vary: 'Cookie',
  };
  const accel = setting('MEDIA_X_ACCEL_PREFIX');
  if (accel && /^\/[a-zA-Z0-9_/-]+\/$/.test(accel)) {
    headers['X-Accel-Redirect'] = accel + a.storage_key;
    return new Response(null, { headers });
  }
  let range;
  try {
    range = byteRange(request.headers.get('range'), size);
  } catch (e) {
    if (e instanceof HttpError && e.status === 416)
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      });
    throw e;
  }
  const start = range?.start ?? 0,
    end = range?.end ?? size - 1;
  headers['Content-Length'] = String(end - start + 1);
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  const stream = createReadStream(assetPath(a), { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}
async function readChunk(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > CHUNK)
    throw new HttpError(413, '单块视频不能超过 4 MiB');
  if (!request.body) throw new HttpError(400, '缺少上传数据');
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > CHUNK) {
        void reader.cancel();
        throw new HttpError(413, '单块视频不能超过 4 MiB');
      }
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new HttpError(400, '上传数据为空');
  return Buffer.concat(parts, size);
}
export async function handleMedia(
  request: Request,
  p: Person | null,
  path: string[],
): Promise<Response | null> {
  const [resource, id, action, subaction] = path;
  const url = new URL(request.url);
  if (
    resource === 'lessons' &&
    id &&
    request.method === 'GET' &&
    (action === 'videos' || action === 'video')
  ) {
    requirePerson(p);
    const l = await lessonAccess(p, id),
      assets = ids(l)
        .map(getAsset)
        .filter((a) => a.status === 'ready');
    if (action === 'videos')
      return json({
        items: assets.map((a) => ({
          ...info(a),
          url: `/api/media/${a.id}/play?lesson=${encodeURIComponent(id)}`,
        })),
        stream: !!l.stream_uid,
      });
    if (!assets.length) return null;
    return json({
      url: `/api/media/${assets[0].id}/play?lesson=${encodeURIComponent(id)}`,
      type: assets[0].mime_type,
      expiresIn: null,
    });
  }
  if (
    resource === 'media' &&
    id &&
    action === 'play' &&
    request.method === 'GET'
  ) {
    requirePerson(p);
    if (p.role !== 'teacher' || url.searchParams.has('lesson')) {
      const l = await lessonAccess(p, url.searchParams.get('lesson') || '');
      if (!ids(l).includes(id)) throw new HttpError(404, '本章节没有此视频');
    } else requireCourseOwner(p); // Unscoped teacher playback is course administration.
    return streamAsset(request, getAsset(id));
  }
  if (resource !== 'teacher' || id !== 'media') return null;
  requireTeacher(p);
  requireCourseOwner(p);
  const db = sqlite();
  if (request.method === 'GET' && !action) {
    const q = (url.searchParams.get('q') || '').slice(0, 100),
      page = Math.max(
        0,
        Math.min(10000, Number(url.searchParams.get('page')) || 0),
      );
    const found = db
      .prepare(
        "SELECT * FROM media_assets WHERE status!='archived' AND name LIKE ? ORDER BY created_at DESC,id LIMIT 31 OFFSET ?",
      )
      .all(`%${q}%`, page * 30) as Asset[];
    return json({
      items: found.slice(0, 30).map(info),
      hasMore: found.length > 30,
      page,
    });
  }
  if (request.method === 'POST' && action === 'uploads' && !subaction) {
    await limit(p, 'media-create', 20, 3600);
    const d = z
      .object({
        name: z.string().trim().min(1).max(200),
        size: z.number().int().positive().max(MAX_VIDEO),
        mimeType: z.enum(['video/mp4', 'video/webm']),
      })
      .strict()
      .parse(await body(request));
    const assetId = randomUUID(),
      uploadId = randomUUID(),
      now = Date.now(),
      storageKey = `${assetId}.${d.mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
    await mkdir(mediaRoot(), { recursive: true, mode: 0o2750 });
    await cleanupExpiredUploads();
    await ensureDiskSpace(d.size);
    const file = await open(join(mediaRoot(), storageKey), 'wx', 0o640);
    await file.close();
    try {
      db.transaction(() => {
        const count = db
          .prepare(
            "SELECT COUNT(*) AS n FROM media_uploads u JOIN media_assets a ON a.id=u.asset_id WHERE u.owner_id=? AND u.expires_at>? AND a.status='uploading'",
          )
          .get(p.id, now) as { n: number };
        if (count.n >= 10)
          throw new HttpError(
            429,
            '最多同时保留 10 个上传任务，请先完成已有上传',
          );
        const used = db
          .prepare('SELECT COALESCE(SUM(size),0) AS n FROM media_assets')
          .get() as { n: number };
        const configured = Number(setting('MEDIA_MAX_BYTES'));
        const maximum =
          Number.isSafeInteger(configured) && configured > 0
            ? configured
            : 10 * GiB;
        if (used.n + d.size > maximum)
          throw new HttpError(507, '视频素材容量已达上限，请联系管理员');
        db.prepare(
          'INSERT INTO media_assets(id,name,mime_type,size,storage_key,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
        ).run(
          assetId,
          d.name,
          d.mimeType,
          d.size,
          storageKey,
          'uploading',
          p.id,
          now,
        );
        db.prepare(
          'INSERT INTO media_uploads(id,asset_id,owner_id,offset,expires_at,updated_at) VALUES(?,?,?,0,?,?)',
        ).run(uploadId, assetId, p.id, now + 86400000, now);
      })();
    } catch (e) {
      await unlink(join(mediaRoot(), storageKey));
      throw e;
    }
    return json(
      {
        uploadId,
        assetId,
        offset: 0,
        chunkSize: CHUNK,
        expiresAt: now + 86400000,
      },
      201,
    );
  }
  if (action === 'uploads' && subaction) {
    const upload = db
      .prepare('SELECT * FROM media_uploads WHERE id=? AND owner_id=?')
      .get(subaction, p.id) as Upload | undefined;
    if (!upload || upload.expires_at <= Date.now())
      throw new HttpError(404, '上传任务不存在或已过期');
    const a = getAsset(upload.asset_id);
    if (request.method === 'GET')
      return json({
        uploadId: upload.id,
        assetId: a.id,
        offset: upload.offset,
        size: a.size,
        chunkSize: CHUNK,
        status: a.status,
      });
    if (request.method === 'POST' && path[4] === 'chunk') {
      const offsetHeader = request.headers.get('upload-offset');
      if (!offsetHeader || !/^\d+$/.test(offsetHeader))
        throw new HttpError(400, '缺少上传位置');
      return withUploadWrite(upload.id, async () => {
        const offset = Number(offsetHeader),
          bytes = await readChunk(request),
          token = randomUUID(),
          now = Date.now();
        if (offset + bytes.length > a.size)
          throw new HttpError(413, '上传内容超过声明大小');
        if (a.status !== 'uploading')
          throw new HttpError(409, '此视频已经完成上传');
        await ensureDiskSpace(bytes.length);
        const locked = db
          .prepare(
            'UPDATE media_uploads SET lock_token=?,lock_until=? WHERE id=? AND offset=? AND lock_until<? AND expires_at>?',
          )
          .run(token, now + 30000, upload.id, offset, now, now);
        if (!locked.changes)
          throw new HttpError(409, '上传位置已变化，请恢复上传');
        const renewal = setInterval(
          () =>
            db
              .prepare(
                'UPDATE media_uploads SET lock_until=? WHERE id=? AND lock_token=?',
              )
              .run(Date.now() + 30000, upload.id, token),
          5000,
        );
        renewal.unref();
        let file;
        try {
          file = await open(assetPath(a), 'r+');
          await file.truncate(offset);
          let written = 0;
          while (written < bytes.length) {
            const r = await file.write(
              bytes,
              written,
              bytes.length - written,
              offset + written,
            );
            if (!r.bytesWritten)
              throw new Error('Unable to persist media chunk');
            written += r.bytesWritten;
          }
          await file.sync();
          const saved = db
            .prepare(
              'UPDATE media_uploads SET offset=?,updated_at=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?',
            )
            .run(offset + bytes.length, Date.now(), upload.id, token);
          if (!saved.changes)
            throw new HttpError(409, '上传锁已失效，请恢复上传');
          return json({ offset: offset + bytes.length });
        } finally {
          clearInterval(renewal);
          await file?.close();
          db.prepare(
            'UPDATE media_uploads SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?',
          ).run(upload.id, token);
        }
      });
    }
    if (request.method === 'POST' && path[4] === 'complete') {
      return withUploadWrite(upload.id, async () => {
        if (a.status === 'ready') return json({ ...info(a), saved: true });
        if (a.status !== 'uploading')
          throw new HttpError(409, '此素材不可完成上传');
        if (upload.offset !== a.size || upload.lock_until > Date.now())
          throw new HttpError(409, '视频尚未上传完整');
        const f = await open(assetPath(a), 'r');
        let valid = false;
        try {
          const head = Buffer.alloc(16);
          await f.read(head, 0, 16, 0);
          valid =
            a.mime_type === 'video/mp4'
              ? head.subarray(4, 8).toString() === 'ftyp'
              : head
                  .subarray(0, 4)
                  .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        } finally {
          await f.close();
        }
        if (!valid || (await stat(assetPath(a))).size !== a.size)
          throw new HttpError(400, '文件不是完整的 MP4/WebM 视频');
        await chmod(assetPath(a), 0o640);
        db.prepare(
          "UPDATE media_assets SET status='ready' WHERE id=? AND status='uploading'",
        ).run(a.id);
        return json({ ...info(getAsset(a.id)), saved: true });
      });
    }
  }
  if (request.method === 'POST' && action && subaction === 'archive') {
    const a = getAsset(action);
    const inUse = db
      .prepare('SELECT id FROM lessons WHERE video_asset_ids LIKE ? LIMIT 1')
      .get(`%${a.id}%`);
    if (inUse) throw new HttpError(409, '请先从章节中移除此素材');
    db.prepare("UPDATE media_assets SET status='archived' WHERE id=?").run(
      a.id,
    );
    return json({ saved: true });
  }
  throw new HttpError(404, '素材操作不存在');
}
