import type { Person } from './auth';
import { boundedText, HttpError, json, requirePerson, limit } from './http';
import { database } from './env';
import {
  courseList,
  courseDetail,
  createCourse,
  updateCourse,
  createLesson,
  lessonEditor,
  saveLessonDraft,
  publishLesson,
  restoreLesson,
  lessonVisibility,
  lessonVersion,
} from './lms-courses';
import {
  ticketDetail,
  ticketPage,
  replyTicket,
  changeTicket,
  reviewDetail,
  reviewPage,
  resubmitReview,
  feedbackReview,
  releasePage,
  notificationPage,
} from './lms-support';
import {
  grantCourse,
  revokeGrant,
  grantPage,
  studentPage,
  dashboard,
} from './lms-roster';
import { deleteAttachment } from './files';
import { requireCourseOwner } from './course-visibility';
export async function handleLms(
  request: Request,
  p: Person | null,
  path: string[],
): Promise<Response | null> {
  if (path[0] !== 'lms') return null;
  requirePerson(p);
  const [, resource, id, action, version] = path,
    url = new URL(request.url);
  // Course administration follows owner-only mode, even for teachers. Student-facing
  // releases and reviews are filtered per course instead.
  const studentVersionRead =
    request.method === 'GET' && resource === 'lessons' && action === 'versions';
  if (
    ['courses', 'lessons', 'grants', 'students', 'dashboard'].includes(resource) &&
    !studentVersionRead
  )
    requireCourseOwner(p);
  if (request.method === 'GET') {
    if (resource === 'courses')
      return json(id ? await courseDetail(p, id) : await courseList(p));
    if (resource === 'lessons' && id)
      return json(
        action === 'versions' && version
          ? await lessonVersion(p, id, decodeURIComponent(version))
          : await lessonEditor(p, id),
      );
    if (resource === 'tickets')
      return json(id ? await ticketDetail(p, id) : await ticketPage(p, url));
    if (resource === 'reviews')
      return json(id ? await reviewDetail(p, id) : await reviewPage(p, url));
    if (resource === 'grants') return json(await grantPage(p, url));
    if (resource === 'students') return json(await studentPage(p, url));
    if (resource === 'dashboard') return json(await dashboard(p));
    if (resource === 'releases') return json(await releasePage(p, url));
    if (resource === 'notifications')
      return json(await notificationPage(p, url));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'lms-write', 90);
  let data: unknown;
  try {
    data = JSON.parse(await boundedText(request, 500000));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, '无效的 JSON');
  }
  if (resource === 'courses') {
    if (id && action === 'lessons')
      return json(await createLesson(p, id, data), 201);
    return json(
      id ? await updateCourse(p, id, data) : await createCourse(p, data),
      id ? 200 : 201,
    );
  }
  if (resource === 'lessons' && id) {
    if (action === 'draft') return json(await saveLessonDraft(p, id, data));
    if (action === 'publish') return json(await publishLesson(p, id, data));
    if (action === 'restore') return json(await restoreLesson(p, id, data));
    if (action === 'visibility')
      return json(await lessonVisibility(p, id, data));
  }
  if (resource === 'tickets' && id) {
    if (action === 'reply') return json(await replyTicket(p, id, data));
    if (action === 'status') return json(await changeTicket(p, id, data));
  }
  if (resource === 'reviews' && id) {
    if (action === 'resubmit') return json(await resubmitReview(p, id, data));
    if (action === 'feedback') return json(await feedbackReview(p, id, data));
  }
  if (resource === 'grants') {
    if (id && action === 'revoke') return json(await revokeGrant(p, id));
    if (!id) return json(await grantCourse(p, data), 201);
  }
  if (resource === 'notifications' && id === 'read-all') {
    database()
      .prepare(
        'UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL',
      )
      .bind(Date.now(), p.id)
      .run();
    return json({ saved: true });
  }
  if (resource === 'attachments' && id && action === 'delete')
    return json(await deleteAttachment(p, id));
  throw new HttpError(404, '接口不存在');
}
