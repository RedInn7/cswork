import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const directory = mkdtempSync(resolve(tmpdir(), 'cswork-intelligence-test-'));
process.env.DATABASE_PATH = resolve(directory, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { ensureOjSeed } = await import('../lib/server/oj-problems');
const { handleOj } = await import('../lib/server/oj-api');
const { fail } = await import('../lib/server/http');
const student: Person = {
  id: 'student-a',
  email: 'student@example.test',
  name: 'Student',
  role: 'student',
  verified: true,
};
const outsider: Person = {
  ...student,
  id: 'student-b',
  email: 'other@example.test',
};
const token = 'test-only-broker-token-'.repeat(3);
const documentId = randomUUID();
const input = {
  problemId: 'watch-intervals',
  documentId,
  language: 'python',
  code: 'import math\nmath.',
  version: 1,
  action: 'completion',
  position: { line: 1, character: 5 },
};
const closeInput = {
  problemId: input.problemId,
  documentId,
  language: input.language,
};
const seen: {
  path: string;
  authorization?: string;
  body: Record<string, unknown>;
}[] = [];
let responseStatus = 200;
let rawResponse: string | undefined;
let redirect: string | undefined;
let holdResponse = false;
let responseClosed = false;
let endpoint: string;
const broker = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  seen.push({
    path: request.url || '',
    authorization: request.headers.authorization,
    body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
      string,
      unknown
    >,
  });
  response.once('close', () => {
    responseClosed = true;
  });
  if (holdResponse) return;
  response.writeHead(responseStatus, {
    'Content-Type': 'application/json',
    ...(redirect ? { Location: redirect } : {}),
  });
  response.end(
    rawResponse ??
      JSON.stringify(
        request.url === '/v1/close'
          ? { closed: true }
          : {
              version: 1,
              language: 'python',
              server: 'test language server',
              result: { items: [] },
              diagnostics: [],
            },
      ),
  );
});

async function invoke(
  data: unknown = input,
  person = student,
  close = false,
  options: {
    raw?: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {},
) {
  const request = new Request(
    `http://localhost/api/oj/intelligence${close ? '/close' : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.raw ?? JSON.stringify(data),
      signal: options.signal,
    },
  );
  try {
    return await handleOj(
      request,
      person,
      close ? ['intelligence', 'close'] : ['intelligence'],
    );
  } catch (error) {
    return fail(error);
  }
}

before(async () => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare(
      'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
    )
    .run('gomall', 'GoMall', 'Tests', '1');
  for (const id of [
    '00-overview',
    '07-product-search',
    '00-overview-architecture',
    '14-middleware',
  ])
    sqlite()
      .prepare(
        'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)',
      )
      .run(id, 'gomall', id, '', 'chapter', '', '1');
  await ensureOjSeed();
  sqlite()
    .prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    )
    .run('student-grant', student.email, 'gomall', 'test', Date.now());
  await new Promise<void>((done) => broker.listen(0, '127.0.0.1', done));
  endpoint = `http://127.0.0.1:${(broker.address() as AddressInfo).port}`;
});
beforeEach(() => {
  process.env.CSWORK_LSP_URL = endpoint;
  process.env.CSWORK_LSP_TOKEN = token;
  responseStatus = 200;
  rawResponse = undefined;
  redirect = undefined;
  holdResponse = false;
  responseClosed = false;
  seen.length = 0;
  sqlite().prepare('DELETE FROM limits').run();
  sqlite().prepare('UPDATE grants SET revoked_at=NULL').run();
  sqlite().prepare("UPDATE courses SET published=1 WHERE id='gomall'").run();
  sqlite()
    .prepare("UPDATE oj_problems SET published=1 WHERE id='watch-intervals'")
    .run();
});
after(async () => {
  broker.closeAllConnections();
  await new Promise<void>((done) => broker.close(() => done()));
  sqlite().close();
  rmSync(directory, { recursive: true, force: true });
});

void test('authorized requests inject the authenticated owner and fixed problem/document identity', async () => {
  const response = await invoke();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].path, '/v1/request');
  assert.equal(seen[0].authorization, `Bearer ${token}`);
  assert.equal(seen[0].body.ownerId, student.id);
  assert.equal(seen[0].body.documentId, `${input.problemId}:${documentId}`);
  assert.equal(seen[0].body.problemId, undefined);
  assert.equal(seen[0].body.code, input.code);
  assert.ok(!JSON.stringify(await response.json()).includes(token));
});

void test('unverified, unentitled, revoked and unpublished access never reaches the broker', async () => {
  assert.equal((await invoke(input, outsider)).status, 403);
  assert.equal(
    (await invoke(input, { ...student, verified: false })).status,
    403,
  );
  sqlite().prepare('UPDATE grants SET revoked_at=?').run(Date.now());
  assert.equal((await invoke()).status, 403);
  sqlite().prepare('UPDATE grants SET revoked_at=NULL').run();
  sqlite().prepare("UPDATE courses SET published=0 WHERE id='gomall'").run();
  assert.equal((await invoke()).status, 403);
  sqlite().prepare("UPDATE courses SET published=1 WHERE id='gomall'").run();
  sqlite()
    .prepare("UPDATE oj_problems SET published=0 WHERE id='watch-intervals'")
    .run();
  assert.equal((await invoke()).status, 404);
  assert.equal((await invoke({ ...input, problemId: 'missing' })).status, 404);
  assert.equal(seen.length, 0);
});

