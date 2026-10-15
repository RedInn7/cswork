/**
 * Verifies a Python, C++, Java or Go program against EVERY case of an OA judge package
 * (content/oa-judge/packages/<id>.json) on this machine, built and run as lib/server/oj-engine.ts
 * does in go-judge: its compiler flags, javaCommand's JVM flags, CPU time ≤ timeLimit, wall time
 * ≤ max(3, 3 × timeLimit), peak memory ≤ memoryLimit, stdout ≤ outputLimit, and matchesOutput
 * with the package's checker (ACM: stdin in, stdout out). One process at a time.
 *
 *   node --import tsx scripts/oa-judge/verify-solutions.mjs <id> <language> <file> [--save]
 *     prints passed/total and the failing cases; with --save a program that passes everything
 *     goes into content/oa-judge/solutions/<id>.json (code, sha256, the package's checksum).
 *   node --import tsx scripts/oa-judge/verify-solutions.mjs --report <chunk> <id>...
 *     re-runs every program of those sidecars and merges the results into
 *     content/oa-judge/reports/solutions-<chunk>.json. Only programs a report lists as passing
 *     every case of the current package are ever served (lib/oa-solution-evidence.mjs).
 *
 * Toolchains come from PATH with /opt/homebrew/bin first: python3.13 or python3, g++-14 or g++,
 * javac/java, go. Timing is this machine's, usually faster than the judge's: keep headroom.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HTTP_FIXTURE_BOOTSTRAP, HTTP_FIXTURES_FILE } from '../../lib/http-fixtures.mjs';
import { matchesOutput } from '../../lib/server/oj-engine.ts';
import { javaCommand } from '../../lib/server/leetcode-mode.ts';

export const LANGUAGES = ['python', 'cpp', 'java', 'go'];
const SOURCE = { python: 'main.py', cpp: 'main.cpp', java: 'Main.java', go: 'main.go' };
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
if (existsSync('/opt/homebrew/bin') && !process.env.PATH?.startsWith('/opt/homebrew/bin'))
  process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`;

/** The first candidate that runs, with its version line. */
function tool(candidates, versionArgs) {
  for (const name of candidates) {
    const done = spawnSync(name, versionArgs, { encoding: 'utf8' });
    if (done.status === 0) return { bin: name, version: `${done.stdout}${done.stderr}`.trim().split('\n')[0] };
  }
  return null;
}
let found;
/** Local toolchains, looked up once. */
export function toolchains() {
  found ??= {
    python: tool(['python3.13', 'python3'], ['--version']),
    // Apple's g++ is clang without <bits/stdc++.h>: Homebrew GCC first.
    cpp: tool(['g++-14', 'g++'], ['--version']),
    java: tool(['javac'], ['-version']),
    go: tool(['go'], ['version']),
  };
  return found;
}

/**
 * Runs argv[4:] with in.txt as stdin, out.txt / err.txt as stdout / stderr, a CPU rlimit just
 * past the limit and a wall clock; prints its exit, signal, CPU seconds, peak RSS (KiB) and
 * whether the clock ran out. wait4 is the portable way to get one child's rusage.
 */
const RUNNER = String.raw`
import json, os, resource, signal, subprocess, sys, time
cpu, wall, out = float(sys.argv[1]), float(sys.argv[2]), int(sys.argv[3])
def limits():
    os.setsid()
    resource.setrlimit(resource.RLIMIT_CPU, (int(cpu) + 1, int(cpu) + 2))
    resource.setrlimit(resource.RLIMIT_FSIZE, (out + 1, out + 1))
with open('in.txt', 'rb') as i, open('out.txt', 'wb') as o, open('err.txt', 'wb') as e:
    p = subprocess.Popen(sys.argv[4:], stdin=i, stdout=o, stderr=e, preexec_fn=limits)
start, late = time.monotonic(), False
while True:
    pid, status, usage = os.wait4(p.pid, os.WNOHANG)
    if pid:
        break
    if time.monotonic() - start > wall:
        late = True
        os.killpg(p.pid, signal.SIGKILL)
        pid, status, usage = os.wait4(p.pid, 0)
        break
    time.sleep(0.005)
print(json.dumps({
    'exit': os.WEXITSTATUS(status) if os.WIFEXITED(status) else None,
    'signal': os.WTERMSIG(status) if os.WIFSIGNALED(status) else None,
    'cpu': usage.ru_utime + usage.ru_stime,
    'rss': usage.ru_maxrss // 1024 if sys.platform == 'darwin' else usage.ru_maxrss,
    'late': late,
}))
`;

