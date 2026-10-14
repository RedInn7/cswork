import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'company-hub-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
delete process.env.HIDDEN_COMPANIES;
const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { companyDirectory, companyHub, companyHubPaths, companyPractice, hasHub } = await import('../lib/server/company-hub');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

// Line 500 rows for two of Amazon's reported problems; lc-146 is judgeable.
const lc = (id: string, number: number, titleEn: string) => ({
  id, number, slug: `p-${number}`, titleZh: `题${number}`, titleEn, difficulty: '中等', topics: ['数组'],
  descriptionZh: '题面', descriptionEn: 'Statement', sourceUrl: `https://leetcode.cn/problems/p-${number}/`,
  sourceEnUrl: `https://leetcode.com/problems/p-${number}/`, attribution: 'doocs CC BY-SA 4.0',
  signature: { name: 'f' }, codeSnippets: [], reference: { path: '/private/x.py' }, cases: [], caseStatus: 'missing',
});
const lines = join(dir, 'lc.jsonl');
writeFileSync(lines, [lc('lc-3', 3, 'Longest Substring'), lc('lc-146', 146, 'LRU Cache')].map((r) => JSON.stringify(r)).join('\n') + '\n');
loadStudyLibrary(sqlite(), lines);
sqlite().prepare(
  `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('lc-146','gomall','00-overview','v1',1,1,1)`,
).run();
sqlite().prepare(
  "INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES('v1','lc-146',1,'{}','test','teacher',1)",
).run();
sqlite().prepare("UPDATE study_library SET judge_problem_id='lc-146',verified_hash=content_hash || ':v1' WHERE id='lc-146'").run();

// The content library: the public rows plus ones a company page must not count.
const db = new Database(':memory:');
db.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
const insert = db.prepare(
  `INSERT INTO items(id,type,slug,title,company_slug,company_name,round,published_at,partial,listed,dup_of,extra,body)
   VALUES(@id,@type,@slug,@title,@company,@name,@round,@at,@partial,@listed,@dup,@extra,'Body')`,
);
let n = 0;
const add = (type: string, company: string, name: string, o: Record<string, unknown> = {}) => {
  const id = `${type}-${company}-${++n}`;
  insert.run({ id, type, slug: id, title: `${name} ${type} ${n}`, company, name, round: 'Onsite', partial: 0, listed: 1, dup: null,
    extra: '{}', at: `2026-09-${String(n % 28 + 1).padStart(2, '0')}`, ...o });
};
// Acme: three experiences and two questions, plus rows that don't count.
add('experience', 'acme', 'Acme', { extra: JSON.stringify({ result: 'Offer', rounds: ['Online Assessment', 'Onsite'], date: '2026-05-02', dateBasis: 'interview' }), at: '2026-10-01' });
add('experience', 'acme', 'Acme');
add('experience', 'acme', 'Acme', { extra: JSON.stringify({ result: 'Rejected', rounds: ['Technical Screen'], date: '2026-07-01', dateBasis: 'source_report' }) });
add('interview_question', 'acme', 'Acme');
add('coding_question', 'acme', 'Acme');
add('experience', 'acme', 'Acme', { partial: 1 });
add('experience', 'acme', 'Acme', { listed: 0 });
add('coding_question', 'acme', 'Acme', { dup: '{"kind":"library","id":"lc-1"}' });
add('guide', 'acme', 'Acme');
// Smallco: four items, no OA problems.
for (const type of ['experience', 'experience', 'interview_question', 'coding_question']) add(type, 'smallco', 'Smallco');
// J.P. Morgan under two library spellings; the OA catalog knows it as jpmorgan-chase.
add('experience', 'j-p-morgan', 'J.P. Morgan');
add('experience', 'j-p-morgan', 'J.P. Morgan');
add('experience', 'jpmorganchase', 'JPMorganChase');
// A library not yet rebuilt after a takedown still holds Google rows.
for (let i = 0; i < 6; i++) add('experience', 'google', 'Google');

