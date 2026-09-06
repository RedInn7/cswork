import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
void test('offline publisher binds semantic identity, checker, type, input and oracle', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'semantic-publisher-'));
  const db = new Database(resolve(dir, 'test.sqlite'));
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@example.test',1,1,1)",
  ).run();
  db.close();
  const hash = (v: string) => createHash('sha256').update(v).digest('hex');
  try {
    for (const fault of [
      'none',
      'report-id',
      'package-id',
      'sidecar-id',
      'kind',
      'bad-oracle',
      'bad-input',
      'wrong-checker',
    ]) {
      const payload = {
        schemaVersion: 1,
        problem: {
          id: 'lc-5',
          courseId: 'gomall',
          lessonId: '00-overview',
          title: 'Palindrome',
          difficulty: '中等',
          tags: ['fixture'],
          description: 'Palindrome',
          input: 'JSON',
          output: 'Line',
          explanation: 'Example',
          hints: [],
          timeLimit: 2,
          memoryLimit: 262144,
          outputLimit: 64,
          checker: 'semantic-lc-5',
          semanticId: 5,
          languages: ['python'],
        },
        cases: [
          {
            name: 'sample',
            input: '["babad"]',
            expectedOutput: 'bab\n',
            hidden: false,
            weight: 1,
          },
          {
            name: 'hidden',
            input: '["babad"]',
            expectedOutput: 'aba\n',
            hidden: true,
            weight: 1,
          },
        ],
      };
      if (fault === 'package-id') payload.problem.semanticId = 1044;
      if (fault === 'bad-input') payload.cases[0].input = '["xyz"]';
      const oracle = {
        resultKind: 'string',
        oracleEncoding: 'jsonl-v1',
        semanticId: fault === 'sidecar-id' ? 1044 : 5,
        args: Array.from({ length: 120 }, () => ['babad']),
        expected: Array(120).fill(fault === 'bad-oracle' ? 'xyz' : 'bab'),
      };
      const raw = JSON.stringify(payload),
        oracleRaw = JSON.stringify(oracle);
      const record = {
        problemId: 'lc-5',
        packageFile: 'lc-5.json',
        packageSha256: hash(raw),
        inputBytesSha256: hash(raw),
        sourceContentHash: '0'.repeat(64),
        verified: true,
        referenceSha256: '1'.repeat(64),
        runnerSha256: '2'.repeat(64),
        referenceBytesSha256: '2'.repeat(64),
        mutationSha256: '3'.repeat(64),
        oracleSha256: hash(oracleRaw),
        counts: { formal: 2, oracle: 120, negativeControls: 2 },
        resultKind: fault === 'kind' ? 'integer' : 'string',
        oracleEncoding: 'jsonl-v1',
        checker: fault === 'wrong-checker' ? 'exact' : 'semantic-lc-5',
        semanticId: 5,
        resourceLimits: { timeLimit: 2, memoryLimit: 262144, outputLimit: 64 },
      };
      const manifest = {
        verifiedAt: 'fixture-run',
        sourceHashesFileSha256: '4'.repeat(64),
        problems: [record],
      };
      const report = {
        allPassed: true,
        engine: 'go-judge',
        finishedAt: manifest.verifiedAt,
        sourceHashesFileSha256: manifest.sourceHashesFileSha256,
        problems: [
          {
            ...record,
            id: record.problemId,
            status: 'verified',
            wrapperSha256: record.runnerSha256,
            semanticId: fault === 'report-id' ? 1044 : 5,
            checks: Array.from({ length: 5 }, () => ({ passed: true })),
          },
        ],
      };
      for (const [name, value] of [
        ['lc-5.json', raw],
        ['lc-5.oracle.json', oracleRaw],
        ['manifest.json', JSON.stringify(manifest)],
        ['verification-report.json', JSON.stringify(report)],
      ])
        writeFileSync(resolve(dir, name), value);
      const child = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'scripts/publish-validated-library.ts',
          resolve(dir, 'manifest.json'),
          'teacher@example.test',
        ],
        {
          cwd: resolve('.'),
          env: {
            ...process.env,
            DATABASE_PATH: resolve(dir, 'test.sqlite'),
            ADMIN_EMAILS: 'teacher@example.test',
          },
          encoding: 'utf8',
          timeout: 20000,
        },
      );
      assert.notEqual(child.status, 0, fault);
      if (fault === 'none')
        assert.match(child.stderr, /Source library changed or is missing/);
      else {
        assert.doesNotMatch(
          child.stderr,
          /Source library changed or is missing/,
          fault,
        );
        assert.match(child.stderr, /semantic|Semantic|语义|protocol/i, fault);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
