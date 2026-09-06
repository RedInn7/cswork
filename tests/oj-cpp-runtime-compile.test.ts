import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '../lib/server/oj-engine';

void test('only opted-in wrappers use the fixed optional runtime link command', async () => {
  const original = globalThis.fetch;
  const requests: {
    cmd: {
      args: string[];
      copyIn: Record<string, { content: string }>;
      cpuLimit: number;
      memoryLimit: number;
    }[];
  }[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = init?.body;
    assert.equal(typeof body, 'string');
    requests.push(JSON.parse(body as string));
    return Response.json([
      { status: 'Accepted', fileIds: { main: 'isolated-test-file' } },
    ]);
  };
  try {
    await compile('cpp', 'int main() {}', AbortSignal.timeout(1000));
    const source =
      '// CSWORK_CPP_JSON_RUNTIME_V1\n// $(echo source-must-never-be-shell-code)\nint main() {}';
    await compile('cpp', source, AbortSignal.timeout(1000));
    const [ordinary, wrapped] = requests.map((request) => request.cmd[0]);
    assert.equal(ordinary.args[0], '/usr/bin/g++');
    assert.deepEqual(wrapped.args.slice(0, 2), ['/bin/sh', '-c']);
    const command = wrapped.args[2];
    assert.ok(
      command.includes(
        'test -r /usr/local/include/cswork/json-v1.hpp && test -r /usr/local/lib/cswork/libjson-v1.a',
      ),
    );
    assert.ok(
      command.includes(
        '-DCSWORK_PRECOMPILED_JSON_V1 main.cpp /usr/local/lib/cswork/libjson-v1.a -o main',
      ),
    );
    assert.ok(
      command.includes(
        'else exec /usr/bin/g++ -std=c++20 -O2 -pipe main.cpp -o main',
      ),
    );
    assert.ok(!command.includes('source-must-never-be-shell-code'));
    assert.equal(wrapped.copyIn['main.cpp'].content, source);
    assert.equal(wrapped.cpuLimit, ordinary.cpuLimit);
    assert.equal(wrapped.memoryLimit, ordinary.memoryLimit);
  } finally {
    globalThis.fetch = original;
  }
});
