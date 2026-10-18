// lib/server/topic-page.ts: the warm-up pick, topic frequency, the graph neighbours and the
// practice a /topics/<stop> page renders for a guest, a member and a member in a running exam.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'topic-page-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
delete process.env.HIDDEN_COMPANIES;
const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { pickFocus, stopAsked, stopLeadsTo, topicHeat, topicPractice } = await import('../lib/server/topic-page');
const { companyTagIndex } = await import('../lib/company-tags');
const { ROUTE_SLUGS } = await import('../lib/route-stops');
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const row = (id: string, stage: string, judgeable = true) => ({ id, stage, judgeProblemId: judgeable ? id : null });

test('the warm-up is the first judgeable Foundation problem outside the running contest', () => {
  const rows = [row('lc-1', '核心'), row('lc-2', '基础', false), row('lc-3', '基础'), row('lc-4', '基础')];
  assert.equal(pickFocus(rows, new Set())?.id, 'lc-3');
  assert.equal(pickFocus(rows, new Set(['lc-3']))?.id, 'lc-4');
  // A stop with no Foundation stage (backtracking-constraints) falls back to its first judgeable problem.
  assert.equal(pickFocus([row('lc-5', '核心', false), row('lc-6', '核心'), row('lc-7', '进阶')], new Set())?.id, 'lc-6');
  assert.equal(pickFocus([row('lc-6', '核心'), row('lc-7', '进阶')], new Set(['lc-6']))?.id, 'lc-7');
  // Nothing judgeable: the first problem left, linked to the Line 500 list by the caller.
  assert.equal(pickFocus([row('lc-8', '基础', false)], new Set())?.id, 'lc-8');
  assert.equal(pickFocus([row('lc-9', '基础')], new Set(['lc-9'])), null);
});

test('topic frequency counts each company once, leaves hidden ones out and ranks the top five', () => {
  const entry = (id: string, count: number) => ({ id, rounds: ['Phone'], sources: [`${id}-${count}`], count, last: '2026-01-01' });
  const map = {
    acme: [entry('lc-1', 3), entry('lc-2', 1)],
    beta: [entry('lc-1', 2)],
    gone: [entry('lc-2', 9)],
    c1: [entry('lc-2', 1)],
    c2: [entry('lc-2', 1)],
    c3: [entry('lc-2', 1)],
    elsewhere: [entry('lc-99', 50)],
  };
  const names = { acme: 'Acme', beta: 'Beta', gone: 'Gone', c1: 'C1', c2: 'C2', c3: 'C3', elsewhere: 'Elsewhere' };
  const tags = companyTagIndex(new Set(['gone']), map, [], names);
  // Only Acme has a company page; the rest are named without a link.
  const asked = stopAsked(['lc-1', 'lc-2'], tags, new Set(['acme', 'elsewhere']));
  assert.equal(asked.companies, 5);
  assert.equal(asked.reports, 4 + 2 + 1 + 1 + 1);
  assert.deepEqual(asked.top, [
    { slug: 'acme', name: 'Acme', count: 4, hub: true },
    { slug: 'beta', name: 'Beta', count: 2, hub: false },
    { slug: 'c1', name: 'C1', count: 1, hub: false },
    { slug: 'c2', name: 'C2', count: 1, hub: false },
    { slug: 'c3', name: 'C3', count: 1, hub: false },
  ]);
  assert.deepEqual(stopAsked(['lc-404'], tags), { companies: 0, reports: 0, top: [] });
});

test('a stop leads to the stops that list it as a prerequisite; the index heat is 0–3 per stop', () => {
  const next = stopLeadsTo('binary-search');
  assert.ok(next.includes('binary-search-tree') && next.includes('dp-scheduling'));
  assert.deepEqual(stopLeadsTo('bits-math'), []);
  const heat = topicHeat();
  assert.deepEqual(Object.keys(heat), ROUTE_SLUGS);
  assert.ok(Object.values(heat).every((h) => Number.isInteger(h) && h >= 0 && h <= 3));
  assert.ok(Object.values(heat).includes(3), 'the most asked stop is the hottest');
});

