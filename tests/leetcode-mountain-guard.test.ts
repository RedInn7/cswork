import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import editorials from '../lib/content/ling-editorials.json';
import { leetcodeSource } from '../lib/server/leetcode-mode';

type Language = 'python' | 'cpp' | 'java' | 'go';
// Evens up to the peak, odds down: 401 sits only on the far side, at index 998,
// so a linear scan needs ~10x the 100 get calls LeetCode allows.
const values = [
  ...Array.from({ length: 600 }, (_, i) => 2 * i),
  ...Array.from({ length: 400 }, (_, i) => 1197 - 2 * i),
];
const input = JSON.stringify([401, values]);

const goEnv = { ...process.env, GOTOOLCHAIN: 'local', GOFLAGS: '', GOPROXY: 'off', CGO_ENABLED: '0' };
const cxx = [process.env.CXX, '/opt/homebrew/bin/g++-14', 'g++'].find(
  (c) =>
    c &&
    (c === 'g++' || existsSync(c)) &&
    spawnSync(c, ['-std=c++20', '-fsyntax-only', '-x', 'c++', '-'], { input: '#include <bits/stdc++.h>\n' })
      .status === 0,
);
const skip: Record<Language, string | false> = {
  python: spawnSync('python3', ['--version']).status !== 0 && 'python3 unavailable',
  cpp: !cxx && 'no g++ with <bits/stdc++.h>',
  java:
    (spawnSync('javac', ['-version']).status !== 0 || !existsSync('/usr/bin/java')) && 'java unavailable',
  go: spawnSync('go', ['version'], { env: goEnv }).status !== 0 && 'go unavailable',
};

