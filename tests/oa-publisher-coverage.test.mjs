import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const repository = resolve(import.meta.dirname, '..');
const batch = 'ericsson-1-exhaustive';
const id = 'oa-ericsson-1';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => readFileSync(resolve(repository, 'content/oa-judge', path));

test('publisher accepts exact exhaustive evidence and fails closed on invalid coverage', async (t) => {
  const root = mkdtempSync(resolve(tmpdir(), 'cswork-oa-publisher-coverage-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const executable = resolve(root, 'publisher.mjs');
  await build({
    entryPoints: [resolve(repository, 'scripts/publish-oa-judge.ts')],
    outfile: executable,
    bundle: true,
    platform: 'node',
    format: 'esm',
    // Bundling must not trigger the aggregate helper's standalone CLI entry.
    define: { 'import.meta.url': '""' },
    plugins: [{
      name: 'isolated-publisher-persistence',
      setup(builder) {
        builder.onResolve({ filter: /^\.\.\/(db\/sqlite|lib\/server\/oj-problems)$/ },
          (args) => ({ path: args.path, namespace: 'publisher-fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'publisher-fixture' }, (args) => ({
          loader: 'js',
          resolveDir: repository,
          contents: args.path.endsWith('sqlite')
            ? `export const sqlite = () => ({prepare(sql) { return {get() {
                if (sql.includes('FROM user')) return {id:'teacher',name:'Teacher',email:'teacher@example.test',email_verified:1};
                return undefined;
              }}; }});`
            : `import {createHash} from 'node:crypto';
              import {ojImportSchema} from './lib/oj-types.ts';
              export const validateProblemPackage = value => ojImportSchema.parse(value);
              export const problemChecksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
              export const saveProblemDraft = async () => { console.log('FIXTURE_DRAFT_WRITE'); return {draft:{revision:1}}; };
              export const publishProblemDraft = async () => { console.log('FIXTURE_PUBLISH_WRITE'); };`,
        }));
      },
    }],
  });

  for (const fault of ['none', 'sampled', 'missing-declaration', 'missing-input',
    'duplicate-input', 'oracle-hash', 'report-count', 'sampled-report-count']) {
    await t.test(fault, () => {
      const directory = resolve(root, fault);
      const save = (path, data) => {
        const target = resolve(directory, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, data);
      };
      const manifest = JSON.parse(read(`batches/${batch}.json`));
      const report = JSON.parse(read(`reports/${batch}.json`));
      const entry = manifest.items[0];
      let oracle = JSON.parse(read(`oracles/${id}.json`));
      if (fault.startsWith('sampled')) {
        delete entry.oracleCoverage;
        oracle = Array.from({ length: 120 }, (_, i) => oracle[i % oracle.length]);
      }
      if (fault === 'missing-declaration') delete entry.oracleCoverage;
      if (fault === 'missing-input') oracle.pop();
      if (fault === 'duplicate-input') oracle[oracle.length - 1] = oracle[0];
      const oracleBytes = JSON.stringify(oracle);
      const manifestBytes = JSON.stringify(manifest);
      const result = report.problems[0];
      result.entrySha256 = hash(JSON.stringify(entry));
      result.oracleSha256 = fault === 'oracle-hash' ? '0'.repeat(64) : hash(oracleBytes);
      result.oracle = fault.endsWith('report-count') ? oracle.length + 1 : oracle.length;
      result.passed = result.oracle + result.formal;
      report.batchSha256 = hash(manifestBytes);
      const prefix = 'content/oa-judge/';
      save(prefix + 'registry.json', manifestBytes);
      save(prefix + `batches/${batch}.json`, manifestBytes);
      save(prefix + `reports/${batch}.json`, JSON.stringify(report));
      save(prefix + `oracles/${id}.json`, oracleBytes);
      for (const [folder, extension] of [['packages', 'json'], ['references', 'py'], ['mutants', 'json']])
        save(prefix + `${folder}/${id}.${extension}`, read(`${folder}/${id}.${extension}`));
      save('content/oa-master/catalog.json', JSON.stringify({items:[{id,contentHash:entry.sourceContentHash}]}));
      const child = spawnSync(process.execPath, [executable, '--batch', batch, 'teacher@example.test'], {
        cwd: directory,
        env: { ...process.env, ADMIN_EMAILS: 'teacher@example.test' },
        encoding: 'utf8',
        timeout: 10000,
      });
      if (fault === 'none' || fault === 'sampled') {
        assert.equal(child.status, 0, child.stderr);
        assert.match(child.stdout, /FIXTURE_PUBLISH_WRITE/);
      } else {
        assert.notEqual(child.status, 0, fault);
        assert.doesNotMatch(child.stdout, /FIXTURE_.*WRITE/, 'invalid evidence must not write a draft or publish');
        assert.match(child.stderr, /AssertionError/);
      }
    });
  }
});
