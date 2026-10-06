import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadCandidateScope } from '../scripts/oa-judge/aggregate-batches.mjs';

function fixture(t, runtimeIds = ['oa-live-1']) {
  const root = mkdtempSync(resolve(tmpdir(), 'cswork-oa-candidate-scope-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ['candidate-batches'])
    mkdirSync(resolve(root, folder), { recursive: true });
  const save = (path, items) =>
    writeFileSync(
      resolve(root, path),
      JSON.stringify({ schemaVersion: 1, items }),
    );
  save('registry.json', runtimeIds.map((id) => ({ id })));
  save('candidate-batches/candidate.json', [
    { id: 'oa-candidate-1', sourceContentHash: 'source-hash' },
  ]);
  return root;
}

test('candidate batches can be selected before runtime promotion', (t) => {
  const root = fixture(t);
  const scope = loadCandidateScope(root, 'candidate');
  assert.equal(scope.batch, 'candidate');
  assert.equal(scope.data.items[0].id, 'oa-candidate-1');
});

test('candidate batches cannot shadow runtime entries', (t) => {
  const root = fixture(t, ['oa-candidate-1']);
  assert.throws(
    () => loadCandidateScope(root, 'candidate'),
    /Candidate already in runtime registry/,
  );
});
