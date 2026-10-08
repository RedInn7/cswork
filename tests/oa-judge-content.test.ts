import {
  readReferenceProgram,
  assertReferenceEvidence,
  mutantProgram,
} from '../scripts/oa-judge/reference-program.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ojImportSchema } from '../lib/oj-types';
import {
  aggregateBatches,
  loadScope,
  defaultReportPath,
  assertScopeEvidence,
  digest,
} from '../scripts/oa-judge/aggregate-batches.mjs';
import { assertOracleCoverage } from '../scripts/oa-judge/oracle-coverage.mjs';

test('authored OA packages and displayed solutions match sandbox-verified immutable evidence', () => {
  const load = (name: string) => readFileSync('content/oa-judge/' + name);
  const hash = (data: string | Buffer) =>
    createHash('sha256').update(data).digest('hex');
  const registryBytes = load('registry.json');
  const registry = JSON.parse(registryBytes.toString());
  const catalog = JSON.parse(
    readFileSync('content/oa-master/catalog.json', 'utf8'),
  );
  const root = resolve('content/oa-judge');
  assert.deepEqual(registry, aggregateBatches(root));
  assert(registry.items.length >= 6);
  const candidateIds = new Set<string>();
  const candidateDirectory = resolve(root, 'candidate-batches');
  for (const file of (existsSync(candidateDirectory)
    ? readdirSync(candidateDirectory)
    : []
  ).filter((name) => name.endsWith('.json'))) {
    const candidate = JSON.parse(
      readFileSync(resolve(root, 'candidate-batches', file), 'utf8'),
    );
    for (const item of candidate.items) candidateIds.add(item.id);
  }
  assert(
    registry.items.every((item: { id: string }) => !candidateIds.has(item.id)),
    'Unverified candidates must remain outside the runtime registry',
  );
  for (const file of readdirSync(resolve(root, 'batches')).filter((file) =>
    file.endsWith('.json'),
  )) {
    const batch = file.slice(0, -5);
    const scope = loadScope(root, batch);
    const report = JSON.parse(
      readFileSync(defaultReportPath(root, batch), 'utf8'),
    );
    assertScopeEvidence(scope, report);
    for (const entry of scope.data.items) {
      assert.match(entry.id, /^oa-[a-z0-9-]+$/);
      const bytes = load('packages/' + entry.id + '.json');
      const pkg = ojImportSchema.parse(JSON.parse(bytes.toString()));
      const evidence = report.problems.find(
        (p: { id: string }) => p.id === entry.id,
      );
      assert(evidence);
      assert.equal(entry.packageChecksum, hash(JSON.stringify(pkg)));
      assert.equal(evidence.packageSha256, hash(bytes));
      assert.equal(
        entry.sourceContentHash,
        catalog.items.find((p: { id: string }) => p.id === entry.id)
          .contentHash,
      );
      const program = readReferenceProgram(root, entry);
      assertReferenceEvidence(evidence, program);
      assert(pkg.problem.languages.includes(program.language));
      for (const mutant of JSON.parse(
        load('mutants/' + entry.id + '.json').toString(),
      ))
        mutantProgram(mutant, program);
      assert.equal(
        evidence.oracleSha256,
        hash(load('oracles/' + entry.id + '.json')),
      );
      assert.equal(
        evidence.mutantsSha256,
        hash(load('mutants/' + entry.id + '.json')),
      );
      assertOracleCoverage(
        entry,
        JSON.parse(load('oracles/' + entry.id + '.json').toString()),
        entry.id,
      );
      assert(new Set(evidence.killed).size >= 2);
      assert.equal(evidence.passed, evidence.oracle + pkg.cases.length);
      assert(pkg.cases.filter((c) => c.hidden).length >= 20);
      assert.match(entry.editorial, /^## (?:为什么正确|正确性(?:证明)?)\s*$/m);
    }
  }
});

test('DoorDash #4 Discount Events is available as an independently verified OA item', () => {
  const registry = JSON.parse(
    readFileSync('content/oa-judge/registry.json', 'utf8'),
  );
  const entry = registry.items.find(
    (item: { id: string }) => item.id === 'oa-doordash-4',
  );
  assert(entry, 'DoorDash #4 must have its own published item ID');
  assert.equal(
    entry.sourceContentHash,
    '129cf5e454586707eb0e470ed707c84a84c2dcbd373bd8f6ff3ef00389741977',
  );
});

test('Amazon MERN #5 maps to the verified Optimize Box IDs problem, not Amazon #13', () => {
  const registry = JSON.parse(
    readFileSync('content/oa-judge/registry.json', 'utf8'),
  );
  const entry = registry.items.find(
    (item: { id: string }) => item.id === 'oa-amazon-mern-5',
  );
  const evidence = JSON.parse(
    readFileSync(
      'content/oa-judge/source-evidence/amazon-mern5-duplicate.json',
      'utf8',
    ),
  );
  const problem = JSON.parse(
    readFileSync('content/oa-judge/packages/oa-amazon-mern-5.json', 'utf8'),
  ).problem;
  const canonicalProblem = JSON.parse(
    readFileSync('content/oa-judge/packages/oa-amazon-34.json', 'utf8'),
  ).problem;
  assert(entry, 'Amazon MERN #5 must be independently addressable');
  assert.equal(evidence.duplicateOf, 'oa-amazon-34');
  assert.equal(evidence.incorrectSourceLink.title, 'Get Total Balanced');
  assert.equal(entry.sourceContentHash, evidence.sourceContentHash);
  assert.equal(problem.id, entry.id);
  assert.equal(problem.output, '输出字典序最小的数字串，保留前导零。');
  assert.equal(canonicalProblem.output, '输出字典序最小的数字串，保留前导零。');
});

test('Point72 #3 stays blocked while the OAMaster sample contradicts its rule', () => {
  const registry = JSON.parse(
    readFileSync('content/oa-judge/registry.json', 'utf8'),
  );
  const batch = JSON.parse(
    readFileSync(
      'content/oa-judge/batches/trading-firms-remaining.json',
      'utf8',
    ),
  );
  const catalog = JSON.parse(
    readFileSync('content/oa-master/catalog.json', 'utf8'),
  );
  const reviews = JSON.parse(
    readFileSync(
      'content/oa-judge/reviews/trading-firms-remaining.json',
      'utf8',
    ),
  );
  const source = catalog.items.find(
    (item: { id: string }) => item.id === 'oa-point72-3',
  );
  const review = reviews.items.find(
    (item: { id: string }) => item.id === 'oa-point72-3',
  );
  assert.match(source.statement, /Input: aaaa Output: zzzz/);
  assert(
    !registry.items.some((item: { id: string }) => item.id === 'oa-point72-3'),
  );
  assert(
    !batch.items.some((item: { id: string }) => item.id === 'oa-point72-3'),
  );
  assert.equal(review.status, 'blocked');
  assert.match(review.reason, /样例与题意冲突/);
});

test('Amazon #363 generator does not recreate a candidate for an already-promoted item', () => {
  const candidate =
    'content/oa-judge/candidate-batches/amazon-363-recovered.json';
  assert(!existsSync(candidate));
  const output = execFileSync(
    'python3',
    ['scripts/oa-judge/batches/amazon_363_recovered.py'],
    { encoding: 'utf8' },
  );
  assert.match(output, /oa-amazon-363: already promoted/);
  assert(!existsSync(candidate));
});

test('batch evidence is isolated, complete and cannot authorize new or drifted entries', () => {
  const entry = {
    id: 'oa-fixture-1',
    sourceContentHash: 'a'.repeat(64),
    packageChecksum: 'b'.repeat(64),
    editorial: 'test',
    authoredSolutions: [],
  };
  const scope = {
    batch: 'google-next',
    sha256: 'c'.repeat(64),
    data: { schemaVersion: 1, items: [entry] },
  };
  const report = {
    schemaVersion: 1,
    engine: 'go-judge',
    allPassed: true,
    batch: 'google-next',
    batchSha256: scope.sha256,
    problems: [{ id: entry.id, entrySha256: digest(JSON.stringify(entry)) }],
  };
  assert.doesNotThrow(() => assertScopeEvidence(scope, report));
  assert.throws(() => assertScopeEvidence(scope, null), /evidence required/);
  assert.throws(() =>
    assertScopeEvidence(scope, { ...report, allPassed: false }),
  );
  assert.throws(() =>
    assertScopeEvidence(scope, { ...report, batch: 'first-google' }),
  );
  assert.throws(() =>
    assertScopeEvidence({ ...scope, sha256: 'd'.repeat(64) }, report),
  );
  assert.throws(() => assertScopeEvidence(scope, { ...report, problems: [] }));
  assert.throws(() =>
    assertScopeEvidence(
      {
        ...scope,
        data: { ...scope.data, items: [{ ...entry, editorial: 'changed' }] },
      },
      report,
    ),
  );
  assert.throws(
    () =>
      assertScopeEvidence(scope, {
        ...report,
        batch: undefined,
        registrySha256: scope.sha256,
      }),
    /own sandbox report/,
  );
  // Legacy evidence is restricted to the byte-identical original first batch.
  const legacy = {
    schemaVersion: 1,
    engine: 'go-judge',
    allPassed: true,
    registrySha256: scope.sha256,
    problems: [{ id: entry.id }],
  };
  assert.doesNotThrow(() =>
    assertScopeEvidence({ ...scope, batch: 'first-google' }, legacy),
  );
  assert.throws(() =>
    assertScopeEvidence(
      { ...scope, batch: 'first-google', sha256: 'd'.repeat(64) },
      legacy,
    ),
  );
});
