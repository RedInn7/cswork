// Course catalog: category/level filters and the teacher fields behind them, the free preview
// lesson (first published lesson; reading paths only), and completion certificates.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-expect-error -- jsdom ships no types; the .mjs UI tests use it untyped too.
import { JSDOM } from 'jsdom';

const folder = mkdtempSync(join(tmpdir(), 'cswork-course-catalog-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
process.env.MEDIA_PATH = join(folder, 'media');
process.env.APP_URL = 'http://localhost:4319';
process.env.BETTER_AUTH_SECRET = 'test-course-catalog-secret-that-is-long-enough';
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { liveLesson, previewLessonId } = await import('../lib/server/lms-common');
const { handleMedia } = await import('../lib/server/media');
const { updateCourse, createCourse, courseList } = await import('../lib/server/lms-courses');
const { CERTIFICATE_ID, certificateById, certificatesFor, finishedCourses, profileCertificates, showOnProfile } = await import(
  '../lib/server/certificates'
);
const { catalogLabel, filterCourses } = await import('../lib/course-catalog');
const { CertificateView } = await import('../app/certificate/view');
const db = sqlite();

const person = (id: string, role: 'student' | 'teacher' = 'student', verified = true) => ({
  id,
  email: `${id}@cswork.test`,
  name: id,
  role,
  verified,
});
const teacher = person('teacher', 'teacher');
const member = person('member');
const stranger = person('stranger');
const fresh = person('fresh', 'student', false);
for (const p of [teacher, member, stranger, fresh])
  db.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,1,1)').run(
    p.id,
    p.id === 'member' ? 'Ada Member' : p.id,
    p.email,
    +p.verified,
  );
db.prepare(
  "INSERT INTO courses(id,title,summary,version,published,revision) VALUES('sysd','System Design','s','1.0.0',1,1),('draft-course','Draft','s','1.0.0',0,1)",
).run();
const lesson = db.prepare(
  "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,published,updated_at) VALUES(?,?,?,'s','sec',?,?,'1.0.0',?,1)",
);
lesson.run('l0', 'sysd', 'Unpublished intro', 0, 'draft body', 0);
lesson.run('l1', 'sysd', 'Overview', 1, 'preview body', 1);
lesson.run('l2', 'sysd', 'Deep dive', 2, 'paid body', 1);
lesson.run('d1', 'draft-course', 'Draft lesson', 1, 'draft course body', 1);
db.prepare("INSERT INTO grants(id,email,course_id,source,created_at) VALUES('g1',?,'sysd','test',1)").run(member.email);

const request = (path: string) =>
  new Request(process.env.APP_URL + '/api/' + path, { headers: { Origin: process.env.APP_URL!, 'X-Real-IP': 'test' } });
const status = (code: number) => (error: unknown) =>
  !!error && typeof error === 'object' && 'status' in error && error.status === code;
after(() => {
  delete process.env.COURSE_ACCESS;
  delete process.env.COURSE_OWNER_ID;
  rmSync(folder, { recursive: true, force: true });
});

