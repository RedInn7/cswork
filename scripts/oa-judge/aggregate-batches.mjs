/** Shared fail-closed batch bindings. Runtime registry stays schemaVersion 1. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export function batchName(name) {
  assert(
    typeof name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name),
    'Invalid OA batch name',
  );
  return name;
}
export function readRegistry(path) {
  const bytes = readFileSync(path);
  assert(bytes.length < 16 * 1024 * 1024, 'OA manifest too large');
  const data = JSON.parse(bytes.toString());
  assert(
    data.schemaVersion === 1 &&
      Array.isArray(data.items) &&
      data.items.length > 0,
    'Invalid OA manifest',
  );
  const ids = new Set();
  for (const item of data.items) {
    assert(
      /^oa-[a-z0-9-]+$/.test(item.id) && !ids.has(item.id),
      'Invalid or duplicate OA ID',
    );
    ids.add(item.id);
  }
  return { bytes, data, sha256: digest(bytes) };
}
export function aggregateBatches(root) {
  const files = readdirSync(resolve(root, 'batches'))
    .filter((file) => file.endsWith('.json'))
    .sort();
  assert(files.length > 0, 'No OA batches');
  const items = [],
    ids = new Set();
  for (const file of files) {
    batchName(file.slice(0, -5));
    for (const item of readRegistry(resolve(root, 'batches', file)).data
      .items) {
      assert(
        !ids.has(item.id),
        'OA ID belongs to multiple batches: ' + item.id,
      );
      ids.add(item.id);
      items.push(item);
    }
  }
  return { schemaVersion: 1, items };
}
export function loadScope(root, batch = null) {
  const runtime = readRegistry(resolve(root, 'registry.json'));
  if (!batch) return { ...runtime, batch: null };
  const selected = readRegistry(
    resolve(root, 'batches', batchName(batch) + '.json'),
  );
  const runtimeItems = new Map(
    runtime.data.items.map((item) => [item.id, item]),
  );
  for (const item of selected.data.items)
    assert.deepEqual(
      runtimeItems.get(item.id),
      item,
      'Batch differs from aggregated runtime entry: ' + item.id,
    );
  return { ...selected, batch };
}
export function defaultReportPath(root, batch = null) {
  if (!batch) return resolve(root, 'sandbox-report.json');
  const path = resolve(root, 'reports', batchName(batch) + '.json');
  // The immutable first manifest is an exact copy of the original registry.
  // Its legacy report remains valid only if that exact bytes hash still matches.
  return batch === 'first-google' && !existsSync(path)
    ? resolve(root, 'sandbox-report.json')
    : path;
}
export function assertScopeEvidence(scope, report) {
  assert(
    report &&
      report.schemaVersion === 1 &&
      report.engine === 'go-judge' &&
      report.allPassed === true,
    'Successful sandbox evidence required',
  );
  if (scope.batch && report.batch !== undefined) {
    assert.equal(report.batch, scope.batch, 'Wrong batch evidence');
    assert.equal(
      report.batchSha256,
      scope.sha256,
      'Changed batch requires revalidation',
    );
  } else {
    assert(
      !scope.batch || scope.batch === 'first-google',
      'A new batch requires its own sandbox report',
    );
    assert.equal(
      report.registrySha256,
      scope.sha256,
      'Changed registry requires revalidation',
    );
  }
  assert(
    Array.isArray(report.problems) &&
      report.problems.length === scope.data.items.length,
    'Incomplete batch evidence',
  );
  const ids = new Set(report.problems.map((item) => item.id));
  assert.equal(ids.size, report.problems.length, 'Duplicate evidence');
  for (const item of scope.data.items) {
    const evidence = report.problems.find((result) => result.id === item.id);
    assert(evidence, 'Missing item evidence');
    if (scope.batch && report.batch !== undefined)
      assert.equal(
        evidence.entrySha256,
        digest(JSON.stringify(item)),
        'Changed entry requires revalidation',
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve('content/oa-judge');
  const registry = aggregateBatches(root);
  const target = resolve(root, 'registry.json');
  if (process.argv.includes('--check'))
    assert.deepEqual(
      readRegistry(target).data,
      registry,
      'Run aggregate-batches.mjs to rebuild runtime registry',
    );
  else writeFileSync(target, JSON.stringify(registry, null, 2) + '\n');
  console.log(
    JSON.stringify({
      event: 'oa_batches_aggregated',
      items: registry.items.length,
      check: process.argv.includes('--check'),
    }),
  );
}
