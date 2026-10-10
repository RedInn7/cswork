import { z } from 'zod';
import { getKnowledgeProgress } from './knowledge-progress';
import type { Course, Lesson } from '@/lib/types';
import type { TicketRow } from './lms-records';
import { person, type Person } from './auth';
import { database, setting } from './env';
import {
  json,
  fail,
  requirePerson,
  requireTeacher,
  requireCourse,
  sameOrigin,
  body,
  rows,
  one,
  allowed,
  HttpError,
  limit,
} from './http';
import { seed } from './seed';
import { ensureOjSeed, listPublishedProblems } from './oj-problems';
import { handleOj } from './oj-api';
import { judgeReady, submit, result } from './judge';
import { playback } from './video';
import { handleLms } from './lms';
import { handleMedia } from './media';
import { handleEnrollment } from './enrollment';
import { handleCommerce, annotateCommerceCourses } from './commerce';
import {
  canSeeCourse,
  courseNotificationFilter,
  requireCourseOwner,
  requireCourseVisible,
  visibleCourseSql,
} from './course-visibility';
import { liveLesson, courseAccess } from './lms-common';
import {
  ticketDetail,
  replyTicket,
  changeTicket,
  createReview,
  feedbackReview,
  releasePage,
} from './lms-support';
import { grantCourse, revokeGrant, dashboard } from './lms-roster';
import { lessonEditor, saveLessonDraft, publishLesson } from './lms-courses';
import { uploadAttachment, downloadAttachment } from './files';
const id = z.string().min(1).max(100),
  short = z.string().trim().min(1).max(180),
  long = z.string().trim().min(1).max(12000);
const lessonSelect =
  'id,course_id,title,summary,section,position,version,published,revision,(stream_uid IS NOT NULL OR json_array_length(video_asset_ids)>0) as has_video,updated_at';
