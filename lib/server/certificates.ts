import { randomBytes } from 'node:crypto';
import { sqlite } from '@/db/sqlite';
import { SKILL_TESTS } from '@/lib/skill-tests';
import { beginnerCourses } from './beginner-courses';
import { canSeeCourse } from './course-visibility';
import { sdRequired } from './system-design-course';

/**
 * Course completion certificates. bootstrap() issues one the first time it sees every
 * published lesson of a published course the learner holds completed; marking a self-paced
 * course's last chapter read and passing a skill exam issue theirs (SELF_PACED, EXTERNAL). The
 * random id is the verification code on /certificate/<id>, which the learner chooses to share.
 * The page shows the account name, so a public profile lists (and links to) a certificate
 * only after the learner opts in: user_profiles never shows the name on its own.
 */
export const CERTIFICATE_ID = /^[A-Za-z0-9_-]{16}$/;
export type Certificate = { id: string; courseId: string; issuedAt: number; onProfile: number };

/**
 * Self-paced public courses, certified once every chapter is marked read (user_marks <target>,
 * read): the system design course's chapters are sd:<chapter>, a beginner course's
 * sd:<course>/<chapter>. The certificate's course id is sd:<course>.
 */
export const SELF_PACED = [
  {
    id: 'sd:system-design',
    zh: '系统设计面试课',
    en: 'System Design Interview Course',
    // The key-technology and pattern chapters are optional: adding them never raises the bar.
    targets: sdRequired.map((slug) => `sd:${slug}`),
  },
  ...beginnerCourses.map((c) => ({
    id: `sd:${c.slug}`,
    zh: c.titleZh,
    en: c.titleEn,
    targets: c.chapters.map((chapter) => `sd:${c.slug}/${chapter.slug}`),
  })),
];
/** Certificates without a course row: self-paced courses and skill exams (skill:<test>). */
const EXTERNAL = new Map<string, { zh: string; en: string; lessons: number; skill: boolean }>([
  ...SELF_PACED.map((c) => [c.id, { zh: c.zh, en: c.en, lessons: c.targets.length, skill: false }] as const),
  ...SKILL_TESTS.map((t) => [`skill:${t.id}`, { zh: t.zh, en: t.en, lessons: 0, skill: true }] as const),
]);
/** A row's course title in the locale and whether it is a skill exam; null when it may not be shown. */
function shown<T extends { courseId: string; course: string | null }>(row: T, zh: boolean) {
  const external = EXTERNAL.get(row.courseId);
  if (external) return { ...row, course: zh ? external.zh : external.en, skill: external.skill };
  // A course row: published (the LEFT JOIN found it) and not hidden from the public (owner-only mode).
  return row.course !== null && canSeeCourse(null, row.courseId) ? { ...row, course: row.course, skill: false } : null;
}

const mine = (userId: string) =>
  sqlite()
    .prepare(
      'SELECT id,course_id AS courseId,issued_at AS issuedAt,on_profile AS onProfile FROM certificates WHERE user_id=? ORDER BY issued_at,id',
    )
    .all(userId) as Certificate[];

/** Published courses the learner holds whose published lessons (at least one) are all completed. */
export function finishedCourses(
  courses: { id: string; published: number; has_access: boolean; lessons: { id: string; published?: number }[] }[],
  progress: { lesson_id: string; completed: number }[],
) {
  const completed = new Set(progress.filter((r) => r.completed).map((r) => r.lesson_id));
  return courses
    .filter((c) => {
      const lessons = c.lessons.filter((l) => l.published);
      return c.published && c.has_access && lessons.length > 0 && lessons.every((l) => completed.has(l.id));
    })
    .map((c) => c.id);
}

/** The learner's certificates, after issuing any missing one for the courses in `completed`. */
export function certificatesFor(userId: string, completed: string[], now = Date.now()) {
  const list = mine(userId);
  const missing = completed.filter((courseId) => !list.some((c) => c.courseId === courseId));
  // Read-only once issued: the periodic bootstrap does not write.
  if (!missing.length) return list;
  for (const courseId of missing) issueCertificate(userId, courseId, now);
  return mine(userId);
}

/** Issues the learner's certificate for `courseId` unless they hold it; returns its id. */
export function issueCertificate(userId: string, courseId: string, now = Date.now()) {
  const db = sqlite();
  db.prepare(
    'INSERT INTO certificates(id,user_id,course_id,issued_at) VALUES(?,?,?,?) ON CONFLICT(user_id,course_id) DO NOTHING',
  ).run(randomBytes(12).toString('base64url'), userId, courseId, now);
  return db.prepare('SELECT id FROM certificates WHERE user_id=? AND course_id=?').pluck().get(userId, courseId) as string;
}