void test('browser-supplied owners, URIs, arbitrary methods and options are rejected', async () => {
  for (const patch of [
    { ownerId: outsider.id },
    { uri: 'file:///etc/passwd' },
    { method: 'workspace/executeCommand' },
    { action: 'workspace/executeCommand' },
    { options: { command: 'sh' } },
    { language: '__proto__' },
    { documentId: '../other-file' },
    { version: 0 },
  ])
    assert.equal((await invoke({ ...input, ...patch })).status, 400);
  assert.equal(
    (await invoke({ ...closeInput, ownerId: outsider.id }, student, true))
      .status,
    400,
  );
  assert.equal(seen.length, 0);
});

void test('code bytes, JSON size and UTF-16 cursor boundaries are enforced', async () => {
  assert.equal(
    (await invoke({ ...input, code: '中'.repeat(22000) })).status,
    413,
  );
  assert.equal(
    (await invoke(input, student, false, { raw: ' '.repeat(400001) })).status,
    413,
  );
  assert.equal(
    (await invoke(input, student, false, { raw: '{invalid' })).status,
    400,
  );
  for (const patch of [
    { position: undefined },
    { position: { line: 2, character: 0 } },
    { position: { line: 1, character: 6 } },
    { position: { line: -1, character: 0 } },
    { position: { line: 0, character: 0, uri: 'file:///secret' } },
  ])
    assert.equal((await invoke({ ...input, ...patch })).status, 400);
  assert.equal(seen.length, 0);
  assert.equal(
    (
      await invoke({
        ...input,
        code: '😀.',
        position: { line: 0, character: 3 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await invoke({
        ...input,
        code: 'x'.repeat(65536),
        position: { line: 0, character: 65536 },
      })
    ).status,
    200,
  );
  assert.equal(
    (await invoke({ ...input, action: 'diagnostics', position: undefined }))
      .status,
    200,
  );
});

void test('closing is allowed after revocation but remains scoped to the authenticated owner', async () => {
  sqlite().prepare('UPDATE grants SET revoked_at=?').run(Date.now());
  assert.equal((await invoke(closeInput, student, true)).status, 200);
  assert.deepEqual(seen[0], {
    path: '/v1/close',
    authorization: `Bearer ${token}`,
    body: {
      documentId: `${input.problemId}:${documentId}`,
      language: 'python',
      ownerId: student.id,
    },
  });
  assert.equal((await invoke(closeInput, outsider, true)).status, 200);
  assert.equal(seen[1].body.ownerId, outsider.id);
  assert.equal(seen[1].body.code, undefined);
});

void test('typing rate exhaustion does not prevent closing and reclaiming the owned session', async () => {
  const key = `${student.id}:editor-intelligence:${Math.floor(Date.now() / 60000)}`;
  sqlite()
    .prepare('INSERT INTO limits(key,count,expires_at) VALUES(?,240,?)')
    .run(key, Date.now() + 60000);
  assert.equal((await invoke()).status, 429);
  assert.equal((await invoke(closeInput, student, true)).status, 200);
  assert.equal(seen[0].path, '/v1/close');
});

void test('unconfigured, malformed or nonlocal broker endpoints fail closed without a network request', async () => {
  for (const value of [
    '',
    'not a URL',
    'https://127.0.0.1:4321',
    'http://example.test:4321',
    'http://user:password@127.0.0.1:4321',
    'http://127.0.0.1:4321/other',
    'http://127.0.0.1:4321/?secret=1',
  ]) {
    process.env.CSWORK_LSP_URL = value;
    assert.equal((await invoke()).status, 503, value);
  }
  process.env.CSWORK_LSP_URL = endpoint;
  process.env.CSWORK_LSP_TOKEN = '';
  assert.equal((await invoke()).status, 503);
  assert.equal(seen.length, 0);
});

void test('upstream errors, redirects, invalid JSON and oversized output do not expose service details', async () => {
  rawResponse = JSON.stringify({
    error: 'private broker implementation details',
    token,
  });
  for (const [upstream, expected] of [
    [429, 503],
    [503, 503],
    [409, 409],
    [500, 502],
    [401, 502],
  ]) {
    responseStatus = upstream;
    const response = await invoke();
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes(token));
  }
  responseStatus = 302;
  redirect = 'http://example.test/never-follow';
  assert.equal((await invoke()).status, 503);
  redirect = undefined;
  responseStatus = 200;
  rawResponse = 'invalid-json';
  assert.equal((await invoke()).status, 503);
  rawResponse = JSON.stringify({ result: 'x'.repeat(1048576) });
  assert.equal((await invoke()).status, 502);
});

void test('browser abort propagates to the in-flight broker HTTP request', async () => {
  holdResponse = true;
  const controller = new AbortController();
  const pending = invoke(input, student, false, { signal: controller.signal });
  const deadline = Date.now() + 2000;
  while (!seen.length && Date.now() < deadline)
    await new Promise((done) => setTimeout(done, 10));
  assert.equal(seen.length, 1);
  controller.abort();
  assert.equal((await pending).status, 503);
  while (!responseClosed && Date.now() < deadline)
    await new Promise((done) => setTimeout(done, 10));
  assert.ok(responseClosed);
});
