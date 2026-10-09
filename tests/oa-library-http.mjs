/** Real built-app check. Uses a fresh temporary DB and no production credentials. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const entry = resolve(
  process.env.TEST_WEB_ENTRY || 'dist/standalone/server.js',
);
const base = 'http://127.0.0.1:4318';
const dir = mkdtempSync(join(tmpdir(), 'cswork-oa-http-'));
const file = join(dir, 'test.sqlite');
const secret = randomUUID() + randomUUID();
const catalog = JSON.parse(
  readFileSync('content/oa-master/catalog.json', 'utf8'),
);
const db = new Database(file);
let server;
try {
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const now = Date.now(),
    uid = randomUUID(),
    token = randomUUID();
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
  ).run(uid, 'OA test learner', 'oa-http@example.test', 1, now, now);
  db.prepare(
    'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
  ).run(randomUUID(), now + 3600000, token, now, now, uid);
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  const cookie = `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`;
  server = spawn(process.execPath, [entry], {
    cwd: dirname(entry),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1024',
      HOST: '127.0.0.1',
      PORT: '4318',
      APP_URL: base,
      BETTER_AUTH_SECRET: secret,
      DATABASE_PATH: file,
      OJ_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  server.stderr.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    assert(
      server.exitCode === null && server.signalCode === null,
      'Preview server exited: ' + logs,
    );
    try {
      if ((await fetch(base + '/api/bootstrap')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  assert(ready, 'Preview did not start: ' + logs);
  let checks = 0;
  async function req(path, expected = 200, signedIn = true) {
    const response = await fetch(base + path, {
      headers: signedIn ? { cookie } : {},
    });
    assert.equal(response.status, expected, path);
    if (path.startsWith('/api/'))
      assert.equal(response.headers.get('cache-control'), 'no-store');
    checks++;
    return response;
  }
  const first = catalog.items[0];
  // Catalogue and statements are public; solutions require sign-in.
  for (const path of ['/api/oj/oa-library', `/api/oj/oa-library/${first.id}`])
    await req(path, 200, false);
  await req(`/api/oj/oa-library/${first.id}/solution`, 401, false);
  for (const path of [
    '/content/oa-master/catalog.json',
    '/content/oa-master/manifest.json',
    '/content/oa-judge/registry.json',
    '/oa-master/catalog.json',
  ])
    await req(path, 404, false);
  const publicHtml = await (
    await req('/?view=problems&library=oa', 200, false)
  ).text();
  assert(!publicHtml.includes(first.statement.slice(0, 100)));
  const list = await (await req('/api/oj/oa-library')).json();
  assert.equal(list.total, catalog.items.length);
  assert.equal(list.companies.length, catalog.companies.length);
  assert.equal(list.items.length, 30);
  assert(!('statement' in list.items[0]));
  assert(!('solutions' in list.items[0]));
  assert.equal(list.items[0].judgeStatus, 'reading_only');
  const page = await (await req('/api/oj/oa-library?page=2')).json();
  assert.equal(page.items[0].id, catalog.items[30].id);
  const company = await (await req('/api/oj/oa-library?company=meta')).json();
  assert(company.items.every((item) => item.companySlug === 'meta'));
  const detail = await (await req(`/api/oj/oa-library/${first.id}`)).json();
  assert.equal(detail.statement, first.statement);
  assert(!('solutions' in detail) && !('explanation' in detail));
  const authored = JSON.parse(
    readFileSync('content/oa-judge/registry.json', 'utf8'),
  ).items;
  const verified = authored.find(
    (item) =>
      item.id === first.id && item.sourceContentHash === first.contentHash,
  );
  if (verified) {
    const solution = await (
      await req(`/api/oj/oa-library/${first.id}/solution`)
    ).json();
    assert.deepEqual(solution.solutions, verified.authoredSolutions);
    assert.equal(solution.explanation, verified.editorial);
  } else await req(`/api/oj/oa-library/${first.id}/solution`, 409);
  await req('/api/oj/oa-library/oa-missing-1', 404);
  await req('/api/oj/oa-library?company=not-a-company', 400);
  await req('/api/oj/oa-library/' + first.id + '/solution/extra', 404);
  await req('/api/oj/library');
  console.log(
    JSON.stringify({
      event: 'oa_http_complete',
      checks,
      questions: list.total,
      companies: list.companies.length,
      anonymousDenied: true,
      privateAssetsNotServed: true,
      oldLibraryStillAvailable: true,
    }),
  );
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolveExit) =>
      server.once('exit', resolveExit),
    );
    server.kill('SIGTERM');
    await Promise.race([exited, delay(10000)]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGKILL');
      await exited;
    }
  }
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
