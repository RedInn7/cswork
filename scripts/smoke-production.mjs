import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const base = process.env.APP_URL;
if (!base || new URL(base).protocol !== 'https:')
  throw new Error('Production smoke check requires HTTPS.');
const login = readFileSync(process.env.CSWORK_ADMIN_PASSWORD_FILE, 'utf8');
const email = login.match(/^邮箱：(.+)$/m)?.[1];
const password = login.match(/^初始密码：(.+)$/m)?.[1];
if (!email || !password)
  throw new Error('Missing protected bootstrap credentials.');
const html = await fetch(base);
assert.equal(html.status, 200);
assert.match(await html.text(), /cswork/);
const signIn = await fetch(base + '/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ email, password }),
});
assert.equal(signIn.status, 200, 'Admin password login failed.');
const cookies = signIn.headers.getSetCookie();
assert.ok(
  cookies.some(
    (value) => value.includes('HttpOnly') && value.includes('Secure'),
  ),
);
assert.ok(
  cookies.every((value) => !/;\s*Domain=/i.test(value)),
  'Cookies must be host-only.',
);
const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
try {
  const bootResponse = await fetch(base + '/api/bootstrap', {
    headers: { Cookie: cookie },
  });
  const boot = await bootResponse.json();
  assert.equal(boot.person.email, email);
  assert.equal(boot.person.role, 'teacher');
  assert.equal(boot.courses[0].lessons.length, 17);
  assert.equal(
    (await fetch(base + '/api/teacher', { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  assert.equal((await fetch(base + '/api/lessons/00-overview')).status, 401);
  assert.equal(
    (
      await fetch(base + '/api/teacher', {
        headers: {
          'oai-authenticated-user-id': 'forged',
          'oai-authenticated-user-email': email,
        },
      })
    ).status,
    401,
  );
  // Nonexistent notification: exercises an authenticated write without changing user data.
  const write = await fetch(base + '/api/notifications', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: base,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: randomUUID() }),
  });
  assert.equal(write.status, 200);
  const crossOrigin = await fetch(base + '/api/notifications', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: 'https://attacker.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: randomUUID() }),
  });
  assert.equal(crossOrigin.status, 403);
} finally {
  const out = await fetch(base + '/api/auth/sign-out', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: base,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal(out.status, 200);
}
assert.equal(
  (
    await (
      await fetch(base + '/api/bootstrap', { headers: { Cookie: cookie } })
    ).json()
  ).person,
  null,
);
console.log(
  'PASS: HTTPS, host-only secure cookies, admin login, persisted courses, isolation, CSRF, and session logout.',
);
