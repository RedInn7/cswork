/** Verify authored programs only in go-judge; never run reference code on the host. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve('content/oa-judge');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => {
  const bytes = readFileSync(path);
  assert(bytes.length < 16 * 1024 * 1024);
  return { bytes, data: JSON.parse(bytes), sha256: hash(bytes) };
};
const registry = read(resolve(root, 'registry.json'));
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
  registrySha256: registry.sha256,
  allPassed: false,
  problems: [],
  finishedAt: '',
};
const equal = (a, b) =>
  a.trim().split(/\s+/).join(' ') === b.trim().split(/\s+/).join(' ');
async function run(code, input, spec) {
  assert(
    spec.checker === 'tokens' && spec.timeLimit > 0 && spec.timeLimit <= 10,
  );
  assert(spec.memoryLimit >= 16384 && spec.memoryLimit <= 524288);
  assert(spec.outputLimit > 0 && spec.outputLimit <= 65536);
  const response = await fetch(new URL('/run', url), {
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
  assert(response.ok, 'Sandbox HTTP ' + response.status);
  const results = await response.json();
  assert(results.length === 1);
  return results[0];
}
for (const item of registry.data.items) {
  assert(/^oa-[a-z0-9-]+$/.test(item.id));
  const pkg = read(resolve(root, 'packages', item.id + '.json'));
  assert.equal(hash(JSON.stringify(pkg.data)), item.packageChecksum);
  assert.equal(pkg.data.problem.id, item.id);
  const reference = readFileSync(
    resolve(root, 'references', item.id + '.py'),
    'utf8',
  );
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
      equal(result.files?.stdout || '', test.expectedOutput),
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
      if (!equal(result.files?.stdout || '', test.expectedOutput)) {
        detected = true;
        break;
      }
    }
    assert(detected, item.id + ' surviving mutant ' + mutant.name);
    killed.push(mutant.name);
  }
  report.problems.push({
    id: item.id,
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
writeFileSync(
  process.argv[2] || resolve(root, 'sandbox-report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    event: 'oa_verification_complete',
    problems: report.problems.length,
  }),
);
