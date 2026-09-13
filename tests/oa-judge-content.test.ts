import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ojImportSchema } from '../lib/oj-types';

test('authored OA packages and displayed solutions match sandbox-verified immutable evidence', () => {
  const load = (name: string) => readFileSync('content/oa-judge/' + name);
  const hash = (data: string | Buffer) =>
    createHash('sha256').update(data).digest('hex');
  const registryBytes = load('registry.json');
  const registry = JSON.parse(registryBytes.toString());
  const report = JSON.parse(load('sandbox-report.json').toString());
  const catalog = JSON.parse(
    readFileSync('content/oa-master/catalog.json', 'utf8'),
  );
  assert.equal(report.registrySha256, hash(registryBytes));
  assert.equal(report.engine, 'go-judge');
  assert.equal(report.allPassed, true);
  assert.equal(registry.items.length, 6);
  assert.equal(report.problems.length, 6);
  for (const entry of registry.items) {
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
      catalog.items.find((p: { id: string }) => p.id === entry.id).contentHash,
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
    assert.match(entry.editorial, /为什么正确/);
  }
});
