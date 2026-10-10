import type { Person } from './auth';
import { setting } from './env';
import { HttpError } from './http';
import { INTERVIEW_COURSE_ID } from './seed-interview';

/**
 * Temporary owner-only mode for teaching courses, set in the server environment:
 *   COURSE_ACCESS=owner
 *   COURSE_OWNER_ID=<the owner's user id>
 * Removing COURSE_ACCESS restores the normal grant rules. Nothing is deleted.
 * Scope is course content, including course OJ exercises; OA and library problems
 * judge free for verified accounts, and the algorithm knowledge module keeps its
 * normal rules.
 */
const OPEN_COURSES = [INTERVIEW_COURSE_ID];

export function coursesOwnerOnly() {
  return setting('COURSE_ACCESS') === 'owner';
}

/** Fails closed: owner-only mode without a configured owner matches nobody. */
export function isCourseOwner(p: Person | null) {
  const owner = setting('COURSE_OWNER_ID');
  return !!owner && !!p && p.verified && p.id === owner;
}

export function canSeeCourse(p: Person | null, courseId: string) {
  return !coursesOwnerOnly() || OPEN_COURSES.includes(courseId) || isCourseOwner(p);
}

/** 404 rather than 403, so hidden courses do not reveal that they exist. */
export function requireCourseVisible(p: Person | null, courseId: string) {
  if (!canSeeCourse(p, courseId)) throw new HttpError(404, '课程暂未开放');
}

/** Course administration and unscoped media: the owner only while the mode is on. */
export function requireCourseOwner(p: Person | null) {
  if (coursesOwnerOnly() && !isCourseOwner(p))
    throw new HttpError(404, '课程暂未开放');
}

/** SQL restricting a course-id column to courses this person may see. */
export function visibleCourseSql(p: Person | null, column: string) {
  return !coursesOwnerOnly() || isCourseOwner(p)
    ? ''
    : ` AND ${column} IN (${OPEN_COURSES.map((id) => `'${id}'`).join(',')})`;
}

/** SQL clause hiding notifications about courses this person may not see. */
export function courseNotificationFilter(p: Person | null) {
  if (!coursesOwnerOnly() || isCourseOwner(p)) return '';
  const open = OPEN_COURSES.map((id) => `'${id}'`).join(',');
  return ` AND href NOT LIKE '/?view=courses%' AND NOT EXISTS(SELECT 1 FROM releases r WHERE href='/?view=releases&release='||r.id AND r.course_id NOT IN (${open}))`;
}
