import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  capacityCases,
  makeCapacityCase,
  capacityCaseNames,
  MAX_I64,
  MIN_I64,
} from '../scripts/oa-judge/stripe-payments-capacity-cases.mjs';
import { dedicatedUrl } from '../scripts/verify-stripe-payments-capacity.mjs';

const reference = fileURLToPath(
  new URL('../content/oa-judge/references/oa-stripe-17.py', import.meta.url),
);
const readArtifact = (path) => readFileSync(new URL(path, import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const evidence = JSON.parse(
  readArtifact('../docs/oa-recovery/stripe-17-capacity.json'),
);
test('all nine histories cover the published full command count, valid timestamps and single-value domain', () => {
  assert.equal(evidence.passed, true);
  assert.deepEqual(
    evidence.cases.map((row) => row.name),
    capacityCaseNames,
  );
  let count = 0;
  for (const c of capacityCases()) {
    const row = evidence.cases[count];
    assert.equal(row.q, c.q);
    assert.equal(row.inputSha256, hash(c.input));
    assert.equal(row.expectedOutputSha256, hash(c.expectedOutput));
    assert.equal(row.outputSha256, row.expectedOutputSha256);
    assert.equal(row.inputBytes, Buffer.byteLength(c.input));
    assert.equal(row.outputBytes, Buffer.byteLength(c.expectedOutput));
    assert.equal(row.status, 'Accepted');
    assert.equal(row.exitStatus, 0);
    assert.equal(row.passed, true);
    assert(
      row.cpuNanoseconds > 0 &&
        row.cpuNanoseconds <= evidence.limits.timeLimit * 1e9,
    );
    assert(
      row.peakMemoryBytes > 0 &&
        row.peakMemoryBytes <= evidence.limits.memoryLimit * 1024,
    );
    const lines = c.input.trimEnd().split('\n');
    assert.equal(Number(lines.shift()), 200000);
    assert.equal(lines.length, 200000);
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(' ');
      assert.equal(Number(parts[0]), i + 1);
      const numeric =
        parts[1] === 'INIT'
          ? parts.slice(3)
          : parts[1] === 'CREATE'
            ? parts.slice(4)
            : parts[1] === 'UPDATE'
              ? parts.slice(3)
              : [];
      for (const value of numeric)
        assert(BigInt(value) >= MIN_I64 && BigInt(value) <= MAX_I64);
    }
    assert(Buffer.byteLength(c.input) < 32 * 1024 * 1024);
    assert(Buffer.byteLength(c.expectedOutput) < 16 * 1024 * 1024);
    count++;
  }
  assert.equal(count, 9);
});
test('capacity evidence remains bound to the published package, reference and case generator', () => {
  const bytes = readArtifact('../content/oa-judge/packages/oa-stripe-17.json');
  const pkg = JSON.parse(bytes);
  const batch = JSON.parse(
    readArtifact('../content/oa-judge/batches/stripe-next.json'),
  );
  const entry = batch.items.find((item) => item.id === 'oa-stripe-17');
  assert.equal(evidence.problemId, entry.id);
  assert.equal(evidence.sourceContentHash, entry.sourceContentHash);
  assert.equal(evidence.packageFileSha256, hash(bytes));
  assert.equal(evidence.packageChecksum, hash(JSON.stringify(pkg)));
  assert.equal(evidence.packageChecksum, entry.packageChecksum);
  assert.equal(evidence.referenceSha256, hash(readFileSync(reference)));
  assert.equal(
    evidence.caseGeneratorSha256,
    hash(
      readArtifact('../scripts/oa-judge/stripe-payments-capacity-cases.mjs'),
    ),
  );
  for (const key of ['timeLimit', 'memoryLimit', 'outputLimit'])
    assert.equal(evidence.limits[key], pkg.problem[key]);
});
test('small constructions match actual checked-in authored reference, without sandbox credentials', () => {
  for (const q of [32, 97, 256])
    for (const name of capacityCaseNames) {
      const c = makeCapacityCase(name, q);
      const run = spawnSync('python3', ['-I', reference], {
        input: c.input,
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout, c.expectedOutput, `${name} q=${q}`);
    }
});
test('closed-form expectations distinguish state, deadline and fixed-width errors', () => {
  const balance = (name) =>
    BigInt(
      makeCapacityCase(name, 97)
        .expectedOutput.trim()
        .split('\n')[1]
        .split(' ')[1],
    );
  assert.equal(balance('duplicate-success-refund'), -17n);
  assert.equal(balance('refund-inclusive'), -17n);
  assert.equal(balance('refund-expired'), -17n + 16n * 7n);
  assert.equal(balance('failure-retry-update'), -17n + 12n * 13n);
  assert.equal(balance('negative-start-refunded'), MIN_I64);
  assert.equal(balance('wide-integer-credit'), 33n * MAX_I64);
  assert.notEqual(
    BigInt.asIntN(64, balance('wide-integer-credit')),
    balance('wide-integer-credit'),
  );
  assert.equal(
    makeCapacityCase('refund-policies', 97).expectedOutput,
    '3\nmissing -7\nnegative -5\nzero 74\n',
  );
  const sorted = makeCapacityCase('merchant-sort', 32).expectedOutput.split(
    '\n',
  );
  assert.deepEqual(sorted.slice(1, 4), ['m1 -1', 'm10 -10', 'm11 -11']);
});
test('runner refuses production, nonlocal hosts, credentials in URL and alternate endpoints', () => {
  assert.equal(dedicatedUrl('http://localhost:5054'), 'http://localhost:5054/');
  for (const bad of [
    'http://localhost:5050',
    'https://localhost:5054',
    'http://example.com:5054',
    'http://user:pass@localhost:5054',
    'http://localhost:5054/run',
    'http://localhost:5054/?x=1',
  ]) {
    assert.throws(() => dedicatedUrl(bad));
  }
  assert.throws(() => makeCapacityCase('not-a-case'));
  assert.throws(() => makeCapacityCase('merchant-sort', 200001));
});
