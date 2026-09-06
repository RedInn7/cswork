/** Real near-128 MiB import/publication, only against an isolated staging DB. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

const base = new URL(process.env.TEST_URL || 'http://localhost:4319');
assert.ok(
  base.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(base.hostname),
);
assert.match(process.env.DATABASE_PATH || '', /staging/);
const secret = process.env.BETTER_AUTH_SECRET;
assert.ok(secret?.length >= 32);
const email = (process.env.ADMIN_EMAILS || '').split(',')[0].trim();
assert.ok(email);
const db = new Database(process.env.DATABASE_PATH);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
const uid = 'large-import-' + randomUUID(),
  id = 'large-import-' + randomUUID();
const token = randomUUID(),
  now = Date.now();
assert.ok(
  !db.prepare('SELECT id FROM user WHERE email=?').get(email),
  'Use an unused staging teacher identity',
);
db.prepare(
  'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
).run(uid, 'Large import reviewer', email, 1, now, now);
db.prepare(
  'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
).run(randomUUID(), now + 3600000, token, now, now, uid);
const signature = createHmac('sha256', secret).update(token).digest('base64');
const cookie =
  'better-auth.session_token=' + encodeURIComponent(token + '.' + signature);
async function request(path, data) {
  const response = await fetch(new URL('/api/' + path, base), {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      Cookie: cookie,
      Origin: process.env.APP_URL || base.origin,
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(180000),
  });
  assert.equal(response.status, 200, 'Unexpected HTTP status for ' + path);
  return response.json();
}
try {
  const markerA = 'PRIVATE_LARGE_A_',
    markerB = 'PRIVATE_LARGE_B_';
  const full = 64 * 1024 * 1024,
    second = full - 512 * 1024;
  const payload = {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Synthetic maximum import',
      difficulty: '简单',
      tags: ['集成测试'],
      description: 'Isolated staging capacity fixture.',
      input: 'A small control input.',
      output: 'Produce the assigned synthetic output.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 65536,
      checker: 'exact',
      languages: ['python'],
    },
    cases: [
      {
        name: 'sample',
        input: '0\n',
        expectedOutput: '0\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden-full',
        input: '1\n',
        expectedOutput: markerA + 'x'.repeat(full - markerA.length),
        hidden: true,
        weight: 1,
      },
      {
        name: 'hidden-near-full',
        input: '2\n',
        expectedOutput: markerB + 'y'.repeat(second - markerB.length),
        hidden: true,
        weight: 1,
      },
    ],
  };
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  assert.ok(bytes > 127 * 1024 * 1024 && bytes < 128 * 1024 * 1024);
  assert.equal(Buffer.byteLength(payload.cases[1].expectedOutput), full);
  const saved = await request('oj/admin/problems/save', {
    payload,
    expectedRevision: null,
  });
  assert.ok(saved.draft?.revision > 0);
  console.log(
    `PASS maximum import: ${bytes} package bytes; ${full} largest expected bytes`,
  );
  await request(`oj/admin/problems/${id}/publish`, {
    expectedRevision: saved.draft.revision,
  });
  assert.ok(
    db
      .prepare(
        'SELECT current_version_id FROM oj_problems WHERE id=? AND published=1',
      )
      .get(id)?.current_version_id,
  );
  const publicView = JSON.stringify(await request(`oj/problems/${id}`));
  assert.ok(publicView.length < 100000);
  assert.ok(
    !publicView.includes(markerA) && !publicView.includes(markerB),
    'Private large expected output leaked',
  );
  console.log('PASS maximum publication and public hidden-answer omission');
} finally {
  // Keep immutable version history; withdraw only our synthetic question.
  db.prepare('UPDATE oj_problems SET published=0 WHERE id=?').run(id);
  db.prepare('DELETE FROM limits WHERE key LIKE ?').run(uid + ':%');
  db.prepare('DELETE FROM audit WHERE actor_id=?').run(uid);
  db.prepare('DELETE FROM profiles WHERE id=?').run(uid);
  db.prepare('DELETE FROM user WHERE id=?').run(uid);
  db.close();
}
