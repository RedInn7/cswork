import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capacityCases } from './oa-judge/stripe-payments-capacity-cases.mjs';
import { readReferenceProgram } from './oa-judge/reference-program.mjs';
import {
  createReferenceSandbox,
  assertNormalExit,
} from './oa-judge/reference-sandbox.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
export function dedicatedUrl(value) {
  const u = new URL(value);
  assert(
    u.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) &&
      u.port === '5054' &&
      !u.username &&
      !u.password &&
      u.pathname === '/' &&
      !u.search &&
      !u.hash,
    'Only the dedicated local port 5054 runner is allowed',
  );
  return u.href;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  assert(
    args.length === 2 && args[0] === '--report',
    'Usage: --report NEW_REPORT_PATH',
  );
  const reportPath = resolve(args[1]);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const content = resolve(root, 'content/oa-judge');
  // Reports are new independent artifacts; never overwrite an existing file.
  const { open } = await import('node:fs/promises');
  const url = dedicatedUrl(env.OA_SANDBOX_URL ?? 'http://127.0.0.1:5054');
  assert(
    env.OA_SANDBOX_TOKEN,
    'OA_SANDBOX_TOKEN is required (environment only)',
  );
  const batch = JSON.parse(
    await readFile(resolve(content, 'batches/stripe-next.json'), 'utf8'),
  );
  const entry = batch.items.find((x) => x.id === 'oa-stripe-17');
  const program = readReferenceProgram(content, entry);
  const packageBytes = await readFile(
    resolve(content, 'packages/oa-stripe-17.json'),
  );
  const pkg = JSON.parse(packageBytes);
  assert.equal(
    sha(JSON.stringify(pkg)),
    entry.packageChecksum,
    'Package checksum mismatch',
  );
  const generatorPath = resolve(
    root,
    'scripts/oa-judge/stripe-payments-capacity-cases.mjs',
  );
  const generatorSha256 = sha(await readFile(generatorPath));
  const limits = { timeLimit: 3, memoryLimit: 262144, outputLimit: 16384 };
  for (const [key, value] of Object.entries(limits))
    assert.equal(pkg.problem[key], value);
  const report = {
    schemaVersion: 1,
    kind: 'independent-capacity-regression',
    problemId: entry.id,
    startedAt: new Date().toISOString(),
    referenceSha256: program.sha256,
    sourceContentHash: entry.sourceContentHash,
    packageFileSha256: sha(packageBytes),
    packageChecksum: entry.packageChecksum,
    caseGeneratorSha256: generatorSha256,
    limits,
    note: 'Representative full-command-count scenarios for the published site q<=200000 protocol only; not new problem acceptance or proof of the entire original-source domain. Original sources provide no numeric bounds. Identifier length and aggregate output are not bounded by these scenarios. Single input amounts are signed 64-bit; accumulated balances are mathematical integers and may exceed signed 64-bit. Python arbitrary-precision arithmetic is tested; other languages need suitable big-integer arithmetic, and are not validated by this suite.',
    cases: [],
    passed: false,
  };
  const handle = await open(reportPath, 'wx');
  try {
    const sandbox = createReferenceSandbox({
      url,
      token: env.OA_SANDBOX_TOKEN,
    });
    await sandbox.withProgram(program, async (run) => {
      for (const test of capacityCases()) {
        console.log(
          JSON.stringify({
            event: 'capacity_start',
            name: test.name,
            q: test.q,
          }),
        );
        const result = await run(test.input, limits);
        const actual = result.files?.stdout ?? '';
        const row = {
          name: test.name,
          q: test.q,
          inputBytes: Buffer.byteLength(test.input),
          expectedOutputBytes: Buffer.byteLength(test.expectedOutput),
          outputBytes: Buffer.byteLength(actual),
          inputSha256: sha(test.input),
          expectedOutputSha256: sha(test.expectedOutput),
          outputSha256: sha(actual),
          status: result.status,
          exitStatus: result.exitStatus,
          cpuNanoseconds: result.time,
          wallNanoseconds: result.runTime,
          peakMemoryBytes: result.memory,
          passed:
            result.status === 'Accepted' &&
            (result.exitStatus === undefined || result.exitStatus === 0) &&
            actual.trimEnd() === test.expectedOutput.trimEnd(),
        };
        report.cases.push(row);
        console.log(JSON.stringify({ event: 'capacity_result', ...row }));
        assertNormalExit(result, test.name);
        assert(row.passed, `${test.name}: output mismatch`);
        assert(
          Number.isFinite(result.time) && Number.isFinite(result.memory),
          'Missing actual resource metrics',
        );
      }
    });
    assert.equal(
      sha(await readFile(resolve(content, 'packages/oa-stripe-17.json'))),
      report.packageFileSha256,
    );
    assert.equal(readReferenceProgram(content, entry).sha256, program.sha256);
    assert.equal(
      sha(await readFile(generatorPath)),
      generatorSha256,
      'Case generator changed during verification',
    );
    report.passed = true;
  } finally {
    report.finishedAt = new Date().toISOString();
    await handle.writeFile(JSON.stringify(report, null, 2) + '\n');
    await handle.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
