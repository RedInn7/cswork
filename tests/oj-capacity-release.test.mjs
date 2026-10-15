import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('failed queue drain restores queue without touching running services', () => {
  const script = readFileSync(new URL('../deploy/oj-capacity-release.sh', import.meta.url), 'utf8');
  const begin = script.indexOf('finish() {');
  const end = script.indexOf('\ntrap finish EXIT', begin);
  assert(begin > 0 && end > begin);
  // Exercise the real EXIT handler; every external operation is replaced with a stub.
  const result = spawnSync('/bin/bash', ['-c', `
    complete=false; worker_touched=false; paused=true; renamed=false; runner_stopped=false; switched=false
    node=true; previous=unused; old_runner=unused; rollback=unused
    systemctl() { echo "UNEXPECTED systemctl $*"; }
    docker() { echo "UNEXPECTED docker $*"; }
    install() { echo "UNEXPECTED install $*"; }
    ln() { echo "UNEXPECTED ln $*"; }
    mv() { echo "UNEXPECTED mv $*"; }
    wait_for_judge() { echo 'UNEXPECTED health wait'; }
    queue() { echo "queue $*"; }
    ${script.slice(begin, end)}
    false
    finish
  `], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stdout, /UNEXPECTED/);
  assert.match(result.stdout, /queue resume/);
  assert(script.indexOf('worker_touched=true') > script.lastIndexOf('queue pause'));
});

test('the worker reaches no lazy import: its bundle ships as one file', () => {
  // vite.worker.config.ts splits a dynamic import into dist/oj-worker/assets, which neither
  // scripts/package-oj-worker.mjs nor this release ships: the worker would throw ERR_MODULE_NOT_FOUND.
  const root = fileURLToPath(new URL('..', import.meta.url));
  const seen = new Set();
  const lazy = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, spec] of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g)) lazy.push(`${relative(root, file)} -> ${spec}`);
    // Static imports and re-exports; type-only ones are erased.
    for (const [, spec] of source.matchAll(/^(?:import(?!\s+type\s)|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]/gm)) {
      if (!spec || !(spec.startsWith('.') || spec.startsWith('@/')) || spec.endsWith('.json')) continue;
      const base = spec.startsWith('@/') ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      const found = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts'].map((ext) => base + ext).find((f) => existsSync(f) && !f.endsWith('/'));
      assert(found, `${relative(root, file)} imports ${spec}`);
      if (!seen.has(found) && /\.[mc]?[jt]sx?$/.test(found)) visit(found);
    }
  };
  visit(resolve(root, 'lib/server/oj-worker.ts'));
  assert(seen.has(resolve(root, 'lib/server/company-follows.ts')));
  // submissionDetail's contest check: the worker imports oj-submissions but never calls it.
  assert.deepEqual(lazy, ['lib/server/oj-submissions.ts -> ./contests']);
});
