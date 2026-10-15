import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { SELF_PACED } from './certificates';
import { requireVerified } from './contests';
import { requireCourseVisible } from './course-visibility';
import { boundedText, HttpError, json, limit, limitReader, requirePerson } from './http';

/**
 * Course star ratings: 1–5 stars, no text, one per verified learner and course, changeable.
 * A learner rates a course they have started: one completed lesson of a course row, or one
 * chapter of a self-paced course (SELF_PACED) marked read. The average shows from RATING_MIN
 * ratings on; below that only the count does.
 */
export const RATING_MIN = 5;

/** Course list columns rating_avg (null under RATING_MIN) and rating_count, for the course id expression `id`. */
export const ratingColumns = (id: string) =>
  `(SELECT CASE WHEN COUNT(*)>=${RATING_MIN} THEN ROUND(AVG(stars),1) END FROM course_ratings r WHERE r.course_id=${id}) AS rating_avg,
  (SELECT COUNT(*) FROM course_ratings r WHERE r.course_id=${id}) AS rating_count`;

/** A published course row anyone may see, or a self-paced course; 404 otherwise. */
function rateable(p: Person | null, courseId: string) {
  const selfPaced = SELF_PACED.find((c) => c.id === courseId);
  if (selfPaced) return selfPaced;
  if (!sqlite().prepare('SELECT 1 FROM courses WHERE id=? AND published=1').get(courseId))
    throw new HttpError(404, '课程不存在');
  requireCourseVisible(p, courseId);
  return null;
}

function started(userId: string, courseId: string, selfPaced: (typeof SELF_PACED)[number] | null) {
  return !!(selfPaced
    ? sqlite()
        .prepare("SELECT 1 FROM user_marks WHERE user_id=? AND mark='read' AND target IN (SELECT value FROM json_each(?))")
        .get(userId, JSON.stringify(selfPaced.targets))
    : sqlite()
        .prepare(
          'SELECT 1 FROM progress pr JOIN lessons l ON l.id=pr.lesson_id WHERE pr.user_id=? AND pr.completed=1 AND l.course_id=?',
        )
        .get(userId, courseId));
}

/** Average (null under RATING_MIN), count, and for a signed-in reader their stars and whether they may rate. */
export function courseRating(p: Person | null, courseId: string) {
  const selfPaced = rateable(p, courseId);
  const { avg, count } = sqlite()
    .prepare(
      `SELECT CASE WHEN COUNT(*)>=${RATING_MIN} THEN ROUND(AVG(stars),1) END AS avg,COUNT(*) AS count
      FROM course_ratings WHERE course_id=?`,
    )
    .get(courseId) as { avg: number | null; count: number };
  const mine = p
    ? ((sqlite().prepare('SELECT stars FROM course_ratings WHERE user_id=? AND course_id=?').pluck().get(p.id, courseId) as
        | number
        | undefined) ?? null)
    : null;
  return { avg, count, mine, canRate: !!p && (p.verified || p.role === 'teacher') && started(p.id, courseId, selfPaced) };
}

export function rateCourse(p: Person, courseId: string, stars: number, now = Date.now()) {
  requireVerified(p);
  const selfPaced = rateable(p, courseId);
  if (!started(p.id, courseId, selfPaced)) throw new HttpError(403, '学完至少一节后才能评分');
  sqlite()
    .prepare(
      `INSERT INTO course_ratings(user_id,course_id,stars,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id,course_id) DO UPDATE SET stars=excluded.stars,updated_at=excluded.updated_at`,
    )
    .run(p.id, courseId, stars, now, now);
  return courseRating(p, courseId);
}

const course = z.string().min(1).max(120);
const rateSchema = z.object({ course, stars: z.number().int().min(1).max(5) }).strict();

/** /api/course-ratings: GET ?course=<id> reads signed out too; POST { course, stars } rates. */
export async function handleCourseRatings(request: Request, p: Person | null) {
  if (request.method === 'GET') {
    await limitReader(request, p, 'course-rating-read', 120);
    return json(courseRating(p, course.parse(new URL(request.url).searchParams.get('course'))));
  }
  if (request.method === 'POST') {
    requirePerson(p);
    await limit(p, 'course-rating-write', 20);
    let body: unknown;
    try {
      body = JSON.parse(await boundedText(request, 2000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    const d = rateSchema.parse(body);
    return json(rateCourse(p, d.course, d.stars));
  }
  throw new HttpError(404, '接口不存在');
}
