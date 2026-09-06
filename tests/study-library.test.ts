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
test('metadata import is idempotent and never enables judging', () => {
  loadStudyLibrary(sqlite(), file);
  loadStudyLibrary(sqlite(), file);
  const list = listStudyLibrary(new URLSearchParams('q=3'));
  assert.equal(list.total, 1);
  assert.equal(list.items[0].caseStatus, 'missing');
  assert.equal(list.items[0].judgeProblemId, null);
});
test('public detail excludes hidden cases and reference solutions; supports bilingual search and topics', () => {
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
test('legacy candidate inputs and supplied answers are rejected atomically', () => {
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
test('invalid batch rolls back completely', () => {
  writeFileSync(
    file,
    JSON.stringify({ ...source, id: 'lc-4', number: 4, slug: 'new-problem' }) +
      '\n' +
      JSON.stringify({ ...source, id: 'lc-5', number: 8 }),
  );
  assert.throws(() => loadStudyLibrary(sqlite(), file));
  assert.equal(listStudyLibrary(new URLSearchParams()).total, 1);
});
test('verification expires when the source snapshot or published judge version changes', () => {
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
test('offline publication rejects an old source manifest before publishing', async () => {
  const { problems } = await import('../lib/problems');
  const { createOjSeedPackages } = await import('../scripts/seed-oj-data.mjs');
  const payload = createOjSeedPackages(problems)[0];
  payload.problem.id = 'lc-3';
  const raw = JSON.stringify(payload);
  writeFileSync(resolve(dir, 'lc-3.json'), raw);
  sqlite()
    .prepare(
      "INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('teacher','Teacher','teacher@example.test',1,1,1)",
    )
    .run();
  const manifest = {
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
        counts: {
          formal: payload.cases.length,
          oracle: 120,
          negativeControls: 2,
        },
      },
    ],
  };
  writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify(manifest));
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
      env: { ...process.env, ADMIN_EMAILS: 'teacher@example.test' },
      encoding: 'utf8',
      timeout: 20000,
    },
  );
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Source library changed or is missing/);
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
