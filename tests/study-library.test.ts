import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
const dir = mkdtempSync(resolve(tmpdir(), 'study-library-'));
process.env.DATABASE_PATH = resolve(dir, 'db.sqlite');
const { sqlite } = await import('../db/sqlite');
const { listStudyLibrary, getStudyLibrary } =
  await import('../lib/server/study-library');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');
const source = {
  id: 'lc-3',
  number: 3,
  slug: 'longest-substring-without-repeating-characters',
  titleZh: '无重复字符的最长子串',
  titleEn: 'Longest Substring Without Repeating Characters',
  difficulty: '中等',
  topics: ['滑动窗口与双指针'],
  descriptionZh: '题面',
  descriptionEn: 'Statement',
  sourceUrl:
    'https://leetcode.cn/problems/longest-substring-without-repeating-characters/',
  sourceEnUrl:
    'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
  attribution: 'doocs CC BY-SA 4.0',
  signature: { name: 'lengthOfLongestSubstring' },
  codeSnippets: [],
  reference: { path: '/private/solution.py' },
  cases: [],
  caseStatus: 'missing',
};
const file = resolve(dir, 'source.jsonl');
before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  writeFileSync(file, JSON.stringify(source) + '\n');
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});
void test('metadata import is idempotent and never enables judging', () => {
  loadStudyLibrary(sqlite(), file);
  loadStudyLibrary(sqlite(), file);
  const list = listStudyLibrary(new URLSearchParams('q=3'));
  assert.equal(list.total, 1);
  assert.equal(list.items[0].caseStatus, 'missing');
  assert.equal(list.items[0].judgeProblemId, null);
});
void test('public detail excludes hidden cases and reference solutions; supports bilingual search and topics', () => {
  // Simulate the legacy row being retired, not a newly permitted import.
  sqlite()
    .prepare(
      "UPDATE study_library SET payload_json=?,case_count=1,expected_count=1 WHERE id='lc-3'",
    )
    .run(
      JSON.stringify({
        ...source,
        cases: [{ input: 'hidden-input', output: 'secret-answer' }],
      }),
    );
  const detail = getStudyLibrary('lc-3');
  assert.equal(detail.descriptionEn, 'Statement');
  assert.deepEqual(detail.caseSummary, { total: 1, withExpected: 1 });
  for (const secret of [
    'hidden-input',
    'secret-answer',
    '/private/solution.py',
    'codeSnippets',
  ])
    assert.ok(!JSON.stringify(detail).includes(secret));
  assert.equal(
    listStudyLibrary(
      new URLSearchParams({ q: 'Substring', topic: '滑动窗口与双指针' }),
    ).total,
    1,
  );
  assert.equal(listStudyLibrary(new URLSearchParams({ q: '%' })).total, 0);
  assert.throws(() => getStudyLibrary('../lc-3'));
  loadStudyLibrary(sqlite(), file);
  assert.deepEqual(getStudyLibrary('lc-3').caseSummary, {
    total: 0,
    withExpected: 0,
  });
  assert.deepEqual(
    JSON.parse(
      (
        sqlite()
          .prepare("SELECT payload_json FROM study_library WHERE id='lc-3'")
          .get() as { payload_json: string }
      ).payload_json,
    ).cases,
    [],
  );
});
void test('legacy candidate inputs and supplied answers are rejected atomically', () => {
  writeFileSync(
    file,
    JSON.stringify({ ...source, id: 'lc-4', number: 4, slug: 'new-problem' }) +
      '\n' +
      JSON.stringify({
        ...source,
        cases: [{ input: 'legacy input', output: 'untrusted answer' }],
        caseStatus: 'unverified',
      }),
  );
  assert.throws(() => loadStudyLibrary(sqlite(), file));
  assert.equal(listStudyLibrary(new URLSearchParams()).total, 1);
});
void test('invalid batch rolls back completely', () => {
  writeFileSync(
    file,
    JSON.stringify({ ...source, id: 'lc-4', number: 4, slug: 'new-problem' }) +
      '\n' +
      JSON.stringify({ ...source, id: 'lc-5', number: 8 }),
  );
  assert.throws(() => loadStudyLibrary(sqlite(), file));
  assert.equal(listStudyLibrary(new URLSearchParams()).total, 1);
});
void test('verification expires when the source snapshot or published judge version changes', () => {
  const db = sqlite();
  db.prepare(
    `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('lc-3','gomall','00-overview','v1',1,1,1)`,
  ).run();
  for (const revision of [1, 2])
    db.prepare(
      "INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,'lc-3',?,'{}','test','teacher',1)",
    ).run(`v${revision}`, revision);
  db.prepare(
    "UPDATE study_library SET judge_problem_id='lc-3',verified_hash=content_hash || ':v1' WHERE id='lc-3'",
  ).run();
  assert.equal(getStudyLibrary('lc-3').caseStatus, 'verified');
  db.prepare(
    "UPDATE oj_problems SET current_version_id='v2' WHERE id='lc-3'",
  ).run();
  assert.equal(getStudyLibrary('lc-3').judgeProblemId, null);
  db.prepare(
    "UPDATE study_library SET verified_hash=content_hash || ':v2' WHERE id='lc-3'",
  ).run();
  assert.equal(getStudyLibrary('lc-3').caseStatus, 'verified');
  writeFileSync(
    file,
    JSON.stringify({ ...source, descriptionEn: 'Changed constraints' }),
  );
  loadStudyLibrary(db, file);
  assert.equal(getStudyLibrary('lc-3').caseStatus, 'missing');
});
void test('offline publication rejects an old source manifest before publishing', async () => {
  const { problems } = await import('../lib/problems');
  const { createOjSeedPackages } = await import('../scripts/seed-oj-data.mjs');
  const payload = createOjSeedPackages(problems)[0];
  payload.problem.id = 'lc-3';
  Object.assign(payload.problem, {
    timeLimit: 2,
    memoryLimit: 262144,
    outputLimit: 64,
  });
  const raw = JSON.stringify(payload);
  writeFileSync(resolve(dir, 'lc-3.json'), raw);
  sqlite()
    .prepare(
      "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@example.test',1,1,1)",
    )
    .run();
  const manifest = {
    verifiedAt: '2026-09-06T00:00:00.000Z',
    sourceHashesFileSha256: '4'.repeat(64),
    problems: [
      {
        problemId: 'lc-3',
        packageFile: 'lc-3.json',
        packageSha256: createHash('sha256').update(raw).digest('hex'),
        sourceContentHash: '0'.repeat(64),
        verified: true,
        referenceSha256: '1'.repeat(64),
        runnerSha256: '2'.repeat(64),
        mutationSha256: '3'.repeat(64),
        inputBytesSha256: createHash('sha256').update(raw).digest('hex'),
        referenceBytesSha256: '2'.repeat(64),
        oracleSha256: '5'.repeat(64),
        counts: {
          formal: payload.cases.length,
          oracle: 120,
          negativeControls: 2,
        },
      },
    ],
  };
  const record = manifest.problems[0];
  const report = {
    allPassed: true,
    engine: 'go-judge',
    finishedAt: manifest.verifiedAt,
    sourceHashesFileSha256: manifest.sourceHashesFileSha256,
    problems: [
      {
        id: record.problemId,
        status: 'verified',
        counts: record.counts,
        sourceContentHash: record.sourceContentHash,
        packageSha256: record.packageSha256,
        referenceSha256: record.referenceSha256,
        wrapperSha256: record.runnerSha256,
        inputBytesSha256: record.inputBytesSha256,
        referenceBytesSha256: record.referenceBytesSha256,
        oracleSha256: record.oracleSha256,
        mutationSha256: record.mutationSha256,
        checks: Array.from(
          { length: record.counts.formal + record.counts.negativeControls + 1 },
          () => ({ passed: true }),
        ),
      },
    ],
  };
  writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(
    resolve(dir, 'verification-report.json'),
    JSON.stringify(report),
  );
  const invokePublisher = () =>
    spawnSync(
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
        env: { ...process.env, ADMIN_EMAILS: 'teacher@example.test' },
        encoding: 'utf8',
        timeout: 20000,
      },
    );
  const child = invokePublisher();
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Source library changed or is missing/);
  // Every defect must be rejected by the report boundary, before even checking
  // the deliberately stale source. Thus a stale source cannot mask a missing check.
  for (const [fault, expected] of [
    ['missing', /ENOENT/],
    ['failed', /allPassed/],
    ['missing-check', /checks do not match/],
    ['failed-check', /passed/],
    ['provenance', /provenance does not match/],
    ['duplicate', /Duplicate or mismatched/],
    ['run', /does not match manifest run/],
  ] as const) {
    const bad = structuredClone(report);
    if (fault === 'failed') bad.allPassed = false;
    if (fault === 'missing-check') bad.problems[0].checks.pop();
    if (fault === 'failed-check') bad.problems[0].checks[0].passed = false;
    if (fault === 'provenance') bad.problems[0].oracleSha256 = '6'.repeat(64);
    if (fault === 'duplicate')
      bad.problems.push(structuredClone(bad.problems[0]));
    if (fault === 'run') bad.finishedAt = 'another-run';
    if (fault === 'missing') rmSync(resolve(dir, 'verification-report.json'));
    else
      writeFileSync(
        resolve(dir, 'verification-report.json'),
        JSON.stringify(bad),
      );
    const rejected = invokePublisher();
    assert.notEqual(rejected.status, 0, fault);
    assert.match(rejected.stderr, expected, fault);
  }
  for (const fault of [
    'manifest-kind',
    'report-limit',
    'checker',
    'limits',
    'array-shape',
  ]) {
    const manifestChanges: Record<string, unknown> = {};
    const reportChanges: Record<string, unknown> = {};
    if (fault === 'manifest-kind')
      Object.assign(manifestChanges, {
        resultKind: 'string',
        oracleEncoding: 'jsonl-v1',
      });
    if (fault === 'report-limit')
      Object.assign(reportChanges, {
        resourceLimits: { timeLimit: 3, memoryLimit: 262144, outputLimit: 64 },
      });
    if (fault === 'checker') {
      const protocol = {
        resultKind: 'string',
        oracleEncoding: 'jsonl-v1',
        checker: 'exact',
      };
      Object.assign(manifestChanges, protocol);
      Object.assign(reportChanges, protocol);
    }
    if (fault === 'limits') {
      const limits = {
        resourceLimits: { timeLimit: 2, memoryLimit: 262144, outputLimit: 128 },
      };
      Object.assign(manifestChanges, limits);
      Object.assign(reportChanges, limits);
    }
    if (fault === 'array-shape') {
      const protocol = {
        resultKind: 'integer-array',
        oracleEncoding: 'jsonl-v1',
      };
      Object.assign(manifestChanges, protocol);
      Object.assign(reportChanges, protocol);
    }
    writeFileSync(
      resolve(dir, 'manifest.json'),
      JSON.stringify({
        ...manifest,
        problems: manifest.problems.map((record) => ({
          ...record,
          ...manifestChanges,
        })),
      }),
    );
    writeFileSync(
      resolve(dir, 'verification-report.json'),
      JSON.stringify({
        ...report,
        problems: report.problems.map((record) => ({
          ...record,
          ...reportChanges,
        })),
      }),
    );
    const rejected = invokePublisher();
    assert.notEqual(rejected.status, 0, fault);
    assert.match(
      rejected.stderr,
      fault === 'array-shape'
        ? /Expected output does not match/
        : /Verification result protocol does not match/,
      fault,
    );
  }
  for (const [kind, expectedValue, expectedError] of [
    ['integer-array', '[]', /Source library changed or is missing/],
    [
      'integer-array',
      '[9007199254740993]',
      /Source library changed or is missing/,
    ],
    ['integer-array', '[true]', /Oracle type or count/],
    ['integer-array', '[1.0]', /Oracle type or count/],
    ['string', '"🙂"', /Source library changed or is missing/],
    ['string', '"a\\nb"', /Oracle type or count/],
    ['string', '"\\ud800"', /Oracle type or count/],
  ] as const) {
    const typedPayload = structuredClone(payload);
    typedPayload.problem.checker = kind === 'string' ? 'exact' : 'tokens';
    for (const c of typedPayload.cases)
      c.expectedOutput = kind === 'string' ? 'line\n' : '0\n';
    const typedRaw = JSON.stringify(typedPayload);
    const typedHash = createHash('sha256').update(typedRaw).digest('hex');
    writeFileSync(resolve(dir, 'lc-3.json'), typedRaw);
    const oracleRaw =
      '{"resultKind":' +
      JSON.stringify(kind) +
      ',"oracleEncoding":"jsonl-v1","args":[' +
      Array(120).fill('[]').join(',') +
      '],"expected":[' +
      Array(120).fill(expectedValue).join(',') +
      ']}';
    const oracleHash = createHash('sha256').update(oracleRaw).digest('hex');
    const fields = {
      resultKind: kind,
      oracleEncoding: 'jsonl-v1',
      checker: typedPayload.problem.checker,
      packageSha256: typedHash,
      inputBytesSha256: typedHash,
      oracleSha256: oracleHash,
    };
    writeFileSync(resolve(dir, 'lc-3.oracle.json'), oracleRaw);
    writeFileSync(
      resolve(dir, 'manifest.json'),
      JSON.stringify({
        ...manifest,
        problems: manifest.problems.map((record) => ({ ...record, ...fields })),
      }),
    );
    writeFileSync(
      resolve(dir, 'verification-report.json'),
      JSON.stringify({
        ...report,
        problems: report.problems.map((record) => ({ ...record, ...fields })),
      }),
    );
    const rejected = invokePublisher();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, expectedError, expectedValue);
    if (expectedValue === '[]') {
      writeFileSync(resolve(dir, 'lc-3.oracle.json'), oracleRaw + ' ');
      assert.match(invokePublisher().stderr, /Changed verified oracle/);
    }
  }
  assert.equal(
    (
      sqlite()
        .prepare(
          "SELECT current_version_id AS id FROM oj_problems WHERE id='lc-3'",
        )
        .get() as { id: string }
    ).id,
    'v2',
  );
});