void test('a company page needs OA problems or five public library items; spellings merge', () => {
  const directory = companyDirectory(db);
  const acme = directory.get('acme')!;
  assert.deepEqual([acme.oa, acme.experiences, acme.questions, acme.name], [0, 3, 2, 'Acme']);
  assert.equal(hasHub(acme), true);
  assert.equal(hasHub(directory.get('smallco')!), false);
  const jpm = directory.get('jpmorgan-chase')!;
  assert.ok(jpm.oa > 0, 'the OA catalog has JPMorgan Chase');
  assert.deepEqual(jpm.library, ['j-p-morgan', 'jpmorganchase'], 'most items first');
  assert.equal(jpm.name, 'JPMorgan Chase');
  assert.equal(directory.has('j-p-morgan'), false);
  assert.equal(directory.has('unknown'), false, 'Other is not an employer');
  const paths = companyHubPaths(db).map((p) => p.path);
  assert.ok(paths.includes('/company/acme') && paths.includes('/company/jpmorgan-chase'));
  assert.ok(!paths.includes('/company/smallco'));
  // OA companies get a page without a library.
  assert.ok(companyHubPaths(null).some((p) => p.path === '/company/amazon'));
});

void test('hub data: OA list, ranked LeetCode, latest experiences with facts, questions, mocks', () => {
  assert.equal(companyHub(db, 'smallco'), null);
  assert.equal(companyHub(db, 'j-p-morgan'), null, 'only the canonical slug has a page');
  assert.equal(companyHub(db, 'nope'), null);
  const acme = companyHub(db, 'acme')!;
  assert.deepEqual([acme.oa, acme.leetcode, acme.mockOa], [[], [], null]);
  assert.equal(acme.experiences.length, 3);
  assert.deepEqual(acme.experiences[0], {
    type: 'experience', slug: acme.experiences[0].slug, title: acme.experiences[0].title, role: null, round: 'Onsite', difficulty: null,
    result: 'Offer', rounds: ['Online Assessment', 'Onsite'], interviewDate: '2026-05-02',
  });
  // A report date is not an interview date.
  assert.ok(acme.experiences.some((e) => e.result === 'Rejected' && e.interviewDate === null));
  assert.deepEqual(acme.questions.map((q) => q.type).sort(), ['coding_question', 'interview_question']);
  assert.ok(!('body' in acme.experiences[0]), 'summary fields only');
  const jpm = companyHub(db, 'jpmorgan-chase')!;
  assert.ok(jpm.oa.length > 0);
  assert.equal(jpm.experiences.length, 3, 'both spellings');
  assert.equal(jpm.mockOa, 'jpmorgan-chase');
  // Amazon's reported problems in Line 500, most reported first, with their judge state.
  const amazon = companyHub(db, 'amazon')!;
  assert.deepEqual(
    amazon.leetcode.map((p) => [p.id, p.count, p.titleEn, p.judgeProblemId]),
    [['lc-146', 2, 'LRU Cache', 'lc-146'], ['lc-3', 2, 'Longest Substring', null]],
  );
  assert.equal(amazon.mockOa, 'amazon');
});

void test('hidden and taken-down companies have no page and no practice', async () => {
  assert.ok(companyHub(db, 'google'), 'a visible OA company has a page');
  process.env.HIDDEN_COMPANIES = 'google,amazon';
  try {
    assert.equal(companyHub(db, 'google'), null);
    assert.equal(companyDirectory(db).has('google'), false, 'library rows of a hidden company drop out too');
    assert.ok(!companyHubPaths(db).some((p) => /\/company\/(google|amazon)$/.test(p.path)));
    assert.equal(await companyPractice(db, 'amazon'), null);
  } finally {
    delete process.env.HIDDEN_COMPANIES;
  }
});

void test('practice: judgeable most-reported problems, nothing for a company without any', async () => {
  const amazon = (await companyPractice(db, 'amazon'))!;
  assert.equal(amazon.slug, 'amazon');
  assert.equal(amazon.hub, true);
  assert.deepEqual(amazon.top.map((p) => [p.id, p.count]), [['lc-146', 2]], 'only judgeable problems');
  // A library spelling practises under its employer.
  const bytedance = await companyPractice(db, 'bytedance');
  assert.deepEqual([bytedance?.slug, bytedance?.name], ['tiktok', 'TikTok / ByteDance']);
  assert.equal(await companyPractice(db, 'acme'), null);
  assert.equal(await companyPractice(db, null), null);
});
