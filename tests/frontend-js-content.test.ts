// The frontend JS track (content/frontend-js, lib/content/frontend-js.json): the manifest is complete
// and current, every problem is bilingual with at least one public case, and its solution passes
// while its starter fails, run through the same harness the browser uses.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import manifest from '../lib/content/frontend-js.json';
import { CONTENT_DIR, GROUPS, HARNESS_FILE, PROBLEMS, runInVm } from '../scripts/frontend-js/build.mjs';

const CJK = /[\u4e00-\u9fff]/;

test('the manifest lists every content folder once, grouped, with the current harness', () => {
  const folders = readdirSync(CONTENT_DIR).sort();
  assert.equal(manifest.problems.length, 40);
  assert.deepEqual(manifest.problems.map((p) => p.slug).sort(), folders);
  assert.deepEqual(new Set(manifest.problems.map((p) => p.slug)).size, 40);
  assert.deepEqual(manifest.groups, GROUPS);
  for (const group of GROUPS) assert.ok(manifest.problems.some((p) => p.group === group.key), group.key);
  assert.equal(manifest.harness, readFileSync(HARNESS_FILE, 'utf8'));
  assert.deepEqual(manifest.problems.map((p) => p.slug), PROBLEMS.map((p) => p.slug));
});

test('every problem is bilingual and has public and hidden cases', () => {
  for (const p of manifest.problems) {
    assert.ok(['easy', 'medium', 'hard'].includes(p.difficulty), p.slug);
    assert.ok(CJK.test(p.title.zh) && !CJK.test(p.title.en), `${p.slug}: titles`);
    assert.ok(CJK.test(p.statement.zh) && CJK.test(p.editorial.zh), `${p.slug}: Chinese text`);
    // English text may quote a CJK sample value, but not whole sentences.
    for (const text of [p.statement.en, p.editorial.en])
      assert.ok((text.match(/[\u4e00-\u9fff]/g) ?? []).length <= 4, `${p.slug}: English text`);
    assert.ok(p.cases.some((c) => c.public), `${p.slug}: a public case`);
    assert.ok(p.cases.length >= 5, `${p.slug}: at least five cases`);
    assert.equal(new Set(p.cases.map((c) => c.name)).size, p.cases.length, `${p.slug}: case names are unique`);
    assert.ok(p.starter.includes('Your code here'), `${p.slug}: starter`);
  }
});

test('every solution passes, every starter fails, and the manifest is current (build --check)', () => {
  // A child process: the starters leave rejected promises unhandled, which node:test would blame on this file.
  const run = spawnSync(process.execPath, ['scripts/frontend-js/build.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /40 problems ok/);
});

test('a wrong answer fails: the cases are not trivially satisfied', async () => {
  const debounce = manifest.problems.find((p) => p.slug === 'debounce')!;
  // Runs at once on every call: a throttle-like mistake.
  const eager = 'function debounce(func, wait) { const d = function (...a) { func.apply(this, a); }; d.cancel = () => {}; return d; }';
  const { results } = await runInVm(manifest.harness, eager, debounce.tests);
  assert.ok(results.some((r: { pass: boolean }) => !r.pass));
  const pool = manifest.problems.find((p) => p.slug === 'promise-pool')!;
  // Waits for each batch of `limit` before starting the next.
  const batches = `async function promisePool(tasks, limit) {
    const out = [];
    for (let i = 0; i < tasks.length; i += limit) out.push(...(await Promise.all(tasks.slice(i, i + limit).map((t) => t()))));
    return out;
  }`;
  const pooled = await runInVm(manifest.harness, batches, pool.tests);
  assert.deepEqual(Array.from(pooled.results.filter((r: { pass: boolean }) => !r.pass), (r: { name: string }) => r.name), [
    'starts the next task as soon as one finishes',
  ]);
});
