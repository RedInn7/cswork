import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  referenceProgram,
  readReferenceProgram,
  referenceExtension,
  assertReferenceEvidence,
  mutantProgram,
} from '../scripts/oa-judge/reference-program.mjs';
import {
  createReferenceSandbox,
  assertNormalExit,
} from '../scripts/oa-judge/reference-sandbox.mjs';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

const cpp = {
  language: 'cpp',
  code: '#include <iostream>\nint main(){std::cout<<42;}',
};
const python = { language: 'python', code: 'print(42)\n' };
const entry = (program) => ({
  id: 'oa-native-fixture',
  authoredSolutions: [program],
});
const spec = { timeLimit: 2, memoryLimit: 131072, outputLimit: 4096 };
const ok = (stdout = '42') => ({
  status: 'Accepted',
  exitStatus: 0,
  files: { stdout },
});
function harness(results, deleteStatus = 200) {
  const calls = [];
  const sandbox = createReferenceSandbox({
    url: 'http://127.0.0.1:5050',
    token: 'fixture-only',
    fetchImpl: async (url, options) => {
      calls.push({
        url: url instanceof URL ? url.href : url,
        ...options,
        ...(options.body ? { command: JSON.parse(options.body).cmd[0] } : {}),
      });
      if (options.method === 'DELETE')
        return { ok: deleteStatus === 200, status: deleteStatus };
      assert(results.length, 'unexpected execution request');
      const result = results.shift();
      if (result instanceof Error) throw result;
      return { ok: true, json: async () => [result] };
    },
  });
  return { sandbox, calls };
}

