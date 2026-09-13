import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { coverage } from '../scripts/oa-judge/coverage.mjs';
import { digest } from '../scripts/oa-judge/aggregate-batches.mjs';

const id = 'oa-fixture-1';
const batch = 'fixture';

/** Minimal immutable-evidence fixture; never reads or writes production content. */
function fixture(t, { report = true } = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), 'cswork-oa-coverage-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = resolve(directory, 'judge');
  for (const folder of [
    'batches',
    'reviews',
    'reports',
    'packages',
    'references',
    'oracles',
    'mutants',
  ]) {
    mkdirSync(resolve(root, folder), { recursive: true });
  }
  function json(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }
  const catalogPath = resolve(directory, 'catalog.json');
  const sourceHash = digest('original fixture statement');
  json(catalogPath, {
    schemaVersion: 1,
    source: { commit: 'fixture-source-commit' },
    items: [
      { id, companySlug: 'fixture', contentHash: sourceHash },
      {
        id: 'oa-fixture-2',
        companySlug: 'fixture',
        contentHash: digest('unreviewed'),
      },
      {
        id: 'oa-fixture-3',
        companySlug: 'fixture',
        contentHash: digest('blocked'),
      },
    ],
  });
  const code = 'print(1)\n';
  const pkg = {
    schemaVersion: 1,
    problem: { id, checker: 'tokens' },
    cases: Array.from({ length: 23 }, (_, index) => ({
      name: `case-${index}`,
      input: `${index}\n`,
      expectedOutput: '1\n',
      hidden: index >= 3,
      weight: 1,
    })),
  };
  const oracle = Array.from({ length: 120 }, (_, index) => ({
    input: `${index}\n`,
    expectedOutput: '1\n',
  }));
  const mutants = [
    { name: 'wrong-zero', code: 'print(0)\n' },
    { name: 'wrong-two', code: 'print(2)\n' },
  ];
  json(resolve(root, 'packages', `${id}.json`), pkg);
  json(resolve(root, 'oracles', `${id}.json`), oracle);
  json(resolve(root, 'mutants', `${id}.json`), mutants);
  writeFileSync(resolve(root, 'references', `${id}.py`), code);
  const entry = {
    id,
    sourceContentHash: sourceHash,
    packageChecksum: digest(JSON.stringify(pkg)),
    editorial: 'Fixture only.',
    authoredSolutions: [{ language: 'python', code }],
  };
  const manifest = { schemaVersion: 1, items: [entry] };
  json(resolve(root, 'registry.json'), manifest);
  json(resolve(root, 'batches', `${batch}.json`), manifest);
  json(resolve(root, 'reviews', `${batch}.json`), {
    schemaVersion: 1,
    items: [
      { id, status: 'authored', reason: 'Independently authored fixture.' },
      {
        id: 'oa-fixture-3',
        status: 'blocked',
        reason: 'Source statement is incomplete.',
      },
    ],
  });
  const evidence = {
    schemaVersion: 1,
    engine: 'go-judge',
    allPassed: true,
    batch,
    batchSha256: digest(
      readFileSync(resolve(root, 'batches', `${batch}.json`)),
    ),
    problems: [
      {
        id,
        entrySha256: digest(JSON.stringify(entry)),
        packageSha256: digest(
          readFileSync(resolve(root, 'packages', `${id}.json`)),
        ),
        referenceSha256: digest(code),
        oracleSha256: digest(
          readFileSync(resolve(root, 'oracles', `${id}.json`)),
        ),
        mutantsSha256: digest(
          readFileSync(resolve(root, 'mutants', `${id}.json`)),
        ),
        passed: oracle.length + pkg.cases.length,
        formal: pkg.cases.length,
        oracle: oracle.length,
        killed: mutants.map((mutant) => mutant.name),
      },
    ],
  };
  const reportPath = resolve(root, 'reports', `${batch}.json`);
  if (report) json(reportPath, evidence);
  return {
    root,
    catalogPath,
    evidence,
    entry,
    manifest,
    json,
    run: () => coverage(root, catalogPath),
    saveReport: () => json(reportPath, evidence),
  };
}