async function ticketFor(p: Person, id: string) {
  const t = await one<TicketRow>('SELECT * FROM tickets WHERE id=?', id);
  if (!t || (t.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '工单不存在');
  return t;
}
const lessonFor = liveLesson;
function services() {
  const google = !!(
    setting('GOOGLE_CLIENT_ID') && setting('GOOGLE_CLIENT_SECRET')
  );
  const github = !!(
    setting('GITHUB_CLIENT_ID') && setting('GITHUB_CLIENT_SECRET')
  );
  const email = !!(setting('RESEND_API_KEY') && setting('MAIL_FROM'));
  return {
    google,
    github,
    email,
    password: true,
    registration: email || google || github,
    passwordReset: email,
    judge: judgeReady(),
    video: !!(
      setting('MEDIA_PATH') ||
      (setting('STREAM_API_TOKEN') && setting('STREAM_ACCOUNT_ID'))
    ),
    checkout: !!(
      setting('STRIPE_SECRET_KEY') && setting('STRIPE_WEBHOOK_SECRET')
    ),
  };
}
export async function bootstrap(p: Person | null) {
  const cs = await rows<Course & { revision: number; position: number }>(
    `SELECT id,title,summary,version,published,revision,position FROM courses ${p?.role === 'teacher' ? '' : 'WHERE published=1'} ORDER BY position,id`,
  );
  for (const c of cs) {
    c.has_access = p ? await allowed(p, c.id) : false;
    c.lessons = await rows<Lesson>(
      `SELECT ${lessonSelect} FROM lessons WHERE course_id=? ${p?.role === 'teacher' ? '' : 'AND published=1'} ORDER BY position,id`,
      c.id,
    );
  }
  return {
    person: p,
    // Owner-only mode returns no course content to anyone else; OJ submission
    // rights still come from course grants, so expose only those course ids.
    courses: await annotateCommerceCourses(
      cs.filter((c) => canSeeCourse(p, c.id)),
      p,
    ),
    courseAccess: cs.filter((c) => c.has_access).map((c) => c.id),
    problems: await listPublishedProblems(p),
    progress: p
      ? await rows('SELECT * FROM progress WHERE user_id=?', p.id)
      : [],
    submissions: p
      ? await rows(
          "SELECT id,problem_id,language,status,passed,total,runtime,memory,created_at FROM submissions WHERE user_id=? AND mode='judge' ORDER BY created_at DESC LIMIT 100",
          p.id,
        )
      : [],
    // Practice calendar: accepted judge runs over the last ~26 weeks; the client buckets by local day.
    activity: p
      ? await rows<{ problem_id: string; created_at: number }>(
          // Newest first so a cap drops the oldest days, not the recent ones; 26 weeks + a day.
          "SELECT problem_id,created_at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND created_at>? ORDER BY created_at DESC LIMIT 5000",
          p.id,
          Date.now() - 183 * 86400000,
        )
      : [],
    notifications: p
      ? await rows(
          `SELECT * FROM notifications WHERE user_id=?${courseNotificationFilter(p)} ORDER BY created_at DESC LIMIT 50`,
          p.id,
        )
      : [],
    unreadNotifications: p
      ? (
          await one<{ count: number }>(
            `SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL${courseNotificationFilter(p)}`,
            p.id,
          )
        )?.count || 0
      : 0,
    services: services(),
  };
}
export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, '').split('/');
    const [resource, resourceId, action] = path;
    if (resource === 'stripe' && resourceId === 'webhook') {
      const { webhook } = await import('./payments');
      return await webhook(request);
    }
    if (request.method !== 'GET') sameOrigin(request);
    await seed();
    await ensureOjSeed();
    const p = await person(request),
      db = database(),
      now = Date.now();
    for (const handler of [
      handleEnrollment,
      handleMedia,
      handleCommerce,
      handleLms,
    ]) {
      const response = await handler(request, p, path);
      if (response) return response;
    }
    if (resource === 'oj')
      // handleOj requires sign-in for everything except public OA reads.
      return await handleOj(request, p, path.slice(1));
    if (request.method === 'GET') {
      if (resource === 'bootstrap') return json(await bootstrap(p));
      requirePerson(p);
      if (resource === 'knowledge' && resourceId === 'progress') {
        return json(
          await getKnowledgeProgress(
            p,
            new URL(request.url).searchParams.get('lesson') || '',
          ),
        );
      }
      if (resource === 'attachments' && resourceId) {
        const attachment = await one<{
          id: string;
          ticket_id: string;
          name: string;
        }>('SELECT * FROM attachments WHERE id=?', resourceId);
        if (!attachment) throw new HttpError(404, '附件不存在');
        await ticketFor(p, attachment.ticket_id);
        return await downloadAttachment(attachment.id, attachment.name);
      }
      if (resource === 'lessons' && resourceId) {
        const l = await lessonFor(p, resourceId);
        if (action === 'video') {
          if (!l.stream_uid) throw new HttpError(404, '视频尚未发布');
          await limit(p, 'video', 12);
          return json(await playback(l.stream_uid));
        }
        return json({
          ...l,
          stream_uid: p.role === 'teacher' ? l.stream_uid : undefined,
          video_asset_ids: p.role === 'teacher' ? l.video_asset_ids : undefined,
          has_video: !!(
            l.stream_uid || JSON.parse(l.video_asset_ids || '[]').length
          ),
          progress: await one(
            'SELECT * FROM progress WHERE user_id=? AND lesson_id=?',
            p.id,
            l.id,
          ),
          versions: await rows(
            'SELECT version,created_at FROM revisions WHERE lesson_id=? ORDER BY created_at DESC',
            l.id,
          ),
        });
      }
      if (resource === 'search') {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
        if (!q) return json([]);
        const access = courseAccess(p, 'l.course_id');
        const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        const ls = await rows<{
          id: string;
          course_id: string;
          title: string;
          summary: string;
          body: string;
        }>(
          `SELECT l.id,l.course_id,l.title,l.summary,l.body FROM lessons l WHERE ${access.sql} ${p.role === 'teacher' ? '' : 'AND l.published=1'} AND (l.title LIKE ? ESCAPE '\\' OR l.body LIKE ? ESCAPE '\\') ORDER BY l.position,l.id LIMIT 30`,
          ...access.args,
          pattern,
          pattern,
        );
        const found = [];
        for (const l of ls)
          if (await allowed(p, l.course_id)) {
            const start = Math.max(
              0,
              l.body.toLowerCase().indexOf(q.toLowerCase()) - 50,
            );
            found.push({
              id: l.id,
              title: l.title,
              summary: l.summary,
              snippet: l.body.slice(start, start + 180).replace(/[#*`]/g, ''),
            });
          }
        return json(found);
      }
      if (resource === 'tickets') {
        if (resourceId) {
          return json(await ticketDetail(p, resourceId));
        }
        return json(
          await rows(
            'SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',
            p.id,
          ),
        );
      }
      if (resource === 'releases')
        return json((await releasePage(p, url)).items);
      if (resource === 'submissions' && resourceId)
        return json(await result(p, resourceId));
      if (resource === 'reviews')
        return json(
          await rows(
            `SELECT r.* FROM reviews r JOIN lessons l ON l.id=r.lesson_id WHERE r.user_id=?${visibleCourseSql(p, 'l.course_id')} ORDER BY r.created_at DESC LIMIT 100`,
            p.id,
          ),
        );
      if (resource === 'orders')
        return json(
          await rows(
            'SELECT id,course_id,status,amount,currency,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
            p.id,
          ),
        );
      if (resource === 'teacher') {
        requireTeacher(p);
        return json({
          tickets: await rows(
            "SELECT t.*,p.name,p.email FROM tickets t JOIN profiles p ON p.id=t.user_id ORDER BY CASE WHEN t.status='open' THEN 0 WHEN t.status='waiting' THEN 1 ELSE 2 END,t.updated_at ASC LIMIT 100",
          ),
          reviews: await rows(
            "SELECT r.*,p.name FROM reviews r JOIN profiles p ON p.id=r.user_id ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.created_at ASC LIMIT 100",
          ),
          struggles: await rows(
            "SELECT s.user_id,p.name,s.problem_id,(SELECT recent.id FROM submissions recent WHERE recent.user_id=s.user_id AND recent.problem_id=s.problem_id AND recent.mode='judge' ORDER BY recent.created_at DESC LIMIT 1) as latest_submission_id,COUNT(*) as failures,MAX(s.created_at) as last_attempt FROM submissions s JOIN profiles p ON p.id=s.user_id WHERE s.mode='judge' AND s.status IN ('wrong_answer','time_limit','memory_limit','output_limit','runtime_error','compile_error') AND s.created_at>? AND NOT EXISTS(SELECT 1 FROM submissions ok WHERE ok.user_id=s.user_id AND ok.problem_id=s.problem_id AND ok.mode='judge' AND ok.status='accepted') GROUP BY s.user_id,s.problem_id HAVING COUNT(*)>=3 ORDER BY failures DESC LIMIT 50",
            now - 7 * 86400000,
          ),
          grants: await rows(
            'SELECT * FROM grants ORDER BY created_at DESC LIMIT 100',
          ),
          staff: await rows(
            "SELECT id,name FROM profiles WHERE role='teacher'",
          ),
          students: await one(
            "SELECT COUNT(*) as count FROM profiles WHERE role='student'",
          ),
          counts: (await dashboard(p)).counts,
          services: services(),
        });
      }
      throw new HttpError(404, '页面不存在');
    }
    requirePerson(p);
    await limit(p, 'write', 90);
    if (resource === 'tickets' && resourceId && action === 'attachments') {
      await ticketFor(p, resourceId);
      await limit(p, 'upload', 20, 3600);
      return await uploadAttachment(request, p, resourceId);
    }
    const data = await body(request);
    if (resource === 'progress' && request.method === 'POST') {
      const d = z
        .object({
          lessonId: id,
          completed: z.boolean().optional(),
          position: z.number().min(0).max(86400).optional(),
          note: z.string().max(20000).optional(),
          bookmarked: z.boolean().optional(),
          videoAssetId: id.nullable().optional(),
        })
        .parse(data);
      const lesson = await lessonFor(p, d.lessonId);
      if (
        d.videoAssetId &&
        !(JSON.parse(lesson.video_asset_ids || '[]') as string[]).includes(
          d.videoAssetId,
        )
      )
        throw new HttpError(400, '视频不属于此章节');
      const fields: Record<string, string | number | null> = {};
      if (d.videoAssetId !== undefined) fields.video_asset_id = d.videoAssetId;
      if (d.completed !== undefined) fields.completed = d.completed ? 1 : 0;
      if (d.position !== undefined) fields.position = d.position;
      if (d.note !== undefined) fields.note = d.note;
      if (d.bookmarked !== undefined) fields.bookmarked = d.bookmarked ? 1 : 0;
      const keys = Object.keys(fields);
      if (!keys.length) throw new HttpError(400, '没有需要保存的内容');
      db.prepare(
        `INSERT INTO progress(user_id,lesson_id,updated_at,${keys.join(',')}) VALUES(?,?,?,${keys.map(() => '?').join(',')}) ON CONFLICT(user_id,lesson_id) DO UPDATE SET updated_at=excluded.updated_at,${keys.map((k) => `${k}=excluded.${k}`).join(',')}`,
      )
        .bind(p.id, d.lessonId, now, ...Object.values(fields))
        .run();
      return json({ saved: true });
    }
    if (resource === 'tickets' && request.method === 'POST') {
      if (!resourceId) {
        const d = z
          .object({
            title: short,
            body: long,
            lessonId: id.optional(),
            courseId: id.optional(),
            submissionId: id.optional(),
            videoPosition: z.number().min(0).max(86400).optional(),
            videoAssetId: id.optional(),
          })
          .parse(data);
        await limit(p, 'ticket', 10, 3600);
        if (d.courseId) requireCourseVisible(p, d.courseId);
        const ticketLesson = d.lessonId ? await lessonFor(p, d.lessonId) : null;
        if (
          d.videoAssetId &&
          (!ticketLesson ||
            !(JSON.parse(ticketLesson.video_asset_ids) as string[]).includes(
              d.videoAssetId,
            ))
        )
          throw new HttpError(400, '视频不属于此章节');
        if (
          d.courseId &&
          !(await one(
            `SELECT id FROM courses WHERE id=? ${p.role === 'teacher' ? '' : 'AND published=1'}`,
            d.courseId,
          ))
        )
          throw new HttpError(404, '课程不存在');
        if (d.submissionId) {
          const s = await one<{ user_id: string }>(
            'SELECT user_id FROM submissions WHERE id=?',
            d.submissionId,
          );
          if (!s || s.user_id !== p.id) throw new HttpError(404, '提交不存在');
        }
        const tid = crypto.randomUUID();
        db.prepare(
          'INSERT INTO tickets(id,user_id,title,body,lesson_id,course_id,submission_id,video_position,video_asset_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
          .bind(
            tid,
            p.id,
            d.title,
            d.body,
            d.lessonId || null,
            d.courseId || null,
            d.submissionId || null,
            d.videoPosition ?? null,
            d.videoAssetId || null,
            'open',
            now,
            now,
          )
          .run();
        return json({ id: tid }, 201);
      }
      if (action === 'reply') {
        await replyTicket(p, resourceId, data, true);
        return json({ saved: true });
      }
      if (action === 'status') {
        await changeTicket(p, resourceId, data, true);
        return json({ saved: true });
      }
    }
    if (resource === 'submissions' && request.method === 'POST') {
      const d = z
        .object({
          problemId: id,
          language: z.enum(['python', 'go', 'java', 'cpp']),
          code: z.string().min(1).max(60000),
        })
        .parse(data);
      await requireCourse(p, 'gomall');
      return json(await submit(p, d.problemId, d.language, d.code), 201);
    }
    if (resource === 'reviews' && request.method === 'POST') {
      if (!resourceId) return json(await createReview(p, data), 201);
      await feedbackReview(p, resourceId, data, true);
      return json({ saved: true });
    }
    if (resource === 'notifications' && request.method === 'POST') {
      const d = z.object({ id }).parse(data);
      db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?')
        .bind(now, d.id, p.id)
        .run();
      return json({ saved: true });
    }
    if (resource === 'releases' && resourceId && action === 'read') {
      const r = await one<{ course_id: string }>(
        'SELECT course_id FROM releases WHERE id=?',
        resourceId,
      );
      if (!r) throw new HttpError(404, '更新不存在');
      requireCourseVisible(p, r.course_id);
      await requireCourse(p, r.course_id);
      db.prepare(
        'INSERT OR IGNORE INTO release_reads(user_id,release_id) VALUES(?,?)',
      )
        .bind(p.id, resourceId)
        .run();
      return json({ saved: true });
    }
    if (resource === 'checkout') {
      const { checkout } = await import('./payments');
      return json(
        await checkout(p, z.object({ courseId: id }).parse(data).courseId),
      );
    }
    if (resource === 'teacher') {
      requireTeacher(p);
      if (resourceId === 'grants') return json(await grantCourse(p, data), 201);
      if (resourceId === 'revoke')
        return json(await revokeGrant(p, z.object({ id }).parse(data).id));
      if (resourceId === 'publish') {
        requireCourseOwner(p);
        const d = z
          .object({
            lessonId: id,
            version: z
              .string()
              .regex(/^\d+\.\d+\.\d+$/)
              .max(30),
            title: short,
            summary: long,
            body: z.string().min(1).max(100000),
            streamUid: z
              .string()
              .regex(/^[a-f0-9]{32}$/)
              .nullable(),
            important: z.boolean(),
          })
          .parse(data);
        const editor = await lessonEditor(p, d.lessonId);
        if (editor.draft.hasChanges)
          throw new HttpError(
            409,
            '此章节已有未发布草稿，请在课程管理中继续编辑',
          );
        const saved = await saveLessonDraft(p, d.lessonId, {
          expectedRevision: editor.draft.revision,
          title: editor.draft.title,
          summary: editor.draft.summary,
          section: editor.draft.section,
          position: editor.draft.position,
          body: d.body,
          streamUid: d.streamUid,
          videoAssetIds: d.streamUid ? [] : editor.draft.videoAssetIds,
        });
        await publishLesson(p, d.lessonId, {
          expectedRevision: saved.draft.revision,
          version: d.version,
          releaseTitle: d.title,
          releaseSummary: d.summary,
          important: d.important,
        });
        const released = await one<{ id: string }>(
          'SELECT id FROM releases WHERE lesson_id=? AND version=? ORDER BY created_at DESC LIMIT 1',
          d.lessonId,
          d.version,
        );
        return json({ id: released!.id }, 201);
      }
    }
    throw new HttpError(404, '操作不存在');
  } catch (e) {
    return fail(e);
  }
}
