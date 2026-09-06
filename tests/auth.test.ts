import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
const directory = mkdtempSync(resolve(tmpdir(), 'cswork-auth-'));
process.env.DATABASE_PATH = resolve(directory, 'auth.sqlite');
process.env.APP_URL = 'http://localhost:4317';
process.env.BETTER_AUTH_SECRET =
  'isolated-auth-test-secret-at-least-thirty-two';
process.env.RESEND_API_KEY = 're_isolated_fixture';
process.env.MAIL_FROM = 'cswork <no-reply@example.test>';
process.env.ADMIN_EMAILS = 'teacher@example.test';
const mail: { to: string[]; subject: string; text: string }[] = [];
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  mail.push(JSON.parse(raw));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ id: 'fixture-email' }));
});
const { sqlite } = await import('../db/sqlite');
const { auth, person } = await import('../lib/server/auth');
const { sendAuthOTP } = await import('../lib/server/mail');
async function request(path: string, body?: unknown, cookie = '') {
  return auth().handler(
    new Request(`http://localhost:4317/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: 'http://localhost:4317',
        'Content-Type': 'application/json',
        'x-real-ip': '127.0.0.1',
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
}
function lastCode() {
  const code = mail.at(-1)?.text.match(/验证码：(\d{6})/)?.[1];
  assert.ok(code, 'Mail capture must contain a code');
  return code;
}
before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing capture server');
  process.env.MAIL_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
});
// Each scenario gets a fresh rate-limit window; production limits remain enabled.
beforeEach(() => {
  sqlite().prepare('DELETE FROM rate_limit').run();
});
after(async () => {
  sqlite().close();
  await new Promise<void>((r, e) =>
    server.close((error) => (error ? e(error) : r())),
  );
  rmSync(directory, { recursive: true, force: true });
});
let firstCookie = '',
  secondCookie = '';
const email = 'student@example.test';
test('OTP registration verifies mailbox, stores hashed OTP and rejects replay', async () => {
  const sent = await request('email-otp/send-verification-otp', {
    email,
    type: 'sign-in',
  });
  assert.equal(sent.status, 200);
  const otp = lastCode();
  const stored = sqlite().prepare('SELECT value FROM verification').all() as {
    value: string;
  }[];
  assert.ok(
    stored.every((v) => !v.value.includes(otp)),
    'Plain OTP must not be stored',
  );
  const signed = await request('sign-in/email-otp', {
    email,
    otp,
    name: 'Test student',
  });
  assert.equal(signed.status, 200);
  firstCookie = cookies(signed);
  assert.ok(firstCookie);
  const who = await person(
    new Request('http://localhost:4317/api/bootstrap', {
      headers: { cookie: firstCookie },
    }),
  );
  assert.equal(who?.email, email);
  assert.equal(who?.verified, true);
  assert.equal(who?.role, 'student');
  const replay = await request('sign-in/email-otp', { email, otp });
  assert.notEqual(replay.status, 200);
});
test('unverified public password registration remains disabled', async () => {
  const r = await request('sign-up/email', {
    email: 'teacher@example.test',
    password: 'long-enough-test-password',
    name: 'Teacher',
  });
  assert.equal(r.status, 400);
  assert.equal(
    (
      sqlite()
        .prepare('SELECT COUNT(*) n FROM user WHERE email=?')
        .get('teacher@example.test') as { n: number }
    ).n,
    0,
  );
});
test('expired OTP cannot create an account', async () => {
  const other = 'expired@example.test';
  await request('email-otp/send-verification-otp', {
    email: other,
    type: 'sign-in',
  });
  sqlite()
    .prepare('UPDATE verification SET expires_at=?')
    .run(Date.now() - 1000);
  const response = await request('sign-in/email-otp', {
    email: other,
    otp: lastCode(),
  });
  assert.notEqual(response.status, 200);
  assert.equal(
    (
      sqlite()
        .prepare('SELECT COUNT(*) n FROM user WHERE email=?')
        .get(other) as { n: number }
    ).n,
    0,
  );
});
test('OTP recovery creates password, distinguishes mail purpose and revokes all old sessions', async () => {
  await request('email-otp/send-verification-otp', { email, type: 'sign-in' });
  const signed = await request('sign-in/email-otp', { email, otp: lastCode() });
  secondCookie = cookies(signed);
  assert.equal(signed.status, 200);
  const sent = await request('email-otp/request-password-reset', { email });
  assert.equal(sent.status, 200);
  assert.equal(mail.at(-1)?.subject, '重设你的 cswork 密码');
  const reset = await request('email-otp/reset-password', {
    email,
    otp: lastCode(),
    password: 'a-very-long-new-password',
  });
  assert.equal(reset.status, 200);
  for (const cookie of [firstCookie, secondCookie])
    assert.equal(
      await person(
        new Request('http://localhost:4317/api/bootstrap', {
          headers: { cookie },
        }),
      ),
      null,
    );
  const login = await request('sign-in/email', {
    email,
    password: 'a-very-long-new-password',
  });
  assert.equal(login.status, 200);
  firstCookie = cookies(login);
});
test('native profile, identity and session endpoints work for the signed-in user', async () => {
  assert.equal(
    (await request('update-user', { name: '   ' }, firstCookie)).status,
    400,
  );
  assert.equal(
    (await request('update-user', { name: 'Updated student' }, firstCookie))
      .status,
    200,
  );
  const who = await person(
    new Request('http://localhost:4317/api/bootstrap', {
      headers: { cookie: firstCookie },
    }),
  );
  assert.equal(who?.name, 'Updated student');
  const identities = await request('list-accounts', undefined, firstCookie);
  assert.equal(identities.status, 200);
  assert.ok(
    (await identities.json()).some(
      (a: { providerId: string }) => a.providerId === 'credential',
    ),
  );
  const sessions = await request('list-sessions', undefined, firstCookie);
  assert.equal(sessions.status, 200);
  assert.equal((await sessions.json()).length, 1);
  assert.equal(
    (
      await request(
        'change-password',
        {
          currentPassword: 'wrong-password',
          newPassword: 'second-long-new-password',
          revokeOtherSessions: true,
        },
        firstCookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        'change-password',
        {
          currentPassword: 'a-very-long-new-password',
          newPassword: 'second-long-new-password',
          revokeOtherSessions: true,
        },
        firstCookie,
      )
    ).status,
    200,
  );
});
test('email verification purpose and missing provider are explicit', async () => {
  await sendAuthOTP({ email, otp: '123456', type: 'email-verification' });
  assert.equal(mail.at(-1)?.subject, '验证你的 cswork 邮箱');
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    await assert.rejects(
      sendAuthOTP({ email, otp: '123456', type: 'sign-in' }),
      /尚未开放/,
    );
  } finally {
    process.env.RESEND_API_KEY = key;
  }
});
