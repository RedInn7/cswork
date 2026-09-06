import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const folder = mkdtempSync(join(tmpdir(), 'cswork-enrollment-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
process.env.MEDIA_PATH = join(folder, 'media');
process.env.APP_URL = 'http://localhost:4318';
process.env.BETTER_AUTH_SECRET =
  'test-media-enrollment-secret-that-is-long-enough';
process.env.ADMIN_EMAILS = 'teacher@media.test';
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { handleEnrollment } = await import('../lib/server/enrollment');
const { handleMedia, byteRange } = await import('../lib/server/media');
const db = sqlite();
const teacher = {
  id: 'teacher',
  email: 'teacher@media.test',
  name: 'Teacher',
  role: 'teacher' as const,
  verified: true,
};
const student = {
  id: 'student',
  email: 'student@media.test',
  name: 'Student',
  role: 'student' as const,
  verified: true,
};
db.prepare(
  "INSERT INTO courses(id,title,summary,version,published) VALUES('course','Course','summary','1.0.0',1)",
).run();
db.prepare(
  "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('lesson','course','Lesson','summary','section',0,'body','1.0.0',1)",
).run();
db.prepare(
  "INSERT INTO grants(id,email,course_id,source,created_at) VALUES('grant',?,'course','test',1)",
).run(student.email);
const request = (
  path: string,
  data?: unknown,
  extra?: Record<string, string>,
) =>
  new Request(process.env.APP_URL + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      Origin: process.env.APP_URL!,
      'Content-Type': 'application/json',
      'X-Real-IP': 'test-' + Math.random(),
      ...extra,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
async function invite(email: string) {
  const r = await handleEnrollment(
    request('teacher/invitations', { emails: [email], courseIds: ['course'] }),
    teacher,
    ['teacher', 'invitations'],
  );
  assert.equal(r?.status, 201);
  const data = await r!.json();
  return {
    ...data.items[0],
    token: new URL(data.items[0].url).hash.slice('#invite='.length),
  };
}
after(() => {
  db.close();
  delete (globalThis as { __csworkSqlite?: unknown }).__csworkSqlite;
  rmSync(folder, { recursive: true, force: true });
});

void test('invitation activates a new account with a real Better Auth cookie and an atomic course grant', async () => {
  const i = await invite('new@media.test');
  assert.notEqual(
    (
      db
        .prepare('SELECT token_hash FROM enrollment_invites WHERE id=?')
        .get(i.id) as { token_hash: string }
    ).token_hash,
    i.token,
  );
  const inspect = await handleEnrollment(
    request('enrollment/inspect', { token: i.token }),
    null,
    ['enrollment', 'inspect'],
  );
  assert.equal((await inspect!.json()).requiresLogin, false);
  const response = await handleEnrollment(
    request('enrollment/activate', {
      token: i.token,
      name: 'New student',
      password: 'A long test password 123',
    }),
    null,
    ['enrollment', 'activate'],
  );
  assert.equal(response?.status, 200);
  assert.match(response!.headers.get('set-cookie') || '', /session_token/);
  const user = db.prepare('SELECT * FROM user WHERE email=?').get(i.email) as {
    id: string;
    email_verified: number;
  };
  assert.equal(user.email_verified, 1);
  assert.ok(
    db
      .prepare('SELECT id FROM grants WHERE email=? AND course_id=?')
      .get(i.email, 'course'),
  );
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/activate', { token: i.token }),
        null,
        ['enrollment', 'activate'],
      ),
    /已经使用/,
  );
  const list = await handleEnrollment(request('teacher/invitations'), teacher, [
    'teacher',
    'invitations',
  ]);
  assert.ok(!(await list!.text()).includes(i.token));
});
void test('existing accounts must sign in and invitation redemption never resets their password', async () => {
  const i = await invite('new@media.test');
  const u = db.prepare('SELECT id FROM user WHERE email=?').get(i.email) as {
    id: string;
  };
  const before = db
    .prepare('SELECT password FROM account WHERE user_id=?')
    .get(u.id);
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/activate', {
          token: i.token,
          password: 'attacker password',
        }),
        null,
        ['enrollment', 'activate'],
      ),
    /先使用原账号登录/,
  );
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/activate', { token: i.token }),
        student,
        ['enrollment', 'activate'],
      ),
    /先使用原账号登录/,
  );
  const r = await handleEnrollment(
    request('enrollment/activate', { token: i.token }),
    { ...student, id: u.id, email: i.email },
    ['enrollment', 'activate'],
  );
  assert.equal(r?.status, 200);
  assert.deepEqual(
    db.prepare('SELECT password FROM account WHERE user_id=?').get(u.id),
    before,
  );
});
void test('invites reject forged, revoked, expired tokens, unauthorized creators and teacher recipients', async () => {
  await assert.rejects(
    () =>
      handleEnrollment(
        request('teacher/invitations', {
          emails: ['a@media.test'],
          courseIds: ['course'],
        }),
        student,
        ['teacher', 'invitations'],
      ),
    /仅老师/,
  );
  await assert.rejects(() => invite(teacher.email), /老师账号/);
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/inspect', { token: 'x'.repeat(43) }),
        null,
        ['enrollment', 'inspect'],
      ),
    /过期或被撤销/,
  );
  const i = await invite('expired@media.test');
  db.prepare('UPDATE enrollment_invites SET expires_at=1 WHERE id=?').run(i.id);
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/activate', { token: i.token }),
        null,
        ['enrollment', 'activate'],
      ),
    /过期或被撤销/,
  );
  const r = await invite('revoked@media.test');
  db.prepare('UPDATE enrollment_invites SET revoked_at=1 WHERE id=?').run(r.id);
  await assert.rejects(
    () =>
      handleEnrollment(
        request('enrollment/activate', { token: r.token }),
        null,
        ['enrollment', 'activate'],
      ),
    /过期或被撤销/,
  );
});