/**
 * Called when a chapter is marked read: the self-paced course's certificate id once every
 * chapter of the course holding `target` is read (issued the first time), else null.
 */
export function selfPacedCertificate(userId: string, target: string, now = Date.now()) {
  const course = SELF_PACED.find((c) => c.targets.includes(target));
  if (!course) return null;
  const read = sqlite()
    .prepare(
      "SELECT COUNT(*) FROM user_marks WHERE user_id=? AND mark='read' AND target IN (SELECT value FROM json_each(?))",
    )
    .pluck()
    .get(userId, JSON.stringify(course.targets)) as number;
  return read === course.targets.length ? issueCertificate(userId, course.id, now) : null;
}

/**
 * The learner lists one certificate on their public profile, or takes it off. Only the
 * owner's own row changes; anyone else's id is the same 404 as an unknown one.
 */
export function showOnProfile(userId: string, id: string, on: boolean) {
  const { changes } = sqlite()
    .prepare('UPDATE certificates SET on_profile=? WHERE id=? AND user_id=?')
    .run(+on, id, userId);
  return changes > 0;
}

/**
 * What /certificate/<id> shows, or null for a malformed or unknown id, an unpublished course
 * and a course hidden from the public (owner-only mode). The name is the account's display
 * name; the handle only when the learner keeps a public profile and lists this certificate.
 * A self-paced course or skill exam has no course row: its title comes from EXTERNAL.
 */
export function certificateById(id: string, zh = true) {
  if (!CERTIFICATE_ID.test(id)) return null;
  const row = sqlite()
    .prepare(
      `SELECT c.id,c.course_id AS courseId,c.issued_at AS issuedAt,co.title AS course,u.name,
        (SELECT handle FROM user_profiles up WHERE up.user_id=c.user_id AND up.visible=1 AND c.on_profile=1) AS handle,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id AND l.published=1) AS lessons
      FROM certificates c LEFT JOIN courses co ON co.id=c.course_id AND co.published=1 JOIN user u ON u.id=c.user_id WHERE c.id=?`,
    )
    .get(id) as
    | { id: string; courseId: string; issuedAt: number; course: string | null; name: string; handle: string | null; lessons: number }
    | undefined;
  const cert = row && shown(row, zh);
  return cert ? { ...cert, lessons: EXTERNAL.get(cert.courseId)?.lessons ?? cert.lessons } : null;
}

/** Who holds certificate `id` (its page shows the holder the add-to-LinkedIn link). */
export const certificateOwner = (id: string) =>
  sqlite().prepare('SELECT user_id FROM certificates WHERE id=?').pluck().get(id) as string | undefined;

/** All the learner's own certificates with their titles, newest first (the resume builder). */
export function myCertificates(userId: string, zh = true) {
  return (
    sqlite()
      .prepare(
        `SELECT c.id,c.course_id AS courseId,c.issued_at AS issuedAt,co.title AS course FROM certificates c
        LEFT JOIN courses co ON co.id=c.course_id AND co.published=1 WHERE c.user_id=? ORDER BY c.issued_at DESC,c.id`,
      )
      .all(userId) as (Omit<Certificate, 'onProfile'> & { course: string | null })[]
  ).flatMap((row) => shown(row, zh) ?? []);
}

/** Certificates the learner chose to list on a visible public profile, newest first. */
export function profileCertificates(handle: string, zh = true) {
  return (
    sqlite()
      .prepare(
        `SELECT c.id,c.course_id AS courseId,c.issued_at AS issuedAt,co.title AS course FROM certificates c
        JOIN user_profiles up ON up.user_id=c.user_id AND up.visible=1 LEFT JOIN courses co ON co.id=c.course_id AND co.published=1
        WHERE up.handle=? AND c.on_profile=1 ORDER BY c.issued_at DESC,c.id`,
      )
      .all(handle) as (Omit<Certificate, 'onProfile'> & { course: string | null })[]
  ).flatMap((row) => shown(row, zh) ?? []);
}

/** The learner's self-paced course and skill exam certificates, with their titles (/certify). */
export function externalCertificates(userId: string) {
  return mine(userId).flatMap((c) => {
    const external = EXTERNAL.get(c.courseId);
    return external ? [{ ...c, zh: external.zh, en: external.en, skill: external.skill }] : [];
  });
}
