// scripts/oa-judge/verify-solutions.mjs on a two-case package: each verdict the judge gives, in each
// language whose toolchain is here (CI has Python and g++; Java and Go when installed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toolchains, verifyProgram } from '../scripts/oa-judge/verify-solutions.mjs';

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
  // 320 MiB written, over the 256 MiB limit (a JVM alone stays well under it).
  assert.deepEqual(verdicts(run("x = b'x' * (320 << 20)\nprint(3)\n")), ['memory_limit', 'memory_limit']);
  const slow = verifyProgram({ ...pkg, cases: pkg.cases.slice(0, 1) }, 'python', 'while True:\n    pass\n');
  assert.deepEqual(verdicts(slow), ['time_limit']);
  assert.throws(() => verifyProgram({ ...pkg, problem: { ...pkg.problem, languages: ['python'] } }, 'go', ''), /does not accept go/);
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
