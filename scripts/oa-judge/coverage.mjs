/** Deterministic inventory; sandbox verification is not a claim of production publication. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertScopeEvidence,
  defaultReportPath,
  digest,
  loadScope,
} from './aggregate-batches.mjs';

export function coverage(
  root = resolve('content/oa-judge'),
  catalogPath = resolve('content/oa-master/catalog.json'),
) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const source = new Map(catalog.items.map((item) => [item.id, item]));
  const decisions = new Map();
  const reviews = resolve(root, 'reviews');
  if (existsSync(reviews))
    for (const file of readdirSync(reviews)
      .filter((name) => name.endsWith('.json'))
      .sort()) {
      const review = JSON.parse(readFileSync(resolve(reviews, file), 'utf8'));
      assert.equal(review.schemaVersion, 1);
      for (const item of review.items) {
        assert(source.has(item.id), 'Unknown reviewed ID: ' + item.id);
        assert(
          ['authored', 'blocked'].includes(item.status) && item.reason.trim(),
        );
        assert(!decisions.has(item.id), 'Duplicate review: ' + item.id);
        decisions.set(item.id, item);
      }
    }
  const prepared = new Map();
  for (const file of readdirSync(resolve(root, 'batches'))
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const batch = file.slice(0, -5);
    const scope = loadScope(root, batch);
    const reportFile = defaultReportPath(root, batch);
    let report;
    if (existsSync(reportFile)) {
      report = JSON.parse(readFileSync(reportFile, 'utf8'));
      assertScopeEvidence(scope, report);
    }
    for (const entry of scope.data.items) {
      assert.equal(entry.sourceContentHash, source.get(entry.id)?.contentHash);
      assert(!prepared.has(entry.id), 'Duplicate prepared ID');
      const packageBytes = readFileSync(
        resolve(root, 'packages', entry.id + '.json'),
      );
      assert.equal(
        digest(JSON.stringify(JSON.parse(packageBytes))),
        entry.packageChecksum,
      );
      if (report) {
        const evidence = report.problems.find((item) => item.id === entry.id);
        const pkg = JSON.parse(packageBytes);
        const oracle = JSON.parse(
          readFileSync(resolve(root, 'oracles', entry.id + '.json'), 'utf8'),
        );
        assert.equal(entry.authoredSolutions.length, 1);
        assert.equal(entry.authoredSolutions[0].language, 'python');
        assert.equal(
          entry.authoredSolutions[0].code,
          readFileSync(resolve(root, 'references', entry.id + '.py'), 'utf8'),
        );
        assert(evidence.oracle >= 120 && evidence.oracle === oracle.length);
        assert.equal(evidence.formal, pkg.cases.length);
        assert.equal(evidence.passed, evidence.oracle + evidence.formal);
        const mutants = JSON.parse(
          readFileSync(resolve(root, 'mutants', entry.id + '.json'), 'utf8'),
        );
        assert(Array.isArray(mutants) && mutants.length >= 2);
        assert(
          mutants.every(
            (item) =>
              typeof item.name === 'string' &&
              item.name &&
              typeof item.code === 'string' &&
              item.code,
          ),
        );
        const names = mutants.map((item) => item.name).sort();
        assert.equal(
          new Set(names).size,
          names.length,
          'Unique incorrect programs required',
        );
        assert(
          Array.isArray(evidence.killed) &&
            evidence.killed.every((name) => typeof name === 'string'),
        );
        assert.deepEqual(
          [...evidence.killed].sort(),
          names,
          'Every incorrect program must be rejected',
        );
        assert(pkg.cases.filter((item) => item.hidden).length >= 20);
        for (const [folder, extension, field] of [
          ['packages', '.json', 'packageSha256'],
          ['references', '.py', 'referenceSha256'],
          ['oracles', '.json', 'oracleSha256'],
          ['mutants', '.json', 'mutantsSha256'],
        ])
          assert.equal(
            digest(readFileSync(resolve(root, folder, entry.id + extension))),
            evidence[field],
            entry.id + ': stale evidence',
          );
      }
      prepared.set(entry.id, {
        batch,
        status: report ? 'sandbox_verified' : 'awaiting_sandbox',
      });
    }
  }
  // Candidate batches keep author-verified work visible to the coverage
  // inventory without adding its solutions to the runtime registry. Only a
  // real go-judge report can promote a candidate into `batches/`.
  const candidates = resolve(root, 'candidate-batches');
  if (existsSync(candidates))
    for (const file of readdirSync(candidates)
      .filter((name) => name.endsWith('.json'))
      .sort()) {
      const batch = file.slice(0, -5);
      const manifest = JSON.parse(
        readFileSync(resolve(candidates, file), 'utf8'),
      );
      assert.equal(manifest.schemaVersion, 1);
      assert(Array.isArray(manifest.items) && manifest.items.length > 0);
      for (const entry of manifest.items) {
        assert(source.has(entry.id), 'Unknown candidate ID: ' + entry.id);
        assert.equal(
          entry.sourceContentHash,
          source.get(entry.id)?.contentHash,
        );
        assert(!prepared.has(entry.id), 'Duplicate prepared ID: ' + entry.id);
        const packageBytes = readFileSync(
          resolve(root, 'packages', entry.id + '.json'),
        );
        const pkg = JSON.parse(packageBytes);
        assert.equal(digest(JSON.stringify(pkg)), entry.packageChecksum);
        assert.equal(pkg.problem.id, entry.id);
        assert.equal(entry.authoredSolutions.length, 1);
        assert.equal(entry.authoredSolutions[0].language, 'python');
        assert.equal(
          entry.authoredSolutions[0].code,
          readFileSync(resolve(root, 'references', entry.id + '.py'), 'utf8'),
        );
        const oracle = JSON.parse(
          readFileSync(resolve(root, 'oracles', entry.id + '.json'), 'utf8'),
        );
        assert(
          oracle.length >= 120,
          'Candidate oracle coverage required: ' + entry.id,
        );
        const mutants = JSON.parse(
          readFileSync(resolve(root, 'mutants', entry.id + '.json'), 'utf8'),
        );
        assert(Array.isArray(mutants) && mutants.length >= 2);
        const validation = JSON.parse(
          readFileSync(resolve(root, 'validation', batch + '.json'), 'utf8'),
        );
        const evidence = validation.problems.find(
          (item) => item.id === entry.id,
        );
        assert(evidence && evidence.oracleCases === oracle.length);
        assert(evidence.negativeControls.length >= 2);
        assert(
          evidence.negativeControls.every(
            (item) => item.rejectedByCases.length > 0,
          ),
        );
        prepared.set(entry.id, { batch, status: 'awaiting_sandbox' });
      }
    }
  // Preserve historical blocked reviews; an explicit source-bound resolution
  // may replace their current decision only after a real package is registered.
  const resolutions = resolve(root, 'resolutions');
  const resolved = new Set();
  if (existsSync(resolutions))
    for (const file of readdirSync(resolutions)
      .filter((name) => name.endsWith('.json'))
      .sort()) {
      const document = JSON.parse(
        readFileSync(resolve(resolutions, file), 'utf8'),
      );
      assert.equal(document.schemaVersion, 1);
      for (const item of document.items) {
        assert(!resolved.has(item.id), 'Duplicate resolution: ' + item.id);
        assert(source.has(item.id), 'Unknown resolved ID: ' + item.id);
        const previous = decisions.get(item.id);
        assert(
          previous?.status === 'blocked',
          'Resolution must address a blocked review: ' + item.id,
        );
        assert.equal(
          item.previousReason,
          previous.reason,
          'Stale blocked reason: ' + item.id,
        );
        assert.equal(
          item.sourceContentHash,
          source.get(item.id).contentHash,
          'Stale resolution source: ' + item.id,
        );
        assert(
          typeof item.reason === 'string' && item.reason.trim(),
          'Resolution reason required',
        );
        assert(
          prepared.has(item.id) && prepared.get(item.id).batch === item.batch,
          'Resolution requires its registered batch: ' + item.id,
        );
        decisions.set(item.id, {
          id: item.id,
          status: 'authored',
          reason: item.reason,
        });
        resolved.add(item.id);
      }
    }
  const items = catalog.items.map((item) => {
    const decision = decisions.get(item.id);
    const authored = prepared.get(item.id);
    if (decision?.status === 'authored')
      assert(authored, 'Authored review has no registered package: ' + item.id);
    if (decision?.status === 'blocked')
      assert(!authored, 'Blocked problem must not be registered: ' + item.id);
    return {
      id: item.id,
      company: item.companySlug,
      status:
        authored?.status ||
        (decision?.status === 'blocked' ? 'blocked' : 'unreviewed'),
      ...(authored ? { batch: authored.batch } : {}),
      ...(decision ? { reason: decision.reason } : {}),
    };
  });
  const totals = {
    total: items.length,
    sandbox_verified: 0,
    awaiting_sandbox: 0,
    blocked: 0,
    unreviewed: 0,
  };
  for (const item of items) totals[item.status]++;
  return {
    schemaVersion: 1,
    sourceCommit: catalog.source.commit,
    note: '沙箱通过不等于已线上发布；未审阅不等于题目有错。',
    totals,
    items,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = coverage();
  const file = resolve('content/oa-judge/coverage.json');
  if (process.argv.includes('--check'))
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), result);
  else writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.totals));
}
