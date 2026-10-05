import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
  for (const file of readdirSync(resolve(root, 'candidate-batches')).filter(
    (name) => name.endsWith('.json'),
  )) {
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
      const code = load('references/' + entry.id + '.py');
      assert.equal(entry.authoredSolutions.length, 1);
      assert.equal(entry.authoredSolutions[0].language, 'python');
      assert.equal(entry.authoredSolutions[0].code, code.toString());
      assert.equal(evidence.referenceSha256, hash(code));
      assert.equal(
        evidence.oracleSha256,
        hash(load('oracles/' + entry.id + '.json')),
      );
      assert.equal(
        evidence.mutantsSha256,
        hash(load('mutants/' + entry.id + '.json')),
      );
      assert(evidence.oracle >= 120 && new Set(evidence.killed).size >= 2);
      assert.equal(evidence.passed, evidence.oracle + pkg.cases.length);
      assert(pkg.cases.filter((c) => c.hidden).length >= 20);
      assert.match(entry.editorial, /^## (?:为什么正确|正确性(?:证明)?)\s*$/m);
    }
  }
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
