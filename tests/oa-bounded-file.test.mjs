import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, openSync, closeSync, ftruncateSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBoundedFileSync } from '../scripts/oa-judge/bounded-file.mjs';
import { readRegistry } from '../scripts/oa-judge/aggregate-batches.mjs';
import { OJ_MAX_IMPORT_BYTES, OA_MAX_METADATA_FILE_BYTES } from '../lib/oj-data-budgets.mjs';

test('file reads check stat before allocation and retain independent package/metadata budgets', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'oa-bounded-file-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'fixture.json');
  writeFileSync(path, '中a');
  assert.equal(readBoundedFileSync(path, 4).toString(), '中a');
  assert.throws(() => readBoundedFileSync(path, 3), /byte budget/);
  assert.equal(OJ_MAX_IMPORT_BYTES, 128 * 1024 * 1024);
  assert.equal(OA_MAX_METADATA_FILE_BYTES, 16 * 1024 * 1024);
  for (const limit of [OA_MAX_METADATA_FILE_BYTES, OJ_MAX_IMPORT_BYTES]) {
    const fd = openSync(path, 'w');
    ftruncateSync(fd, limit + 1);
    closeSync(fd);
    const allocate = t.mock.method(Buffer, 'allocUnsafe', () => { throw new Error('allocated before stat limit'); });
    assert.throws(() => readBoundedFileSync(path, limit), /byte budget/);
    if (limit === OA_MAX_METADATA_FILE_BYTES)
      assert.throws(() => readRegistry(path), /byte budget/);
    assert.equal(allocate.mock.callCount(), 0);
    allocate.mock.restore();
  }
});

test('only verifier packages opt into the 128 MiB file budget', () => {
  const source = readFileSync(new URL('../scripts/verify-oa-judge.mjs', import.meta.url), 'utf8');
  assert.match(source, /maximumBytes = OA_MAX_METADATA_FILE_BYTES/);
  assert.match(source, /read\(\s*resolve\(root, 'packages', item\.id \+ '\.json'\),\s*OJ_MAX_IMPORT_BYTES,?\s*\)/);
  assert.match(source, /read\(resolve\(root, 'oracles', item\.id \+ '\.json'\)\)/);
  assert.match(source, /read\(resolve\(root, 'mutants', item\.id \+ '\.json'\)\)/);
  assert.doesNotMatch(source, /readFileSync/);
});
