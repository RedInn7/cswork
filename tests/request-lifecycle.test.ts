import assert from 'node:assert/strict';
import test from 'node:test';
import { withRequestBodyCleanup } from '../lib/server/request-lifecycle';

function upload(
  options: { cancel?: () => void | Promise<void>; contentLength?: number } = {},
) {
  let cancelled = 0;
  const request = new Request('http://localhost/api/tickets/test/attachments', {
    method: 'POST',
    headers: { 'Content-Length': String(options.contentLength ?? 2097153) },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('prefix'));
      },
      cancel() {
        cancelled++;
        return options.cancel?.();
      },
    }),
    duplex: 'half',
  } as RequestInit);
  return { request, cancelled: () => cancelled };
}

// Real staging evidence: consecutive 2 MiB + 1 uploads returned 413, then
// UND_ERR_SOCKET after the keep-alive timeout, then 413 on a new connection.
// These tests pin the response/body ownership boundary without relying on TCP
// buffer sizes, OS-specific timing, authentication fixtures or a remote host.
test('Content-Length rejection releases the unread upload and preserves 413', async () => {
  const input = upload();
  const response = await withRequestBodyCleanup((request) => {
    assert.ok(Number(request.headers.get('content-length')) > 2 * 1024 * 1024);
    return Response.json({ error: '附件不能超过 2MB' }, { status: 413 });
  })(input.request);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, '附件不能超过 2MB');
  assert.equal(input.cancelled(), 1);
});

test('authentication and permission rejections also discard unread bodies', async () => {
  for (const status of [401, 403, 404]) {
    const input = upload();
    const response = await withRequestBodyCleanup(
      () => new Response(null, { status }),
    )(input.request);
    assert.equal(response.status, status);
    assert.equal(input.cancelled(), 1);
  }
});

test('body cancellation cannot mask the selected HTTP response', async () => {
  const input = upload({
    cancel: () => Promise.reject(new Error('peer disconnected')),
  });
  const response = await withRequestBodyCleanup(
    () => new Response('too large', { status: 413 }),
  )(input.request);
  assert.equal(response.status, 413);
  assert.equal(input.cancelled(), 1);
  await new Promise((resolve) => setImmediate(resolve));
});

test('a tee or stalled uploader cannot delay the rejection response', async () => {
  const input = upload({ cancel: () => new Promise<void>(() => {}) });
  const response = await withRequestBodyCleanup(
    () => new Response(null, { status: 413 }),
  )(input.request);
  assert.equal(response.status, 413);
  assert.equal(input.cancelled(), 1);
});

test('thrown handlers retain their original exception and discard the body', async () => {
  const input = upload();
  const expected = new Error('original handler failure');
  await assert.rejects(
    withRequestBodyCleanup(() => {
      throw expected;
    })(input.request),
    (error) => error === expected,
  );
  assert.equal(input.cancelled(), 1);
});

test('normal JSON consumption remains unchanged', async () => {
  const request = new Request('http://localhost/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ title: 'example' }),
  });
  const response = await withRequestBodyCleanup(async (input) =>
    Response.json(await input.json()),
  )(request);
  assert.deepEqual(await response.json(), { title: 'example' });
});

test('streaming response can retain its reader after handler returns', async () => {
  const input = upload();
  const reader = input.request.body!.getReader();
  const response = await withRequestBodyCleanup(
    () =>
      new Response(
        new ReadableStream(
          {
            async pull(controller) {
              const chunk = await reader.read();
              controller.enqueue(chunk.value);
              controller.close();
              await reader.cancel();
            },
          },
          { highWaterMark: 0 },
        ),
      ),
  )(input.request);
  assert.equal(input.cancelled(), 0);
  assert.equal(await response.text(), 'prefix');
});

test('direct request-body forwarding remains readable', async () => {
  const request = new Request('http://localhost/api/echo', {
    method: 'POST',
    body: 'echo content',
  });
  const response = await withRequestBodyCleanup(
    (input) => new Response(input.body),
  )(request);
  assert.equal(await response.text(), 'echo content');
});