void test('ranges cover suffix, open-ended, clamp and reject unsatisfiable or multiple ranges', () => {
  assert.deepEqual(byteRange('bytes=0-3', 10), { start: 0, end: 3 });
  assert.deepEqual(byteRange('bytes=3-', 10), { start: 3, end: 9 });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=0-999', 10), { start: 0, end: 9 });
  for (const value of [
    'bytes=10-',
    'bytes=-0',
    'bytes=4-2',
    'bytes=0-1,3-4',
    'bytes=bad',
  ])
    assert.throws(() => byteRange(value, 10));
});

void test('resumable upload, atomic offset, video signature and authenticated streaming', async () => {
  const bytes = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftypisom'),
    Buffer.alloc(64),
  ]);
  const r = await handleMedia(
    request('teacher/media/uploads', {
      name: 'Lesson.mp4',
      size: bytes.length,
      mimeType: 'video/mp4',
    }),
    teacher,
    ['teacher', 'media', 'uploads'],
  );
  const upload = await r!.json();
  const chunk = (offset: number, data: Buffer) =>
    handleMedia(
      new Request(
        process.env.APP_URL +
          '/api/teacher/media/uploads/' +
          upload.uploadId +
          '/chunk',
        {
          method: 'POST',
          headers: { 'Upload-Offset': String(offset) },
          body: new Uint8Array(data).buffer,
        },
      ),
      teacher,
      ['teacher', 'media', 'uploads', upload.uploadId, 'chunk'],
    );
  await chunk(0, bytes.subarray(0, 20));
  await assert.rejects(() => chunk(0, bytes.subarray(0, 20)), /位置已变化/);
  const state = await handleMedia(
    request('teacher/media/uploads/' + upload.uploadId),
    teacher,
    ['teacher', 'media', 'uploads', upload.uploadId],
  );
  assert.equal((await state!.json()).offset, 20);
  await assert.rejects(
    () =>
      handleMedia(
        request('teacher/media/uploads/' + upload.uploadId + '/complete', {}),
        teacher,
        ['teacher', 'media', 'uploads', upload.uploadId, 'complete'],
      ),
    /尚未上传完整/,
  );
  await chunk(20, bytes.subarray(20));
  const done = await handleMedia(
    request('teacher/media/uploads/' + upload.uploadId + '/complete', {}),
    teacher,
    ['teacher', 'media', 'uploads', upload.uploadId, 'complete'],
  );
  assert.equal((await done!.json()).status, 'ready');
  db.prepare('UPDATE lessons SET video_asset_ids=? WHERE id=?').run(
    JSON.stringify([upload.assetId]),
    'lesson',
  );
  const path = `media/${upload.assetId}/play?lesson=lesson`;
  await assert.rejects(
    () => handleMedia(request(path), null, ['media', upload.assetId, 'play']),
    /请先登录/,
  );
  const partial = await handleMedia(
    request(path, undefined, { Range: 'bytes=0-11' }),
    student,
    ['media', upload.assetId, 'play'],
  );
  assert.equal(partial?.status, 206);
  assert.equal(
    partial!.headers.get('content-range'),
    `bytes 0-11/${bytes.length}`,
  );
  assert.deepEqual(
    Buffer.from(await partial!.arrayBuffer()),
    bytes.subarray(0, 12),
  );
  const invalid = await handleMedia(
    request(path, undefined, { Range: 'bytes=999-' }),
    student,
    ['media', upload.assetId, 'play'],
  );
  assert.equal(invalid?.status, 416);
  await assert.rejects(
    () =>
      handleMedia(request(`media/${upload.assetId}/play`), student, [
        'media',
        upload.assetId,
        'play',
      ]),
    /章节不存在/,
  );
  db.prepare('UPDATE grants SET revoked_at=1 WHERE id=?').run('grant');
  await assert.rejects(
    () =>
      handleMedia(request(path), student, ['media', upload.assetId, 'play']),
    /尚未开通/,
  );
  db.prepare('UPDATE grants SET revoked_at=NULL WHERE id=?').run('grant');
  db.prepare('UPDATE lessons SET published=0 WHERE id=?').run('lesson');
  await assert.rejects(
    () =>
      handleMedia(request(path), student, ['media', upload.assetId, 'play']),
    /章节不存在/,
  );
});

