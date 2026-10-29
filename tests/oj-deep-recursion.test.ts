import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { run } from '../lib/server/oj-engine';
import { JAVA_STARTUP_FLAGS, leetcodeSource, leetcodeTemplates } from '../lib/server/leetcode-mode';
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
  const bridged = JSON.parse(bridge.match(/\["\/usr\/bin\/java".*?\]/)![0]);
  for (const command of [args, bridged]) {
    assert.ok(command.includes('-Xss64m'), command.join(' '));
    assert.ok(command.includes('-Xmx153m'));
    // ACM runs and LeetCode bridges start the same JVM.
    assert.ok(JAVA_STARTUP_FLAGS.every((flag) => command.includes(flag)), command.join(' '));
  }
});

// The runner's Python is 3.13: a C call between recursive frames (C @cache, or
// max() iterating a generator) spends a fixed budget that stops near depth 3300.
const python = spawnSync('python3.13', ['-c', '']).status === 0;
function runPython(id: string, code: string, input: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-deep-'));
  try {
    const { source } = leetcodeSource(id, 'python', code, 262144);
    writeFileSync(join(dir, 'main.py'), source);
    return spawnSync('python3.13', ['-I', 'main.py', '--leetcode-input'], {
      cwd: dir,
      input,
      encoding: 'utf8',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

void test(
  'recursion 10^5 deep runs under python3.13 -I',
  { skip: !python && 'python3.13 unavailable' },
  () => {
    const depth = 100000;
    const chain: (number | null)[] = [0];
    for (let i = 1; i < depth; i++) chain.push(i, null);
    chain.pop();
    for (const [decorator, value] of [
      ['@cache', '1 + max(d(node.left), d(node.right))'],
      ['@lru_cache(None)', '1 + max(d(node.left), d(node.right))'],
      ['@lru_cache', '1 + max(d(node.left), d(node.right))'],
      ['', '1 + max(d(c) for c in (node.left, node.right))'],
    ]) {
      const code = `class Solution:\n    def maxDepth(self, root):\n        ${decorator}\n        def d(node):\n            return 0 if node is None else ${value}\n        return d(root)\n`;
      const result = runPython('lc-104', code, JSON.stringify(chain));
      assert.equal(result.stderr, '', decorator + value);
      assert.equal(result.stdout, `${depth}\n`, decorator + value);
    }
  },
);

// Unfolded, a deep traceback overflows the 64 KiB stderr collector: an output limit.
void test(
  'a deep memoized failure stays a short runtime error',
  { skip: !python && 'python3.13 unavailable' },
  () => {
    const code = `class Solution:\n    def coinChange(self, coins, amount):\n        @cache\n        def dp(a):\n            best = 1 // a\n            for c in coins:\n                if c <= a: best = min(best, dp(a - c) + 1)\n            return best\n        return dp(amount)\n`;
    const result = runPython('lc-322', code, '[1,2,5]\n1000');
    assert.equal(result.status, 1);
    assert.ok(result.stderr.length < 4096, `${result.stderr.length} bytes`);
    assert.match(result.stderr, /omitted[^]*repeated[^]*\nZeroDivisionError: [^\n]+\n$/);
  },
);
