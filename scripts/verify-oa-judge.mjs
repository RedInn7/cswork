/** Verify authored programs only in go-judge; never run reference code on the host. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { batchName, loadScope } from './oa-judge/aggregate-batches.mjs';
import { matchesOaOutput } from './oa-judge/output-checker.mjs';
import { OA_SEMANTIC_IDS } from '../lib/oa-semantic-checkers.mjs';
import {
  OJ_MAX_IMPORT_BYTES,
  OA_MAX_METADATA_FILE_BYTES,
} from '../lib/oj-data-budgets.mjs';
import { readBoundedFileSync } from './oa-judge/bounded-file.mjs';

const root = resolve('content/oa-judge');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path, maximumBytes = OA_MAX_METADATA_FILE_BYTES) => {
  const bytes = readBoundedFileSync(path, maximumBytes);
  return { bytes, data: JSON.parse(bytes), sha256: hash(bytes) };
};
const args = process.argv.slice(2);
const batch = args[0] === '--batch' ? batchName(args.splice(0, 2)[1]) : null;
assert(
  args.length <= 1 && !args.some((arg) => arg.startsWith('--')),
  'Usage: verify-oa-judge.mjs [--batch NAME] [REPORT]',
);
const registry = loadScope(root, batch);
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
async function run(code, input, spec) {
  assert(
    [
      'tokens',
      'exact',
      'float',
      'float-array',
      'oa-closest-pair',
      'oa-peak-index',
      'oa-window-averages',
      'oa-balanced-circle',
      'oa-magic-square',
      'oa-newspaper',
      'oa-quadratic-minimum',
      'oa-compatible-groups',
      'oa-football-top-two',
      'oa-regional-maxima',
      'oa-optimal-loads',
      'oa-optimal-distinct',
      'oa-dictionary-path',
      'oa-ipv4-cidr',
      'oa-json-diff',
      'oa-longest-palindrome',
      'oa-piecewise-linear',
    ].includes(spec.checker) &&
      spec.timeLimit > 0 &&
      spec.timeLimit <= 10,
  );
  assert(spec.memoryLimit >= 16384 && spec.memoryLimit <= 524288);
  assert(spec.outputLimit > 0 && spec.outputLimit <= 65536);
  let response;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      response = await fetch(new URL('/run', url), {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + process.env.GO_JUDGE_TOKEN,
        },
        body: JSON.stringify({
          cmd: [
            {
              args: ['/usr/bin/python3', 'main.py'],
              env: ['PATH=/usr/bin:/bin', 'LANG=C.UTF-8', 'HOME=/w'],
              files: [
                { content: input },
                { name: 'stdout', max: spec.outputLimit * 1024, pipe: true },
                { name: 'stderr', max: 65536, pipe: true },
              ],
              cpuLimit: Math.ceil(spec.timeLimit * 1e9),
              clockLimit: Math.ceil(Math.max(3, spec.timeLimit * 3) * 1e9),
              memoryLimit: spec.memoryLimit * 1024,
              procLimit: 16,
              copyIn: { 'main.py': { content: code } },
            },
          ],
        }),
      });
      break;
    } catch (error) {
      const transient =
        error?.name === 'TimeoutError' ||
        ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
          error?.cause?.code,
        );
      if (!transient || attempt === 5) throw error;
      console.warn(JSON.stringify({ event: 'oa_sandbox_retry', attempt }));
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(2 ** attempt, 8) * 1000),
      );
    }
  }
  assert(response.ok, 'Sandbox HTTP ' + response.status);
  const results = await response.json();
  assert(results.length === 1);
  return results[0];
}
for (const item of registry.data.items) {
  assert(/^oa-[a-z0-9-]+$/.test(item.id));
  const pkg = read(
    resolve(root, 'packages', item.id + '.json'),
    OJ_MAX_IMPORT_BYTES,
  );
  assert.equal(hash(JSON.stringify(pkg.data)), item.packageChecksum);
  assert.equal(pkg.data.problem.id, item.id);
  if (Object.hasOwn(OA_SEMANTIC_IDS, pkg.data.problem.checker))
    assert.equal(
      item.id,
      OA_SEMANTIC_IDS[pkg.data.problem.checker],
      'Fixed OA checker identity mismatch',
    );
  const reference = readBoundedFileSync(
    resolve(root, 'references', item.id + '.py'),
    OA_MAX_METADATA_FILE_BYTES,
  ).toString('utf8');
  assert.equal(
    item.authoredSolutions.length,
    1,
    'Every exposed program must be verified',
  );
  assert.equal(item.authoredSolutions[0].language, 'python');
  assert.equal(
    item.authoredSolutions[0].code,
    reference,
    'Exposed solution must match verified program',
  );
  const oracle = read(resolve(root, 'oracles', item.id + '.json'));
  const mutants = read(resolve(root, 'mutants', item.id + '.json'));
  assert(oracle.data.length >= 120 && mutants.data.length >= 2);
  assert(
    pkg.data.cases.some((c) => !c.hidden) &&
      pkg.data.cases.filter((c) => c.hidden).length >= 20,
  );
  let passed = 0;
  for (const test of [...pkg.data.cases, ...oracle.data]) {
    assert.equal(typeof test.input, 'string');
    assert.equal(typeof test.expectedOutput, 'string');
    const result = await run(reference, test.input, pkg.data.problem);
    assert.equal(result.status, 'Accepted', item.id + ' reference runtime');
    assert(
      matchesOaOutput(
        result.files?.stdout || '',
        test.expectedOutput,
        pkg.data.problem.checker,
        test.input,
      ),
      item.id + ' reference output',
    );
    passed++;
  }
  const killed = [];
  for (const mutant of mutants.data) {
    assert(typeof mutant.name === 'string' && typeof mutant.code === 'string');
    let detected = false;
    for (const test of pkg.data.cases) {
      const result = await run(mutant.code, test.input, pkg.data.problem);
      // A syntax/runtime error is not evidence that the cases distinguish a wrong algorithm.
      assert.equal(
        result.status,
        'Accepted',
        item.id + ' mutant must run normally',
      );
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
    assert(detected, item.id + ' surviving mutant ' + mutant.name);
    killed.push(mutant.name);
  }
  report.problems.push({
    id: item.id,
    ...(batch ? { entrySha256: hash(JSON.stringify(item)) } : {}),
    packageSha256: pkg.sha256,
    referenceSha256: hash(reference),
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