// Three binary-search problems: lc-35 (Foundation) and lc-34 (Core) judgeable, lc-852 (Foundation) not.
const db = sqlite();
const library = db.prepare(
  `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,verified_hash,imported_at)
   VALUES(?,?,?,?,?,'简单','[]','{}','h',1,1,?,?,0)`,
);
for (const [n, judgeable] of [[35, true], [34, true], [852, false]] as const) {
  library.run(`lc-${n}`, n, `p-${n}`, `题${n}`, `Problem ${n}`, `lc-${n}`, judgeable ? `h:v${n}` : null);
  if (!judgeable) continue;
  db.prepare(`INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`).run(`lc-${n}`, `v${n}`);
  db.prepare(`INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,'{}','c','teacher',1)`).run(`v${n}`, `lc-${n}`);
}
db.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('u1','U','u1@topic.test',1,0,0)").run();
const submit = db.prepare(
  `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
   VALUES(?,'u1',?,'python','x',?,0,1,'judge',1,1)`,
);
submit.run('s1', 'lc-35', 'accepted');
submit.run('s2', 'lc-34', 'wrong_answer');
submit.run('s3', 'core-binary-search', 'accepted');

test('a guest gets the stop in three stages with approaches and no statuses', async () => {
  const p = await topicPractice('binary-search', null);
  assert.equal(p.signedIn, false);
  assert.deepEqual(p.stages.map((s) => [s.stage, s.rows.map((r) => r.number)]), [
    ['基础', [35, 852]],
    ['核心', [34]],
    ['进阶', []],
  ]);
  assert.equal(p.focus?.number, 35);
  assert.equal(p.focus?.href, '/?view=problem&problem=lc-35');
  assert.equal(p.stages[0].rows[1].href, '/?view=problems&section=binary-search', 'not judgeable: the Line 500 list');
  assert.ok(p.stages.flatMap((s) => s.rows).every((r) => r.reason && r.reasonEn && r.status === undefined));
  assert.deepEqual(p.prereqs.map((s) => s.slug), ['array-foundations']);
  assert.ok(p.prereqs.every((s) => s.total > 0 && s.solved === undefined));
  assert.ok(p.leadsTo.some((s) => s.slug === 'dp-scheduling'));
  assert.deepEqual(p.core.map((c) => [c.id, c.status]), [['core-binary-search', undefined]]);
  assert.equal(p.core[0].href, '/?view=problem&problem=core-binary-search');
  // No OA problem is published in this database.
  assert.deepEqual(p.oa, { items: [], total: 0 });
  assert.ok(p.asked.top.every((c) => typeof c.hub === 'boolean'), 'each top company says whether it has a page');
});

test('a member sees their statuses; a running exam seals its problem and moves the warm-up', async () => {
  const p = await topicPractice('binary-search', 'u1');
  const status = Object.fromEntries(p.stages.flatMap((s) => s.rows).map((r) => [r.number, r.status]));
  assert.deepEqual(status, { 35: 'solved', 852: 'not_started', 34: 'attempted' });
  assert.equal(p.core[0].status, 'solved');
  assert.equal(p.leadsTo.find((s) => s.slug === 'binary-search-tree')?.solved, 0);
  const own = (await topicPractice('array-foundations', 'u1')).leadsTo.find((s) => s.slug === 'binary-search');
  assert.equal(own?.solved, 1);

  const now = Date.now();
  db.prepare(
    "INSERT INTO skill_attempts(id,user_id,test,ids_json,language,started_at,deadline,created_at) VALUES('exam','u1','python','[\"lc-35\"]','python',?,?,0)",
  ).run(now - 1000, now + 3_600_000);
  const sealed = await topicPractice('binary-search', 'u1');
  const rows = sealed.stages.flatMap((s) => s.rows);
  assert.deepEqual(
    rows.find((r) => r.number === 35),
    { ...rows.find((r) => r.number === 35)!, reason: '', reasonEn: '' },
  );
  assert.ok(rows.filter((r) => r.number !== 35).every((r) => r.reason));
  // The Foundation stage has nothing judgeable left, so the warm-up is the Core problem.
  assert.equal(sealed.focus?.number, 34);
});
