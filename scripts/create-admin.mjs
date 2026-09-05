import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const email = process.argv[2]?.trim().toLowerCase();
const admins = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase());
if (!email || !admins.includes(email))
  throw new Error('Email must be explicitly listed in ADMIN_EMAILS.');
const credentials = resolve(
  process.env.CSWORK_ADMIN_PASSWORD_FILE || '.local/owner-login.txt',
);
if (existsSync(credentials))
  throw new Error('Credential file already exists; refusing to replace it.');
const db = new Database(
  resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite'),
);
try {
  if (db.prepare('SELECT id FROM user WHERE email=?').get(email))
    throw new Error('Account already exists; refusing to reset its password.');
  const password = randomBytes(30).toString('base64url');
  const hash = await hashPassword(password),
    id = randomUUID(),
    now = Date.now();
  mkdirSync(dirname(credentials), { recursive: true, mode: 0o700 });
  writeFileSync(
    credentials,
    `cswork\n${process.env.APP_URL || 'http://localhost:4317'}\n邮箱：${email}\n初始密码：${password}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  try {
    db.transaction(() => {
      db.prepare(
        'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      ).run(id, process.argv[3] || 'cswork 老师', email, 1, now, now);
      db.prepare(
        'INSERT INTO account(id,account_id,provider_id,issuer,user_id,password,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
      ).run(randomUUID(), id, 'credential', 'local:credential', id, hash, now, now);
    })();
  } catch (error) {
    unlinkSync(credentials);
    throw error;
  }
  console.log(
    `Created admin account ${email}; login details saved to ${credentials}.`,
  );
} finally {
  db.close();
}
