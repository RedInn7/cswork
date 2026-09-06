import { z } from 'zod';
import type {
  TicketRow,
  ReviewRow,
  ReviewEventRow,
  ReleaseRow,
  NotificationRow,
} from './lms-records';
import type { Person } from './auth';
import { database } from './env';
import {
  one,
  rows,
  HttpError,
  requireTeacher,
  auditStatement,
  limit,
} from './http';
import {
  expected,
  liveLesson,
  conflict,
  cursorFrom,
  nextCursor,
  searchText,
  courseAccess,
  type SqlValue,
} from './lms-common';
const message = z.string().trim().min(1).max(12000);
const urlSchema = z
  .url()
  .max(1000)
  .refine(
    (s) => /^https:\/\/github\.com\/[^/]+\/[^/]+(?:\/.*)?$/.test(s),
    '请提供 GitHub 仓库或 PR 链接',
  );
export async function ticketDetail(p: Person, id: string) {
  const t = await one<TicketRow>(
    'SELECT t.*,c.title AS course_title,p.name,p.email FROM tickets t LEFT JOIN courses c ON c.id=t.course_id LEFT JOIN profiles p ON p.id=t.user_id WHERE t.id=?',
    id,
  );
  if (!t || (t.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '工单不存在');
  return {
    ...t,
    attachments: await rows(
      'SELECT id,user_id,name,size,created_at FROM attachments WHERE ticket_id=? ORDER BY created_at,id',
      id,
    ),
    replies: await rows(
      'SELECT r.*,p.name,p.role FROM replies r LEFT JOIN profiles p ON p.id=r.user_id WHERE ticket_id=? ORDER BY r.created_at,r.id',
      id,
    ),
  };
}
export async function ticketPage(p: Person, url: URL) {
  const where: string[] = [],
    args: SqlValue[] = [];
  if (p.role !== 'teacher') {
    where.push('t.user_id=?');
    args.push(p.id);
  }
  const status = url.searchParams.get('status');
  if (status && status !== 'all') {
    where.push('t.status=?');
    args.push(z.enum(['open', 'waiting', 'resolved']).parse(status));
  }
  const assigned = url.searchParams.get('assignedTo');
  if (p.role === 'teacher' && assigned) {
    where.push(
      assigned === 'unassigned' ? 't.assigned_to IS NULL' : 't.assigned_to=?',
    );
    if (assigned !== 'unassigned')
      args.push(assigned === 'me' ? p.id : assigned);
  }
  const q = searchText(url);
  if (q) {
    where.push(
      "(t.title LIKE ? ESCAPE '\\' OR t.body LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR p.email LIKE ? ESCAPE '\\')",
    );
    args.push(...Array(4).fill(`%${q}%`));
  }
  const base = where.length ? where.join(' AND ') : '1=1';
  const total = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tickets t LEFT JOIN profiles p ON p.id=t.user_id WHERE ${base}`,
    ...args,
  );
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('(t.updated_at<? OR (t.updated_at=? AND t.id<?))');
    args.push(cursor.time, cursor.time, cursor.id);
  }
  const found = await rows<TicketRow>(
    `SELECT t.*,p.name,p.email,c.title AS course_title FROM tickets t LEFT JOIN profiles p ON p.id=t.user_id LEFT JOIN courses c ON c.id=t.course_id WHERE ${where.length ? where.join(' AND ') : '1=1'} ORDER BY t.updated_at DESC,t.id DESC LIMIT 31`,
    ...args,
  );
  const items = found.slice(0, 30),
    last = items.at(-1);
  return {
    items,
    total: total?.n || 0,
    nextCursor:
      found.length > 30 && last ? nextCursor(last.updated_at, last.id) : null,
  };
}
export async function replyTicket(
  p: Person,
  id: string,
  data: unknown,
  legacy = false,
) {
  const d = z
    .object({ body: message, expectedRevision: expected.optional() })
    .strict()
    .parse(data);
  const t = await ticketDetail(p, id);
  if (!legacy && d.expectedRevision === undefined)
    throw new HttpError(400, '请提供工单版本');
  const revision = d.expectedRevision ?? t.revision,
    db = database(),
    now = Date.now(),
    replyId = crypto.randomUUID();
  const results = db.batch([
    db
      .prepare(
        'INSERT INTO replies(id,ticket_id,user_id,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM tickets WHERE id=? AND revision=?) RETURNING id',
      )
      .bind(replyId, id, p.id, d.body, now, id, revision),
    db
      .prepare(
        'UPDATE tickets SET status=?,updated_at=?,revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM replies WHERE id=?)',
      )
      .bind(p.role === 'teacher' ? 'waiting' : 'open', now, id, replyId),
    db
      .prepare(
        'INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT ?,?,?,?,?,? WHERE ?=1 AND EXISTS(SELECT 1 FROM replies WHERE id=?)',
      )
      .bind(
        crypto.randomUUID(),
        t.user_id,
        '老师回复了你的问题',
        t.title,
        `/?view=tickets&ticket=${id}`,
        now,
        Number(p.role === 'teacher' && t.user_id !== p.id),
        replyId,
      ),
  ]);
  if (!(results[0] as unknown[]).length) throw conflict();
  return ticketDetail(p, id);
}
export async function changeTicket(
  p: Person,
  id: string,
  data: unknown,
  legacy = false,
) {
  const d = z
    .object({
      status: z.enum(['open', 'waiting', 'resolved']),
      assignedTo: z.string().max(100).nullable().optional(),
      expectedRevision: expected.optional(),
    })
    .strict()
    .parse(data);
  const t = await ticketDetail(p, id);
  if (!legacy && d.expectedRevision === undefined)
    throw new HttpError(400, '请提供工单版本');
  if (d.assignedTo !== undefined || d.status === 'waiting') requireTeacher(p);
  if (
    d.assignedTo &&
    !(await one(
      "SELECT id FROM profiles WHERE id=? AND role='teacher'",
      d.assignedTo,
    ))
  )
    throw new HttpError(400, '请选择老师');
  const result = database()
    .prepare(
      'UPDATE tickets SET status=?,assigned_to=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id',
    )
    .bind(
      d.status,
      d.assignedTo === undefined ? t.assigned_to : d.assignedTo,
      Date.now(),
      id,
      d.expectedRevision ?? t.revision,
    )
    .run();
  if (!(result as unknown[]).length) throw conflict();
  auditStatement(p, 'ticket.status', id).run();
  return ticketDetail(p, id);
}
export async function reviewDetail(p: Person, id: string) {
  const r = await one<ReviewRow>(
    'SELECT r.*,p.name,p.email,l.title AS lesson_title FROM reviews r LEFT JOIN profiles p ON p.id=r.user_id LEFT JOIN lessons l ON l.id=r.lesson_id WHERE r.id=?',
    id,
  );
  if (!r || (r.user_id !== p.id && p.role !== 'teacher'))
    throw new HttpError(404, '作业不存在');
  return {
    ...r,
    events: await rows<ReviewEventRow>(
      "SELECT e.revision,e.kind,e.url,e.note,e.feedback,e.status,e.lesson_version AS lessonVersion,COALESCE(p.name,'老师') AS actorName,e.created_at AS createdAt FROM lms_review_events e LEFT JOIN profiles p ON p.id=e.actor_id WHERE e.review_id=? ORDER BY e.revision DESC",
      id,
    ),
  };
}
export async function reviewPage(p: Person, url: URL) {
  const where: string[] = [],
    args: SqlValue[] = [];
  if (p.role !== 'teacher') {
    where.push('r.user_id=?');
    args.push(p.id);
  }
  const status = url.searchParams.get('status');
  if (status && status !== 'all') {
    where.push('r.status=?');
    args.push(
      z.enum(['pending', 'approved', 'changes_requested']).parse(status),
    );
  }
  const q = searchText(url);
  if (q) {
    where.push(
      "(l.title LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR p.email LIKE ? ESCAPE '\\' OR r.note LIKE ? ESCAPE '\\')",
    );
    args.push(...Array(4).fill(`%${q}%`));
  }
  const joins =
    'FROM reviews r LEFT JOIN profiles p ON p.id=r.user_id LEFT JOIN lessons l ON l.id=r.lesson_id';
  const total = await one<{ n: number }>(
    `SELECT COUNT(*) AS n ${joins} WHERE ${where.length ? where.join(' AND ') : '1=1'}`,
    ...args,
  );
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('(r.updated_at<? OR (r.updated_at=? AND r.id<?))');
    args.push(cursor.time, cursor.time, cursor.id);
  }
  const found = await rows<ReviewRow>(
    `SELECT r.*,p.name,p.email,l.title AS lesson_title ${joins} WHERE ${where.length ? where.join(' AND ') : '1=1'} ORDER BY r.updated_at DESC,r.id DESC LIMIT 31`,
    ...args,
  );
  const items = found.slice(0, 30),
    last = items.at(-1);
  return {
    items,
    total: total?.n || 0,
    nextCursor:
      found.length > 30 && last ? nextCursor(last.updated_at, last.id) : null,
  };
}
export async function createReview(p: Person, data: unknown) {
  const d = z
    .object({
      lessonId: z.string().min(1).max(100),
      url: urlSchema,
      note: z.string().trim().max(6000),
    })
    .strict()
    .parse(data);
  const l = await liveLesson(p, d.lessonId);
  await limit(p, 'review', 10, 3600);
  const id = crypto.randomUUID(),
    now = Date.now(),
    db = database();
  db.batch([
    db
      .prepare(
        "INSERT INTO reviews(id,user_id,lesson_id,url,note,status,revision,created_at,updated_at) VALUES(?,?,?,?,?,'pending',1,?,?)",
      )
      .bind(id, p.id, d.lessonId, d.url, d.note, now, now),
    db
      .prepare(
        "INSERT INTO lms_review_events(id,review_id,revision,kind,url,note,status,lesson_version,actor_id,created_at) VALUES(?,?,1,'submit',?,?,'pending',?,?,?)",
      )
      .bind(crypto.randomUUID(), id, d.url, d.note, l.version, p.id, now),
  ]);
  return { id };
}
async function reviewWrite(
  p: Person,
  id: string,
  data: unknown,
  kind: 'resubmit' | 'feedback',
  legacy = false,
) {
  if (kind === 'feedback') requireTeacher(p);
  const r = await reviewDetail(p, id);
  if (kind === 'resubmit' && r.user_id !== p.id)
    throw new HttpError(403, '只能重新提交自己的作业');
  const d =
    kind === 'feedback'
      ? z
          .object({
            expectedRevision: expected.optional(),
            status: z.enum(['approved', 'changes_requested']),
            feedback: message,
          })
          .strict()
          .parse(data)
      : z
          .object({
            expectedRevision: expected,
            url: urlSchema,
            note: z.string().trim().max(6000),
          })
          .strict()
          .parse(data);
  if (!legacy && d.expectedRevision === undefined)
    throw new HttpError(400, '请提供作业版本');
  const l = await liveLesson(p, r.lesson_id);
  if (kind === 'resubmit' && r.status === 'pending')
    throw new HttpError(409, '作业正在等待评审，请等待老师反馈后再提交修改');
  const revision = d.expectedRevision ?? r.revision;
  if (revision !== r.revision) throw conflict();
  const newUrl = 'url' in d ? d.url : r.url,
    newNote = 'note' in d ? d.note : r.note,
    status = 'status' in d ? d.status : 'pending',
    feedback = 'feedback' in d ? d.feedback : null,
    db = database(),
    now = Date.now(),
    eventId = crypto.randomUUID();
  const result = db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO lms_review_events(id,review_id,revision,kind,url,note,feedback,status,lesson_version,actor_id,created_at) SELECT ?,id,revision,'snapshot',url,note,feedback,status,?,user_id,updated_at FROM reviews WHERE id=? AND revision=?",
      )
      .bind(crypto.randomUUID(), l.version, id, revision),
    db
      .prepare(
        'INSERT INTO lms_review_events(id,review_id,revision,kind,url,note,feedback,status,lesson_version,actor_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM reviews WHERE id=? AND revision=?) RETURNING id',
      )
      .bind(
        eventId,
        id,
        revision + 1,
        kind,
        newUrl,
        newNote,
        feedback,
        status,
        l.version,
        p.id,
        now,
        id,
        revision,
      ),
    db
      .prepare(
        'UPDATE reviews SET url=?,note=?,feedback=?,status=?,reviewed_by=?,revision=revision+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM lms_review_events WHERE id=?)',
      )
      .bind(
        newUrl,
        newNote,
        feedback,
        status,
        kind === 'feedback' ? p.id : null,
        now,
        id,
        eventId,
      ),
    db
      .prepare(
        'INSERT INTO notifications(id,user_id,title,body,href,created_at) SELECT ?,?,?,?,?,? WHERE ?=1 AND EXISTS(SELECT 1 FROM lms_review_events WHERE id=?)',
      )
      .bind(
        crypto.randomUUID(),
        r.user_id,
        '作业评审已完成',
        (feedback || '').slice(0, 180),
        `/?view=reviews&review=${id}`,
        now,
        Number(kind === 'feedback'),
        eventId,
      ),
  ]);
  if (!(result[1] as unknown[]).length) throw conflict();
  auditStatement(p, `review.${kind}`, id).run();
  return reviewDetail(p, id);
}
export const resubmitReview = (p: Person, id: string, data: unknown) =>
  reviewWrite(p, id, data, 'resubmit');
export const feedbackReview = (
  p: Person,
  id: string,
  data: unknown,
  legacy = false,
) => reviewWrite(p, id, data, 'feedback', legacy);
export async function releasePage(p: Person, url: URL) {
  const access = courseAccess(p, 'r.course_id'),
    where = [access.sql],
    args: SqlValue[] = [...access.args];
  if (p.role !== 'teacher')
    where.push(
      '(r.lesson_id IS NULL OR EXISTS(SELECT 1 FROM lessons l WHERE l.id=r.lesson_id AND l.published=1))',
    );
  const total = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM releases r WHERE ${where.join(' AND ')}`,
    ...args,
  );
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('(r.created_at<? OR (r.created_at=? AND r.id<?))');
    args.push(cursor.time, cursor.time, cursor.id);
  }
  const found = await rows<ReleaseRow>(
    `SELECT r.*,EXISTS(SELECT 1 FROM release_reads rr WHERE rr.release_id=r.id AND rr.user_id=?) AS is_read FROM releases r WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC,r.id DESC LIMIT 31`,
    p.id,
    ...args,
  );
  const items = found.slice(0, 30),
    last = items.at(-1);
  return {
    items,
    total: total?.n || 0,
    nextCursor:
      found.length > 30 && last ? nextCursor(last.created_at, last.id) : null,
  };
}
export async function notificationPage(p: Person, url: URL) {
  const args: SqlValue[] = [p.id],
    where = ['user_id=?'];
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('(created_at<? OR (created_at=? AND id<?))');
    args.push(cursor.time, cursor.time, cursor.id);
  }
  const found = await rows<NotificationRow>(
    `SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT 31`,
    ...args,
  );
  const counts = await one<{ total: number; unread: number }>(
    'SELECT COUNT(*) AS total,COALESCE(SUM(read_at IS NULL),0) AS unread FROM notifications WHERE user_id=?',
    p.id,
  );
  const items = found.slice(0, 30),
    last = items.at(-1);
  return {
    items,
    total: counts?.total || 0,
    unread: counts?.unread || 0,
    nextCursor:
      found.length > 30 && last ? nextCursor(last.created_at, last.id) : null,
  };
}
