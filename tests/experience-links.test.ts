import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// experience-question-links: questions linked to site problems count as "asked", and a public
// post can be drawn as a timed mock.
const dir = mkdtempSync(join(tmpdir(), 'cswork-experience-links-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.HIDDEN_COMPANIES = 'google';
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');

// The content library: Amazon experiences, so Amazon has a company page.
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
for (const slug of ['lib-a', 'lib-b', 'lib-c'])
  content
    .prepare(
      `INSERT INTO items(id,type,slug,title,company_slug,company_name,role,published_at,body)
      VALUES(?,'experience',?,?,'amazon','Amazon','Software Engineer','2026-09-30T00:00:00.000Z','Body')`,
    )
    .run(slug, slug, `Amazon ${slug}`);
content.close();

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { handleContent } = await import('../lib/server/content-library');
const { companyReports } = await import('../lib/server/learner-cloud');
const { mockPresetFor } = await import('../lib/server/mock-oa-presets');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');

const me: Person = { id: 'xl-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'xl-other', email: 'other@example.test' };
const third: Person = { ...me, id: 'xl-third', email: 'third@example.test' };
const teacher: Person = { ...me, id: 'xl-teacher', email: 'teacher@example.test', role: 'teacher' };
const readers = [1, 2, 3].map((i): Person => ({ ...me, id: `xl-reader-${i}`, email: `r${i}@example.test` }));

// Judgeable LeetCode problems as the catalogue sees them (study library row, published version).
const LC: [number, string, string][] = [
  [1, '简单', 'Two Sum'],
  [3, '中等', 'Longest Substring'],
  [7, '简单', 'Reverse Integer'],
  [42, '困难', 'Trapping Rain Water'],
  [146, '中等', 'LRU Cache'],
  [200, '中等', 'Number of Islands'],
];
before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const file = join(dir, 'lc.jsonl');
  writeFileSync(
    file,
    LC.map(([n, difficulty, titleEn]) =>
      JSON.stringify({
        id: `lc-${n}`, number: n, slug: `p-${n}`, titleZh: `题${n}`, titleEn, difficulty, topics: ['数组'],
        descriptionZh: '题面', descriptionEn: 'Statement', sourceUrl: `https://leetcode.cn/problems/p-${n}/`,
        sourceEnUrl: `https://leetcode.com/problems/p-${n}/`, attribution: 'test', signature: { name: 'f' },
        codeSnippets: [], reference: { path: '/private/x.py' }, cases: [], caseStatus: 'missing',
      }),
    ).join('\n') + '\n',
  );
  loadStudyLibrary(db, file);
  for (const [n, difficulty, titleEn] of LC) {
    const id = `lc-${n}`;
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
    ).run(id, `v-${id}`);
    db.prepare(
      `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,?,'test','teacher',1)`,
    ).run(`v-${id}`, id, JSON.stringify({ id, title: `题${n}`, difficulty, translations: { en: { title: titleEn } } }));
    db.prepare(`UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':v-' || ? WHERE id=?`).run(id, id, id);
  }
  // A course exercise and a hidden company's OA problem: never linkable.
  for (const id of ['course-x', 'oa-google-1'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
    ).run(id, `v-${id}`);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const r = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  const parts = url.pathname.split('/').slice(3);
  try {
    const response = path.startsWith('content/') ? await handleContent(r, p, parts) : await handleOj(r, p, parts);
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // The API wrapper turns HttpError/ZodError into responses.
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
const month = new Date().toISOString().slice(0, 7);
const post = (o: Record<string, unknown> = {}) => ({
  company: 'amazon',
  title: 'Amazon SDE new grad loop',
  role: 'Software Engineer',
  rounds: ['Online Assessment', 'Onsite'],
  result: 'Offer',
  month,
  body: 'An OA with two problems, then three onsite rounds of coding and behavioral. '.repeat(3),
  agree: true,
  ...o,
});
const q = (text: string, problem = '', extra: Record<string, unknown> = {}) => ({ text, round: '', problem, similar: false, ...extra });
const asked = async (problem: string, p: Person | null = null) => (await call(p, 'GET', `oj/reports?problem=${problem}`)).data;
const approve = async (id: string) =>
  assert.equal((await call(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'approved' })).status, 200);

let loop = '';
let pending = '';
let plain = '';
void test('a question links only a public problem, in one of the post’s rounds; plain strings still work', async () => {
  for (const questions of [
    [q('LRU cache', '', { round: 'Technical Screen' })], // not a round of this post
    [q('LRU cache', 'course-x')],
    [q('LRU cache', 'oa-google-1')], // hidden company
    [q('LRU cache', 'lc-404')],
    [{ text: 'LRU cache', problem: 'lc-146', extra: 1 }],
    [q('LR', 'lc-146')],
  ])
    assert.equal((await call(me, 'POST', 'oj/experiences', post({ questions }))).status, 400, JSON.stringify(questions));
  assert.equal((await call(me, 'POST', 'oj/experiences', post({ prepWeeks: 105 }))).status, 400);
  assert.equal((await call(me, 'POST', 'oj/experiences', post({ prepSources: ['tutor'] }))).status, 400);

  const old = await call(third, 'POST', 'oj/experiences', post({ questions: ['Two sum', 'Design a feed'] }));
  assert.equal(old.status, 201);
  plain = old.data.member.id;
  assert.deepEqual(old.data.questions, [q('Two sum'), q('Design a feed')]);

  const created = await call(
    me,
    'POST',
    'oj/experiences',
    post({
      prepWeeks: 6,
      prepSources: ['mock', 'leetcode', 'mock'],
      questions: [
        q('Two sum variant', 'lc-1', { round: 'Online Assessment' }),
        q('Something like rain water', 'lc-42', { round: 'Onsite', similar: true }),
        'Tell me about a conflict',
        q('LRU cache', 'lc-146'),
        q('Count islands', 'lc-200', { round: 'Onsite' }),
        q('Longest substring', 'lc-3'),
        q('Two sum again', 'lc-1'),
        q('Reverse a number', 'lc-7'),
        q('Similar without a link', '', { similar: true }),
      ],
    }),
  );
  assert.equal(created.status, 201);
  loop = created.data.member.id;
  assert.deepEqual(created.data.questions.slice(0, 3), [
    q('Two sum variant', 'lc-1', { round: 'Online Assessment' }),
    q('Something like rain water', 'lc-42', { round: 'Onsite', similar: true }),
    q('Tell me about a conflict'),
  ]);
  assert.deepEqual(created.data.questions.at(-1), q('Similar without a link'), 'similar means nothing without a link');
  assert.deepEqual([created.data.details.prepWeeks, created.data.details.prepSources], [6, ['mock', 'leetcode']]);
  // Only questions with a round or a link get a metadata row.
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM experience_questions WHERE submission_id=?').pluck().get(loop), 7);

  pending = (await call(other, 'POST', 'oj/experiences', post({ questions: [q('LRU cache', 'lc-146')] }))).data.member.id;
  assert.ok(pending);
});

void test('approved linked questions count as asked: by person, never "similar", gone with the post', async () => {
  assert.equal((await asked('lc-1')).total, 0, 'pending posts count for nothing');
  await approve(loop);
  await approve(plain);
  let lc1 = await asked('lc-1', me);
  assert.deepEqual([lc1.total, lc1.last, lc1.companies.map((c: { slug: string; n: number }) => [c.slug, c.n])], [1, month, [['amazon', 1]]]);
  assert.deepEqual(lc1.mine, [], "the author's own list holds manual reports only");
  assert.equal((await asked('lc-42')).total, 0, 'similar is not the question itself');
  // The same author reporting it by hand is still one person.
  assert.equal((await call(me, 'POST', 'oj/reports', { problemId: 'lc-1', company: 'amazon', round: 'oa', month })).status, 200);
  lc1 = await asked('lc-1', me);
  assert.equal(lc1.total, 1);
  assert.equal(lc1.mine.length, 1);
  const ids = companyReports('amazon').map((r) => r.problemId);
  for (const id of ['lc-1', 'lc-146', 'lc-200', 'lc-3']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('lc-42'));

  // Three readers report it down: the count drops; re-approved, it is back.
  for (const reader of readers)
    assert.equal((await call(reader, 'POST', `oj/experiences/${loop}/flag`, { reason: 'inaccurate' })).status, 200);
  assert.equal((await asked('lc-146')).total, 0);
  assert.ok(!companyReports('amazon').some((r) => r.problemId === 'lc-146'));
  await approve(loop);
  assert.equal((await asked('lc-146')).total, 1);
});

void test('pages title linked problems and drop links to problems no longer public', async () => {
  // Unpublished after the post linked it (before any catalogue snapshot).
  sqlite().prepare("UPDATE oj_problems SET published=0 WHERE id='lc-7'").run();
  const item = (await call(null, 'GET', `content/item?type=experience&slug=member.${loop}`)).data;
  assert.deepEqual(
    item.questions.slice(0, 2).map((x: { problem: string; title?: string; titleEn?: string }) => [x.problem, x.title, x.titleEn]),
    [
      ['lc-1', '题1', 'Two Sum'],
      ['lc-42', '题42', 'Trapping Rain Water'],
    ],
  );
  const reverse = item.questions.find((x: { text: string }) => x.text === 'Reverse a number');
  assert.deepEqual([reverse.problem, reverse.similar], ['', false]);
  assert.equal(item.questions[2].title, undefined);
  // The teacher's queue shows the links as stored.
  const queue = (await call(teacher, 'GET', 'oj/experiences/review')).data;
  const card = queue.approved.find((x: { id: string }) => x.id === loop);
  assert.equal(card.questions.find((x: { text: string }) => x.text === 'Reverse a number').problem, 'lc-7');
});

void test('drawing a mock from a post: linked judgeable problems in order, at most 4; pending 404, none 409', async () => {
  const drawn = await call(me, 'POST', 'oj/mock-oa/draw', { experience: loop, exclude: ['lc-1'] });
  assert.equal(drawn.status, 200);
  const d = drawn.data;
  assert.deepEqual(d.ids, ['lc-1', 'lc-42', 'lc-146', 'lc-200'], 'similar ones too, duplicates once, exclude ignored');
  assert.deepEqual(d.slots, ['easy', 'hard', 'medium', 'medium']);
  const preset = mockPresetFor('amazon')!;
  assert.equal(d.minutes, Math.min(180, Math.max(15, Math.round((preset.minutes / preset.questions) * 4))));
  assert.deepEqual([d.preset, d.company, d.scoring, d.experience, d.questions], [false, 'amazon', 'tests', loop, 4]);

  assert.equal((await call(me, 'POST', 'oj/mock-oa/draw', { experience: pending })).status, 404, 'not public yet');
  assert.equal((await call(other, 'POST', 'oj/mock-oa/draw', { experience: pending })).status, 404, 'not even for its author');
  assert.equal((await call(me, 'POST', 'oj/mock-oa/draw', { experience: plain })).status, 409, 'no linked problem');
  assert.equal((await call(me, 'POST', 'oj/mock-oa/draw', { experience: 'short' })).status, 400);
  assert.equal((await call(me, 'POST', 'oj/mock-oa/draw', { experience: loop, company: 'amazon' })).status, 400, 'one source only');
});

void test('company stats: median preparation over offers only, from five posts', async () => {
  const { memberExperienceStats } = await import('../lib/server/experience-submissions');
  const insert = sqlite().prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,rounds,result,interview_month,body,status,prep_weeks,reviewed_at,created_at)
    VALUES(?,?,'amazon','Seeded','SWE','["Onsite"]',?,?,'Body','approved',?,1,1)`,
  );
  // Four offers with prep plus `loop` (6 weeks): 2, 4, 6, 8, 30 → median 6; a rejection never counts.
  [2, 4, 8, 30].forEach((weeks, i) => insert.run(`seedOffer${String(i).padStart(3, '0')}`, `seed-${i}`, 'Offer', month, weeks));
  insert.run('seedReject00', 'seed-r', 'Rejected', month, 1);
  assert.deepEqual(memberExperienceStats('amazon')?.prep, { n: 5, median: 6 });
  sqlite().prepare("DELETE FROM experience_submissions WHERE id='seedOffer000'").run();
  assert.equal(memberExperienceStats('amazon')?.prep ?? null, null, 'four offers are too few');
});

void test('withdrawing a post takes its question rows and its asked counts with it', async () => {
  assert.equal((await call(me, 'POST', 'oj/reports/withdraw', { problemId: 'lc-1', month })).status, 200);
  assert.equal((await asked('lc-1')).total, 1);
  assert.equal((await call(me, 'POST', `oj/experiences/${loop}/withdraw`, {})).status, 200);
  assert.equal((await asked('lc-1')).total, 0);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM experience_questions WHERE submission_id=?').pluck().get(loop), 0);
});
