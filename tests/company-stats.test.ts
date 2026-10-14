import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { companyStats, MIN_EXPERIENCES, sixMonthsBefore } from '../lib/server/company-stats';

const db = new Database(':memory:');
db.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
const insert = db.prepare(
  `INSERT INTO items(id,type,slug,title,company_slug,role,category,published_at,partial,listed,dup_of,extra,body)
   VALUES(@id,@type,@id,'T',@company,@role,@category,@at,@partial,@listed,@dup,@extra,'B')`,
);
let n = 0;
const add = (type: string, company: string, o: Record<string, unknown> = {}) =>
  insert.run({
    id: `${type}-${++n}`, type, company, role: null, category: null, at: '2026-09-01T00:00:00.000Z',
    partial: 0, listed: 1, dup: null, extra: '{}', ...o,
  });
const extra = (o: Record<string, unknown>) => ({ extra: JSON.stringify(o) });
// Acme: ten public experiences under two spellings, plus rows a public page never counts.
add('experience', 'acme', { role: 'Software Engineer', ...extra({ result: 'Offer', rounds: ['Online Assessment', 'Onsite'], date: '2026-08-01', dateBasis: 'interview' }) });
add('experience', 'acme', { role: 'Software Engineer', ...extra({ result: 'Rejected', rounds: ['Online Assessment', 'Online Assessment'], date: '2025-01-01', dateBasis: 'interview' }) });
add('experience', 'acme', { role: 'Data Scientist', ...extra({ result: 'Rejected', rounds: ['Technical Screen'], date: '2026-05-01', dateBasis: 'source_report' }) });
add('experience', 'acme', { role: '', ...extra({ result: 'Made up', rounds: [] }) });
for (let i = 0; i < 5; i++) add('experience', 'acme', { at: '2026-06-01T00:00:00.000Z', ...extra({ result: null, rounds: ['Onsite'] }) });
add('experience', 'acme-corp', { at: '2024-01-01T00:00:00.000Z' });
add('experience', 'acme', { partial: 1 });
add('experience', 'acme', { listed: 0 });
add('experience', 'acme', { dup: '{"kind":"prachub","id":"x"}' });
add('coding_question', 'acme', { category: 'Coding & Algorithms' });
add('coding_question', 'acme', { category: 'Coding & Algorithms' });
add('interview_question', 'acme-corp', { category: 'System Design' });
add('interview_question', 'acme', { category: null });
add('guide', 'acme', { category: 'System Design' });
// Smallco: below the threshold.
for (let i = 0; i < MIN_EXPERIENCES - 1; i++) add('experience', 'smallco');

void test('company stats aggregate public experiences and questions over every spelling', () => {
  const stats = companyStats(db, ['acme', 'acme-corp'], new Date('2026-10-14T12:00:00Z'))!;
  assert.equal(stats.experiences, 10);
  // Since 2026-04-14 by interview or report date, else publication: 08-01, 05-01, the undated one
  // published 09-01 and the five from 06-01 (not the 2025 interview or the 2024 post).
  assert.equal(stats.recent, 8);
  assert.deepEqual(stats.rounds, [
    { value: 'Onsite', n: 6 },
    { value: 'Online Assessment', n: 2 },
    { value: 'Technical Screen', n: 1 },
  ]);
  // Reported outcomes only, unknown labels dropped: shares of reports, not a pass rate.
  assert.deepEqual(stats.results, [{ value: 'Rejected', n: 2 }, { value: 'Offer', n: 1 }]);
  assert.equal(stats.reported, 3);
  assert.deepEqual(stats.roles, [{ value: 'Software Engineer', n: 2 }, { value: 'Data Scientist', n: 1 }]);
  assert.deepEqual(stats.categories, [{ value: 'Coding & Algorithms', n: 2 }, { value: 'System Design', n: 1 }]);
  assert.equal(stats.questions, 4);
});

void test('the six-month window starts on the same day, clamped at month end', () => {
  assert.deepEqual(
    ['2026-10-14', '2026-08-31', '2026-10-31', '2028-08-31', '2026-03-31'].map((d) => sixMonthsBefore(new Date(d + 'T12:00:00Z'))),
    ['2026-04-14', '2026-02-28', '2026-04-30', '2028-02-29', '2025-09-30'],
  );
});

void test('too few experiences, no library or no spellings: no stats; results are cached per day', () => {
  assert.equal(companyStats(db, ['smallco']), null);
  assert.equal(companyStats(db, ['acme']), null, 'one spelling alone has nine');
  assert.equal(companyStats(null, ['acme']), null);
  assert.equal(companyStats(db, []), null);
  const day = new Date('2026-10-14T12:00:00Z');
  const first = companyStats(db, ['acme', 'acme-corp'], day);
  add('experience', 'acme');
  assert.equal(companyStats(db, ['acme', 'acme-corp'], day), first, 'same handle, same day: cached');
  assert.equal(companyStats(db, ['acme', 'acme-corp'], new Date('2026-10-15T12:00:00Z'))!.experiences, 11);
});

void test('the stats card says what it is based on and never calls outcomes a pass rate', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CompanyStatsCard } = await import('../components/company-stats-card');
  const stats = {
    experiences: 10, recent: 8, questions: 4, reported: 3,
    rounds: [{ value: 'Onsite', n: 6 }, { value: 'Online Assessment', n: 2 }],
    results: [{ value: 'Rejected', n: 2 }, { value: 'Offer', n: 1 }],
    roles: [{ value: 'Software Engineer', n: 2 }],
    categories: [{ value: 'Coding & Algorithms', n: 2 }],
    trend: null,
  };
  const zh = renderToStaticMarkup(createElement(CompanyStatsCard, { stats, locale: 'zh' }));
  assert.ok(zh.includes('基于 10 篇面经'));
  assert.ok(zh.includes('10 篇里有 3 篇写了结果；只代表发帖人自述，不是通过率。'));
  assert.ok(zh.includes('编程与算法') && zh.includes('Onsite'));
  // Shares: Onsite in 6 of 10 experiences; Rejected in 2 of 3 reports.
  assert.ok(zh.includes('60%') && zh.includes('67%'));
  const en = renderToStaticMarkup(createElement(CompanyStatsCard, { stats, locale: 'en' }));
  assert.ok(en.includes('Based on 10 interview experiences'));
  assert.ok(en.includes('not a pass rate'));
  assert.ok(en.includes('Online assessment') || en.includes('>OA<'));
  assert.ok(!/pass rate:|通过率：/.test(zh + en));
  // Panels without data are left out.
  const bare = renderToStaticMarkup(
    createElement(CompanyStatsCard, { stats: { ...stats, results: [], reported: 0, categories: [], questions: 0 }, locale: 'en' }),
  );
  assert.ok(!bare.includes('Reported outcomes') && !bare.includes('Question categories') && !bare.includes('>Questions<'));
});
