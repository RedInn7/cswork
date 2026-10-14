import { randomBytes } from 'node:crypto';
import { sqlite } from '@/db/sqlite';
import { canSeeCourse } from './course-visibility';

/**
 * Course completion certificates. bootstrap() issues one the first time it sees every
 * published lesson of a course the learner holds completed; the random id is the
 * verification code on the public page /certificate/<id>, which the learner chooses to share.
 */
export const CERTIFICATE_ID = /^[A-Za-z0-9_-]{16}$/;
export type Certificate = { id: string; courseId: string; issuedAt: number };

const mine = (userId: string) =>
  sqlite()
    .prepare('SELECT id,course_id AS courseId,issued_at AS issuedAt FROM certificates WHERE user_id=? ORDER BY issued_at,id')
    .all(userId) as Certificate[];

/** Courses the learner holds whose published lessons (at least one) are all completed. */
export function finishedCourses(
  courses: { id: string; has_access: boolean; lessons: { id: string; published?: number }[] }[],
  progress: { lesson_id: string; completed: number }[],
) {
  const completed = new Set(progress.filter((r) => r.completed).map((r) => r.lesson_id));
  return courses
    .filter((c) => {
      const lessons = c.lessons.filter((l) => l.published);
      return c.has_access && lessons.length > 0 && lessons.every((l) => completed.has(l.id));
    })
    .map((c) => c.id);
}

/** The learner's certificates, after issuing any missing one for the courses in `completed`. */
export function certificatesFor(userId: string, completed: string[], now = Date.now()) {
  const list = mine(userId);
  const missing = completed.filter((courseId) => !list.some((c) => c.courseId === courseId));
  // Read-only once issued: the periodic bootstrap does not write.
  if (!missing.length) return list;
  const insert = sqlite().prepare(
    'INSERT INTO certificates(id,user_id,course_id,issued_at) VALUES(?,?,?,?) ON CONFLICT(user_id,course_id) DO NOTHING',
  );
  for (const courseId of missing) insert.run(randomBytes(12).toString('base64url'), userId, courseId, now);
  return mine(userId);
}

/**
 * What /certificate/<id> shows, or null for a malformed or unknown id and for a course hidden
 * from the public (owner-only mode). The name is the account's display name; the handle only
 * when the learner keeps a public profile.
 */
export function certificateById(id: string) {
  if (!CERTIFICATE_ID.test(id)) return null;
  const row = sqlite()
    .prepare(
      `SELECT c.id,c.course_id AS courseId,c.issued_at AS issuedAt,co.title AS course,u.name,
        (SELECT handle FROM user_profiles up WHERE up.user_id=c.user_id AND up.visible=1) AS handle,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id AND l.published=1) AS lessons
      FROM certificates c JOIN courses co ON co.id=c.course_id JOIN user u ON u.id=c.user_id WHERE c.id=?`,
    )
    .get(id) as
    | { id: string; courseId: string; issuedAt: number; course: string; name: string; handle: string | null; lessons: number }
    | undefined;
  return row && canSeeCourse(null, row.courseId) ? row : null;
}

/** Certificates on a visible public profile, newest first. */
export function profileCertificates(handle: string) {
  return (
    sqlite()
      .prepare(
        `SELECT c.id,c.course_id AS courseId,c.issued_at AS issuedAt,co.title AS course FROM certificates c
        JOIN user_profiles up ON up.user_id=c.user_id AND up.visible=1 JOIN courses co ON co.id=c.course_id
        WHERE up.handle=? ORDER BY c.issued_at DESC,c.id`,
      )
      .all(handle) as (Certificate & { course: string })[]
  ).filter((c) => canSeeCourse(null, c.courseId));
}