void test('a slow upload remains mutually exclusive after a database lease expires', async () => {
  const bytes = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftypisom'),
    Buffer.alloc(64),
  ]);
  const created = await handleMedia(
    request('teacher/media/uploads', {
      name: 'Slow.mp4',
      size: bytes.length,
      mimeType: 'video/mp4',
    }),
    teacher,
    ['teacher', 'media', 'uploads'],
  );
  const u = await created!.json();
  let release!: () => void;
  let started!: () => void;
  const began = new Promise<void>((r) => {
    started = r;
  });
  const held = new Promise<void>((r) => {
    release = r;
  });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      started();
      await held;
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const pending = handleMedia(
    new Request(
      process.env.APP_URL +
        '/api/teacher/media/uploads/' +
        u.uploadId +
        '/chunk',
      {
        method: 'POST',
        headers: { 'Upload-Offset': '0' },
        body: stream,
        duplex: 'half',
      } as RequestInit,
    ),
    teacher,
    ['teacher', 'media', 'uploads', u.uploadId, 'chunk'],
  );
  await began;
  db.prepare('UPDATE media_uploads SET lock_until=0 WHERE id=?').run(
    u.uploadId,
  );
  try {
    await assert.rejects(
      () =>
        handleMedia(
          new Request(
            process.env.APP_URL +
              '/api/teacher/media/uploads/' +
              u.uploadId +
              '/chunk',
            {
              method: 'POST',
              headers: { 'Upload-Offset': '0' },
              body: new Uint8Array(bytes).buffer,
            },
          ),
          teacher,
          ['teacher', 'media', 'uploads', u.uploadId, 'chunk'],
        ),
      /位置已变化/,
    );
  } finally {
    release();
  }
  assert.equal((await pending)?.status, 200);
});

void test('completed uploads release the active quota and storage reservations enforce a global cap', async () => {
  const creator = { ...teacher, id: 'bulk-teacher' };
  const bytes = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftypisom'),
    Buffer.alloc(16),
  ]);
  const create = () =>
    handleMedia(
      request('teacher/media/uploads', {
        name: 'Bulk.mp4',
        size: bytes.length,
        mimeType: 'video/mp4',
      }),
      creator,
      ['teacher', 'media', 'uploads'],
    );
  for (let i = 0; i < 11; i++) {
    const u = await (await create())!.json();
    await handleMedia(
      new Request(
        process.env.APP_URL +
          '/api/teacher/media/uploads/' +
          u.uploadId +
          '/chunk',
        {
          method: 'POST',
          headers: { 'Upload-Offset': '0' },
          body: new Uint8Array(bytes).buffer,
        },
      ),
      creator,
      ['teacher', 'media', 'uploads', u.uploadId, 'chunk'],
    );
    const done = () =>
      handleMedia(
        request('teacher/media/uploads/' + u.uploadId + '/complete', {}),
        creator,
        ['teacher', 'media', 'uploads', u.uploadId, 'complete'],
      );
    assert.equal((await done())?.status, 200);
    assert.equal((await done())?.status, 200);
  }
  process.env.MEDIA_MAX_BYTES = '1';
  try {
    await assert.rejects(create, /容量已达上限/);
  } finally {
    delete process.env.MEDIA_MAX_BYTES;
  }
});