test('valid sandbox evidence is verified without mislabeling unreviewed or blocked entries', (t) => {
  const f = fixture(t);
  const result = f.run();
  assert.deepEqual(result.totals, {
    total: 3,
    sandbox_verified: 1,
    awaiting_sandbox: 0,
    blocked: 1,
    unreviewed: 1,
  });
  assert.deepEqual(
    result.items.map(({ id, status }) => ({ id, status })),
    [
      { id, status: 'sandbox_verified' },
      { id: 'oa-fixture-2', status: 'unreviewed' },
      { id: 'oa-fixture-3', status: 'blocked' },
    ],
  );
  assert.match(result.note, /不等于已线上发布/);
});

test('an authored package without a sandbox report is only awaiting_sandbox', (t) => {
  const f = fixture(t, { report: false });
  const result = f.run();
  assert.equal(result.items[0].status, 'awaiting_sandbox');
  assert.equal(result.totals.sandbox_verified, 0);
  assert.equal(result.items[1].status, 'unreviewed');
  assert.equal(result.items[2].status, 'blocked');
});

test('killed program order is irrelevant when every real program is accounted for', (t) => {
  const f = fixture(t);
  f.evidence.problems[0].killed.reverse();
  f.saveReport();
  assert.equal(f.run().items[0].status, 'sandbox_verified');
});

test('an unsuccessful sandbox report cannot claim verification', (t) => {
  const f = fixture(t);
  f.evidence.allPassed = false;
  f.saveReport();
  assert.throws(f.run, /Successful sandbox evidence required/);
});

for (const [name, mutate] of [
  [
    'passed total',
    (e) => {
      e.passed += 1;
    },
  ],
  [
    'oracle count even when passed is adjusted',
    (e) => {
      e.oracle += 1;
      e.passed += 1;
    },
  ],
  [
    'formal count even when passed is adjusted',
    (e) => {
      e.formal += 1;
      e.passed += 1;
    },
  ],
  [
    'fewer than two killed programs',
    (e) => {
      e.killed = ['wrong-zero'];
    },
  ],
  [
    'duplicate killed names',
    (e) => {
      e.killed = ['wrong-zero', 'wrong-zero'];
    },
  ],
  [
    'fabricated killed names',
    (e) => {
      e.killed = ['not-a-real-mutant', 'also-fabricated'];
    },
  ],
  [
    'extra fabricated killed result',
    (e) => {
      e.killed.push('third-program-never-run');
    },
  ],
  [
    'a string in place of the killed array',
    (e) => {
      e.killed = 'ab';
    },
  ],
]) {
  test(`rejects tampered ${name}`, (t) => {
    const f = fixture(t);
    mutate(f.evidence.problems[0]);
    f.saveReport();
    assert.throws(f.run);
  });
}

for (const [folder, extension] of [
  ['packages', '.json'],
  ['oracles', '.json'],
  ['mutants', '.json'],
  ['references', '.py'],
]) {
  test(`rejects changed ${folder} bytes even when JSON semantics are unchanged`, (t) => {
    const f = fixture(t);
    const path = resolve(f.root, folder, id + extension);
    writeFileSync(path, readFileSync(path, 'utf8') + '\n');
    assert.throws(f.run);
  });
}

test('rejects a changed batch fingerprint', (t) => {
  const f = fixture(t);
  f.evidence.batchSha256 = '0'.repeat(64);
  f.saveReport();
  assert.throws(f.run, /revalidation/);
});

test('cannot classify a registered package as blocked', (t) => {
  const f = fixture(t);
  f.json(resolve(f.root, 'reviews', `${batch}.json`), {
    schemaVersion: 1,
    items: [{ id, status: 'blocked', reason: 'Contradictory review.' }],
  });
  assert.throws(f.run, /Blocked problem must not be registered/);
});

test('an authored review without a package fails closed instead of claiming verification', (t) => {
  const f = fixture(t);
  f.json(resolve(f.root, 'reviews', `${batch}.json`), {
    schemaVersion: 1,
    items: [
      { id: 'oa-fixture-2', status: 'authored', reason: 'Missing package.' },
    ],
  });
  assert.throws(f.run, /Authored review has no registered package/);
});
