import { z } from 'zod';
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
  auditStatement,
} from './http';
import { seed } from './seed';
import { problems } from '@/lib/problems';
import { judgeReady, submit, result } from './judge';
import { playback, ensurePrivate } from './video';
import { uploadAttachment, downloadAttachment } from './files';
const id = z.string().min(1).max(100),
  short = z.string().trim().min(1).max(180),
  long = z.string().trim().min(1).max(12000);
const lessonSelect =
  'id,course_id,title,summary,section,position,version,stream_uid IS NOT NULL as has_video,updated_at';
async function ticketFor(p: Person, id: string) {
  const t = await one<any>('SELECT * FROM tickets WHERE id=?', id);
  if (!t || (t.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '工单不存在');
  return t;
}
async function lessonFor(p: Person, id: string) {
  const l = await one<any>('SELECT * FROM lessons WHERE id=?', id);
  if (!l) throw new HttpError(404, '章节不存在');
  await requireCourse(p, l.course_id);
  return l;
}
async function bootstrap(p: Person | null) {
  const cs = await rows<any>(
    'SELECT id,title,summary,version,published FROM courses WHERE published=1',
  );
  for (const c of cs) {
    c.has_access = p ? await allowed(p, c.id) : false;
    c.lessons = await rows(
      `SELECT ${lessonSelect} FROM lessons WHERE course_id=? ORDER BY position`,
      c.id,
    );
  }
  return {
    person: p,
    courses: cs,
    problems,
    progress: p
      ? await rows('SELECT * FROM progress WHERE user_id=?', p.id)
      : [],
    submissions: p
      ? await rows(
          'SELECT id,problem_id,language,status,passed,total,runtime,memory,created_at FROM submissions WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
          p.id,
        )
      : [],
    notifications: p
      ? await rows(
          'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
          p.id,
        )
      : [],
    services: {
      google: !!(
        setting('GOOGLE_CLIENT_ID') && setting('GOOGLE_CLIENT_SECRET')
      ),
      github: !!(
        setting('GITHUB_CLIENT_ID') && setting('GITHUB_CLIENT_SECRET')
      ),
      email: !!(setting('RESEND_API_KEY') && setting('MAIL_FROM')),
      chatgpt: setting('ENABLE_CHATGPT_AUTH') === 'true',
      judge: judgeReady(),
      checkout: !!(
        setting('STRIPE_SECRET_KEY') &&
        setting('STRIPE_PRICE_GOMALL') &&
        setting('STRIPE_WEBHOOK_SECRET')
      ),
    },
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
    const p = await person(request),
      db = database(),
      now = Date.now();
    if (request.method === 'GET') {
      if (resource === 'bootstrap') return json(await bootstrap(p));
      requirePerson(p);
      if (resource === 'attachments' && resourceId) {
        const attachment = await one<any>(
          'SELECT * FROM attachments WHERE id=?',
          resourceId,
        );
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
          has_video: !!l.stream_uid,
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
        const ls = await rows<any>(
          'SELECT id,course_id,title,summary,body FROM lessons WHERE title LIKE ? OR body LIKE ? LIMIT 30',
          `%${q}%`,
          `%${q}%`,
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
          const t = await ticketFor(p, resourceId);
          return json({
            ...t,
            attachments: await rows(
              'SELECT id,name,size,created_at FROM attachments WHERE ticket_id=? ORDER BY created_at',
              t.id,
            ),
            replies: await rows(
              'SELECT r.*,p.name,p.role FROM replies r JOIN profiles p ON p.id=r.user_id WHERE ticket_id=? ORDER BY created_at',
              t.id,
            ),
          });
        }
        return json(
          await rows(
            'SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',
            p.id,
          ),
        );
      }
      if (resource === 'releases') {
        const rs = await rows<any>(
          'SELECT r.*,EXISTS(SELECT 1 FROM release_reads rr WHERE rr.release_id=r.id AND rr.user_id=?) as is_read FROM releases r ORDER BY created_at DESC LIMIT 100',
          p.id,
        );
        const result = [];
        for (const r of rs) if (await allowed(p, r.course_id)) result.push(r);
        return json(result);
      }
      if (resource === 'submissions' && resourceId)
        return json(await result(p, resourceId));
      if (resource === 'reviews')
        return json(
          await rows(
            'SELECT * FROM reviews WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
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
            "SELECT s.user_id,p.name,s.problem_id,(SELECT recent.id FROM submissions recent WHERE recent.user_id=s.user_id AND recent.problem_id=s.problem_id ORDER BY recent.created_at DESC LIMIT 1) as latest_submission_id,COUNT(*) as failures,MAX(s.created_at) as last_attempt FROM submissions s JOIN profiles p ON p.id=s.user_id WHERE s.status IN ('wrong_answer','time_limit','runtime_error','compile_error') AND s.created_at>? AND NOT EXISTS(SELECT 1 FROM submissions ok WHERE ok.user_id=s.user_id AND ok.problem_id=s.problem_id AND ok.status='accepted') GROUP BY s.user_id,s.problem_id HAVING COUNT(*)>=3 ORDER BY failures DESC LIMIT 50",
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
          services: {
            video: !!setting('STREAM_API_TOKEN'),
            judge: judgeReady(),
            google: !!setting('GOOGLE_CLIENT_ID'),
            github: !!setting('GITHUB_CLIENT_ID'),
            email: !!setting('RESEND_API_KEY'),
            checkout: !!setting('STRIPE_SECRET_KEY'),
          },
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
          position: z.number().finite().min(0).max(86400).optional(),
          note: z.string().max(20000).optional(),
          bookmarked: z.boolean().optional(),
        })
        .parse(data);
      await lessonFor(p, d.lessonId);
      const fields: Record<string, string | number> = {};
      if (d.completed !== undefined) fields.completed = d.completed ? 1 : 0;
      if (d.position !== undefined) fields.position = d.position;
      if (d.note !== undefined) fields.note = d.note;
      if (d.bookmarked !== undefined) fields.bookmarked = d.bookmarked ? 1 : 0;
      const keys = Object.keys(fields);
      if (!keys.length) throw new HttpError(400, '没有需要保存的内容');
      await db
        .prepare(
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
            submissionId: id.optional(),
            videoPosition: z.number().finite().min(0).max(86400).optional(),
          })
          .parse(data);
        await limit(p, 'ticket', 10, 3600);
        if (d.lessonId) await lessonFor(p, d.lessonId);
        if (d.submissionId) {
          const s = await one<any>(
            'SELECT user_id FROM submissions WHERE id=?',
            d.submissionId,
          );
          if (!s || s.user_id !== p.id) throw new HttpError(404, '提交不存在');
        }
        const tid = crypto.randomUUID();
        await db
          .prepare(
            'INSERT INTO tickets(id,user_id,title,body,lesson_id,submission_id,video_position,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            tid,
            p.id,
            d.title,
            d.body,
            d.lessonId || null,
            d.submissionId || null,
            d.videoPosition ?? null,
            'open',
            now,
            now,
          )
          .run();
        return json({ id: tid }, 201);
      }
      const t = await ticketFor(p, resourceId);
      if (action === 'reply') {
        const d = z.object({ body: long }).parse(data);
        const statements = [
          db
            .prepare(
              'INSERT INTO replies(id,ticket_id,user_id,body,created_at) VALUES(?,?,?,?,?)',
            )
            .bind(crypto.randomUUID(), t.id, p.id, d.body, now),
          db
            .prepare('UPDATE tickets SET status=?,updated_at=? WHERE id=?')
            .bind(p.role === 'teacher' ? 'waiting' : 'open', now, t.id),
        ];
        if (p.role === 'teacher' && t.user_id !== p.id)
          statements.push(
            db
              .prepare(
                'INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)',
              )
              .bind(
                crypto.randomUUID(),
                t.user_id,
                '老师回复了你的问题',
                t.title,
                `/?view=tickets&ticket=${t.id}`,
                now,
              ),
          );
        await db.batch(statements);
        return json({ saved: true });
      }
      if (action === 'status') {
        const d = z
          .object({
            status: z.enum(['open', 'resolved']),
            assignedTo: z.string().nullable().optional(),
          })
          .parse(data);
        if (d.assignedTo !== undefined) {
          requireTeacher(p);
          if (
            d.assignedTo &&
            !(await one(
              "SELECT id FROM profiles WHERE id=? AND role='teacher'",
              d.assignedTo,
            ))
          )
            throw new HttpError(400, '请选择老师');
          await db
            .prepare('UPDATE tickets SET assigned_to=? WHERE id=?')
            .bind(d.assignedTo, t.id)
            .run();
        }
        await db.batch([
          db
            .prepare('UPDATE tickets SET status=?,updated_at=? WHERE id=?')
            .bind(d.status, now, t.id),
          auditStatement(p, 'ticket.status', t.id),
        ]);
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
      if (!resourceId) {
        const d = z
          .object({
            lessonId: id,
            url: z
              .string()
              .url()
              .max(1000)
              .refine(
                (s) => /^https:\/\/github\.com\/[^/]+\/[^/]+(?:\/.*)?$/.test(s),
                '请提供 GitHub 仓库或 PR 链接',
              ),
            note: z.string().trim().max(6000),
          })
          .parse(data);
        await lessonFor(p, d.lessonId);
        await limit(p, 'review', 10, 3600);
        const rid = crypto.randomUUID();
        await db
          .prepare(
            'INSERT INTO reviews(id,user_id,lesson_id,url,note,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
          )
          .bind(rid, p.id, d.lessonId, d.url, d.note, 'pending', now, now)
          .run();
        return json({ id: rid }, 201);
      }
      requireTeacher(p);
      const d = z
        .object({
          status: z.enum(['approved', 'changes_requested']),
          feedback: long,
        })
        .parse(data);
      const r = await one<any>('SELECT * FROM reviews WHERE id=?', resourceId);
      if (!r) throw new HttpError(404, '作业不存在');
      await db.batch([
        db
          .prepare(
            'UPDATE reviews SET status=?,feedback=?,reviewed_by=?,updated_at=? WHERE id=?',
          )
          .bind(d.status, d.feedback, p.id, now, r.id),
        db
          .prepare(
            'INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            r.user_id,
            '作业评审已完成',
            d.feedback.slice(0, 180),
            '/?view=reviews',
            now,
          ),
        auditStatement(p, 'review.feedback', r.id),
      ]);
      return json({ saved: true });
    }
    if (resource === 'notifications' && request.method === 'POST') {
      const d = z.object({ id }).parse(data);
      await db
        .prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?')
        .bind(now, d.id, p.id)
        .run();
      return json({ saved: true });
    }
    if (resource === 'releases' && resourceId && action === 'read') {
      const r = await one<any>(
        'SELECT course_id FROM releases WHERE id=?',
        resourceId,
      );
      if (!r) throw new HttpError(404, '更新不存在');
      await requireCourse(p, r.course_id);
      await db
        .prepare(
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
      if (resourceId === 'grants') {
        const d = z
          .object({
            email: z
              .string()
              .email()
              .max(254)
              .transform((s) => s.toLowerCase()),
            courseId: z.enum(['gomall', '*']).default('gomall'),
            expiresAt: z.number().int().positive().nullable().default(null),
          })
          .parse(data);
        const gid = crypto.randomUUID();
        await db.batch([
          db
            .prepare(
              'INSERT INTO grants(id,email,course_id,source,expires_at,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(gid, d.email, d.courseId, 'instructor', d.expiresAt, now),
          auditStatement(p, 'grant.create', gid),
        ]);
        return json({ id: gid }, 201);
      }
      if (resourceId === 'revoke') {
        const d = z.object({ id }).parse(data);
        await db.batch([
          db
            .prepare('UPDATE grants SET revoked_at=? WHERE id=?')
            .bind(now, d.id),
          auditStatement(p, 'grant.revoke', d.id),
        ]);
        return json({ saved: true });
      }
      if (resourceId === 'publish') {
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
        const l = await lessonFor(p, d.lessonId);
        if (d.streamUid) await ensurePrivate(d.streamUid);
        if (
          await one(
            'SELECT id FROM revisions WHERE lesson_id=? AND version=?',
            l.id,
            d.version,
          )
        )
          throw new HttpError(409, '此版本已经发布，请使用新的版本号');
        const rid = crypto.randomUUID();
        await db.batch([
          db
            .prepare(
              'INSERT INTO revisions(id,lesson_id,version,body,stream_uid,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              l.id,
              d.version,
              d.body,
              d.streamUid,
              now,
            ),
          db
            .prepare(
              'UPDATE lessons SET body=?,version=?,stream_uid=?,updated_at=? WHERE id=?',
            )
            .bind(d.body, d.version, d.streamUid, now, l.id),
          db
            .prepare(
              'INSERT INTO releases(id,course_id,lesson_id,version,title,body,important,created_at) VALUES(?,?,?,?,?,?,?,?)',
            )
            .bind(
              rid,
              l.course_id,
              l.id,
              d.version,
              d.title,
              d.summary,
              d.important ? 1 : 0,
              now,
            ),
          auditStatement(p, 'lesson.publish', l.id),
        ]);
        return json({ id: rid }, 201);
      }
    }
    throw new HttpError(404, '操作不存在');
  } catch (e) {
    return fail(e);
  }
}