void test('reference selection binds C++ extension, exact source and declared language; legacy Python evidence remains valid', () => {
  const root = mkdtempSync(join(tmpdir(), 'oa-reference-test-'));
  try {
    mkdirSync(join(root, 'references'));
    writeFileSync(join(root, 'references/oa-native-fixture.cpp'), cpp.code);
    const program = readReferenceProgram(root, entry(cpp));
    assert.equal(program.extension, '.cpp');
    assert.equal(program.code, cpp.code);
    assertReferenceEvidence(
      { referenceLanguage: 'cpp', referenceSha256: program.sha256 },
      program,
    );
    assert.throws(
      () =>
        assertReferenceEvidence({ referenceSha256: program.sha256 }, program),
      /language/,
    );
    assert.throws(() => referenceProgram(entry(cpp), cpp.code + '\n'), /match/);
    assert.throws(
      () =>
        assertReferenceEvidence(
          { referenceLanguage: 'cpp', referenceSha256: 'stale' },
          program,
        ),
      /Stale/,
    );
    const old = referenceProgram(entry(python), python.code);
    assertReferenceEvidence({ referenceSha256: old.sha256 }, old);
    assert.throws(() => referenceExtension('java'), /Unsupported/);
    assert.throws(() => referenceExtension('__proto__'), /Unsupported/);
    assert.throws(() => referenceExtension(null), /Unsupported/);
    assert.throws(
      () =>
        referenceProgram(
          { ...entry(cpp), authoredSolutions: [cpp, python] },
          cpp.code,
        ),
      /Every exposed/,
    );
    assert.throws(
      () => readReferenceProgram(root, { ...entry(cpp), id: '../../outside' }),
      /identity/,
    );
    writeFileSync(
      join(root, 'references/oa-native-fixture.cpp'),
      Buffer.from([255]),
    );
    assert.throws(() => readReferenceProgram(root, entry(cpp)), /valid UTF-8/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test('mutants inherit reference language or select an explicit supported adapter', () => {
  assert.equal(
    mutantProgram({ name: 'incorrect', code: 'int main(){}' }, cpp).language,
    'cpp',
  );
  assert.equal(
    mutantProgram({ name: 'incorrect', ...python }, cpp).language,
    'python',
  );
  assert.throws(
    () => mutantProgram({ name: 'incorrect', code: 'x', language: 'go' }, cpp),
    /Unsupported/,
  );
});

void test('C++ is compiled in GoJudge once, reused for cases, and cache is deleted in finally', async () => {
  const { sandbox, calls } = harness([
    { ...ok(), fileIds: { main: 'binary/id' } },
    ok(),
    ok(),
  ]);
  await sandbox.withProgram(cpp, async (run) => {
    assertNormalExit(await run('first', spec));
    assertNormalExit(await run('second', spec));
  });
  assert.deepEqual(calls[0].command.args, [
    '/usr/bin/g++',
    '-std=c++20',
    '-O2',
    '-pipe',
    'main.cpp',
    '-o',
    'main',
  ]);
  assert.deepEqual(calls[0].command.copyOutCached, ['main']);
  assert.equal(calls[0].command.copyIn['main.cpp'].content, cpp.code);
  assert.equal(calls[0].command.memoryLimit, 1073741824);
  assert.equal(calls[0].command.cpuLimit, 30e9);
  for (const call of calls.slice(1, 3)) {
    assert.deepEqual(call.command.args, ['main']);
    assert.deepEqual(call.command.copyIn, { main: { fileId: 'binary/id' } });
    assert.equal(call.command.memoryLimit, spec.memoryLimit * 1024);
  }
  assert.equal(calls[3].method, 'DELETE');
  assert.equal(calls[3].url, 'http://127.0.0.1:5050/file/binary%2Fid');
});

void test('Python executes in GoJudge without any native compilation or cache requests', async () => {
  const { sandbox, calls } = harness([ok()]);
  await sandbox.withProgram(python, async (run) =>
    assertNormalExit(await run('', spec)),
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].command.args, [
    '/usr/bin/python3',
    '-I',
    'main.py',
  ]);
  assert.deepEqual(calls[0].command.copyIn, {
    'main.py': { content: python.code },
  });
});

void test('failed compilation cannot count as mutant kill and partial compiler cache is cleaned', async () => {
  const { sandbox, calls } = harness([
    {
      status: 'Nonzero Exit Status',
      exitStatus: 1,
      fileIds: { main: 'partial', diagnostic: 'extra' },
    },
  ]);
  let called = false;
  await assert.rejects(
    sandbox.withProgram(cpp, async () => {
      called = true;
    }),
    /compilation must run normally/,
  );
  assert.equal(called, false);
  assert.deepEqual(
    calls
      .slice(1)
      .map((c) => c.url)
      .sort((a, b) => a.localeCompare(b)),
    ['http://127.0.0.1:5050/file/extra', 'http://127.0.0.1:5050/file/partial'],
  );
});

void test('missing compiled binary rejects and cleans other cached artifacts', async () => {
  const { sandbox, calls } = harness([
    { ...ok(), fileIds: { other: 'orphan' } },
  ]);
  await assert.rejects(
    sandbox.withProgram(cpp, async () => assert.fail('must not run')),
    /artifact missing/,
  );
  assert.equal(calls.at(-1).method, 'DELETE');
});

void test('normal execution with wrong output is a kill; runtime failures are never kills; failure still cleans cache', async () => {
  const { sandbox, calls } = harness([
    { ...ok(), fileIds: { main: 'wrong-answer' } },
    ok('incorrect'),
  ]);
  await sandbox.withProgram(cpp, async (run) => {
    const result = await run('', spec);
    assertNormalExit(result, 'mutant');
    assert.equal(
      matchesOaOutput(result.files.stdout, '42', 'tokens', ''),
      false,
    );
  });
  assert.equal(calls.at(-1).method, 'DELETE');
  for (const result of [
    { status: 'Time Limit Exceeded' },
    { status: 'Nonzero Exit Status', exitStatus: 1 },
    { status: 'Accepted', exitStatus: 1 },
  ]) {
    const h = harness([{ ...ok(), fileIds: { main: 'bad-runtime' } }, result]);
    await assert.rejects(
      h.sandbox.withProgram(cpp, async (run) =>
        assertNormalExit(await run('', spec), 'mutant'),
      ),
    );
    assert.equal(h.calls.at(-1).method, 'DELETE');
  }
});

void test('test callback and transport failures still clean cached binaries; cleanup failure cannot silently pass', async () => {
  for (const transport of [false, true]) {
    const h = harness([
      { ...ok(), fileIds: { main: 'cleanup' } },
      ...(transport ? [new Error('transport failure')] : []),
    ]);
    await assert.rejects(
      h.sandbox.withProgram(cpp, async (run) => {
        if (transport) await run('', spec);
        throw new Error('test failure');
      }),
      /failure/,
    );
    assert.equal(h.calls.at(-1).method, 'DELETE');
  }
  const h = harness([{ ...ok(), fileIds: { main: 'cleanup' } }], 500);
  await assert.rejects(
    h.sandbox.withProgram(cpp, async () => {}),
    /cleanup failed/,
  );
});

void test('unsupported language is rejected before any sandbox request', async () => {
  const { sandbox, calls } = harness([]);
  await assert.rejects(
    sandbox.withProgram({ language: 'java', code: 'x' }, async () => {}),
    /Unsupported/,
  );
  assert.equal(calls.length, 0);
});
