import { z } from 'zod';
import type { LessonRow } from './lms-records';
import type { Person } from './auth';
import { HttpError, one, requireCourse } from './http';
import { requireCourseVisible, visibleCourseSql } from './course-visibility';
export const lmsId = z.string().min(1).max(100);
export const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const title = z.string().trim().min(1).max(180);
export const expected = z.number().int().nonnegative();
export type SqlValue = string | number | null;
export function courseAccess(p: Person, column: string) {
  // Owner-only mode narrows every role, teachers included, to the courses still open.
  const visible = visibleCourseSql(p, column);
  if (p.role === 'teacher')
    return { sql: `1=1${visible}`, args: [] as SqlValue[] };
  if (!p.verified) return { sql: '0=1', args: [] as SqlValue[] };
  return {
    sql: `EXISTS(SELECT 1 FROM courses c WHERE c.id=${column} AND c.published=1) AND EXISTS(SELECT 1 FROM grants g WHERE g.email=? AND (g.course_id=${column} OR g.course_id='*') AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?))${visible}`,
    args: [p.email, Date.now()] as SqlValue[],
  };
}
/** A course's free preview: its first published lesson, while the course itself is published. */
export async function previewLessonId(courseId: string) {
  return (
    await one<{ id: string }>(
      'SELECT l.id FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.course_id=? AND l.published=1 AND c.published=1 ORDER BY l.position,l.id LIMIT 1',
      courseId,
    )
  )?.id;
}
/**
 * A published lesson this person may open. `preview`: reading paths (the lesson, its video,
 * reading progress) also let any signed-in account open the course's free preview lesson;
 * code reviews still need the course.
 */
export async function liveLesson(p: Person, id: string, preview = false) {
  const l = await one<LessonRow>('SELECT * FROM lessons WHERE id=?', id);
  if (!l || (p.role !== 'teacher' && !l.published))
    throw new HttpError(404, '章节不存在或尚未发布');
  requireCourseVisible(p, l.course_id);
  if (!(preview && (await previewLessonId(l.course_id)) === l.id)) await requireCourse(p, l.course_id);
  return l;
}
export function cursorFrom(url: URL) {
  const raw = url.searchParams.get('cursor');
  if (!raw) return null;
  try {
    return z
      .object({
        time: z.number().int().nonnegative(),
        id: z.string().min(1).max(300),
      })
      .strict()
      .parse(JSON.parse(Buffer.from(raw, 'base64url').toString()));
  } catch {
    throw new HttpError(400, '分页游标无效');
  }
}
export function nextCursor(time: number, id: string) {
  return Buffer.from(JSON.stringify({ time, id })).toString('base64url');
}
export function searchText(url: URL) {
  return (url.searchParams.get('q') || '')
    .trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, '\\$&');
}
export function conflict() {
  return new HttpError(
    409,
    '内容已被更新，请重新载入后再提交；你的编辑尚未覆盖服务器内容',
  );
}
