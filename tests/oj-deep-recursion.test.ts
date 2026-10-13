import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { run } from '../lib/server/oj-engine';
import { leetcodeSource, leetcodeTemplates } from '../lib/server/leetcode-mode';
import type { OjProblemSpec } from '../lib/oj-types';

// LeetCode-style recursive solutions must not overflow where LeetCode accepts them.
void test('every learner JVM gets a 64 MiB thread stack', async () => {
  const original = globalThis.fetch;
  let args: string[] = [];
  globalThis.fetch = async (_url, init) => {
    args = JSON.parse(init!.body as string).cmd[0].args;
    return Response.json([{ status: 'Accepted' }]);
  };
  try {
    const spec = { memoryLimit: 262144, timeLimit: 2, outputLimit: 64 };
    await run(
      { language: 'java', source: '', cache: { 'main.jar': 'jar' } },
      '',
      spec as OjProblemSpec,
      AbortSignal.timeout(1000),
    );
  } finally {
    globalThis.fetch = original;
  }
  const java = leetcodeTemplates('lc-104')!.java;
  const bridge = leetcodeSource('lc-104', 'java', java, 262144).bridgeSource!;
  for (const command of [args, JSON.parse(bridge.match(/\["\/usr\/bin\/java".*?\]/)![0])]) {
    assert.ok(command.includes('-Xss64m'), command.join(' '));
    assert.ok(command.includes('-Xmx153m'));
  }
});

// The runner's Python is 3.13: C-level @cache recursion stops near depth 3300 there.
const python = spawnSync('python3.13', ['-c', '']).status === 0;
void test(
  'memoized recursion 10^5 deep runs under python3.13 -I',
  { skip: !python && 'python3.13 unavailable' },
  () => {
    const depth = 100000;
    const chain: (number | null)[] = [0];
    for (let i = 1; i < depth; i++) chain.push(i, null);
    chain.pop();
    const dir = mkdtempSync(join(tmpdir(), 'cswork-deep-'));
    try {
      for (const decorator of ['@cache', '@lru_cache(maxsize=None)', '@lru_cache']) {
        const code = `class Solution:\n    def maxDepth(self, root):\n        ${decorator}\n        def d(node):\n            return 0 if node is None else 1 + max(d(node.left), d(node.right))\n        return d(root)\n`;
        writeFileSync(join(dir, 'main.py'), leetcodeSource('lc-104', 'python', code, 262144).source);
        const result = spawnSync('python3.13', ['-I', 'main.py', '--leetcode-input'], {
          cwd: dir,
          input: JSON.stringify(chain),
          encoding: 'utf8',
        });
        assert.equal(result.stderr, '', decorator);
        assert.equal(result.stdout, `${depth}\n`, decorator);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
