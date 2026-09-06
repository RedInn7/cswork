import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import catalog from '../content/interview-catalog.json';
const dir = mkdtempSync(resolve(tmpdir(), 'knowledge-progress-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { seedInterview } = await import('../lib/server/seed-interview');
const { getKnowledgeProgress } =
  await import('../lib/server/knowledge-progress');
const db = sqlite();
migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
seedInterview(
  catalog,
  Object.fromEntries(
    catalog.map((c) => [
      `/content/lectures/${c.id}.md`,
      readFileSync(resolve(c.source), 'utf8'),
    ]),
  ),
);
const p = {
  id: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'teacher' as const,
  verified: true,
};
for (const n of [1, 49, 560])
  db.prepare(
    `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,imported_at) VALUES(?,?,?,?,?,'Easy','[]','{"private":"hidden-solution"}','hash',0,0,?,0)`,
  ).run(`lc-${n}`, n, `slug-${n}`, `题目${n}`, `Problem ${n}`, `lc-${n}`);
function submission(
  id: string,
  problem: string,
  status: string,
  round: string | null,
  mode = 'judge',
  user = 'alice',
) {
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,practice_round_id,mode) VALUES(?,?,?,'cpp','private-code',?,1,0,0,?,?)`,
  ).run(id, user, problem, status, round, mode);
}
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test('current-round completion is authoritative, preserves AC, ignores run and other users', async () => {
  db.prepare(
    "INSERT INTO practice_rounds(id,user_id,number,created_at,active) VALUES('r1','alice',1,0,1),('r2','alice',2,0,0),('bob','bob',1,0,1)",
  ).run();
  submission('a', 'lc-1', 'accepted', 'r1');
  submission('b', 'lc-1', 'wrong_answer', 'r1');
  submission('c', 'lc-49', 'accepted', 'r1', 'run');
  submission('d', 'lc-49', 'accepted', 'bob', 'judge', 'bob');
  submission('e', 'lc-560', 'wrong_answer', 'r1');
  for (let n = 0; n < 110; n++)
    submission(`later-${n}`, 'lc-999', 'wrong_answer', 'r1');
  const result = await getKnowledgeProgress(p, 'interview-01');
  assert.equal(result.completed, 1);
  assert.deepEqual(
    result.items.map((i) => i.status),
    ['solved', 'not_started', 'attempted'],
  );
  assert.deepEqual(
    result.items.map((i) => i.id),
    ['lc-1', 'lc-49', 'lc-560'],
  );
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(result).includes('hidden-solution'));
  db.prepare("UPDATE practice_rounds SET active=0 WHERE id='r1'").run();
  db.prepare("UPDATE practice_rounds SET active=1 WHERE id='r2'").run();
  const next = await getKnowledgeProgress(p, 'interview-01');
  assert.equal(next.currentRound.number, 2);
  assert.equal(next.completed, 0);
  assert.ok(next.items.every((i) => i.status === 'not_started'));
});
test('read-only first-round projection and authorization', async () => {
  submission('legacy', 'lc-1', 'accepted', null, 'judge', 'new-user');
  const first = await getKnowledgeProgress(
    { ...p, id: 'new-user' },
    'interview-01',
  );
  assert.equal(first.completed, 1);
  assert.equal(first.currentRound.id, null);
  assert.equal(
    db.prepare("SELECT 1 FROM practice_rounds WHERE user_id='new-user'").get(),
    undefined,
  );
  await assert.rejects(
    getKnowledgeProgress(
      { ...p, role: 'student', verified: false },
      'interview-01',
    ),
    /尚未开通/,
  );
  await assert.rejects(
    getKnowledgeProgress(p, 'not-a-chapter'),
    /知识点不存在/,
  );
});
