import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'company-insights-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
delete process.env.HIDDEN_COMPANIES;
const NOW = Date.parse('2026-10-14T12:00:00Z');
const DAY = 86400000;

// The content library: recent and old pages, plus rows a public list never shows.
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL DEFAULT 'B')`);
let n = 0;
const page = (type: string, at: string, o: Record<string, unknown> = {}) =>
  content
    .prepare(
      `INSERT INTO items(id,type,slug,title,company_slug,company_name,published_at,partial,listed,dup_of,category,extra)
       VALUES(@id,@type,@slug,@title,@company,@name,@at,@partial,@listed,@dup,@category,@extra)`,
    )
    .run({ id: `i${++n}`, type, slug: `${type.replace('_', '-')}-${n}`, title: `Page ${n}`, company: null, name: null, at, partial: 0, listed: 1, dup: null, category: null, extra: '{}', ...o });
page('experience', '2026-10-10T00:00:00Z', { company: 'acme', name: 'Acme' });
page('interview_question', '2026-09-20T00:00:00Z');
page('concept', '2026-08-01T00:00:00Z');
page('experience', '2026-10-12T00:00:00Z', { partial: 1 });
page('guide', '2026-10-12T00:00:00Z');
page('article', '2026-10-12T00:00:00Z', { slug: 'bad slug!' });
page('experience', '2026-10-11T00:00:00Z', { company: 'hush', name: 'Hush' });
// Reports behind Amazon's lc-146 and lc-3 in company-lc-map.json, dated by the interview (extra) or the post.
const source = (slug: string, o: Record<string, unknown> = {}) =>
  page('coding_question', '2025-01-01T00:00:00Z', { slug, title: `Source ${slug}`, ...o });
source('implement-lru-cache-with-o-1-ops', { extra: JSON.stringify({ date: '2026-09-01' }) });
source('implement-and-analyze-an-lru-query-cache');
source('determine-length-of-longest-unique-substring', { listed: 0 });
source('determine-length-of-longest-unique-substring', { type: 'experience', listed: 0 });
source('implement-python-function-for-longest-unique-substring-length', { company: 'hush', name: 'Hush' });
// The same slug as an experience: the coding question is the report.
page('experience', '2020-01-01T00:00:00Z', { slug: 'implement-lru-cache-with-o-1-ops' });
content.close();

const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');
const { topProblems, recentAdditions, rankInWindow, sourceDates } = await import('../lib/server/company-insights');
const { listStudyLibrary } = await import('../lib/server/study-library');
const { windowCounts } = await import('../lib/report-windows');
const { companyLcProblems, companyTagIndex } = await import('../lib/company-tags');
const { reportCompanies } = await import('../lib/server/learner-cloud');
const { createOaLibrary } = await import('../lib/server/oa-library');
const { companyStats, lastQuarters } = await import('../lib/server/company-stats');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

// Two of the map's reported problems in the bank; lc-146 is judgeable.
const lc = (id: string, number: number, titleEn: string) => ({
  id, number, slug: `p-${number}`, titleZh: `题${number}`, titleEn, difficulty: '中等', topics: ['数组'],
  descriptionZh: '题面', descriptionEn: 'Statement', sourceUrl: `https://leetcode.cn/problems/p-${number}/`,
  sourceEnUrl: `https://leetcode.com/problems/p-${number}/`, attribution: 'doocs CC BY-SA 4.0',
  signature: { name: 'f' }, codeSnippets: [], reference: { path: '/private/x.py' }, cases: [], caseStatus: 'missing',
});
const lines = join(dir, 'lc.jsonl');
writeFileSync(lines, [lc('lc-3', 3, 'Longest Substring'), lc('lc-146', 146, 'LRU Cache')].map((r) => JSON.stringify(r)).join('\n') + '\n');
loadStudyLibrary(sqlite(), lines);
const report = (user: string, problem: string, company: string, month: string) =>
  sqlite()
    .prepare('INSERT INTO problem_reports(id,user_id,problem_id,company,round,asked_month,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(`${user}-${problem}-${company}-${month}`, user, problem, company, 'oa', month, NOW);

void test('Top 100: map reports plus recent learner reports, companies ranked, hidden ones nowhere', () => {
  const mapped = (id: string) => (companyTagIndex().get(id) ?? []).reduce((sum, t) => sum + t.count, 0);
  for (const user of ['u1', 'u2', 'u3']) report(user, 'lc-3', 'amazon', '2026-09');
  report('u4', 'lc-3', '', '2026-10');
  report('u5', 'lc-3', 'amazon', '2025-01'); // outside the six months
  report('u6', 'lc-3', 'hush', '2026-10'); // hidden below
  const top = topProblems(100, NOW, new Set(['hush']));
  assert.deepEqual(top.map((p) => p.id).sort(), ['lc-146', 'lc-3'], 'problems without a bank entry drop out');
  const lc3 = top.find((p) => p.id === 'lc-3')!;
  assert.equal(lc3.learnerReports, 4);
  assert.equal(lc3.score, mapped('lc-3') + 4);
  assert.equal(lc3.last, '2026-10');
  const amazon = lc3.companies.find((c) => c.slug === 'amazon')!;
  assert.equal(amazon.n > 3, true, 'map and learner reports for one company add up');
  assert.equal(lc3.companies.some((c) => c.slug === 'hush'), false);
  assert.equal(amazon.hub, true);
  // Only employers with a company page get a link.
  const hubs = new Set(reportCompanies().map((c) => c.slug));
  assert.equal(top.every((p) => p.companies.every((c) => c.hub === hubs.has(c.slug))), true);
  assert.equal(top.some((p) => p.companies.some((c) => !c.hub)), true, 'map employers without a page are named only');
  assert.equal(lc3.companies.every((c, i, all) => i === 0 || all[i - 1].n >= c.n), true);
  assert.equal(top.every((p, i, all) => i === 0 || all[i - 1].score >= p.score), true);
  assert.equal(topProblems(1, NOW).length, 1);
  assert.deepEqual(top.find((p) => p.id === 'lc-146')!.judgeProblemId, null);
});

void test('recently added: public pages, approved member posts and newly judgeable OA problems', async () => {
  sqlite()
    .prepare(
      `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,rounds,result,interview_month,body,questions,status,review_note,reviewed_at,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run('m1', 'u1', 'amazon', 'Amazon SDE loop', 'SDE', '[]', null, '2026-09', 'x'.repeat(100), '[]', 'approved', '', NOW - 2 * DAY, NOW - 3 * DAY);
  sqlite()
    .prepare(
      `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,rounds,result,interview_month,body,questions,status,review_note,reviewed_at,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run('m2', 'u2', 'amazon', 'Pending', 'SDE', '[]', null, '2026-09', 'x'.repeat(100), '[]', 'pending', '', null, NOW - DAY);
  const ready = new Map([
    ['oa-amazon-1', { firstAt: NOW - 3 * DAY }],
    ['oa-amazon-2', { firstAt: NOW - 90 * DAY }],
  ]);
  const recent = await recentAdditions(NOW, 30, new Set(['hush']), ready);
  assert.deepEqual(recent.library.map((i) => i.path), ['/library/experience/experience-1', '/library/interview_question/interview-question-2']);
  assert.deepEqual(recent.libraryCounts, { experience: 1, interview_question: 1 });
  assert.deepEqual(recent.members.map((m) => m.title), ['Amazon SDE loop']);
  assert.equal(recent.membersTotal, 1);
  const { recentMemberExperiences } = await import('../lib/server/experience-submissions');
  assert.deepEqual(recentMemberExperiences(NOW - 30 * DAY, 0), { items: [], total: 1 }, 'counted in full, not only the shown ones');
  assert.deepEqual(recent.oa.map((o) => [o.id, o.company]), [['oa-amazon-1', 'Amazon']]);
  assert.equal(recent.oaTotal, 1);
});

void test('OA difficulty filter: easy / medium / hard as shown, estimates included', () => {
  const catalog = {
    schemaVersion: 1,
    source: { repository: 'https://github.com/RedInn7/OA-Master', commit: 'a'.repeat(40), origin: 'https://oamaster.com' },
    companies: [{ slug: 'meta', name: 'Meta', count: 4 }],
    items: [1, 2, 3, 4].map((i) => ({
      id: `oa-meta-${i}`, companySlug: 'meta', companyName: 'Meta', number: i, title: `P${i}`,
      sourceUrl: `https://oamaster.com/docs/companies/meta#${i}`, languages: ['python'], statement: 'S', explanation: 'E',
      solutions: [], contentHash: 'b'.repeat(64),
    })),
  };
  const levels: Record<string, string> = { 'oa-meta-1': 'easy', 'oa-meta-2': 'hard', 'oa-meta-3': 'hard' };
  const library = createOaLibrary(catalog, { topics: () => undefined });
  // oa-meta-3 is statement only: its row shows no level, so no level finds it.
  const ready = new Set(['oa-meta-1', 'oa-meta-2', 'oa-meta-4']);
  const ids = (q: string) => library.list(new URLSearchParams(q), ready, { difficultyOf: (id) => levels[id] }).items.map((i) => i.id);
  assert.deepEqual(ids('difficulty=hard'), ['oa-meta-2']);
  assert.deepEqual(ids('difficulty=easy'), ['oa-meta-1']);
  assert.deepEqual(ids('difficulty=medium'), []);
  assert.equal(ids('difficulty=nonsense').length, 4, 'unknown levels filter nothing');
  assert.equal(ids('').length, 4);
});

void test('company stats: quarterly trend of experiences and question categories', () => {
  assert.deepEqual(lastQuarters(new Date('2026-10-14T00:00:00Z')), ['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  assert.deepEqual(lastQuarters(new Date('2026-01-01T00:00:00Z'), 2), ['2025-Q4', '2026-Q1']);
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, company_slug TEXT, category TEXT, role TEXT, published_at TEXT,
    partial INTEGER DEFAULT 0, dup_of TEXT, listed INTEGER DEFAULT 1, extra TEXT DEFAULT '{}')`);
  let k = 0;
  const add = (type: string, at: string, o: Record<string, unknown> = {}) =>
    db
      .prepare('INSERT INTO items(id,type,company_slug,category,published_at,extra) VALUES(@id,@type,@company,@category,@at,@extra)')
      .run({ id: String(++k), type, company: 'acme', category: null, at, extra: '{}', ...o });
  for (let i = 0; i < 10; i++) add('experience', '2026-08-01', { extra: JSON.stringify({ date: i < 4 ? '2026-02-10' : '2026-07-01' }) });
  add('experience', '2023-01-01');
  for (let i = 0; i < 3; i++) add('coding_question', '2026-09-05', { category: 'Coding & Algorithms' });
  add('interview_question', '2026-04-05', { category: 'System Design' });
  const trend = companyStats(db, ['acme'], new Date('2026-10-14T00:00:00Z'))!.trend!;
  assert.deepEqual(trend.quarters, lastQuarters(new Date('2026-10-14T00:00:00Z')));
  const row = (v: string) => trend.series.find((s) => s.value === v)!.counts;
  assert.deepEqual(row('experience'), [0, 0, 4, 0, 6, 0], 'by interview date; older ones out of range');
  assert.deepEqual(row('Coding & Algorithms'), [0, 0, 0, 0, 3, 0]);
  assert.deepEqual(row('System Design'), [0, 0, 0, 1, 0, 0]);
  assert.equal(trend.series[0].value, 'experience');
});

void test('report sources: listed rows only, dated by the interview else the post, hidden companies out', () => {
  const dated = sourceDates(NOW, new Set(['hush']));
  assert.deepEqual(dated.get('implement-lru-cache-with-o-1-ops'), {
    type: 'coding_question', slug: 'implement-lru-cache-with-o-1-ops', title: 'Source implement-lru-cache-with-o-1-ops', date: '2026-09-01', page: true,
  });
  assert.equal(dated.get('implement-and-analyze-an-lru-query-cache')?.date, '2025-01-01');
  assert.equal(dated.has('determine-length-of-longest-unique-substring'), false, 'taken down');
  assert.equal(dated.has('implement-python-function-for-longest-unique-substring-length'), false, 'hidden company');
  const lru = companyTagIndex().get('lc-146')!.find((t) => t.slug === 'amazon')!;
  assert.deepEqual(windowCounts(lru.sources, dated, NOW), { m3: 1, m6: 0, y1: 0, y2: 1, older: 0 });
  // A company page: counts inside the window, and the reports behind a row that have a page.
  const amazon = companyLcProblems().get('amazon')!.filter((p) => p.id === 'lc-146' || p.id === 'lc-3');
  const row = (p: ReturnType<typeof rankInWindow>[number]) => [p.id, p.n, p.refs.map((r) => r.date)];
  assert.deepEqual(rankInWindow(amazon, '3m', dated, NOW).map(row), [['lc-146', 1, ['2026-09-01']]], 'none left at zero');
  assert.deepEqual(rankInWindow(amazon, 'all', dated, NOW).map(row), [
    ['lc-146', 2, ['2026-09-01', '2025-01-01']],
    ['lc-3', 2, []],
  ]);
  // The bank's frequency order counts the window's reports only: both have two in all.
  const ids = (window: string) =>
    listStudyLibrary(new URLSearchParams({ company: 'amazon', sort: 'frequency', window })).items.map((i) => i.id);
  assert.deepEqual(ids('3m'), ['lc-146', 'lc-3']);
  assert.deepEqual(ids('all'), listStudyLibrary(new URLSearchParams({ company: 'amazon' })).items.map((i) => i.id), 'ties keep the line order');
});
