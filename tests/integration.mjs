import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
const base = process.env.TEST_URL || 'http://localhost:4317';
if (new URL(base).hostname !== 'localhost')
  throw new Error('Integration fixtures may only run on localhost');
const dbdir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file = readdirSync(dbdir).find(
  (f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite',
);
const db = new DatabaseSync(`${dbdir}/${file}`);
const secret = readFileSync('.dev.vars', 'utf8').match(
  /^BETTER_AUTH_SECRET=(.+)$/m,
)[1];
const prefix = 'integration:' + randomUUID();
const created = [];
const testLesson = prefix + ':lesson';
let checks = 0;
function identity(name, verified = true) {
  const uid = prefix + ':' + name,
    email = `${name}.${prefix.slice(-8)}@example.test`,
    token = randomUUID();
  const now = Date.now();
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, name, email, verified ? 1 : 0, now, now);
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  created.push(uid);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return {
    uid,
    email,
    cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`,
  };
}
async function req(path, { user, data, status = 200, origin = base } = {}) {
  const headers = {
    ...(user ? { cookie: user.cookie } : {}),
    ...(data === undefined
      ? {}
      : { 'Content-Type': 'application/json', Origin: origin }),
  };
  const r = await fetch(base + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await r.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    if (status >= 400 && r.status === status) result = { error: text };
    else throw new Error(`${path}: ${r.status} ${text.slice(0, 250)}`);
  }
  assert.equal(r.status, status, `${path}: ${JSON.stringify(result)}`);
  checks++;
  return result;
}
const teacher = { cookie: '__sites_local_auth=1' };
try {
  const a = identity('alice'),
    b = identity('bob'),
    unverified = identity('unverified', false);
  const guest = await req('bootstrap');
  assert.equal(guest.person, null);
  assert.equal(guest.courses[0].lessons.length, 17);
  assert.equal('body' in guest.courses[0].lessons[0], false);
  await req('lessons/00-overview', { status: 401 });
  await req('teacher', { user: a, status: 403 });
  const ab = await req('bootstrap', { user: a });
  assert.equal(ab.person.email, a.email);
  assert.equal(ab.courses[0].has_access, false);
  await req('lessons/00-overview', { user: a, status: 403 });
  const grant = await req('teacher/grants', {
    user: teacher,
    data: { email: a.email, courseId: 'gomall' },
    status: 201,
  });
  await req('teacher/grants', {
    user: teacher,
    data: { email: unverified.email, courseId: 'gomall' },
    status: 201,
  });
  await req('lessons/00-overview', { user: unverified, status: 403 });
  const lesson = await req('lessons/00-overview', { user: a });
  assert.ok(lesson.body.length > 1000);
  assert.equal('stream_uid' in lesson, false);
  await req('progress', {
    user: a,
    data: {
      lessonId: '00-overview',
      completed: true,
      note: 'integration private note',
      position: 12.5,
      bookmarked: true,
    },
  });
  const p = await req('bootstrap', { user: a });
  assert.equal(p.progress[0].note, 'integration private note');
  assert.equal(p.progress[0].completed, 1);
  const bob = await req('bootstrap', { user: b });
  assert.equal(bob.progress.length, 0);
  const ticket = await req('tickets', {
    user: a,
    data: {
      title: 'integration private question',
      body: 'Only Alice and the teacher should see this',
      lessonId: '00-overview',
      videoPosition: 12,
    },
    status: 201,
  });
  assert.deepEqual(await req('tickets', { user: b }), []);
  await req('tickets/' + ticket.id, { user: b, status: 404 });
  await req('tickets/' + ticket.id + '/reply', {
    user: b,
    data: { body: 'attack' },
    status: 404,
  });
  await req('tickets/' + ticket.id + '/reply', {
    user: teacher,
    data: { body: 'teacher reply' },
  });
  const detail = await req('tickets/' + ticket.id, { user: a });
  assert.equal(detail.status, 'waiting');
  assert.equal(detail.replies.length, 1);
  async function upload(user, name, bytes, status) {
    const r = await fetch(
      `${base}/api/tickets/${ticket.id}/attachments?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: {
          Cookie: user.cookie,
          Origin: base,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      },
    );
    assert.equal(r.status, status, await r.clone().text());
    checks++;
    return r;
  }
  await upload(b, 'private.txt', 'attack', 404);
  await upload(a, 'unsafe.html', '<script>alert(1)</script>', 400);
  await upload(a, 'oversized.txt', new Uint8Array(2 * 1024 * 1024 + 1), 413);
  const attachment = await (
    await upload(a, 'private.txt', 'Private attachment contents', 201)
  ).json();
  await req('attachments/' + attachment.id, { user: b, status: 404 });
  const download = await fetch(base + '/api/attachments/' + attachment.id, {
    headers: { Cookie: a.cookie },
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await download.text(), 'Private attachment contents');
  checks++;
  assert.equal(
    (await req('tickets/' + ticket.id, { user: a })).attachments[0].id,
    attachment.id,
  );
  const notification = (await req('bootstrap', { user: a })).notifications[0];
  assert.ok(notification);
  assert.equal((await req('bootstrap', { user: b })).notifications.length, 0);
  await req('notifications', { user: b, data: { id: notification.id } });
  assert.equal(
    (await req('bootstrap', { user: a })).notifications[0].read_at,
    null,
  );
  await req('tickets/' + ticket.id + '/status', {
    user: a,
    data: { status: 'resolved' },
  });
  assert.equal(
    (await req('tickets/' + ticket.id, { user: a })).status,
    'resolved',
  );
  await req('tickets/' + ticket.id + '/status', {
    user: a,
    data: { status: 'open', assignedTo: null },
    status: 403,
  });
  await req('progress', {
    user: a,
    data: { lessonId: '00-overview', completed: false },
    origin: 'https://attacker.test',
    status: 403,
  });
  const work = await req('reviews', {
    user: a,
    data: {
      lessonId: '00-overview',
      url: 'https://github.com/example/project/pull/1',
      note: 'integration review',
    },
    status: 201,
  });
  await req('reviews/' + work.id, {
    user: b,
    data: { status: 'approved', feedback: 'attack' },
    status: 403,
  });
  await req('reviews/' + work.id, {
    user: teacher,
    data: { status: 'changes_requested', feedback: 'Add a concurrency test' },
  });
  assert.equal(
    (await req('reviews', { user: a }))[0].feedback,
    'Add a concurrency test',
  );
  await req('reviews', {
    user: a,
    data: { lessonId: '00-overview', url: 'javascript:alert(1)', note: 'x' },
    status: 400,
  });
  const search = await req('search?q=' + encodeURIComponent('库存'), {
    user: a,
  });
  assert.ok(search.length > 0);
  assert.deepEqual(
    await req('search?q=' + encodeURIComponent('库存'), { user: b }),
    [],
  );
  await req('submissions', {
    user: a,
    data: {
      problemId: 'watch-intervals',
      language: 'python',
      code: 'print(1)',
    },
    status: 503,
  });
  assert.equal((await req('bootstrap', { user: a })).submissions.length, 0);
  await req('lessons/00-overview/video', { user: a, status: 404 });
  await req('checkout', { user: a, data: { courseId: 'gomall' }, status: 503 });
  db.prepare(
    'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
  ).run(
    testLesson,
    'gomall',
    'Integration chapter',
    'Test only',
    'Test',
    1000,
    'Original revision',
    '1.0.0',
    Date.now(),
  );
  const revision = {
    lessonId: testLesson,
    version: '1.1.0',
    title: 'Integration update',
    summary: 'New revision',
    body: 'Updated revision body',
    streamUid: null,
    important: true,
  };
  await req('teacher/publish', { user: a, data: revision, status: 403 });
  const release = await req('teacher/publish', {
    user: teacher,
    data: revision,
    status: 201,
  });
  await req('teacher/publish', { user: teacher, data: revision, status: 409 });
  assert.equal(
    (await req('lessons/' + testLesson, { user: a })).body,
    revision.body,
  );
  await req('releases/' + release.id + '/read', {
    user: b,
    data: {},
    status: 403,
  });
  await req('releases/' + release.id + '/read', { user: a, data: {} });
  await req('teacher/revoke', { user: teacher, data: { id: grant.id } });
  await req('lessons/00-overview', { user: a, status: 403 });
  // Raw identity headers cannot impersonate a teacher through the local Sites middleware.
  const spoof = await fetch(base + '/api/teacher', {
    headers: {
      'oai-authenticated-user-id': 'local_seedy',
      'oai-authenticated-user-email': 'seedy@sites.test',
    },
  });
  assert.equal(spoof.status, 401);
  checks++;
  console.log(
    `PASS: ${checks} real HTTP checks covering authentication, ownership, grants, notes, tickets, reviews, CSRF, search, and unavailable integrations.`,
  );
} finally {
  for (const uid of created) {
    db.prepare(
      'DELETE FROM attachments WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id=?)',
    ).run(uid);
    db.prepare(
      'DELETE FROM replies WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id=?) OR user_id=?',
    ).run(uid, uid);
    for (const table of [
      'progress',
      'notifications',
      'release_reads',
      'submissions',
      'reviews',
      'orders',
      'tickets',
    ])
      db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(uid);
    db.prepare(
      'DELETE FROM grants WHERE email=(SELECT email FROM user WHERE id=?)',
    ).run(uid);
    db.prepare('DELETE FROM profiles WHERE id=?').run(uid);
    db.prepare('DELETE FROM user WHERE id=?').run(uid);
    db.prepare('DELETE FROM limits WHERE key LIKE ?').run(uid + ':%');
  }
  db.prepare('DELETE FROM releases WHERE lesson_id=?').run(testLesson);
  db.prepare('DELETE FROM revisions WHERE lesson_id=?').run(testLesson);
  db.prepare('DELETE FROM lessons WHERE id=?').run(testLesson);
  db.close();
}
