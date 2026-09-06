import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import fsPromises from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-lms-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.ATTACHMENTS_PATH = resolve(dir, 'attachments');
const { sqlite } = await import('../db/sqlite');
const cms = await import('../lib/server/lms-courses');
const support = await import('../lib/server/lms-support');
const roster = await import('../lib/server/lms-roster');
const { allowed } = await import('../lib/server/http');
const { liveLesson } = await import('../lib/server/lms-common');
const { uploadAttachment, deleteAttachment } =
  await import('../lib/server/files');
const teacher: Person = {
  id: 'teacher',
  email: 'teacher@example.test',
  name: 'Teacher',
  role: 'teacher',
  verified: true,
};
const alice: Person = {
  id: 'alice',
  email: 'alice@example.test',
  name: 'Alice',
  role: 'student',
  verified: true,
};
const bob: Person = {
  id: 'bob',
  email: 'bob@example.test',
  name: 'Bob',
  role: 'student',
  verified: true,
};
const unverified: Person = {
  id: 'unverified',
  email: 'unverified@example.test',
  name: 'Unverified',
  role: 'student',
  verified: false,
};
const status = (n: number) => (e: unknown) =>
  !!e && typeof e === 'object' && 'status' in e && e.status === n;
const db = sqlite();
const scalar = (sql: string, ...args: (string | number)[]) =>
  Object.values(db.prepare(sql).get(...args) as object)[0];
const draft = (body = 'Original body') => ({
  title: 'First lesson',
  summary: 'Course summary',
  section: 'Basics',
  position: 2,
  body,
  streamUid: null,
  videoAssetIds: [],
});
const pub = (revision: number, version = '1.0.0') => ({
  expectedRevision: revision,
  version,
  releaseTitle: 'Lesson published',
  releaseSummary: 'Real course update',
  important: true,
});
before(() => {
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const p of [teacher, alice, bob, unverified]) {
    db.prepare(
      'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,0,0)',
    ).run(p.id, p.name, p.email, Number(p.verified));
    db.prepare(
      'INSERT INTO profiles(id,email,name,role,created_at) VALUES(?,?,?,?,0)',
    ).run(p.id, p.email, p.name, p.role);
  }
});
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

void test('CMS creates unpublished course and chapter; teacher-only editing and public gates', async () => {
  await assert.rejects(
    cms.createCourse(alice, { id: 'bad', title: 'Bad', summary: '' }),
    status(403),
  );
  const c = await cms.createCourse(teacher, {
    id: 'lms-course',
    title: 'LMS Course',
    summary: 'Summary',
  });
  assert.equal(c.course?.published, false);
  const editor = await cms.createLesson(teacher, 'lms-course', {
    id: 'lms-lesson',
    title: 'First lesson',
    section: 'Basics',
  });
  assert.equal(editor.draft.revision, 0);
  assert.equal(editor.lesson.published, 0);
  await assert.rejects(liveLesson(alice, 'lms-lesson'), status(404));
  await assert.rejects(
    cms.updateCourse(teacher, 'lms-course', {
      expectedRevision: 1,
      title: 'LMS Course',
      summary: 'Summary',
      position: 0,
      published: true,
    }),
    status(400),
  );
  assert.equal(
    (await cms.courseDetail(teacher, 'lms-course')).lessons.length,
    1,
  );
});

void test('Persistent drafts use CAS and exactly one simultaneous save succeeds', async () => {
  const attempts = await Promise.allSettled(
    ['First writer', 'Second writer'].map((body) =>
      cms.saveLessonDraft(teacher, 'lms-lesson', {
        expectedRevision: 0,
        ...draft(body),
      }),
    ),
  );
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = attempts.find(
    (r) => r.status === 'rejected',
  ) as PromiseRejectedResult;
  assert.ok(status(409)(rejected.reason));
  const current = await cms.lessonEditor(teacher, 'lms-lesson');
  assert.equal(current.draft.revision, 1);
  assert.equal(current.draft.body, 'First writer');
  assert.equal(current.lesson.body, '');
});

