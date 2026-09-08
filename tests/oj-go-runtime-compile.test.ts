import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '../lib/server/oj-engine';

void test('Go gives cache trimming private writable metadata while reusing immutable stdlib objects', async () => {
  const original = globalThis.fetch;
  let command:
    | {
        args: string[];
        env: string[];
        copyIn: Record<string, { content: string }>;
        cpuLimit: number;
        memoryLimit: number;
      }
    | undefined;
  globalThis.fetch = async (_url, init) => {
    command = JSON.parse(init!.body as string).cmd[0];
    return Response.json([
      { status: 'Accepted', fileIds: { main: 'isolated-test-file' } },
    ]);
  };
  try {
    const source = '// $(touch source-is-data)\npackage main\nfunc main() {}';
    await compile('go', source, AbortSignal.timeout(1000));
    assert.deepEqual(command!.args.slice(0, 2), ['/bin/sh', '-c']);
    assert.ok(
      command!.args[2].includes(
        'test -r /usr/local/lib/cswork/go-stdlib-cache-v1/cswork-toolchain-v1',
      ),
    );
    assert.ok(
      command!.args[2].includes(
        'cp -rs --no-preserve=mode /usr/local/lib/cswork/go-stdlib-cache-v1/. /tmp/go-cache',
      ),
    );
    assert.ok(command!.args[2].includes('rm -f /tmp/go-cache/trim.txt'));
    assert.ok(!command!.args[2].includes('export GOCACHE='));
    assert.ok(
      command!.args[2].endsWith(
        'exec /usr/bin/go build -trimpath -o main main.go',
      ),
    );
    assert.ok(
      command!.env.includes('GOCACHE=/tmp/go-cache'),
      'old images retain isolated writable fallback',
    );
    assert.ok(command!.env.includes('CGO_ENABLED=0'));
    assert.ok(!command!.args[2].includes('source-is-data'));
    assert.equal(command!.copyIn['main.go'].content, source);
    assert.equal(command!.cpuLimit, 30e9);
    assert.equal(command!.memoryLimit, 1073741824);
  } finally {
    globalThis.fetch = original;
  }
});
