/** Verify authored programs only in go-judge; never run reference code on the host. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  batchName,
  loadCandidateScope,
  loadScope,
} from './oa-judge/aggregate-batches.mjs';
import { matchesOaOutput } from './oa-judge/output-checker.mjs';
import { OA_SEMANTIC_IDS } from '../lib/oa-semantic-checkers.mjs';
import {
  OJ_MAX_IMPORT_BYTES,
  OA_MAX_METADATA_FILE_BYTES,
} from '../lib/oj-data-budgets.mjs';
import { readBoundedFileSync } from './oa-judge/bounded-file.mjs';
import {
  assertOracleCoverage,
  assertFormalCoverage,
} from './oa-judge/oracle-coverage.mjs';
import {
  readReferenceProgram,
  mutantProgram,
} from './oa-judge/reference-program.mjs';
import {
  createReferenceSandbox,
  assertNormalExit,
} from './oa-judge/reference-sandbox.mjs';

const root = resolve('content/oa-judge');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path, maximumBytes = OA_MAX_METADATA_FILE_BYTES) => {
  const bytes = readBoundedFileSync(path, maximumBytes);
  return { bytes, data: JSON.parse(bytes), sha256: hash(bytes) };
};
const args = process.argv.slice(2);
const scopeFlag = args[0];
const batch =
  scopeFlag === '--batch' || scopeFlag === '--candidate-batch'
    ? batchName(args.splice(0, 2)[1])
    : null;
const candidateBatch = scopeFlag === '--candidate-batch';
assert(
  args.length <= 1 && !args.some((arg) => arg.startsWith('--')),
  'Usage: verify-oa-judge.mjs [--batch NAME | --candidate-batch NAME] [REPORT]',
);
const registry = candidateBatch
  ? loadCandidateScope(root, batch)
  : loadScope(root, batch);
const url = new URL(process.env.GO_JUDGE_URL || 'http://127.0.0.1:5050');
assert(
  url.protocol === 'https:' ||
    (url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)),
);
assert(process.env.GO_JUDGE_TOKEN, 'Authenticated sandbox required');
assert(registry.data.items.length > 0 && registry.data.items.length <= 100);
const report = {
  schemaVersion: 1,
  engine: 'go-judge',
  ...(batch
    ? { batch, batchSha256: registry.sha256 }
    : { registrySha256: registry.sha256 }),
  allPassed: false,
  problems: [],
  finishedAt: '',
};
const sandbox = createReferenceSandbox({
  url,
  token: process.env.GO_JUDGE_TOKEN,
});
for (const item of registry.data.items) {
  assert(/^oa-[a-z0-9-]+$/.test(item.id));
  const pkg = read(
    resolve(root, 'packages', item.id + '.json'),
    OJ_MAX_IMPORT_BYTES,
  );
  assert.equal(hash(JSON.stringify(pkg.data)), item.packageChecksum);
  assert.equal(pkg.data.problem.id, item.id);
  assert(
    [
      'tokens',
      'exact',
      'float',
      'float-array',
      ...Object.keys(OA_SEMANTIC_IDS),
    ].includes(pkg.data.problem.checker),
    'Unsupported OA checker',
  );
  if (Object.hasOwn(OA_SEMANTIC_IDS, pkg.data.problem.checker))
    assert.equal(
      item.id,
      OA_SEMANTIC_IDS[pkg.data.problem.checker],
      'Fixed OA checker identity mismatch',
    );
  const program = readReferenceProgram(root, item);
  assert(
    pkg.data.problem.languages.includes(program.language),
    'Reference language must be allowed',
  );
  const oracle = read(resolve(root, 'oracles', item.id + '.json'));
  const mutants = read(resolve(root, 'mutants', item.id + '.json'));
  assertOracleCoverage(item, oracle.data, item.id);
  assert(mutants.data.length >= 2);
  assertFormalCoverage(item, pkg.data);
  let passed = 0;
  await sandbox.withProgram(program, async (run) => {
    for (const test of [...pkg.data.cases, ...oracle.data]) {
      assert.equal(typeof test.input, 'string');
      assert.equal(typeof test.expectedOutput, 'string');
      const result = await run(test.input, pkg.data.problem);
      assertNormalExit(result, item.id + ' reference');
      assert(
        matchesOaOutput(
          result.files?.stdout || '',
          test.expectedOutput,
          pkg.data.problem.checker,
          test.input,
        ),
        `${item.id} reference output for ${JSON.stringify(test.input)} ` +
          `(actual ${Buffer.byteLength(result.files?.stdout || '')} bytes, expected ${Buffer.byteLength(test.expectedOutput)} bytes; ` +
          `${JSON.stringify((result.files?.stdout || '').slice(0, 120))} != ${JSON.stringify(test.expectedOutput.slice(0, 120))}...)`,
      );
      passed++;
    }
  });
  const killed = [];
  for (const mutant of mutants.data) {
    const incorrect = mutantProgram(mutant, program);
    let detected = false;
    await sandbox.withProgram(incorrect, async (run) => {
      for (const test of pkg.data.cases) {
        const result = await run(test.input, pkg.data.problem);
        // A syntax/runtime error is not evidence that the cases distinguish a wrong algorithm.
        assertNormalExit(result, item.id + ' mutant');
        if (
          !matchesOaOutput(
            result.files?.stdout || '',
            test.expectedOutput,
            pkg.data.problem.checker,
            test.input,
          )
        ) {
          detected = true;
          break;
        }
      }
    });
    assert(detected, item.id + ' surviving mutant ' + mutant.name);
    killed.push(mutant.name);
  }
  report.problems.push({
    id: item.id,
    ...(batch ? { entrySha256: hash(JSON.stringify(item)) } : {}),
    packageSha256: pkg.sha256,
    referenceLanguage: program.language,
    referenceSha256: program.sha256,
    oracleSha256: oracle.sha256,
    mutantsSha256: mutants.sha256,
    passed,
    formal: pkg.data.cases.length,
    oracle: oracle.data.length,
    killed,
  });
  console.log(
    JSON.stringify({
      event: 'oa_verified',
      id: item.id,
      passed,
      killed: killed.length,
    }),
  );
}
report.allPassed = true;
report.finishedAt = new Date().toISOString();
mkdirSync(resolve(root, 'reports'), { recursive: true });
writeFileSync(
  args[0] ||
    (batch
      ? resolve(root, 'reports', batch + '.json')
      : resolve(root, 'sandbox-report.json')),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    event: 'oa_verification_complete',
    problems: report.problems.length,
  }),
);
