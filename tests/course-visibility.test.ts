import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const folder = mkdtempSync(join(tmpdir(), 'cswork-course-visibility-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
process.env.MEDIA_PATH = join(folder, 'media');
process.env.APP_URL = 'http://localhost:4319';
process.env.BETTER_AUTH_SECRET =
  'test-course-visibility-secret-that-is-long-enough';
process.env.ADMIN_EMAILS = 'owner@cswork.test,admin@cswork.test';
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
// api.ts pulls in Vite-only seeding; bootstrap filters courses with canSeeCourse.
const { canSeeCourse } = await import('../lib/server/course-visibility');
const { liveLesson, courseAccess } = await import('../lib/server/lms-common');
const { handleMedia } = await import('../lib/server/media');
const { handleLms } = await import('../lib/server/lms');
const { allowed } = await import('../lib/server/http');
const { certificateById } = await import('../lib/server/certificates');
const db = sqlite();

const person = (
  id: string,
  role: 'student' | 'teacher',
  verified = true,
) => ({ id, email: `${id}@cswork.test`, name: id, role, verified });
const owner = person('owner', 'teacher');
const otherAdmin = person('admin', 'teacher');
const member = person('member', 'student');
const student = person('student', 'student');
const people = { anonymous: null, student, member, otherAdmin };

db.prepare(
  "INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','summary','1.0.0',1)",
).run();
db.prepare(
  "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,published,updated_at) VALUES('00-overview','gomall','Overview','summary','section',0,'secret body','1.0.0',1,1)",
).run();
// Algorithm Concepts was removed; its course rows stay in the database, hidden from everyone.
db.prepare(
  "INSERT INTO courses(id,title,summary,version,published) VALUES('sde-interview-foundations','Knowledge','summary','1.0.0',1)",
).run();
db.prepare(
  "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,published,updated_at) VALUES('k-1','sde-interview-foundations','Knowledge','summary','section',0,'knowledge body','1.0.0',1,1)",
).run();
db.prepare(
  "INSERT INTO releases(id,course_id,version,title,body,created_at) VALUES('r1','gomall','1.0.0','GoMall update','body',1)",
).run();
db.prepare(
  "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('member','member','member@cswork.test',1,0,0)",
).run();
db.prepare(
  "INSERT INTO certificates(id,user_id,course_id,issued_at) VALUES('kcert-0000000001','member','sde-interview-foundations',1)",
).run();
for (const course of ['gomall', 'sde-interview-foundations'])
  db.prepare(
    "INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,'test',1)",
  ).run(`g-${course}`, member.email, course);

const request = (path: string) =>
  new Request(process.env.APP_URL + '/api/' + path, {
    headers: { Origin: process.env.APP_URL!, 'X-Real-IP': 'test' },
  });
const status = (error: unknown) =>
  !!error &&
  typeof error === 'object' &&
  'status' in error &&
  error.status === 404;

function ownerOnly(on: boolean) {
  if (on) {
    process.env.COURSE_ACCESS = 'owner';
    process.env.COURSE_OWNER_ID = owner.id;
  } else {
    delete process.env.COURSE_ACCESS;
    delete process.env.COURSE_OWNER_ID;
  }
}
after(() => {
  ownerOnly(false);
  rmSync(folder, { recursive: true, force: true });
});

const ids = (p: Parameters<typeof canSeeCourse>[0]) =>
  ['gomall', 'sde-interview-foundations'].filter((c) => canSeeCourse(p, c));

test('owner-only mode hides teaching courses from everyone but the owner', async () => {
  ownerOnly(true);
  for (const [name, p] of Object.entries(people)) {
    assert.ok(!ids(p).includes('gomall'), `${name} sees no teaching course`);
    if (!p) continue;
    await assert.rejects(liveLesson(p, '00-overview'), status, `${name} lesson`);
    assert.match(
      courseAccess(p, 'l.course_id').sql,
      / AND 0$/,
      `${name} search`,
    );
    await assert.rejects(
      handleMedia(request('lessons/00-overview/videos'), p, [
        'lessons',
        '00-overview',
        'videos',
      ]),
      status,
      `${name} videos`,
    );
    await assert.rejects(
      handleMedia(request('media/x/play'), p, ['media', 'x', 'play']),
      status,
      `${name} media`,
    );
  }
  // Other admins are not owners: course administration stays closed to them too.
  for (const path of [['lms', 'courses'], ['lms', 'lessons', '00-overview'], ['lms', 'grants']])
    await assert.rejects(
      handleLms(request(path.join('/')), otherAdmin, path),
      status,
      path.join('/'),
    );

  assert.deepEqual(ids(owner), ['gomall']);
  assert.equal((await liveLesson(owner, '00-overview')).body, 'secret body');
  assert.ok(await handleLms(request('lms/courses'), owner, ['lms', 'courses']));
  // Release notes are filtered per course rather than rejected.
  const releases = async (p: typeof owner) =>
    (await (await handleLms(request('lms/releases'), p, ['lms', 'releases']))!.json())
      .items.length;
  assert.equal(await releases(otherAdmin), 0);
  assert.equal(await releases(member), 0);
  assert.equal(await releases(owner), 1);
});

test('an unverified owner session and a missing owner id both fail closed', async () => {
  ownerOnly(true);
  assert.ok(!ids(({ ...owner, verified: false })).includes('gomall'));
  delete process.env.COURSE_OWNER_ID;
  assert.ok(!ids((owner)).includes('gomall'));
  await assert.rejects(liveLesson(owner, '00-overview'), status);
  ownerOnly(false);
});

test('the removed Algorithm Concepts course is hidden in both modes, owner included', async () => {
  for (const on of [true, false]) {
    ownerOnly(on);
    for (const p of [member, owner]) {
      assert.ok(!ids(p).includes('sde-interview-foundations'), `${p.id} ${on}`);
      await assert.rejects(liveLesson(p, 'k-1'), status, `${p.id} ${on}`);
    }
    const search = courseAccess(owner, 'l.course_id').sql;
    const found = db
      .prepare(`SELECT l.id FROM lessons l WHERE ${search} ORDER BY l.id`)
      .all()
      .map((r) => (r as { id: string }).id);
    assert.deepEqual(found, ['00-overview'], `owner search ${on}`);
    // A certificate issued before the removal still verifies.
    assert.equal(certificateById('kcert-0000000001')?.course, 'Knowledge', `certificate ${on}`);
  }
  ownerOnly(false);
});

test('course grants are unchanged while course content is hidden', async () => {
  ownerOnly(true);
  assert.equal(await allowed(member, 'gomall'), true);
  assert.equal(await allowed(student, 'gomall'), false);
  ownerOnly(false);
});

test('turning the setting off restores normal course access', async () => {
  ownerOnly(false);
  assert.ok(ids((member)).includes('gomall'));
  assert.equal((await liveLesson(member, '00-overview')).body, 'secret body');
  await assert.rejects(liveLesson(student, '00-overview'));
});