/** Builds the program like oj-engine.ts compile(); returns the run command or a compile error. */
function build(language, code, dir, tools, memoryLimit) {
  writeFileSync(join(dir, SOURCE[language]), code);
  const t = tools[language];
  const commands = {
    python: [t.bin, '-I', '-c', "import py_compile; py_compile.compile('main.py', doraise=True)"],
    cpp: [t.bin, '-std=c++20', '-O2', '-pipe', 'main.cpp', '-o', 'main'],
    java: [t.bin, '-J-XX:TieredStopAtLevel=1', '-J-XX:+UseSerialGC', '-encoding', 'UTF-8', 'Main.java'],
    go: [t.bin, 'build', '-trimpath', '-o', 'main', 'main.go'],
  };
  const [bin, ...args] = commands[language];
  const done = spawnSync(bin, args, {
    cwd: dir,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, GOTOOLCHAIN: 'local', GOPROXY: 'off', GOSUMDB: 'off', CGO_ENABLED: '0', GOFLAGS: '' },
  });
  if (done.status !== 0) return { error: `${done.stdout}${done.stderr}`.slice(0, 4000) || String(done.error) };
  return {
    run:
      language === 'python'
        ? [t.bin, '-I', 'main.py']
        : language === 'java'
          ? // The judge's JVM flags; classes from the directory instead of main.jar.
            javaCommand(memoryLimit).map((arg) => (arg === '/usr/bin/java' ? 'java' : arg === 'main.jar' ? '.' : arg))
          : ['./main'],
  };
}

/**
 * Every case of `pkg` against `code`: { passed, total, failures, maxCpuMs, maxRssKb, environment }.
 * Stops after three failures (passed then counts the cases before them).
 */
