import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
const directory = mkdtempSync(resolve(tmpdir(), 'cswork-auth-route-'));
process.env.DATABASE_PATH = resolve(directory, 'auth.sqlite');
process.env.APP_URL = 'http://localhost:4317';
process.env.BETTER_AUTH_SECRET =
  'isolated-auth-test-secret-at-least-thirty-two';
const { POST } = await import('../app/api/auth/[...all]/route');
after(() => rmSync(directory, { recursive: true, force: true }));

test('cross-origin auth POST keeps its 403 instead of a generic 503', async () => {
  const response = await POST(
    new Request('http://localhost:4317/api/auth/sign-out', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.test',
        'Content-Type': 'application/json',
        'x-locale': 'zh',
      },
      body: '{}',
    }),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: '请求来源无效' });
});
