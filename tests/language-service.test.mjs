import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticated,
  dockerArguments,
  safeResult,
  safeDiagnostics,
  validateRequest,
  validateIdentity,
} from '../scripts/language-service/protocol.mjs';
import { createBroker } from '../scripts/language-service/broker.mjs';

const input = {
  ownerId: 'student-a',
  documentId: 'problem:tab-123',
  language: 'python',
  code: 'import math\nmath.',
  version: 1,
  action: 'completion',
  position: { line: 1, character: 5 },
};
await test('only fixed semantic actions and valid UTF-16 document positions are accepted', () => {
  assert.equal(validateRequest(input), 'student-a/problem:tab-123/python');
  for (const patch of [
    { action: 'workspace/executeCommand' },
    { method: 'shutdown' },
    { uri: 'file:///etc/passwd' },
    { language: '__proto__' },
    { documentId: '../other' },
    { version: 0 },
    { position: { line: 5, character: 0 } },
    { position: { line: 1, character: 6 } },
  ])
    assert.throws(() => validateRequest({ ...input, ...patch }));
  assert.doesNotThrow(() =>
    validateRequest({
      ...input,
      code: '😀.',
      position: { line: 0, character: 3 },
    }),
  );
  assert.throws(() => validateRequest({ ...input, code: '界'.repeat(22000) }));
  assert.throws(() => validateIdentity({ ...input, ownerId: 'a/b' }));
});
await test('authentication is exact and missing/wrong tokens fail', () => {
  const token = 'a'.repeat(40);
  assert.equal(authenticated(`Bearer ${token}`, token), true);
  for (const header of [
    undefined,
    '',
    `Bearer ${'b'.repeat(40)}`,
    token,
    [`Bearer ${token}`],
  ])
    assert.equal(authenticated(header, token), false);
});
await test('all runtimes are networkless, nonroot and resource limited without host mounts', () => {
  for (const language of ['python', 'go', 'cpp', 'java']) {
    const args = dockerArguments(
      'cswork-lsp-fixed',
      language,
      'cswork-language-service:1',
    );
    for (const flag of [
      '--read-only',
      '--cap-drop',
      '--security-opt',
      '--memory',
      '--memory-swap',
      '--cpus',
      '--pids-limit',
      '--tmpfs',
      '--user',
    ])
      assert.ok(args.includes(flag));
    assert.equal(args[args.indexOf('--network') + 1], 'none');
    assert.equal(args[args.indexOf('--user') + 1], '10001:10001');
    assert.ok(
      !args.includes('--volume') &&
        !args.includes('-v') &&
        !args.includes('--mount'),
    );
    assert.deepEqual(args.slice(-2), ['cswork-language-service:1', language]);
  }
});
await test('server commands and opaque data cannot cross the editor bridge', () => {
  const result = safeResult('completion', {
    items: Array.from({ length: 110 }, () => ({
      label: 'sqrt',
      command: { command: 'evil' },
      data: { uri: 'file:///secret' },
      additionalTextEdits: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          newText: 'import math\n',
        },
      ],
    })),
  });
  assert.equal(result.items.length, 100);
  assert.equal(result.isIncomplete, true);
  assert.equal(result.items[0].command, undefined);
  assert.equal(result.items[0].data, undefined);
  assert.equal(result.items[0].additionalTextEdits.length, 1);
  assert.equal(
    safeDiagnostics([
      {
        message: 'error',
        relatedInformation: [{ location: { uri: 'file:///secret' } }],
      },
    ])[0].relatedInformation,
    undefined,
  );
});

await test('HTTP broker isolates identities, reserves capacity, closes and reaps sessions', async () => {
  let count = 0;
  const broker = createBroker({
    token: 't'.repeat(40),
    idleMs: 1000,
    makeSession(body) {
      return {
        ownerId: body.ownerId,
        language: body.language,
        pending: 0,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        id: ++count,
        async run(value) {
          return { version: value.version, result: { id: this.id } };
        },
        async close() {
          this.dead = true;
        },
      };
    },
  });
  await new Promise((resolve) => broker.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${broker.server.address().port}`;
  const request = (body, path = '/v1/request', authorized = true) =>
    fetch(url + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorized ? { Authorization: `Bearer ${'t'.repeat(40)}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await request(input, '/v1/request', false)).status, 401);
    assert.equal((await request({ ...input, action: 'shutdown' })).status, 400);
    assert.equal(
      (await request({ ...input, code: 'x'.repeat(600000) })).status,
      413,
    );
    assert.equal(
      (await request({ ...input, documentId: 'already-closed' }, '/v1/close'))
        .status,
      200,
    );
    assert.equal(
      (await request({ ...input, documentId: 'already-closed' })).status,
      409,
    );
    const first = await (await request(input)).json();
    assert.equal(
      (await (await request(input)).json()).result.id,
      first.result.id,
    );
    assert.notEqual(
      (await (await request({ ...input, ownerId: 'student-b' })).json()).result
        .id,
      first.result.id,
    );
    assert.equal(
      (await request({ ...input, documentId: 'second' })).status,
      200,
    );
    assert.equal(
      (await request({ ...input, documentId: 'third' })).status,
      429,
    );
    assert.equal(
      (await request({ ...input, ownerId: 'student-c' })).status,
      200,
    );
    assert.equal(
      (await request({ ...input, ownerId: 'student-d' })).status,
      429,
    );
    assert.equal((await request(input, '/v1/close')).status, 200);
    assert.equal((await request(input)).status, 409);
    assert.equal(broker.sessions.size, 3);
    for (const session of broker.sessions.values()) session.lastUsed = 0;
    await broker.reap();
    assert.equal(broker.sessions.size, 0);
  } finally {
    await broker.close();
  }
});

await test('failed container removal retains the capacity reservation until confirmed cleanup', async () => {
  let failCleanup = true;
  const broker = createBroker({
    token: 't'.repeat(40),
    maxSessions: 1,
    makeSession(body) {
      return {
        ownerId: body.ownerId,
        pending: 0,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        async run() {
          return { ok: true };
        },
        async close() {
          this.dead = true;
          if (failCleanup) throw new Error('Docker unavailable');
        },
      };
    },
  });
  await new Promise((resolve) => broker.server.listen(0, '127.0.0.1', resolve));
  const request = (body, path = '/v1/request') =>
    fetch(`http://127.0.0.1:${broker.server.address().port}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${'t'.repeat(40)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await request(input)).status, 200);
    assert.equal((await request(input, '/v1/close')).status, 503);
    assert.equal(broker.sessions.size, 1);
    assert.equal(
      (await request({ ...input, ownerId: 'someone-else' })).status,
      429,
    );
    failCleanup = false;
    await broker.reap();
    assert.equal(broker.sessions.size, 0);
  } finally {
    failCleanup = false;
    await broker.close();
  }
});
