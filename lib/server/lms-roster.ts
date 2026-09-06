import { z } from 'zod';
import type { GrantRow, StudentRow } from './lms-records';
import type { Person } from './auth';
import { database } from './env';
import { sqlite } from '@/db/sqlite';
import { rows, one, requireTeacher, HttpError, auditStatement } from './http';
import {
  cursorFrom,
  nextCursor,
  searchText,
  type SqlValue,
} from './lms-common';
export async function grantCourse(p: Person, data: unknown) {
  requireTeacher(p);
  const d = z
    .object({
      email: z
        .email()
        .trim()
        .max(254)
        .transform((s) => s.toLowerCase()),
      courseId: z.string().min(1).max(100).default('gomall'),
      expiresAt: z.number().int().positive().nullable().default(null),
      idempotencyKey: z.string().min(8).max(100).optional(),
    })
    .strict()
    .parse(data);
  if (
    d.courseId !== '*' &&
    !(await one('SELECT id FROM courses WHERE id=?', d.courseId))
  )
    throw new HttpError(400, '课程不存在');
  if (d.expiresAt && d.expiresAt <= Date.now())
    throw new HttpError(400, '到期时间必须在未来');
  const db = database(),
    now = Date.now(),
    id = crypto.randomUUID();
  const payloadJson = JSON.stringify({
    email: d.email,
    courseId: d.courseId,
    expiresAt: d.expiresAt,
  });
  return sqlite().transaction(() => {
    if (d.idempotencyKey) {
      const replay = db
        .prepare(
          'SELECT payload_json,grant_id FROM lms_grant_requests WHERE actor_id=? AND key=?',
        )
        .bind(p.id, d.idempotencyKey)
        .first<{ payload_json: string; grant_id: string }>();
      if (replay) {
        if (replay.payload_json !== payloadJson)
          throw new HttpError(409, '此幂等请求已用于其他授权内容');
        return { id: replay.grant_id, reused: true };
      }
    }
    const existing = db
      .prepare(
        "SELECT id FROM grants WHERE email=? AND course_id=? AND source='instructor' AND revoked_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1",
      )
      .bind(d.email, d.courseId)
      .first<{ id: string }>();
    const grantId = existing?.id || id;
    if (!existing)
      db.prepare(
        "INSERT INTO grants(id,email,course_id,source,expires_at,created_at) VALUES(?,?,?,'instructor',?,?)",
      )
        .bind(id, d.email, d.courseId, d.expiresAt, now)
        .run();
    else
      db.prepare('UPDATE grants SET expires_at=? WHERE id=?')
        .bind(d.expiresAt, grantId)
        .run();
    db.prepare(
      "UPDATE grants SET revoked_at=? WHERE email=? AND course_id=? AND source='instructor' AND revoked_at IS NULL AND id<>?",
    )
      .bind(now, d.email, d.courseId, grantId)
      .run();
    if (d.idempotencyKey)
      db.prepare(
        'INSERT INTO lms_grant_requests(actor_id,key,payload_json,grant_id,created_at) VALUES(?,?,?,?,?)',
      )
        .bind(p.id, d.idempotencyKey, payloadJson, grantId, now)
        .run();
    auditStatement(p, existing ? 'grant.renew' : 'grant.create', grantId).run();
    return { id: grantId, reused: !!existing };
  })();
}
export async function revokeGrant(p: Person, id: string) {
  requireTeacher(p);
  const g = await one<GrantRow>('SELECT * FROM grants WHERE id=?', id);
  if (!g) throw new HttpError(404, '授权记录不存在');
  const db = database();
  db.batch([
    db
      .prepare(
        "UPDATE grants SET revoked_at=? WHERE id=? OR (?='instructor' AND email=? AND course_id=? AND source='instructor' AND revoked_at IS NULL)",
      )
      .bind(Date.now(), id, g.source, g.email, g.course_id),
    auditStatement(p, 'grant.revoke', id),
  ]);
  return { saved: true };
}
export async function grantPage(p: Person, url: URL) {
  requireTeacher(p);
  const where: string[] = [],
    args: SqlValue[] = [];
  const q = searchText(url);
  if (q) {
    where.push("g.email LIKE ? ESCAPE '\\'");
    args.push(`%${q}%`);
  }
  const course = url.searchParams.get('courseId');
  if (course) {
    where.push('g.course_id=?');
    args.push(course);
  }
  const state = url.searchParams.get('state');
  if (state === 'active') {
    where.push(
      'g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?)',
    );
    args.push(Date.now());
  } else if (state === 'expired') {
    where.push('g.revoked_at IS NULL AND g.expires_at<=?');
    args.push(Date.now());
  } else if (state === 'revoked') where.push('g.revoked_at IS NOT NULL');
  const total = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM grants g WHERE ${where.length ? where.join(' AND ') : '1=1'}`,
    ...args,
  );
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('(g.created_at<? OR(g.created_at=? AND g.id<?))');
    args.push(cursor.time, cursor.time, cursor.id);
  }
  const found = await rows<GrantRow>(
    `SELECT g.*,c.title AS course_title FROM grants g LEFT JOIN courses c ON c.id=g.course_id WHERE ${where.length ? where.join(' AND ') : '1=1'} ORDER BY g.created_at DESC,g.id DESC LIMIT 31`,
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
export async function studentPage(p: Person, url: URL) {
  requireTeacher(p);
  const joins =
    'FROM (SELECT lower(email) AS email FROM user UNION SELECT email FROM grants) e LEFT JOIN user u ON lower(u.email)=e.email LEFT JOIN profiles p ON p.id=u.id';
  const where: string[] = ["COALESCE(p.role,'student')!='teacher'"],
    args: SqlValue[] = [];
  const q = searchText(url);
  if (q) {
    where.push("(e.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
    args.push(`%${q}%`, `%${q}%`);
  }
  const total = await one<{ n: number }>(
    `SELECT COUNT(*) AS n ${joins} WHERE ${where.length ? where.join(' AND ') : '1=1'}`,
    ...args,
  );
  const cursor = cursorFrom(url);
  if (cursor) {
    where.push('e.email>?');
    args.push(cursor.id);
  }
  const found = await rows<StudentRow>(
    `SELECT e.email,u.id AS userId,COALESCE(u.name,e.email) AS name,COALESCE(u.email_verified,0) AS verified,u.created_at AS joinedAt ${joins} WHERE ${where.length ? where.join(' AND ') : '1=1'} ORDER BY e.email LIMIT 31`,
    ...args,
  );
  const items = await Promise.all(
    found.slice(0, 30).map(async (row) => {
      const grants = await rows<GrantRow>(
        'SELECT * FROM grants WHERE email=? ORDER BY created_at DESC',
        row.email,
      );
      return {
        ...row,
        verified: !!row.verified,
        grants,
        activeCourseIds: [
          ...new Set(
            grants
              .filter(
                (g) =>
                  !g.revoked_at && (!g.expires_at || g.expires_at > Date.now()),
              )
              .map((g) => g.course_id),
          ),
        ],
      };
    }),
  );
  const last = items.at(-1);
  return {
    items,
    total: total?.n || 0,
    nextCursor: found.length > 30 && last ? nextCursor(0, last.email) : null,
  };
}
export async function dashboard(p: Person) {
  requireTeacher(p);
  const now = Date.now();
  const counts = await one(
    "SELECT (SELECT COUNT(*) FROM tickets WHERE status='open') AS openTickets,(SELECT COUNT(*) FROM tickets WHERE status='waiting') AS waitingTickets,(SELECT COUNT(*) FROM reviews WHERE status='pending') AS pendingReviews,(SELECT COUNT(*) FROM user u LEFT JOIN profiles p ON p.id=u.id WHERE COALESCE(p.role,'student')!='teacher') AS students,(SELECT COUNT(*) FROM grants WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)) AS activeGrants",
    now,
  );
  return {
    counts,
    tickets: await rows(
      "SELECT t.*,p.name,p.email,c.title AS course_title FROM tickets t LEFT JOIN profiles p ON p.id=t.user_id LEFT JOIN courses c ON c.id=t.course_id WHERE status='open' ORDER BY updated_at,id LIMIT 20",
    ),
    reviews: await rows(
      "SELECT r.*,p.name,l.title AS lesson_title FROM reviews r LEFT JOIN profiles p ON p.id=r.user_id LEFT JOIN lessons l ON l.id=r.lesson_id WHERE r.status='pending' ORDER BY r.updated_at,r.id LIMIT 20",
    ),
    staff: await rows("SELECT id,name FROM profiles WHERE role='teacher'"),
  };
}