void test('Publishing is atomic and opening a course notifies only verified authorized students once', async () => {
  for (const p of [alice, unverified])
    await roster.grantCourse(teacher, {
      email: p.email,
      courseId: 'lms-course',
    });
  const results = await Promise.allSettled([
    cms.publishLesson(teacher, 'lms-lesson', pub(1)),
    cms.publishLesson(teacher, 'lms-lesson', pub(1)),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    scalar('SELECT COUNT(*) FROM revisions WHERE lesson_id=?', 'lms-lesson'),
    1,
  );
  assert.equal(
    scalar('SELECT COUNT(*) FROM releases WHERE lesson_id=?', 'lms-lesson'),
    1,
  );
  assert.equal(scalar('SELECT COUNT(*) FROM notifications'), 0);
  const edit = {
    expectedRevision: 1,
    title: 'LMS Course',
    summary: 'Summary',
    position: 1,
    published: true,
  };
  const opened = await Promise.allSettled([
    roster.grantCourse(teacher, { email: alice.email, courseId: 'lms-course' }),
    cms.updateCourse(teacher, 'lms-course', edit),
    cms.updateCourse(teacher, 'lms-course', edit),
  ]);
  assert.equal(opened.filter((r) => r.status === 'rejected').length, 1);
  assert.equal(
    scalar('SELECT COUNT(*) FROM notifications WHERE user_id=?', alice.id),
    1,
  );
  assert.equal(
    scalar('SELECT COUNT(*) FROM notifications WHERE user_id=?', unverified.id),
    0,
  );
  assert.ok(await allowed(alice, 'lms-course'));
  assert.equal(await allowed(unverified, 'lms-course'), false);
  assert.equal(await allowed(bob, 'lms-course'), false);
});

void test('Version history is immutable; rollback rejects; restore creates a new draft', async () => {
  let editor = await cms.lessonEditor(teacher, 'lms-lesson');
  await assert.rejects(
    cms.publishLesson(
      teacher,
      'lms-lesson',
      pub(editor.draft.revision, '0.9.0'),
    ),
    status(409),
  );
  editor = await cms.saveLessonDraft(teacher, 'lms-lesson', {
    expectedRevision: editor.draft.revision,
    ...draft('Second version'),
  });
  editor = await cms.publishLesson(
    teacher,
    'lms-lesson',
    pub(editor.draft.revision, '1.1.0'),
  );
  const old = await cms.lessonVersion(alice, 'lms-lesson', '1.0.0');
  assert.equal(old.body, 'First writer');
  assert.equal(old.streamUid, undefined);
  assert.equal(old.videoAssetIds, undefined);
  const restored = await cms.restoreLesson(teacher, 'lms-lesson', {
    version: '1.0.0',
    expectedRevision: editor.draft.revision,
  });
  assert.equal(restored.draft.body, 'First writer');
  assert.equal(restored.lesson.body, 'Second version');
  assert.equal(restored.lesson.version, '1.1.0');
  await assert.rejects(
    cms.restoreLesson(teacher, 'lms-lesson', {
      version: '1.0.0',
      expectedRevision: editor.draft.revision,
    }),
    status(409),
  );
  await assert.rejects(
    cms.lessonVersion(bob, 'lms-lesson', '1.0.0'),
    status(403),
  );
});

void test('Media validation rejects unavailable, duplicate, or mixed sources before publishing', async () => {
  const editor = await cms.lessonEditor(teacher, 'lms-lesson');
  await assert.rejects(
    cms.saveLessonDraft(teacher, 'lms-lesson', {
      expectedRevision: editor.draft.revision,
      ...draft(),
      videoAssetIds: ['x', 'x'],
    }),
  );
  await assert.rejects(
    cms.saveLessonDraft(teacher, 'lms-lesson', {
      expectedRevision: editor.draft.revision,
      ...draft(),
      videoAssetIds: ['x'],
      streamUid: 'a'.repeat(32),
    }),
  );
  const pending = await cms.saveLessonDraft(teacher, 'lms-lesson', {
    expectedRevision: editor.draft.revision,
    ...draft(),
    videoAssetIds: ['not-ready'],
  });
  await assert.rejects(
    cms.publishLesson(
      teacher,
      'lms-lesson',
      pub(pending.draft.revision, '1.2.0'),
    ),
    status(400),
  );
  assert.equal(
    (await cms.lessonEditor(teacher, 'lms-lesson')).lesson.version,
    '1.1.0',
  );
});

void test('Downlisting immediately blocks current body, old versions and release lists', async () => {
  const editor = await cms.lessonEditor(teacher, 'lms-lesson');
  const hidden = await cms.lessonVisibility(teacher, 'lms-lesson', {
    expectedRevision: editor.lesson.revision,
    published: false,
  });
  await assert.rejects(liveLesson(alice, 'lms-lesson'), status(404));
  await assert.rejects(
    cms.lessonVersion(alice, 'lms-lesson', '1.0.0'),
    status(404),
  );
  assert.equal(
    (await support.releasePage(alice, new URL('http://local/releases'))).total,
    0,
  );
  await cms.lessonVisibility(teacher, 'lms-lesson', {
    expectedRevision: hidden.lesson.revision,
    published: true,
  });
  const c = (await cms.courseDetail(teacher, 'lms-course')).course!;
  await cms.updateCourse(teacher, 'lms-course', {
    expectedRevision: c.revision,
    title: c.title,
    summary: c.summary,
    position: c.position,
    published: false,
  });
  assert.equal(await allowed(alice, 'lms-course'), false);
  await assert.rejects(
    cms.lessonVersion(alice, 'lms-lesson', '1.0.0'),
    status(403),
  );
  await cms.updateCourse(teacher, 'lms-course', {
    expectedRevision: c.revision + 1,
    title: c.title,
    summary: c.summary,
    position: c.position,
    published: true,
  });
});

void test('Grant idempotency survives retries and revocation; conflicting payload cannot overwrite', async () => {
  const data = {
    email: bob.email,
    courseId: '*',
    idempotencyKey: 'grant-retry-123',
  };
  const result = await Promise.all(
    Array.from({ length: 10 }, () => roster.grantCourse(teacher, data)),
  );
  assert.equal(new Set(result.map((r) => r.id)).size, 1);
  assert.equal(
    scalar(
      "SELECT COUNT(*) FROM grants WHERE email=? AND course_id='*'",
      bob.email,
    ),
    1,
  );
  await assert.rejects(
    roster.grantCourse(teacher, { ...data, email: alice.email }),
    status(409),
  );
  assert.ok(await allowed(bob, 'lms-course'));
  await roster.revokeGrant(teacher, result[0].id);
  await roster.grantCourse(teacher, data);
  assert.equal(await allowed(bob, 'lms-course'), false);
  assert.equal(scalar('SELECT COUNT(*) FROM lms_grant_requests'), 1);
});

void test('Release pagination filters grants before limiting and returns every accessible page', async () => {
  await cms.createCourse(teacher, {
    id: 'private-course',
    title: 'Private',
    summary: '',
  });
  for (let i = 0; i < 75; i++)
    db.prepare(
      'INSERT INTO releases(id,course_id,version,title,body,important,created_at) VALUES(?,?,?,?,?,0,?)',
    ).run(
      `private-${i}`,
      'private-course',
      '1.0.0',
      'Secret',
      'Hidden',
      9999999999999 + i,
    );
  for (let i = 0; i < 40; i++)
    db.prepare(
      'INSERT INTO releases(id,course_id,version,title,body,important,created_at) VALUES(?,?,?,?,?,0,?)',
    ).run(`public-${i}`, 'lms-course', '1.0.0', 'Public', 'Granted', 1000 + i);
  const first = await support.releasePage(
    alice,
    new URL('http://local/releases'),
  );
  assert.equal(first.total, 42);
  assert.equal(first.items.length, 30);
  assert.ok(first.nextCursor);
  const second = await support.releasePage(
    alice,
    new URL(`http://local/releases?cursor=${first.nextCursor}`),
  );
  assert.equal(second.items.length, 12);
  assert.equal(
    new Set([...first.items, ...second.items].map((i) => i.id)).size,
    42,
  );
  assert.ok(
    [...first.items, ...second.items].every(
      (i) => i.course_id === 'lms-course',
    ),
  );
});

void test('Private tickets isolate users and simultaneous replies respect CAS', async () => {
  db.prepare(
    "INSERT INTO tickets(id,user_id,title,body,status,created_at,updated_at) VALUES('ticket',?,'Private issue','Secret','open',0,0)",
  ).run(alice.id);
  await assert.rejects(support.ticketDetail(bob, 'ticket'), status(404));
  assert.equal(
    (await support.ticketPage(bob, new URL('http://local/tickets'))).total,
    0,
  );
  const attempts = await Promise.allSettled([
    support.replyTicket(teacher, 'ticket', {
      body: 'Teacher answer',
      expectedRevision: 1,
    }),
    support.replyTicket(teacher, 'ticket', {
      body: 'Stale overwrite',
      expectedRevision: 1,
    }),
  ]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    scalar("SELECT COUNT(*) FROM replies WHERE ticket_id='ticket'"),
    1,
  );
  const t = await support.ticketDetail(alice, 'ticket');
  assert.equal(t.status, 'waiting');
  assert.equal(t.revision, 2);
  await assert.rejects(
    support.changeTicket(alice, 'ticket', {
      expectedRevision: 2,
      status: 'waiting',
    }),
    status(403),
  );
  await support.changeTicket(alice, 'ticket', {
    expectedRevision: 2,
    status: 'resolved',
  });
  await support.replyTicket(alice, 'ticket', {
    expectedRevision: 3,
    body: 'Follow-up',
  });
  assert.equal((await support.ticketDetail(alice, 'ticket')).status, 'open');
});

void test('Homework review, resubmission, and rereview preserve all prior versions', async () => {
  const { id } = await support.createReview(alice, {
    lessonId: 'lms-lesson',
    url: 'https://github.com/student/repo',
    note: 'Initial work',
  });
  await assert.rejects(support.reviewDetail(bob, id), status(404));
  await assert.rejects(
    support.resubmitReview(alice, id, {
      expectedRevision: 1,
      url: 'https://github.com/student/repo',
      note: 'Premature',
    }),
    status(409),
  );
  const attempts = await Promise.allSettled([
    support.feedbackReview(teacher, id, {
      expectedRevision: 1,
      status: 'changes_requested',
      feedback: 'Fix the race',
    }),
    support.feedbackReview(teacher, id, {
      expectedRevision: 1,
      status: 'approved',
      feedback: 'Stale answer',
    }),
  ]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(
    attempts.some((r) => r.status === 'rejected' && status(409)(r.reason)),
  );
  const resubmitted = await support.resubmitReview(alice, id, {
    expectedRevision: 2,
    url: 'https://github.com/student/repo/pull/2',
    note: 'Fixed race',
  });
  assert.equal(resubmitted.status, 'pending');
  assert.equal(resubmitted.feedback, null);
  const reviewed = await support.feedbackReview(teacher, id, {
    expectedRevision: 3,
    status: 'approved',
    feedback: 'Looks good',
  });
  assert.equal(reviewed.revision, 4);
  assert.equal(reviewed.events.length, 4);
  assert.equal(reviewed.events[2].feedback, 'Fix the race');
  assert.equal(reviewed.events[3].note, 'Initial work');
});

void test('Attachment quota remains ten under concurrent upload; only author or teacher can delete', async () => {
  const upload = (p: Person = alice) =>
    uploadAttachment(
      new Request(
        'http://local/api/tickets/ticket/attachments?name=proof.txt',
        { method: 'POST', body: 'Evidence' },
      ),
      p,
      'ticket',
    );
  await assert.rejects(upload(bob), status(404));
  const results = await Promise.allSettled(
    Array.from({ length: 16 }, () => upload()),
  );
  const accepted = results.filter(
    (r) => r.status === 'fulfilled',
  ) as PromiseFulfilledResult<Response>[];
  assert.equal(accepted.length, 10);
  assert.equal(readdirSync(process.env.ATTACHMENTS_PATH!).length, 10);
  assert.equal(
    scalar("SELECT COUNT(*) FROM attachments WHERE ticket_id='ticket'"),
    10,
  );
  const attachment = (await accepted[0].value.json()) as { id: string };
  await assert.rejects(deleteAttachment(bob, attachment.id), status(404));
  await deleteAttachment(alice, attachment.id);
  await upload(teacher);
  const teacherFile = db
    .prepare('SELECT id FROM attachments WHERE user_id=?')
    .get(teacher.id) as { id: string };
  await assert.rejects(deleteAttachment(alice, teacherFile.id), status(404));
  await deleteAttachment(teacher, teacherFile.id);
  assert.equal(readdirSync(process.env.ATTACHMENTS_PATH!).length, 9);
});

void test('Roster and dashboard provide accurate totals and paginated users beyond the first page', async () => {
  for (let i = 0; i < 37; i++)
    await roster.grantCourse(teacher, {
      email: `roster-${String(i).padStart(2, '0')}@example.test`,
      courseId: 'lms-course',
    });
  const first = await roster.studentPage(
    teacher,
    new URL('http://local/students?q=roster-'),
  );
  assert.equal(first.total, 37);
  assert.equal(first.items.length, 30);
  const second = await roster.studentPage(
    teacher,
    new URL(`http://local/students?q=roster-&cursor=${first.nextCursor}`),
  );
  assert.equal(second.items.length, 7);
  assert.equal(second.nextCursor, null);
  const dashboard = await roster.dashboard(teacher);
  assert.equal(dashboard.counts?.openTickets, 1);
  assert.equal(dashboard.counts?.pendingReviews, 0);
  await assert.rejects(
    roster.studentPage(alice, new URL('http://local/students')),
    status(403),
  );
});

void test('Legacy lesson metadata is frozen before its first CMS publication', async () => {
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('legacy-lesson','lms-course','Old title','Old summary','Old section',8,'Old body','1.0.0',1)",
  ).run();
  db.prepare(
    "INSERT INTO revisions(id,lesson_id,version,body,created_at) VALUES('legacy-revision','legacy-lesson','1.0.0','Old body',1)",
  ).run();
  const saved = await cms.saveLessonDraft(teacher, 'legacy-lesson', {
    expectedRevision: 0,
    ...draft('New body'),
    title: 'New title',
  });
  await cms.publishLesson(
    teacher,
    'legacy-lesson',
    pub(saved.draft.revision, '1.1.0'),
  );
  const old = await cms.lessonVersion(alice, 'legacy-lesson', '1.0.0');
  assert.equal(old.title, 'Old title');
  assert.equal(old.section, 'Old section');
  assert.equal(old.body, 'Old body');
  const snapshot = scalar(
    "SELECT snapshot_json FROM revisions WHERE id='legacy-revision'",
  ) as string;
  assert.equal(JSON.parse(snapshot).title, 'Old title');
});

void test('Global attachment byte quota reserves atomically across different students and tickets', async () => {
  for(const p of [alice,bob])db.prepare('INSERT INTO tickets(id,user_id,title,body,status,created_at,updated_at) VALUES(?,?,?,?,\'open\',0,0)').run(`quota-${p.id}`,p.id,'Storage quota','Body');
  const before=scalar('SELECT COALESCE(SUM(size),0) FROM attachments') as number;
  const previous=process.env.ATTACHMENTS_MAX_BYTES;
  process.env.ATTACHMENTS_MAX_BYTES=String(before+12);
  const upload=(p:Person)=>uploadAttachment(new Request(`http://local/api/tickets/quota-${p.id}/attachments?name=quota.txt`,{method:'POST',body:'abcdef'}),p,`quota-${p.id}`);
  try {
    const results=await Promise.allSettled(Array.from({length:8},(_,i)=>upload(i%2?alice:bob)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
    assert.ok(results.filter(r=>r.status==='rejected').every(r=>status(507)((r as PromiseRejectedResult).reason)));
    assert.equal(scalar('SELECT SUM(size) FROM attachments'),before+12);
    const row=db.prepare("SELECT id,user_id FROM attachments WHERE ticket_id LIKE 'quota-%' LIMIT 1").get() as {id:string;user_id:string};
    await deleteAttachment(row.user_id===alice.id?alice:bob,row.id);
    const accepted=await upload(alice);assert.equal(accepted.status,201);
    assert.equal(scalar('SELECT SUM(size) FROM attachments'),before+12);
  } finally {
    if(previous===undefined)delete process.env.ATTACHMENTS_MAX_BYTES;else process.env.ATTACHMENTS_MAX_BYTES=previous;
  }
});

void test('Low disk space refuses an attachment before reserving rows or writing files', async t => {
  const before=scalar('SELECT COUNT(*) FROM attachments'),files=readdirSync(process.env.ATTACHMENTS_PATH!);
  t.mock.method(fsPromises,'statfs',async()=>({type:BigInt(0),bsize:BigInt(1),blocks:BigInt(0),bfree:BigInt(3*1024*1024*1024),bavail:BigInt(3*1024*1024*1024),files:BigInt(0),ffree:BigInt(0)}));
  syncBuiltinESMExports();
  try {
    await assert.rejects(uploadAttachment(new Request('http://local/api/tickets/quota-alice/attachments?name=low-space.txt',{method:'POST',body:'x'}),alice,'quota-alice'),status(507));
    assert.equal(scalar('SELECT COUNT(*) FROM attachments'),before);assert.deepEqual(readdirSync(process.env.ATTACHMENTS_PATH!),files);
  } finally {t.mock.restoreAll();syncBuiltinESMExports();}
});