void test('practice status isolates user, round and formal mode; acceptance survives later failures', async () => {
  const db = sqlite();
  const { ensurePracticeRound, changePracticeRound } =
    await import('../lib/server/practice-rounds');
  for (const id of ['progress-a', 'progress-b']) {
    db.prepare(
      `INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)`,
    ).run(id, id, `${id}@example.test`);
  }
  db.prepare(
    "UPDATE study_library SET judge_problem_id='lc-3' WHERE id='lc-3'",
  ).run();
  const round = ensurePracticeRound('progress-a');
  const otherRound = ensurePracticeRound('progress-b');
  const add = (
    id: string,
    user: string,
    roundId: string,
    mode: string,
    status: string,
  ) => {
    db.prepare(`INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,practice_round_id,created_at,updated_at)
      VALUES(?,?,'lc-3','python','pass',?,1,?,?,1,1)`).run(
      id,
      user,
      status,
      mode,
      roundId,
    );
  };
  const page = (status = '') =>
    listStudyLibrary(new URLSearchParams({ q: '3', status }), 'progress-a');
  const item = () =>
    page().items[0] as {
      solved: boolean;
      progressStatus: string;
      judging: boolean;
    };
  add('other-accepted', 'progress-b', otherRound, 'judge', 'accepted');
  add('own-run', 'progress-a', round, 'run', 'accepted');
  assert.equal(item().progressStatus, 'not_started');
  assert.equal(page('not_started').total, 1);
  add('own-pending', 'progress-a', round, 'judge', 'queued');
  assert.equal(item().progressStatus, 'attempted');
  assert.equal(item().judging, true);
  assert.equal(page('attempted').total, 1);
  db.prepare(
    "UPDATE submissions SET status='wrong_answer' WHERE id='own-pending'",
  ).run();
  assert.equal(item().judging, false);
  assert.equal(item().solved, false);
  add('own-accepted', 'progress-a', round, 'judge', 'accepted');
  add('later-wrong', 'progress-a', round, 'judge', 'wrong_answer');
  assert.equal(item().progressStatus, 'solved');
  assert.equal(item().solved, true);
  assert.equal(page('todo').total, 0);
  assert.equal(page('solved').total, 1);
  assert.equal(page('attempted').total, 0);
  changePracticeRound('progress-a', {
    action: 'create',
    idempotencyKey: 'status-round-next-0001',
  });
  assert.equal(item().progressStatus, 'not_started');
  assert.equal(page('todo').total, 1);
  changePracticeRound('progress-a', { action: 'activate', roundId: round });
  assert.equal(item().progressStatus, 'solved');
});
