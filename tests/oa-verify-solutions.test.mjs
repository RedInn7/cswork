// scripts/oa-judge/verify-solutions.mjs on a two-case package: each verdict the judge gives, in each
// language whose toolchain is here (CI has Python and g++; Java and Go when installed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeToolchain, toolchains, verifyProgram } from '../scripts/oa-judge/verify-solutions.mjs';

const pkg = {
  problem: {
    id: 'oa-fixture-1',
    timeLimit: 1,
    memoryLimit: 262144,
    outputLimit: 64,
    checker: 'tokens',
    languages: ['python', 'cpp', 'java', 'go'],
  },
  cases: [
    { name: 'sample', input: '1 2\n', expectedOutput: '3\n', hidden: false, weight: 1 },
    { name: 'hidden', input: '40 2\n', expectedOutput: '42\n', hidden: true, weight: 1 },
  ],
};
const verdicts = (result) => result.failures.map((failure) => failure.verdict);
const tools = toolchains();

test('a correct Python program passes every case; each kind of failure gets the judge verdict', () => {
  const ok = verifyProgram(pkg, 'python', 'a, b = map(int, input().split())\nprint(a + b)\n');
  assert.deepEqual([ok.passed, ok.total, ok.failures], [2, 2, []]);
  assert.match(ok.environment, /Python 3/);
  const run = (code) => verifyProgram(pkg, 'python', code);
  assert.deepEqual(verdicts(run('a, b = map(int, input().split())\nprint(a - b)\n')), ['wrong_answer', 'wrong_answer']);
  assert.deepEqual(verdicts(run('print(3)\nraise SystemExit(1)\n')), ['runtime_error', 'runtime_error']);
  assert.deepEqual(verdicts(run('print(3\n')), ['compile_error']);
  assert.deepEqual(verdicts(run("print('x' * 100000)\n")), ['output_limit', 'output_limit']);
  // 160 MiB written, well over a 64 MiB limit even when macOS compresses some of it.
  const small = { ...pkg, problem: { ...pkg.problem, memoryLimit: 65536 } };
  assert.deepEqual(verdicts(verifyProgram(small, 'python', "x = b'x' * (160 << 20)\nprint(3)\n")), ['memory_limit', 'memory_limit']);
  const slow = verifyProgram({ ...pkg, cases: pkg.cases.slice(0, 1) }, 'python', 'while True:\n    pass\n');
  assert.deepEqual(verdicts(slow), ['time_limit']);
  assert.throws(() => verifyProgram({ ...pkg, problem: { ...pkg.problem, languages: ['python'] } }, 'go', ''), /does not accept go/);
});

test('a pass needs CPU headroom, memory is watched across the process group while it runs, and nothing outlives a case', async () => {
  const first = { problem: { ...pkg.problem, memoryLimit: 65536 }, cases: pkg.cases.slice(0, 1) };
  const run = (code) => verdicts(verifyProgram(first, 'python', code));
  // Over half the 1s limit here: the judge machine is usually slower.
  assert.deepEqual(run('import time\nt = time.process_time()\nwhile time.process_time() - t < 0.6:\n    pass\nprint(3)\n'), ['time_margin']);
  // 160 MiB in a child it never waits for: only the group's RSS, polled while it runs, sees it.
  const hog = "x = b'x' * (160 << 20)\nimport time\ntime.sleep(5)";
  assert.deepEqual(run(`import subprocess, sys, time\nsubprocess.Popen([sys.executable, '-c', ${JSON.stringify(hog)}])\ntime.sleep(1)\nprint(3)\n`), ['memory_limit']);
  // A background child left behind is killed with the group.
  const dir = mkdtempSync(join(tmpdir(), 'oa-verify-left-'));
  try {
    const marker = join(dir, 'marker');
    const late = `import time\ntime.sleep(0.5)\nopen(${JSON.stringify(marker)}, 'w').close()`;
    assert.deepEqual(run(`import subprocess, sys\nsubprocess.Popen([sys.executable, '-c', ${JSON.stringify(late)}])\nprint(3)\n`), []);
    await new Promise((done) => setTimeout(done, 1000));
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // The judge's environment, not this shell's.
  process.env.OA_VERIFY_SECRET = 'x';
  try {
    assert.deepEqual(run("import os\nprint(3 if os.environ.get('TZ') == 'UTC' and 'OA_VERIFY_SECRET' not in os.environ else 0)\n"), []);
  } finally {
    delete process.env.OA_VERIFY_SECRET;
  }
});

test("evidence needs the judge's Python and g++, or a Java and Go pinned down to its 21 and 1.24", () => {
  const at = (language, version) => judgeToolchain(language, { [language]: { version } });
  assert.deepEqual(
    [at('python', 'Python 3.13.2'), at('python', 'Python 3.12.8'), at('python', 'Python 3.9.6')],
    [true, false, false],
  );
  assert.deepEqual(
    [
      at('cpp', 'g++-14 (Homebrew GCC 14.2.0) 14.2.0'),
      at('cpp', 'g++ (Ubuntu 13.3.0-6ubuntu2~24.04) 13.3.0'),
      at('cpp', 'Apple clang version 17.0.0 (clang-1700.0.13.5)'),
    ],
    [true, false, false],
  );
  assert.deepEqual([at('java', 'javac 21.0.6'), at('java', 'javac 22.0.1'), at('java', 'javac 17.0.2')], [true, true, false]);
  assert.deepEqual(
    [at('go', 'go version go1.26.0 darwin/arm64'), at('go', 'go version go1.23.4 linux/amd64'), at('go', 'go version go1.9.7 linux/amd64')],
    [true, false, false],
  );
  assert.equal(judgeToolchain('go', {}), false);
});

// Newer than the judge's Java 21 (unnamed variables, Java 22) and Go 1.24 (WaitGroup.Go, Go 1.25).
const newer = {
  java: 'public class Main{public static void main(String[] x){try{System.out.println(3);}catch(Exception _){}}}\n',
  go: 'package main\n\nimport (\n\t"fmt"\n\t"sync"\n)\n\nfunc main() {\n\tvar wg sync.WaitGroup\n\twg.Go(func() { fmt.Println(3) })\n\twg.Wait()\n}\n',
};
for (const [language, code] of Object.entries(newer))
  test(`${language} newer than the judge's does not build`, { skip: !tools[language] && `no ${language} toolchain` }, () => {
    assert.deepEqual(verdicts(verifyProgram(pkg, language, code)), ['compile_error']);
  });

const programs = {
  cpp: '#include <bits/stdc++.h>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\\n";}\n',
  java: 'import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextLong()+s.nextLong());}}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar a, b int\n\tfmt.Scan(&a, &b)\n\tfmt.Println(a + b)\n}\n',
};
for (const [language, code] of Object.entries(programs))
  test(`${language} builds like the judge and passes; a wrong one fails`, { skip: !tools[language] && `no ${language} toolchain` }, () => {
    assert.equal(verifyProgram(pkg, language, code).passed, 2);
    assert.deepEqual(verdicts(verifyProgram(pkg, language, code.replace('a+b', 'a*b').replace('s.nextLong()+s.nextLong()', 's.nextLong()*s.nextLong()').replace('a + b', 'a * b'))), ['wrong_answer', 'wrong_answer']);
  });