/** Builds and runs a submission the way the judge does: Python directly, natives behind the bridge. */
function judge(language: Language, code: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-mountain-'));
  const sh = (cmd: string, args: string[], env?: NodeJS.ProcessEnv, stdin = '') =>
    spawnSync(cmd, args, { cwd: dir, env, input: stdin, encoding: 'utf8', timeout: 120_000 });
  try {
    const { source, bridgeSource } = leetcodeSource('lc-1095', language, code, 262144);
    if (language === 'python') {
      writeFileSync(join(dir, 'main.py'), source);
      const run = sh('python3', ['-I', 'main.py'], undefined, input);
      return { built: true, ok: run.status === 0, stdout: run.stdout, log: run.stderr };
    }
    const file = { cpp: 'main.cpp', java: 'Main.java', go: 'main.go' }[language];
    writeFileSync(join(dir, file), source);
    writeFileSync(join(dir, 'bridge.py'), bridgeSource!);
    let build =
      language === 'cpp'
        ? sh(cxx!, ['-std=c++20', 'main.cpp', '-o', 'main'])
        : language === 'go'
          ? sh('go', ['build', '-o', 'main', 'main.go'], goEnv)
          : sh('javac', ['-d', '.', 'Main.java']);
    if (build.status === 0 && language === 'java')
      build = sh('jar', ['cf', 'main.jar', ...readdirSync(dir).filter((f) => f.endsWith('.class'))]);
    if (build.status !== 0) return { built: false, ok: false, stdout: '', log: build.stderr };
    const run = sh('python3', ['-I', '-S', 'bridge.py'], undefined, input);
    return { built: true, ok: run.status === 0, stdout: run.stdout, log: run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const editorial = (editorials as Record<string, { approaches: Record<Language, string>[] }>)['lc-1095'];
const linear: Record<Language, string> = {
  python:
    'class Solution:\n    def findInMountainArray(self, target, m):\n        return next((i for i in range(m.length()) if m.get(i) == target), -1)\n',
  cpp: 'class Solution { public: int findInMountainArray(int target, MountainArray& m) { for (int i = 0; i < m.length(); i++) if (m.get(i) == target) return i; return -1; } };',
  java: 'class Solution { public int findInMountainArray(int target, MountainArray m) { for (int i = 0; i < m.length(); i++) if (m.get(i) == target) return i; return -1; } }',
  go: 'package main\nfunc findInMountainArray(target int, m *MountainArray) int { for i := 0; i < m.length(); i++ { if m.get(i) == target { return i } }; return -1 }\n',
};
// Each tries to read the array or reset the budget; [code, expected outcome].
const cheats: Record<Language, [string, 'compile' | 'run'][]> = {
  python: [
    ['class Solution:\n    def findInMountainArray(self, target, m):\n        return list(m._values).index(target)\n', 'run'],
    [
      'class Solution:\n    def findInMountainArray(self, target, m):\n        for i in range(m.length()):\n            m.calls = 0\n            if m.get(i) == target: return i\n        return -1\n',
      'run',
    ],
  ],
  cpp: [
    [
      'class Solution { public: int findInMountainArray(int target, MountainArray& m) { auto& v = m.values; return find(v->begin(), v->end(), target) - v->begin(); } };',
      'compile',
    ],
    [
      'class Solution { public: int findInMountainArray(int target, MountainArray& m) { for (int i = 0; i < m.length(); i++) { m.calls = 0; if (m.get(i) == target) return i; } return -1; } };',
      'compile',
    ],
    [
      'class Solution { public: int findInMountainArray(int target, MountainArray& m) { MountainArray saved = m; for (int i = 0; i < m.length(); i++) { m = saved; if (m.get(i) == target) return i; } return -1; } };',
      'run',
    ],
  ],
  java: [
    [
      'class Solution { public int findInMountainArray(int target, MountainArray m) { for (int i = 0; i < m.values.length; i++) if (m.values[i] == target) return i; return -1; } }',
      'compile',
    ],
    [
      'class Solution { public int findInMountainArray(int target, MountainArray m) { for (int i = 0; i < m.length(); i++) { m.calls = 0; if (m.get(i) == target) return i; } return -1; } }',
      'compile',
    ],
    // The learner owns the template's class, yet an edited one never receives the array.
    [
      `${linear.java}\nclass MountainArray { int[] values; public int get(int i) { return values[i]; } public int length() { return values.length; } }`,
      'run',
    ],
    // Even keeping the judge's constructor and adding a field leaves it null.
    [
      'class Solution { public int findInMountainArray(int target, MountainArray m) { for (int i = 0; i < m.length(); i++) if (m.values[i] == target) return i; return -1; } }\n' +
        'final class MountainArray { int[] values; private final java.util.function.IntUnaryOperator read; private final java.util.function.IntSupplier size; MountainArray(java.util.function.IntUnaryOperator read, java.util.function.IntSupplier size) { this.read = read; this.size = size; } public int get(int i) { return read.applyAsInt(i); } public int length() { return size.getAsInt(); } }',
      'run',
    ],
  ],
  go: [
    [
      'package main\nfunc findInMountainArray(target int, m *MountainArray) int { for i, v := range m.Values { if v == target { return i } }; return -1 }\n',
      'compile',
    ],
    [
      'package main\nfunc findInMountainArray(target int, m *MountainArray) int { for i := 0; i < m.length(); i++ { m.Calls = 0; if m.get(i) == target { return i } }; return -1 }\n',
      'compile',
    ],
    [
      `${linear.go}type MountainArray struct { Values []int }\nfunc (m *MountainArray) get(i int) int { return m.Values[i] }\nfunc (m *MountainArray) length() int { return len(m.Values) }\n`,
      'compile',
    ],
    // The judge's closures plus an extra exported field: the field stays nil.
    [
      'package main\nfunc findInMountainArray(target int, m *MountainArray) int { for i := 0; i < m.length(); i++ { if m.Values[i] == target { return i } }; return -1 }\n' +
        'type MountainArray struct { get_ func(int) int; length_ func() int; Values []int }\nfunc (m *MountainArray) get(i int) int { return m.get_(i) }\nfunc (m *MountainArray) length() int { return m.length_() }\n',
      'run',
    ],
    [
      'package main\nfunc findInMountainArray(target int, m *MountainArray) int { saved := *m; for i := 0; i < m.length(); i++ { *m = saved; if m.get(i) == target { return i } }; return -1 }\n',
      'run',
    ],
  ],
};

for (const language of ['python', 'cpp', 'java', 'go'] as const)
  void test(`${language}: binary search passes, a scan or a bypass fails`, { skip: skip[language] }, () => {
    for (const approach of editorial.approaches) {
      const result = judge(language, approach[language]);
      assert.ok(result.ok, result.log);
      assert.equal(result.stdout, '998\n');
    }
    const scan = judge(language, linear[language]);
    assert.ok(scan.built && !scan.ok, 'a linear scan exceeds 100 get calls');
    assert.match(scan.log, /MountainArray/);
    for (const [code, stage] of cheats[language]) {
      const result = judge(language, code);
      assert.equal(result.ok, false, code);
      assert.equal(result.built, stage === 'run', `${code}\n${result.log}`);
    }
  });
