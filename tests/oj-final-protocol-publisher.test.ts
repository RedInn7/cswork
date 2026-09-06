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
const fixtures = [
  {
    id: 49,
    kind: 'json-string-rows',
    checker: 'strings-lc-49',
    field: 'stringStructureId',
    args: [['eat', 'tea']],
    value: [['eat', 'tea']],
    output: '[["eat","tea"]]\n',
  },
  {
    id: 142,
    kind: 'integer',
    checker: 'tokens',
    field: 'specialId',
    args: [[1], 0],
    value: 0,
    output: '0\n',
  },
  {
    id: 1095,
    kind: 'integer',
    checker: 'tokens',
    field: 'auxiliaryId',
    args: [1, [1, 2, 1]],
    value: 0,
    output: '0\n',
  },
  {
    id: 380,
    kind: 'string',
    checker: 'design-lc-380',
    field: 'complexDesignId',
    args: [
      ['RandomizedSet', 'insert', 'getRandom'],
      [[], [1], []],
    ],
    value: '[null,1,1]',
    output: '[null,1,1]\n',
  },
  {
    id: 166,
    kind: 'string',
    checker: 'fraction-lc-166',
    field: null,
    args: [1, 3],
    value: '0.(3)',
    output: '0.(3)\n',
  },
  {
    id: 4,
    kind: 'float',
    checker: 'float',
    field: null,
    args: [[1], [2]],
    value: 1.5,
    output: '1.5\n',
  },
];
void test('publisher binds final protocols and preserves legacy integer sidecars', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'final-publisher-'));
  const db = new Database(resolve(dir, 'test.sqlite'));
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@example.test',1,1,1)",
  ).run();
  db.close();
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  try {
    for (const f of fixtures) {
      for (const fault of f.field
        ? ['none', 'report', 'package', 'oracle']
        : ['none', 'kind']) {
        const metadata = f.field ? { [f.field]: f.id } : {};
        const payload = {
          schemaVersion: 1,
          problem: {
            id: `lc-${f.id}`,
            courseId: 'gomall',
            lessonId: '00-overview',
            title: 'Fixture',
            difficulty: '中等',
            tags: ['fixture'],
            description: 'Fixture',
            input: 'JSON',
            output: 'Result',
            explanation: 'Fixture',
            hints: [],
            timeLimit: 2,
            memoryLimit: 262144,
            outputLimit: 64,
            checker: f.checker,
            ...metadata,
            languages: ['python'],
          },
          cases: [false, true].map((hidden, i) => ({
            name: String(i),
            input: JSON.stringify(f.args),
            expectedOutput: f.output,
            hidden,
            weight: 1,
          })),
        };
        if (f.field && fault === 'package')
          Object.assign(payload.problem, { [f.field]: 999 });
        const oracle = {
          resultKind: f.kind,
          oracleEncoding: 'jsonl-v1',
          ...metadata,
          args: Array.from({ length: 120 }, () => f.args),
          expected: Array(120).fill(f.value),
        };
        if (f.field && fault === 'oracle')
          Object.assign(oracle, { [f.field]: 999 });
        const raw = JSON.stringify(payload),
          oracleRaw = JSON.stringify(oracle);
        const record = {
          problemId: `lc-${f.id}`,
          packageFile: `lc-${f.id}.json`,
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
          resultKind: fault === 'kind' ? 'integer' : f.kind,
          oracleEncoding: 'jsonl-v1',
          checker: f.checker,
          ...metadata,
          resourceLimits: {
            timeLimit: 2,
            memoryLimit: 262144,
            outputLimit: 64,
          },
        };
        const entry = {
          ...record,
          id: record.problemId,
          status: 'verified',
          wrapperSha256: record.runnerSha256,
          checks: Array.from({ length: 5 }, () => ({ passed: true })),
        };
        if (f.field && fault === 'report')
          Object.assign(entry, { [f.field]: 999 });
        const manifest = {
            verifiedAt: 'fixture',
            sourceHashesFileSha256: '4'.repeat(64),
            problems: [record],
          },
          report = {
            allPassed: true,
            engine: 'go-judge',
            finishedAt: 'fixture',
            sourceHashesFileSha256: '4'.repeat(64),
            problems: [entry],
          };
        for (const [name, value] of [
          [`lc-${f.id}.json`, raw],
          [`lc-${f.id}.oracle.json`, oracleRaw],
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
        assert.notEqual(child.status, 0, `${f.id} ${fault}`);
        if (fault === 'none')
          assert.match(
            child.stderr,
            /Source library changed or is missing/,
            `${f.id}: ${child.stderr}`,
          );
        else
          assert.doesNotMatch(
            child.stderr,
            /Source library changed or is missing/,
            `${f.id} ${fault}`,
          );
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
