/**
 * Real HTTP acceptance of enrollment, CMS, private support, media and reviews.
 * Start an isolated migrated staging server, then run with its environment:
 * node --env-file=.local/staging.env tests/platform-integration.mjs
 * No Stripe charge, external email or production data is used. Media fixtures
 * exercise byte transport/access control; browser playback needs a real video.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import Database from 'better-sqlite3';

const base = new URL(process.env.TEST_URL || 'http://localhost:4318');
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) ||
  base.protocol !== 'http:'
)
  throw new Error('Platform fixtures require a localhost HTTP staging server');
const databasePath = resolve(
  process.env.TEST_DATABASE_PATH ||
    process.env.DATABASE_PATH ||
    'data/staging.sqlite',
);
if (
  !/(^|[/_.-])(test|staging)([/_.-]|$)/i.test(databasePath) ||
  relative(process.cwd(), databasePath).startsWith('..') ||
  !existsSync(databasePath)
)
  throw new Error(
    'Database must be an existing test/staging file in this workspace',
  );
const secret = process.env.BETTER_AUTH_SECRET;
const adminEmail = process.env.ADMIN_EMAILS?.split(',')
  .map((s) => s.trim().toLowerCase())
  .find(Boolean);
if (!secret || secret.length < 32 || !adminEmail)
  throw new Error(
    'Load the staging BETTER_AUTH_SECRET and ADMIN_EMAILS through the environment',
  );
const origin = process.env.APP_URL || base.origin;
if (new URL(origin).origin !== base.origin)
  throw new Error('APP_URL must match TEST_URL');
const db = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const prefix = `platform-${randomUUID().slice(0, 12)}`;
const courseId = `${prefix}-course`,
  lessonId = `${prefix}-lesson`;
const studentEmail = `${prefix}.student@example.test`;
const users = new Set(),
  sessions = new Set(),
  targets = new Set([courseId, lessonId]),
  mediaIds = new Set();
let requests = 0,
  checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}
function identity(name, email = `${prefix}.${name}@example.test`) {
  const existing = db
    .prepare('SELECT id FROM user WHERE lower(email)=?')
    .get(email);
  const uid = existing?.id || `${prefix}-${name}`,
    token = randomUUID(),
    now = Date.now(),
    sid = randomUUID();
  if (!existing) {
    db.prepare(
      'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
    ).run(uid, name, email, 1, now, now);
    users.add(uid);
  }
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(sid, now + 3600000, token, now, now, uid);
  sessions.add(sid);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return {
    uid,
    email,
    cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`,
  };
}
async function req(
  path,
  {
    user,
    data,
    raw,
    headers = {},
    status = 200,
    binary = false,
    requestOrigin = origin,
  } = {},
) {
  const write = data !== undefined || raw !== undefined;
  const r = await fetch(new URL(`/api/${path}`, base), {
    method: write ? 'POST' : 'GET',
    headers: {
      ...(user ? { Cookie: user.cookie } : {}),
      ...(write
        ? {
            Origin: requestOrigin,
            'Content-Type':
              raw === undefined
                ? 'application/json'
                : 'application/octet-stream',
          }
        : {}),
      ...headers,
    },
    body: raw ?? (data === undefined ? undefined : JSON.stringify(data)),
    signal: AbortSignal.timeout(20000),
  });
  requests++;
  const bytes = Buffer.from(await r.arrayBuffer());
  // Never include invite tokens, cookie headers, passwords or full bodies in failures.
  assert.equal(
    r.status,
    status,
    `${path.split('?')[0]} returned ${r.status}, expected ${status}`,
  );
  if (binary) return { bytes, headers: r.headers };
  const result = JSON.parse(bytes.toString());
  Object.defineProperty(result, '_cookies', {
    value: r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });
  return result;
}
async function mediaFixture(teacher, index) {
  const bytes = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.from(`fixture-part-${index}-${prefix}`),
  ]);
  const upload = await req('teacher/media/uploads', {
    user: teacher,
    data: {
      name: `${prefix}-part-${index}.webm`,
      size: bytes.length,
      mimeType: 'video/webm',
    },
    status: 201,
  });
  mediaIds.add(upload.assetId);
  targets.add(upload.assetId);
  await req(`teacher/media/uploads/${upload.uploadId}/chunk`, {
    user: teacher,
    raw: bytes,
    headers: { 'Upload-Offset': '0' },
  });
  const completed = await req(
    `teacher/media/uploads/${upload.uploadId}/complete`,
    { user: teacher, data: {} },
  );
  check(completed.status === 'ready', 'Uploaded media becomes ready');
  return { id: upload.assetId, bytes };
}
try {
  const teacher = identity('teacher', adminEmail),
    outsider = identity('outsider');
  const guest = await req('bootstrap');
  check(guest.person === null, 'Guest remains anonymous');
  check(
    (await req('bootstrap', { user: teacher })).person.role === 'teacher',
    'Teacher authority comes from server configuration',
  );
  await req('lms/courses', { status: 401 });
  await req('lms/courses', { user: outsider, status: 403 });
  await req('teacher/invitations', { user: outsider, status: 403 });
  await req('lms/courses', {
    user: outsider,
    data: {},
    requestOrigin: 'https://example.invalid',
    status: 403,
  });
  const createdCourse = await req('lms/courses', {
    user: teacher,
    data: {
      id: courseId,
      title: `${prefix} course`,
      summary: 'Local acceptance fixture',
      position: 90000,
    },
    status: 201,
  });
  let editor = await req(`lms/courses/${courseId}/lessons`, {
    user: teacher,
    data: {
      id: lessonId,
      title: `${prefix} lesson`,
      summary: 'Two-part lesson',
      section: 'Integration',
      position: 0,
    },
    status: 201,
  });
  check(
    editor.draft.revision === 0 && !editor.lesson.published,
    'New lesson is a private draft',
  );
  const invite = (
    await req('teacher/invitations', {
      user: teacher,
      data: { emails: [studentEmail], courseIds: [courseId], days: 7 },
      status: 201,
    })
  ).items[0];
  targets.add(invite.id);
  const token = new URLSearchParams(new URL(invite.url).hash.slice(1)).get(
    'invite',
  );
  check(
    token && !new URL(invite.url).search,
    'Invitation secret is in the URL fragment',
  );
  const inspected = await req('enrollment/inspect', { data: { token } });
  check(
    inspected.email === studentEmail && !inspected.requiresLogin,
    'New student can inspect invitation',
  );
  await req('enrollment/activate', {
    user: outsider,
    data: { token, name: 'Wrong account', password: randomUUID() },
    status: 409,
  });
  const activated = await req('enrollment/activate', {
    data: { token, name: `${prefix} Student`, password: randomUUID() + 'Aa1!' },
  });
  check(
    activated._cookies.includes('better-auth.session_token='),
    'Invite activation issues a real BetterAuth cookie',
  );
  const student = {
    uid: db.prepare('SELECT id FROM user WHERE email=?').get(studentEmail).id,
    email: studentEmail,
    cookie: activated._cookies,
  };
  users.add(student.uid);
  const profile = (await req('bootstrap', { user: student })).person;
  check(
    profile.email === studentEmail && profile.verified,
    'Activation verifies the invited mailbox',
  );
  await req('enrollment/activate', {
    user: student,
    data: { token },
    status: 409,
  });
  await req(`lms/lessons/${lessonId}`, { user: student, status: 403 });
  check(
    !(await req('bootstrap', { user: student })).courses.some(
      (c) => c.id === courseId,
    ),
    'Unpublished course is absent from student catalog',
  );
  const media = await Promise.all([
    mediaFixture(teacher, 1),
    mediaFixture(teacher, 2),
  ]);
  const payload = {
    title: `${prefix} lesson`,
    summary: 'Two-part lesson',
    section: 'Integration',
    position: 0,
    body: '# Published version one\n\nStudent-visible material.',
    streamUid: null,
    videoAssetIds: media.map((m) => m.id),
  };
  editor = await req(`lms/lessons/${lessonId}/draft`, {
    user: teacher,
    data: { expectedRevision: editor.draft.revision, ...payload },
  });
  editor = await req(`lms/lessons/${lessonId}/publish`, {
    user: teacher,
    data: {
      expectedRevision: editor.draft.revision,
      version: '1.0.0',
      releaseTitle: `${prefix} first release`,
      releaseSummary: 'First visible release',
      important: true,
    },
  });
  await req(`lms/courses/${courseId}`, {
    user: teacher,
    data: {
      expectedRevision: createdCourse.course.revision,
      title: createdCourse.course.title,
      summary: createdCourse.course.summary,
      published: true,
      position: 90000,
    },
  });
  let live = await req(`lessons/${lessonId}`, { user: student });
  check(
    live.body === payload.body && live.version === '1.0.0',
    'Published lesson is accessible to invited student',
  );
  await req(`lessons/${lessonId}`, { user: outsider, status: 403 });
  const videos = await req(`lessons/${lessonId}/videos`, { user: student });
  check(
    videos.items.length === 2 && videos.items[1].id === media[1].id,
    'Lesson preserves upper/lower video ordering',
  );
  const videoBytes = await req(`media/${media[1].id}/play?lesson=${lessonId}`, {
    user: student,
    binary: true,
    headers: { Range: 'bytes=0-7' },
    status: 206,
  });
  check(
    videoBytes.bytes.equals(media[1].bytes.subarray(0, 8)),
    'Authorized range delivery preserves video bytes',
  );
  await req(`media/${media[1].id}/play?lesson=${lessonId}`, {
    user: outsider,
    status: 403,
  });
  await req(`teacher/media/uploads`, {
    user: student,
    data: { name: 'forbidden.webm', size: 8, mimeType: 'video/webm' },
    status: 403,
  });
  const privateDraft = {
    ...payload,
    body: '# Draft version two\n\nPrivate until publication.',
  };
  const previousDraftRevision = editor.draft.revision;
  editor = await req(`lms/lessons/${lessonId}/draft`, {
    user: teacher,
    data: { expectedRevision: previousDraftRevision, ...privateDraft },
  });
  await req(`lms/lessons/${lessonId}/draft`, {
    user: teacher,
    data: { expectedRevision: previousDraftRevision, ...payload },
    status: 409,
  });
  check(
    (await req(`lessons/${lessonId}`, { user: student })).body === payload.body,
    'Saving draft does not alter live content',
  );
  editor = await req(`lms/lessons/${lessonId}/publish`, {
    user: teacher,
    data: {
      expectedRevision: editor.draft.revision,
      version: '1.0.1',
      releaseTitle: `${prefix} second release`,
      releaseSummary: 'The updated lesson is available',
      important: true,
    },
  });
  check(
    (await req(`lessons/${lessonId}`, { user: student })).body ===
      privateDraft.body,
    'Publishing atomically exposes new content',
  );
  check(
    (await req(`lms/lessons/${lessonId}/versions/1.0.0`, { user: student }))
      .body === payload.body,
    'Prior release remains readable',
  );
  await req(`lms/lessons/${lessonId}/versions/1.0.0`, {
    user: outsider,
    status: 403,
  });
  const notices = await req('lms/notifications', { user: student });
  check(
    notices.items.some((n) => n.title.includes(`${prefix} second release`)),
    'Enrolled student receives update notification',
  );
  check(
    !(await req('lms/notifications', { user: outsider })).items.some((n) =>
      n.title.includes(prefix),
    ),
    'Unenrolled student receives no private release notification',
  );
  const releases = (await req('lms/releases', { user: student })).items.filter(
    (r) => r.course_id === courseId,
  );
  check(releases.length === 2, 'Release history lists both published versions');
  await req(`releases/${releases[0].id}/read`, { user: student, data: {} });
  await req('lms/notifications/read-all', { user: student, data: {} });
  check(
    (await req('lms/notifications', { user: student })).unread === 0,
    'Read-all persists for current user',
  );
  console.log(
    'PASS enrollment, CMS versions, notifications and protected two-part media',
  );

  await req('progress', {
    user: student,
    data: {
      lessonId,
      position: 123.5,
      videoAssetId: media[1].id,
      note: 'Private progress',
      bookmarked: true,
    },
  });
  live = await req(`lessons/${lessonId}`, { user: student });
  check(
    live.progress.position === 123.5 &&
      live.progress.video_asset_id === media[1].id,
    'Progress remembers second video and timestamp',
  );
  const ticketCreated = await req('tickets', {
    user: student,
    data: {
      title: `${prefix} question`,
      body: 'Question about the lower segment',
      courseId,
      lessonId,
      videoPosition: 123.5,
      videoAssetId: media[1].id,
    },
    status: 201,
  });
  targets.add(ticketCreated.id);
  const ticketPath = `lms/tickets/${ticketCreated.id}`;
  let ticket = await req(ticketPath, { user: student });
  check(
    ticket.course_id === courseId &&
      ticket.lesson_id === lessonId &&
      ticket.video_position === 123.5 &&
      ticket.video_asset_id === media[1].id,
    'Private ticket retains course, lesson, segment and timestamp',
  );
  await req(ticketPath, { user: outsider, status: 404 });
  await req(`${ticketPath}/reply`, {
    user: outsider,
    data: { body: 'forbidden', expectedRevision: ticket.revision },
    status: 404,
  });
  check(
    !(await req('lms/tickets', { user: outsider })).items.some(
      (t) => t.id === ticket.id,
    ),
    'Private ticket is absent from other student list',
  );
  const attachmentBytes = Buffer.from('private stack trace\n' + prefix);
  const attachment = await req(
    `tickets/${ticket.id}/attachments?name=trace.txt`,
    { user: student, raw: attachmentBytes, status: 201 },
  );
  targets.add(attachment.id);
  const downloaded = await req(`attachments/${attachment.id}`, {
    user: student,
    binary: true,
  });
  check(
    downloaded.bytes.equals(attachmentBytes) &&
      downloaded.headers.get('content-disposition').startsWith('attachment;'),
    'Private attachment downloads intact with attachment disposition',
  );
  await req(`attachments/${attachment.id}`, { user: outsider, status: 404 });
  await req(`lms/attachments/${attachment.id}/delete`, {
    user: outsider,
    data: {},
    status: 404,
  });
  ticket = await req(`${ticketPath}/reply`, {
    user: teacher,
    data: { expectedRevision: ticket.revision, body: 'Teacher answer' },
  });
  check(ticket.status === 'waiting', 'Teacher reply moves ticket to waiting');
  const staleRevision = ticket.revision;
  ticket = await req(`${ticketPath}/reply`, {
    user: student,
    data: { expectedRevision: ticket.revision, body: 'Student follow-up' },
  });
  check(
    ticket.status === 'open' && ticket.replies.length === 2,
    'Student follow-up reopens ticket and preserves conversation',
  );
  await req(`${ticketPath}/reply`, {
    user: student,
    data: { expectedRevision: staleRevision, body: 'Stale duplicate' },
    status: 409,
  });
  await req(`${ticketPath}/status`, {
    user: student,
    data: {
      expectedRevision: ticket.revision,
      status: 'open',
      assignedTo: teacher.uid,
    },
    status: 403,
  });
  ticket = await req(`${ticketPath}/status`, {
    user: teacher,
    data: {
      expectedRevision: ticket.revision,
      status: 'resolved',
      assignedTo: teacher.uid,
    },
  });
  check(
    ticket.status === 'resolved' && ticket.assigned_to === teacher.uid,
    'Teacher can assign and resolve',
  );
  ticket = await req(`${ticketPath}/status`, {
    user: student,
    data: { expectedRevision: ticket.revision, status: 'open' },
  });
  check(ticket.status === 'open', 'Owner can reopen a resolved ticket');
  await req(`lms/attachments/${attachment.id}/delete`, {
    user: student,
    data: {},
  });
  await req(`attachments/${attachment.id}`, { user: student, status: 404 });
  console.log(
    'PASS private ticket lifecycle, attachment ownership and video context',
  );

  const reviewCreated = await req('reviews', {
    user: student,
    data: {
      lessonId,
      url: 'https://github.com/cswork-test/example/pull/1',
      note: 'Initial submission',
    },
    status: 201,
  });
  targets.add(reviewCreated.id);
  const reviewPath = `lms/reviews/${reviewCreated.id}`;
  let review = await req(reviewPath, { user: student });
  await req(reviewPath, { user: outsider, status: 404 });
  await req(`${reviewPath}/feedback`, {
    user: student,
    data: {
      expectedRevision: review.revision,
      status: 'approved',
      feedback: 'Self-approval',
    },
    status: 403,
  });
  await req(`${reviewPath}/resubmit`, {
    user: student,
    data: {
      expectedRevision: review.revision,
      url: review.url,
      note: 'Still pending',
    },
    status: 409,
  });
  review = await req(`${reviewPath}/feedback`, {
    user: teacher,
    data: {
      expectedRevision: review.revision,
      status: 'changes_requested',
      feedback: 'Please handle the empty input case.',
    },
  });
  check(review.status === 'changes_requested', 'Teacher requests changes');
  review = await req(`${reviewPath}/resubmit`, {
    user: student,
    data: {
      expectedRevision: review.revision,
      url: 'https://github.com/cswork-test/example/pull/2',
      note: 'Handled empty input',
    },
  });
  check(
    review.status === 'pending' && review.feedback === null,
    'Resubmission returns to review queue',
  );
  await req(`${reviewPath}/feedback`, {
    user: teacher,
    data: {
      expectedRevision: review.revision - 1,
      status: 'approved',
      feedback: 'Stale approval',
    },
    status: 409,
  });
  review = await req(`${reviewPath}/feedback`, {
    user: teacher,
    data: {
      expectedRevision: review.revision,
      status: 'approved',
      feedback: 'Approved with edge cases covered.',
    },
  });
  check(
    review.status === 'approved' && review.events.length === 4,
    'Full submission/review/resubmission history remains',
  );
  check(
    review.events.some(
      (e) =>
        e.kind === 'feedback' &&
        e.status === 'changes_requested' &&
        e.feedback.includes('empty input'),
    ),
    'Earlier teacher feedback is preserved',
  );
  check(
    review.events.every((e) => e.lessonVersion === '1.0.1'),
    'Review history records lesson version',
  );
  console.log(
    'PASS assignment review, resubmission, history and stale-write rejection',
  );

  const bulkEmails = [outsider.email, `${prefix}.future@example.test`];
  const operations = bulkEmails.map((email) => ({
    email,
    courseId,
    idempotencyKey: `${prefix}:${randomUUID()}`,
  }));
  const grants = await Promise.all(
    operations.map((data) =>
      req('lms/grants', { user: teacher, data, status: 201 }),
    ),
  );
  for (const grant of grants) targets.add(grant.id);
  const repeated = await req('lms/grants', {
    user: teacher,
    data: operations[0],
    status: 201,
  });
  check(
    repeated.id === grants[0].id && repeated.reused,
    'Bulk grant retries preserve one entitlement',
  );
  await req('lms/grants', {
    user: teacher,
    data: { ...operations[0], email: studentEmail },
    status: 409,
  });
  await req('lms/grants', { user: student, data: operations[0], status: 403 });
  check(
    (await req(`lessons/${lessonId}`, { user: outsider })).body ===
      privateDraft.body,
    'New grant activates immediately',
  );
  const roster = await req(`lms/students?q=${prefix}`, { user: teacher });
  check(
    bulkEmails.every((email) =>
      roster.items.some(
        (s) => s.email === email && s.activeCourseIds.includes(courseId),
      ),
    ),
    'Roster includes current and future students with course grants',
  );
  await req('lms/students', { user: student, status: 403 });
  await req(`lms/grants/${grants[0].id}/revoke`, { user: teacher, data: {} });
  await req(`lessons/${lessonId}`, { user: outsider, status: 403 });
  check(
    (await req(`lessons/${lessonId}`, { user: student })).version === '1.0.1',
    'Another student grant revocation cannot revoke invited access',
  );
  const dashboard = await req('lms/dashboard', { user: teacher });
  check(
    dashboard.tickets.some((t) => t.id === ticket.id),
    'Teacher workbench includes reopened private ticket',
  );
  const existingInvite = (
    await req('teacher/invitations', {
      user: teacher,
      data: { emails: [outsider.email], courseIds: [courseId], days: 7 },
      status: 201,
    })
  ).items[0];
  targets.add(existingInvite.id);
  const existingToken = new URLSearchParams(
    new URL(existingInvite.url).hash.slice(1),
  ).get('invite');
  const identityBefore = db
    .prepare('SELECT COUNT(*) AS n FROM account WHERE user_id=?')
    .get(outsider.uid).n;
  await req('enrollment/activate', {
    data: { token: existingToken, password: randomUUID(), name: 'Replacement' },
    status: 409,
  });
  await req('enrollment/activate', {
    user: student,
    data: { token: existingToken },
    status: 409,
  });
  await req('enrollment/activate', {
    user: outsider,
    data: { token: existingToken, password: randomUUID() },
  });
  check(
    db
      .prepare('SELECT COUNT(*) AS n FROM account WHERE user_id=?')
      .get(outsider.uid).n === identityBefore,
    'Existing-account invitation requires its session and never replaces credentials',
  );
  console.log(
    `PASS roster bulk grants and workbench; ${requests} HTTP requests, ${checks} business assertions`,
  );
} finally {
  // Delete only fixture-owned rows/files; a pre-existing configured teacher is retained.
  const claimed = db
    .prepare('SELECT id FROM user WHERE email=?')
    .get(studentEmail);
  if (claimed) users.add(claimed.id);
  const ticketRows = db
    .prepare('SELECT id FROM tickets WHERE course_id=?')
    .all(courseId);
  const attachmentRoot = resolve(
    process.env.ATTACHMENTS_PATH || 'data/attachments',
  );
  const mediaRoot = resolve(process.env.MEDIA_PATH || 'data/media');
  for (const t of ticketRows) {
    for (const a of db
      .prepare('SELECT id FROM attachments WHERE ticket_id=?')
      .all(t.id)) {
      try {
        unlinkSync(join(attachmentRoot, a.id));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
  for (const id of mediaIds) {
    const a = db
      .prepare('SELECT storage_key FROM media_assets WHERE id=?')
      .get(id);
    if (a)
      try {
        unlinkSync(join(mediaRoot, a.storage_key));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
  }
  db.transaction(() => {
    for (const t of ticketRows) {
      db.prepare('DELETE FROM attachments WHERE ticket_id=?').run(t.id);
      db.prepare('DELETE FROM replies WHERE ticket_id=?').run(t.id);
      db.prepare('DELETE FROM tickets WHERE id=?').run(t.id);
    }
    db.prepare(
      'DELETE FROM lms_review_events WHERE review_id IN (SELECT id FROM reviews WHERE lesson_id=?)',
    ).run(lessonId);
    db.prepare('DELETE FROM reviews WHERE lesson_id=?').run(lessonId);
    db.prepare('DELETE FROM progress WHERE lesson_id=?').run(lessonId);
    // Other staging accounts can legitimately hold a wildcard grant. Remove
    // only notifications whose content or release link identifies our fixture.
    db.prepare(
      "DELETE FROM notifications WHERE title LIKE ? OR body=? OR href IN (SELECT '/?view=releases&release='||id FROM releases WHERE course_id=?)",
    ).run('%' + prefix + '%', `${prefix} course`, courseId);
    db.prepare(
      'DELETE FROM release_reads WHERE release_id IN (SELECT id FROM releases WHERE course_id=?)',
    ).run(courseId);
    db.prepare('DELETE FROM releases WHERE course_id=?').run(courseId);
    db.prepare('DELETE FROM revisions WHERE lesson_id=?').run(lessonId);
    db.prepare('DELETE FROM lms_lesson_drafts WHERE lesson_id=?').run(lessonId);
    db.prepare('DELETE FROM lessons WHERE id=?').run(lessonId);
    db.prepare('DELETE FROM lms_grant_requests WHERE key LIKE ?').run(
      prefix + ':%',
    );
    db.prepare('DELETE FROM grants WHERE course_id=?').run(courseId);
    db.prepare('DELETE FROM enrollment_invites WHERE email LIKE ?').run(
      prefix + '.%@example.test',
    );
    db.prepare('DELETE FROM courses WHERE id=?').run(courseId);
    for (const id of mediaIds) {
      db.prepare('DELETE FROM media_uploads WHERE asset_id=?').run(id);
      db.prepare('DELETE FROM media_assets WHERE id=?').run(id);
    }
    for (const id of targets)
      db.prepare('DELETE FROM audit WHERE target_id=?').run(id);
    for (const sid of sessions)
      db.prepare('DELETE FROM session WHERE id=?').run(sid);
    for (const uid of users) {
      db.prepare('DELETE FROM notifications WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM release_reads WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM audit WHERE actor_id=?').run(uid);
      db.prepare('DELETE FROM limits WHERE key LIKE ?').run(uid + ':%');
      db.prepare('DELETE FROM profiles WHERE id=?').run(uid);
      db.prepare('DELETE FROM user WHERE id=?').run(uid);
    }
  })();
  db.close();
  console.log('CLEANUP local platform fixtures removed');
}