test('catalog filters match on both fields, and labels follow the locale', () => {
  const courses = [
    { id: 'a', category: 'system-design', level: 'beginner' },
    { id: 'b', category: 'system-design', level: 'advanced' },
    { id: 'c', category: '', level: '' },
  ];
  assert.deepEqual(filterCourses(courses, {}).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(filterCourses(courses, { category: 'system-design' }).map((c) => c.id), ['a', 'b']);
  assert.deepEqual(filterCourses(courses, { category: 'system-design', level: 'advanced' }).map((c) => c.id), ['b']);
  assert.equal(catalogLabel('advanced', true), '高级');
  assert.equal(catalogLabel('system-design', false), 'System design');
  assert.equal(catalogLabel('', false), '');
  assert.equal(catalogLabel('__proto__', false), '');
});

test('teachers set category and level; bad values are refused and leaving them out keeps them', async () => {
  const save = (extra: Record<string, unknown>) => {
    const c = db.prepare("SELECT revision FROM courses WHERE id='sysd'").get() as { revision: number };
    return updateCourse(teacher, 'sysd', {
      expectedRevision: c.revision,
      title: 'System Design',
      summary: 's',
      published: true,
      position: 0,
      ...extra,
    });
  };
  await save({ category: 'system-design', level: 'intermediate' });
  const row = () => (courseList(teacher) as Promise<{ id: string; category?: string; level?: string }[]>).then((l) => l.find((c) => c.id === 'sysd')!);
  assert.deepEqual([(await row()).category, (await row()).level], ['system-design', 'intermediate']);
  await save({});
  assert.equal((await row()).level, 'intermediate');
  await assert.rejects(save({ category: 'cooking' }));
  await assert.rejects(save({ level: "x' OR 1=1" }));
  await save({ level: '' });
  assert.equal((await row()).level, '');
  await createCourse(teacher, { id: 'new-one', title: 'New', summary: 's', category: 'career', level: 'beginner' });
  assert.equal(
    (db.prepare("SELECT category||'/'||level FROM courses WHERE id='new-one'").pluck().get() as string),
    'career/beginner',
  );
  await assert.rejects(updateCourse(stranger, 'sysd', {}), status(403));
});

test('the first published lesson of a published course is a free preview, for reading only', async () => {
  assert.equal(await previewLessonId('sysd'), 'l1');
  assert.equal(await previewLessonId('draft-course'), undefined);
  // Any signed-in account reads the preview, even before verifying its email.
  for (const p of [stranger, fresh]) {
    assert.equal((await liveLesson(p, 'l1', true)).body, 'preview body');
    await assert.rejects(liveLesson(p, 'l2', true), status(403));
    // Strict callers (tickets, code reviews) still need the course.
    await assert.rejects(liveLesson(p, 'l1'), status(403));
  }
  await assert.rejects(liveLesson(stranger, 'l0', true), status(404));
  await assert.rejects(liveLesson(stranger, 'd1', true), status(403));
  assert.equal((await liveLesson(member, 'l2')).body, 'paid body');
  // Video lists follow the same rule.
  const videos = (id: string, p = stranger) => handleMedia(request(`lessons/${id}/videos`), p, ['lessons', id, 'videos']);
  assert.ok((await videos('l1'))!.ok);
  await assert.rejects(videos('l2'), status(403));
  // Owner-only mode hides the whole course, preview included.
  process.env.COURSE_ACCESS = 'owner';
  process.env.COURSE_OWNER_ID = 'nobody';
  await assert.rejects(liveLesson(stranger, 'l1', true), status(404));
  delete process.env.COURSE_ACCESS;
  delete process.env.COURSE_OWNER_ID;
});

test('a course is finished when every published lesson of a held, published course is complete', () => {
  const courses = [
    { id: 'sysd', published: 1, has_access: true, lessons: [{ id: 'l1', published: 1 }, { id: 'l2', published: 1 }, { id: 'l0', published: 0 }] },
    { id: 'empty', published: 1, has_access: true, lessons: [] },
    { id: 'other', published: 1, has_access: false, lessons: [{ id: 'o1', published: 1 }] },
    // A teacher holds every course, unpublished ones included: no certificate for those.
    { id: 'draft-course', published: 0, has_access: true, lessons: [{ id: 'd1', published: 1 }] },
  ];
  const done = (ids: string[]) => ids.map((lesson_id) => ({ lesson_id, completed: 1 }));
  assert.deepEqual(finishedCourses(courses, done(['l1'])), []);
  assert.deepEqual(finishedCourses(courses, [...done(['l1']), { lesson_id: 'l2', completed: 0 }]), []);
  assert.deepEqual(finishedCourses(courses, done(['l1', 'l2', 'o1', 'd1'])), ['sysd']);
});

test('certificates are issued once, verify publicly, and show on a visible profile only when listed', () => {
  assert.deepEqual(certificatesFor(member.id, []), []);
  const [cert] = certificatesFor(member.id, ['sysd'], 1_790_000_000_000);
  assert.ok(CERTIFICATE_ID.test(cert.id));
  assert.equal(cert.courseId, 'sysd');
  assert.equal(cert.onProfile, 0);
  // Issued once: later bootstraps read the same row.
  assert.deepEqual(certificatesFor(member.id, ['sysd']), [cert]);
  assert.equal(db.prepare('SELECT COUNT(*) FROM certificates').pluck().get(), 1);
  const page = certificateById(cert.id)!;
  assert.equal(page.name, 'Ada Member');
  assert.equal(page.course, 'System Design');
  assert.equal(page.lessons, 2);
  assert.equal(page.handle, null);
  assert.equal(certificateById('short'), null);
  assert.equal(certificateById("' OR 1=1 --xxxxx"), null);
  assert.equal(certificateById('A'.repeat(16)), null);
  assert.deepEqual(profileCertificates('ada'), []);
  db.prepare("INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,'ada',0,0,'',1,1)").run(
    member.id,
  );
  assert.deepEqual(profileCertificates('ada'), []);
  assert.equal(certificateById(cert.id)!.handle, null);
  db.prepare('UPDATE user_profiles SET visible=1 WHERE user_id=?').run(member.id);
  // A visible profile still lists nothing until the learner opts in: the page shows the name.
  assert.deepEqual(profileCertificates('ada'), []);
  assert.equal(certificateById(cert.id)!.handle, null);
  // Only the owner's row changes.
  assert.equal(showOnProfile(stranger.id, cert.id, true), false);
  assert.deepEqual(profileCertificates('ada'), []);
  assert.equal(showOnProfile(member.id, cert.id, true), true);
  assert.deepEqual(
    profileCertificates('ada').map((c) => c.course),
    ['System Design'],
  );
  assert.equal(certificateById(cert.id)!.handle, 'ada');
  // An unpublished course's certificate (issued earlier, or by a teacher) is not public.
  const [draft] = certificatesFor(member.id, ['draft-course']).filter((c) => c.courseId === 'draft-course');
  showOnProfile(member.id, draft.id, true);
  assert.equal(certificateById(draft.id), null);
  assert.deepEqual(profileCertificates('ada').map((c) => c.courseId), ['sysd']);
  db.prepare("DELETE FROM certificates WHERE id=?").run(draft.id);
  process.env.COURSE_ACCESS = 'owner';
  process.env.COURSE_OWNER_ID = 'nobody';
  assert.equal(certificateById(cert.id), null);
  assert.deepEqual(profileCertificates('ada'), []);
  delete process.env.COURSE_ACCESS;
  delete process.env.COURSE_OWNER_ID;
  showOnProfile(member.id, cert.id, false);
  assert.deepEqual(profileCertificates('ada'), []);
});

test('the certificate page shows the name, course, date and verification id in both languages', () => {
  const cert = { id: 'AbCdEfGh12345678', courseId: 'sysd', issuedAt: Date.UTC(2026, 9, 14), course: 'System Design', name: 'Ada <b>Member</b>', handle: 'ada', lessons: 2 };
  for (const zh of [false, true]) {
    const doc = new JSDOM(renderToStaticMarkup(createElement(CertificateView, { cert, zh }))).window.document;
    assert.ok(doc.querySelector('h1')!.textContent!.includes('Ada <b>Member</b>'));
    assert.ok(doc.querySelector('h1 b') === null);
    assert.equal(doc.querySelector('.certificate-course')!.textContent, 'System Design');
    assert.equal(doc.querySelector('.certificate-id')!.textContent, cert.id);
    assert.equal(doc.querySelector('time')!.getAttribute('datetime'), '2026-10-14T00:00:00.000Z');
    assert.ok(doc.querySelector('time')!.textContent!.includes('2026'));
    assert.equal(doc.querySelector('.certificate-profile a')!.getAttribute('href'), '/u/ada');
    assert.equal(doc.querySelectorAll('.certificate-actions button').length, 2);
    assert.ok(doc.querySelector('.certificate-verify a')!.textContent!.endsWith(`/certificate/${cert.id}`));
  }
});