export function verifyProgram(pkg, language, code) {
  const problem = pkg.problem;
  assert(LANGUAGES.includes(language), `Unsupported language: ${language}`);
  assert(problem.languages.includes(language), `${problem.id} does not accept ${language}`);
  const tools = toolchains();
  assert(tools[language] && tools.python, `No local ${language} toolchain`);
  const environment = `${process.platform}-${process.arch}; ${tools[language].version}`;
  const total = pkg.cases.length;
  const dir = mkdtempSync(join(tmpdir(), 'oa-verify-'));
  try {
    const built = build(language, code, dir, tools, problem.memoryLimit);
    if (built.error)
      return { passed: 0, total, failures: [{ case: 'compile', verdict: 'compile_error', detail: built.error }], maxCpuMs: 0, maxRssKb: 0, environment };
    // REST API problems: Python's GETs are answered from the package, as in the judge.
    const fixtures = language === 'python' && problem.httpFixtures;
    if (fixtures) writeFileSync(join(dir, HTTP_FIXTURES_FILE), JSON.stringify(fixtures));
    const command = fixtures ? [built.run[0], '-I', '-c', HTTP_FIXTURE_BOOTSTRAP, 'main.py'] : built.run;
    const outBytes = problem.outputLimit * 1024;
    const wall = Math.max(3, problem.timeLimit * 3);
    let passed = 0, maxCpuMs = 0, maxRssKb = 0;
    const failures = [];
    for (const [index, test] of pkg.cases.entries()) {
      writeFileSync(join(dir, 'in.txt'), test.input);
      const done = spawnSync(
        tools.python.bin,
        ['-I', '-c', RUNNER, String(problem.timeLimit), String(wall), String(outBytes), ...command],
        { cwd: dir, encoding: 'utf8', timeout: (wall + 30) * 1000 },
      );
      assert.equal(done.status, 0, `runner failed: ${done.stderr || done.error}`);
      const r = JSON.parse(done.stdout);
      maxCpuMs = Math.max(maxCpuMs, Math.round(r.cpu * 1000));
      maxRssKb = Math.max(maxRssKb, r.rss);
      const stdout = readFileSync(join(dir, 'out.txt'), 'utf8');
      const errBytes = statSync(join(dir, 'err.txt')).size;
      const verdict =
        r.late || r.cpu > problem.timeLimit || r.signal === 24 /* SIGXCPU */
          ? 'time_limit'
          : r.signal === 25 /* SIGXFSZ */ || Buffer.byteLength(stdout) > outBytes || errBytes > Math.min(outBytes, 65536)
            ? 'output_limit'
            : r.rss > problem.memoryLimit
              ? 'memory_limit'
              : r.exit !== 0
                ? 'runtime_error'
                : matchesOutput(stdout, test.expectedOutput, problem.checker, test.input)
                  ? 'accepted'
                  : 'wrong_answer';
      if (verdict === 'accepted') passed++;
      else {
        failures.push({
          case: `${index + 1} ${test.name ?? ''}`.trim(),
          verdict,
          cpuMs: Math.round(r.cpu * 1000),
          ...(verdict === 'runtime_error' && { detail: readFileSync(join(dir, 'err.txt'), 'utf8').slice(0, 1000) }),
        });
        if (failures.length >= 3) break;
      }
    }
    return { passed, total, failures, maxCpuMs, maxRssKb, environment };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const root = resolve('content/oa-judge');
/** The package and its checksum (sha256 of its JSON, as registry.json's packageChecksum). */
export function readPackage(id) {
  assert(/^oa-[a-z0-9-]+$/.test(id), `Invalid OA id: ${id}`);
  const pkg = JSON.parse(readFileSync(resolve(root, 'packages', `${id}.json`), 'utf8'));
  return { pkg, packageChecksum: sha256(JSON.stringify(pkg)) };
}
const registryEntry = (id) =>
  JSON.parse(readFileSync(resolve(root, 'registry.json'), 'utf8')).items.find((item) => item.id === id);
const write = (file, value) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const order = (a, b) => a.id.localeCompare(b.id) || LANGUAGES.indexOf(a.language) - LANGUAGES.indexOf(b.language);

function print(label, result) {
  const stopped = result.passed + result.failures.length < result.total ? ' (stopped after 3 failures)' : '';
  console.log(`${label}: ${result.passed}/${result.total} passed${stopped}, max CPU ${result.maxCpuMs} ms, max RSS ${result.maxRssKb} KiB (${result.environment})`);
  for (const failure of result.failures) console.log(`  FAIL case ${failure.case}: ${failure.verdict}${failure.detail ? `\n${failure.detail}` : ''}`);
}
const warnSlow = (label, result, timeLimit) =>
  result.maxCpuMs > timeLimit * 500 &&
  console.log(`  WARN ${label} used over half the ${timeLimit}s limit here; the judge machine is usually slower.`);

function single([id, language, file, ...flags]) {
  assert(id && language && file, 'Usage: verify-solutions.mjs <id> <language> <file> [--save]');
  const code = readFileSync(file, 'utf8');
  const { pkg, packageChecksum } = readPackage(id);
  const result = verifyProgram(pkg, language, code);
  print(`${id} ${language}`, result);
  warnSlow(language, result, pkg.problem.timeLimit);
  const ok = result.total > 0 && result.passed === result.total;
  if (ok && flags.includes('--save')) {
    assert.notEqual(registryEntry(id)?.authoredSolutions[0].language, language, `${id} already shows its verified ${language} program`);
    const target = resolve(root, 'solutions', `${id}.json`);
    const old = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : { programs: [] };
    // A newer package keeps the other programs: --report re-runs them all against it.
    const programs = [...old.programs.filter((p) => p.language !== language), { language, code, sha256: sha256(code) }];
    write(target, { id, packageChecksum, programs: programs.sort((a, b) => order({ id, ...a }, { id, ...b })) });
    console.log(`  saved to ${target}; run --report <chunk> ${id} to record the evidence`);
  }
  return ok;
}

function report([chunk, ...ids]) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chunk ?? '') && ids.length, 'Usage: verify-solutions.mjs --report <chunk> <id>...');
  const results = [];
  for (const id of ids) {
    const sidecar = JSON.parse(readFileSync(resolve(root, 'solutions', `${id}.json`), 'utf8'));
    assert.equal(sidecar.id, id, `solutions/${id}.json names ${sidecar.id}`);
    const { pkg, packageChecksum } = readPackage(id);
    assert.equal(sidecar.packageChecksum, packageChecksum, `solutions/${id}.json is for another package version`);
    for (const program of sidecar.programs) {
      assert.equal(sha256(program.code), program.sha256, `${id} ${program.language}: sha256 does not match the code`);
      const result = verifyProgram(pkg, program.language, program.code);
      print(`${id} ${program.language}`, result);
      warnSlow(program.language, result, pkg.problem.timeLimit);
      const { failures, ...rest } = result;
      results.push({ id, language: program.language, sha256: program.sha256, packageChecksum, ...rest, ...(failures.length && { failures }), verifiedAt: new Date().toISOString() });
    }
  }
  const target = resolve(root, 'reports', `solutions-${chunk}.json`);
  const old = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')).results : [];
  write(target, {
    schemaVersion: 1,
    chunk,
    // Re-verified problems replace their old entries; the chunk's others stay.
    results: [...old.filter((r) => !ids.includes(r.id)), ...results].sort(order),
  });
  const failed = results.filter((r) => r.passed !== r.total);
  console.log(`${results.length} program(s), ${failed.length} failing; wrote ${target}`);
  return failed.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  process.exit((args[0] === '--report' ? report(args.slice(1)) : single(args)) ? 0 : 1);
}
