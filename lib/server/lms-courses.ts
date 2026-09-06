import { z } from 'zod';
import type { CourseRow, LessonRow, VersionRow } from './lms-records';
import type { Person } from './auth';
import type { LmsCourse, LmsLessonPayload } from '@/lib/lms-types';
import { database } from './env';
import { sqlite } from '@/db/sqlite';
import { one, rows, HttpError, requireTeacher, auditStatement } from './http';
import { ensurePrivate } from './video';
import { slug, title, expected, liveLesson, conflict } from './lms-common';

const payloadSchema = z
  .object({
    title,
    summary: z.string().trim().max(12000),
    section: title,
    position: z.number().int().min(0).max(100000),
    body: z.string().max(100000),
    streamUid: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .nullable()
      .default(null),
    videoAssetIds: z.array(z.string().min(1).max(100)).max(20).default([]),
  })
  .strict()
  .refine(
    (v) => !(v.streamUid && v.videoAssetIds.length),
    '一次只能选择本地视频或 Stream 视频',
  )
  .refine(
    (v) => new Set(v.videoAssetIds).size === v.videoAssetIds.length,
    '不能重复选择同一视频',
  );
function payload(l: LessonRow): LmsLessonPayload {
  return {
    title: l.title,
    summary: l.summary,
    section: l.section,
    position: l.position,
    body: l.body,
    streamUid: l.stream_uid || null,
    videoAssetIds: JSON.parse(l.video_asset_ids || '[]'),
  };
}
async function course(p: Person, id: string) {
  requireTeacher(p);
  const c = await one<CourseRow>('SELECT * FROM courses WHERE id=?', id);
  if (!c) throw new HttpError(404, '课程不存在');
  return c;
}
export async function courseList(p: Person): Promise<LmsCourse[]> {
  requireTeacher(p);
  const list = await rows<
    CourseRow & { lessonCount: number; publishedLessonCount: number }
  >(
    'SELECT c.*,COUNT(l.id) AS lessonCount,COALESCE(SUM(l.published),0) AS publishedLessonCount FROM courses c LEFT JOIN lessons l ON l.course_id=c.id GROUP BY c.id ORDER BY c.position,c.id',
  );
  return list.map((c) => ({ ...c, published: !!c.published }) as LmsCourse);
}
export async function courseDetail(p: Person, id: string) {
  await course(p, id);
  return {
    course: (await courseList(p)).find((c) => c.id === id),
    lessons: await rows(
      'SELECT id,course_id,title,summary,section,position,version,published,revision,updated_at,(stream_uid IS NOT NULL OR json_array_length(video_asset_ids)>0) AS has_video FROM lessons WHERE course_id=? ORDER BY position,id',
      id,
    ),
  };
}
export async function createCourse(p: Person, data: unknown) {
  requireTeacher(p);
  const d = z
    .object({
      id: slug,
      title,
      summary: z.string().trim().max(12000),
      position: z.number().int().nonnegative().default(0),
    })
    .strict()
    .parse(data);
  if (await one('SELECT id FROM courses WHERE id=?', d.id))
    throw new HttpError(409, '课程 ID 已存在');
  const db = database();
  try {
    db.batch([
      db
        .prepare(
          "INSERT INTO courses(id,title,summary,version,published,revision,position) VALUES(?,?,?,'1.0.0',0,1,?)",
        )
        .bind(d.id, d.title, d.summary, d.position),
      auditStatement(p, 'course.create', d.id),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE'))
      throw new HttpError(409, '课程 ID 已存在');
    throw e;
  }
  return courseDetail(p, d.id);
}
export async function updateCourse(p: Person, id: string, data: unknown) {
  const c = await course(p, id);
  const d = z
    .object({
      expectedRevision: expected,
      title,
      summary: z.string().trim().max(12000),
      published: z.boolean(),
      position: z.number().int().min(0).max(100000),
    })
    .strict()
    .parse(data);
  if (
    d.published &&
    !(await one(
      'SELECT id FROM lessons WHERE course_id=? AND published=1 LIMIT 1',
      id,
    ))
  )
    throw new HttpError(400, '请先发布至少一个章节');
  const db = database(),
    now = Date.now();
  sqlite().transaction(() => {
    const result = db
      .prepare(
        'UPDATE courses SET title=?,summary=?,published=?,position=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id',
      )
      .bind(
        d.title,
        d.summary,
        Number(d.published),
        d.position,
        id,
        d.expectedRevision,
      )
      .run() as unknown[];
    if (!result.length) throw conflict();
    db.prepare(
      "INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT lower(hex(randomblob(16))),u.id,?,?,?,? FROM user u WHERE ?=1 AND ?=0 AND u.email_verified=1 AND EXISTS(SELECT 1 FROM courses c WHERE c.id=? AND c.revision=?) AND EXISTS(SELECT 1 FROM grants g WHERE g.email=lower(u.email) AND (g.course_id=? OR g.course_id='*') AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?))",
    )
      .bind(
        '课程已开放',
        d.title,
        `/?view=courses`,
        now,
        Number(d.published),
        c.published,
        id,
        d.expectedRevision + 1,
        id,
        now,
      )
      .run();
    auditStatement(p, 'course.update', id).run();
  })();
  return courseDetail(p, id);
}
export async function createLesson(p: Person, courseId: string, data: unknown) {
  await course(p, courseId);
  const d = z
    .object({
      id: slug,
      title,
      summary: z.string().trim().max(12000).default(''),
      section: title,
      position: z.number().int().min(0).max(100000).default(0),
    })
    .strict()
    .parse(data);
  if (await one('SELECT id FROM lessons WHERE id=?', d.id))
    throw new HttpError(409, '章节 ID 已存在');
  const db = database();
  try {
    db.batch([
      db
        .prepare(
          "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,video_asset_ids,published,revision,updated_at) VALUES(?,?,?,?,?,?,'','0.0.0','[]',0,1,?)",
        )
        .bind(
          d.id,
          courseId,
          d.title,
          d.summary,
          d.section,
          d.position,
          Date.now(),
        ),
      auditStatement(p, 'lesson.create', d.id),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE'))
      throw new HttpError(409, '章节 ID 已存在');
    throw e;
  }
  return lessonEditor(p, d.id);
}
export async function lessonEditor(p: Person, id: string) {
  requireTeacher(p);
  const l = await liveLesson(p, id);
  const draft = await one<{
    payload_json: string;
    revision: number;
    base_revision: number;
    updated_at: number;
  }>('SELECT * FROM lms_lesson_drafts WHERE lesson_id=?', id);
  const live = payload(l),
    draftPayload: LmsLessonPayload = draft
      ? JSON.parse(draft.payload_json)
      : live;
  return {
    lesson: {
      ...l,
      has_video: !!(
        l.stream_uid || JSON.parse(l.video_asset_ids || '[]').length
      ),
    },
    draft: {
      ...draftPayload,
      lessonId: id,
      courseId: l.course_id,
      revision: draft?.revision || 0,
      baseRevision: draft?.base_revision || l.revision,
      version: l.version,
      published: !!l.published,
      hasChanges: JSON.stringify(draftPayload) !== JSON.stringify(live),
      updatedAt: draft?.updated_at || l.updated_at,
    },
    versions: await rows(
      'SELECT id,version,created_at AS createdAt,created_by AS createdBy FROM revisions WHERE lesson_id=? ORDER BY created_at DESC,id DESC',
      id,
    ),
  };
}
async function savePayload(
  p: Person,
  id: string,
  value: LmsLessonPayload,
  revision: number,
  rebase = false,
) {
  requireTeacher(p);
  const l = await liveLesson(p, id);
  const db = database(),
    now = Date.now();
  const old = await one<{ base_revision: number }>(
    'SELECT base_revision FROM lms_lesson_drafts WHERE lesson_id=?',
    id,
  );
  if (old && old.base_revision !== l.revision && !rebase) throw conflict();
  const serialized = JSON.stringify(payloadSchema.parse(value));
  const result =
    revision === 0
      ? db
          .prepare(
            'INSERT INTO lms_lesson_drafts(lesson_id,payload_json,revision,base_revision,updated_by,updated_at) SELECT ?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM lessons WHERE id=? AND revision=?) ON CONFLICT(lesson_id) DO NOTHING RETURNING revision',
          )
          .bind(id, serialized, l.revision, p.id, now, id, l.revision)
          .run()
      : db
          .prepare(
            'UPDATE lms_lesson_drafts SET payload_json=?,revision=revision+1,base_revision=?,updated_by=?,updated_at=? WHERE lesson_id=? AND revision=? AND EXISTS(SELECT 1 FROM lessons WHERE id=? AND revision=?) RETURNING revision',
          )
          .bind(serialized, l.revision, p.id, now, id, revision, id, l.revision)
          .run();
  if (!(result as unknown[]).length) throw conflict();
  auditStatement(p, 'lesson.draft.save', id).run();
  return lessonEditor(p, id);
}
export async function saveLessonDraft(p: Person, id: string, data: unknown) {
  const d = z
    .object({ expectedRevision: expected, ...payloadSchema.shape })
    .strict()
    .parse(data);
  const { expectedRevision, ...value } = d;
  return savePayload(p, id, payloadSchema.parse(value), expectedRevision);
}
function isLater(next: string, previous: string) {
  const n = next.split('.').map(Number),
    v = previous.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (n[i] > v[i]) return true;
    if (n[i] < v[i]) return false;
  }
  return false;
}
export async function publishLesson(p: Person, id: string, data: unknown) {
  requireTeacher(p);
  const d = z
    .object({
      expectedRevision: z.number().int().positive(),
      version: z.string().regex(/^\d{1,6}\.\d{1,6}\.\d{1,6}$/),
      releaseTitle: title,
      releaseSummary: z.string().trim().min(1).max(12000),
      important: z.boolean(),
    })
    .strict()
    .parse(data);
  const l = await liveLesson(p, id);
  const draft = await one<{
    payload_json: string;
    revision: number;
    base_revision: number;
  }>('SELECT * FROM lms_lesson_drafts WHERE lesson_id=?', id);
  if (
    !draft ||
    draft.revision !== d.expectedRevision ||
    draft.base_revision !== l.revision
  )
    throw conflict();
  if (!isLater(d.version, l.version))
    throw new HttpError(409, '新版本号必须大于当前发布版本');
  const value = payloadSchema.parse(JSON.parse(draft.payload_json));
  if (!value.body.trim()) throw new HttpError(400, '课件正文不能为空');
  if (value.videoAssetIds.length) {
    const found = await rows<{ id: string }>(
      `SELECT id FROM media_assets WHERE status='ready' AND id IN (${value.videoAssetIds.map(() => '?').join(',')})`,
      ...value.videoAssetIds,
    );
    if (found.length !== value.videoAssetIds.length)
      throw new HttpError(400, '请等待所有视频处理完成后发布');
  }
  if (value.streamUid) await ensurePrivate(value.streamUid);
  const db = database(),
    now = Date.now(),
    revisionId = crypto.randomUUID(),
    releaseId = crypto.randomUUID();
  let result;
  try {
    result = db.batch([
      db
        .prepare(
          'INSERT INTO revisions(id,lesson_id,version,body,stream_uid,snapshot_json,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM lessons WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM lms_lesson_drafts WHERE lesson_id=? AND revision=? AND base_revision=?) RETURNING id',
        )
        .bind(
          revisionId,
          id,
          d.version,
          value.body,
          value.streamUid,
          JSON.stringify(value),
          p.id,
          now,
          id,
          l.revision,
          id,
          d.expectedRevision,
          l.revision,
        ),
      db
        .prepare(
          'INSERT OR IGNORE INTO revisions(id,lesson_id,version,body,stream_uid,snapshot_json,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE ?=1 AND EXISTS(SELECT 1 FROM revisions WHERE id=?)',
        )
        .bind(
          crypto.randomUUID(),
          id,
          l.version,
          l.body,
          l.stream_uid,
          JSON.stringify(payload(l)),
          p.id,
          l.updated_at,
          l.published,
          revisionId,
        ),
      db
        .prepare(
          'UPDATE revisions SET snapshot_json=? WHERE lesson_id=? AND version=? AND snapshot_json IS NULL AND EXISTS(SELECT 1 FROM revisions WHERE id=?)',
        )
        .bind(JSON.stringify(payload(l)), id, l.version, revisionId),
      db
        .prepare(
          'UPDATE lessons SET title=?,summary=?,section=?,position=?,body=?,stream_uid=?,video_asset_ids=?,version=?,published=1,revision=revision+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM revisions WHERE id=?)',
        )
        .bind(
          value.title,
          value.summary,
          value.section,
          value.position,
          value.body,
          value.streamUid,
          JSON.stringify(value.videoAssetIds),
          d.version,
          now,
          id,
          revisionId,
        ),
      db
        .prepare(
          'UPDATE lms_lesson_drafts SET revision=revision+1,base_revision=base_revision+1,updated_by=?,updated_at=? WHERE lesson_id=? AND EXISTS(SELECT 1 FROM revisions WHERE id=?)',
        )
        .bind(p.id, now, id, revisionId),
      db
        .prepare(
          'INSERT INTO releases(id,course_id,lesson_id,version,title,body,important,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM revisions WHERE id=?)',
        )
        .bind(
          releaseId,
          l.course_id,
          id,
          d.version,
          d.releaseTitle,
          d.releaseSummary,
          Number(d.important),
          now,
          revisionId,
        ),
      db
        .prepare(
          "INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT lower(hex(randomblob(16))),u.id,?,?,?,? FROM user u WHERE u.email_verified=1 AND EXISTS(SELECT 1 FROM revisions WHERE id=?) AND EXISTS(SELECT 1 FROM courses WHERE id=? AND published=1) AND EXISTS(SELECT 1 FROM grants g WHERE g.email=lower(u.email) AND (g.course_id=? OR g.course_id='*') AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?))",
        )
        .bind(
          `课程更新：${d.releaseTitle}`,
          d.releaseSummary.slice(0, 180),
          `/?view=releases&release=${releaseId}`,
          now,
          revisionId,
          l.course_id,
          l.course_id,
          now,
        ),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE'))
      throw new HttpError(409, '此版本已经发布，请重新载入后使用新版本号');
    throw e;
  }
  if (!(result[0] as unknown[]).length) throw conflict();
  auditStatement(p, 'lesson.publish', id).run();
  return lessonEditor(p, id);
}
export async function lessonVersion(p: Person, id: string, version: string) {
  const l = await liveLesson(p, id);
  const v = await one<VersionRow>(
    'SELECT * FROM revisions WHERE lesson_id=? AND version=?',
    id,
    version,
  );
  if (!v) throw new HttpError(404, '课件版本不存在');
  const snap: LmsLessonPayload = v.snapshot_json
    ? JSON.parse(v.snapshot_json)
    : {
        ...payload(l),
        body: v.body,
        streamUid: v.stream_uid || null,
        videoAssetIds: [],
      };
  return {
    lessonId: id,
    courseId: l.course_id,
    version: v.version,
    createdAt: v.created_at,
    ...snap,
    streamUid: p.role === 'teacher' ? snap.streamUid : undefined,
    videoAssetIds: p.role === 'teacher' ? snap.videoAssetIds : undefined,
  };
}
export async function restoreLesson(p: Person, id: string, data: unknown) {
  requireTeacher(p);
  const d = z
    .object({ version: z.string().min(1).max(30), expectedRevision: expected })
    .strict()
    .parse(data);
  const value = await lessonVersion(p, id, d.version);
  return savePayload(
    p,
    id,
    payloadSchema.parse({
      title: value.title,
      summary: value.summary,
      section: value.section,
      position: value.position,
      body: value.body,
      streamUid: value.streamUid,
      videoAssetIds: value.videoAssetIds,
    }),
    d.expectedRevision,
    true,
  );
}
export async function lessonVisibility(p: Person, id: string, data: unknown) {
  requireTeacher(p);
  const d = z
    .object({ expectedRevision: expected, published: z.boolean() })
    .strict()
    .parse(data);
  const l = await liveLesson(p, id);
  if (
    d.published &&
    !(await one(
      'SELECT id FROM revisions WHERE lesson_id=? AND version=?',
      id,
      l.version,
    ))
  )
    throw new HttpError(400, '请先发布课件版本');
  const db = database();
  const result = db.batch([
    db
      .prepare(
        'UPDATE lessons SET published=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING id',
      )
      .bind(Number(d.published), Date.now(), id, d.expectedRevision),
    db
      .prepare(
        'UPDATE lms_lesson_drafts SET base_revision=base_revision+1 WHERE lesson_id=? AND base_revision=? AND EXISTS(SELECT 1 FROM lessons WHERE id=? AND revision=?)',
      )
      .bind(id, d.expectedRevision, id, d.expectedRevision + 1),
  ]);
  if (!(result[0] as unknown[]).length) throw conflict();
  auditStatement(p, 'lesson.visibility', id).run();
  return lessonEditor(p, id);
}
