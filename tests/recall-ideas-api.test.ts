import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-recall-ideas-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { lingFollowUps } = await import('../lib/server/ling-editorials');

const me: Person = { id: 'ideas-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'ideas-other', email: 'other@example.test' };

function call(p: Person | null, path: string) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(new Request(url), p, url.pathname.split('/').slice(3));
}
async function status(p: Person | null, path: string) {
  try {
    return (await call(p, path)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
type Idea = { id: string; excerpt: string | null; hint: string | null; complexity: { time: string } | null; takeaway: string | null; note: string | null; stop: string | null; solved: boolean };
const ideas = async (p: Person, query: string) => ((await (await call(p, `recall/ideas?${query}`)).json()) as { items: Idea[] }).items;

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const submit = sqlite().prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,mode,created_at,updated_at)
    VALUES(?,?,?,'python','',?,1,?,1,1)`,
  );
  submit.run('i1', me.id, 'lc-1', 'accepted', 'judge');
  submit.run('i2', me.id, 'lc-3', 'wrong_answer', 'judge');
  submit.run('i3', me.id, 'lc-8', 'accepted', 'run'); // A run is not a solve.
  submit.run('i4', other.id, 'lc-3', 'accepted', 'judge');
  sqlite()
    .prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,1)')
    .run(me.id, 'problem:lc-3', `two pointers ${'x'.repeat(5000)}`);
  sqlite()
    .prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,1)')
    .run(other.id, 'problem:lc-1', 'not yours');
});

void test('the takeaway only after your own accepted judge submission; your note only, cut at 4000', async () => {
  assert.ok(lingFollowUps('lc-1') && lingFollowUps('lc-3') && lingFollowUps('lc-8'), 'fixtures have follow-ups');
  const [one, three, eight] = await ideas(me, 'ids=lc-1,lc-3,lc-8&lang=en');
  assert.equal(one.id, 'lc-1');
  assert.equal(one.takeaway, lingFollowUps('lc-1')!.takeawayEn);
  assert.equal(one.solved, true);
  assert.ok(one.hint && one.complexity?.time && one.stop, 'hint, complexity and stop for a Line 500 problem');
  assert.equal(one.note, null, "another learner's note never shows");
  assert.equal(three.takeaway, null, 'a wrong answer is not a solve');
  assert.equal(eight.takeaway, null, 'a run is not a solve');
  assert.equal(three.note?.length, 4000);
  assert.ok(three.note?.startsWith('two pointers'));
  const [zh] = await ideas(me, 'ids=lc-1');
  assert.equal(zh.takeaway, lingFollowUps('lc-1')!.takeawayZh, 'Chinese unless lang=en');
  // No editorial read is recorded: the solve does not turn assisted.
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM practice_aids').pluck().get(), 0);
});

void test('problems of a running contest or exam are left out; limits and checks', async () => {
  const now = Date.now();
  sqlite()
    .prepare("INSERT INTO skill_attempts(id,user_id,test,ids_json,started_at,deadline,created_at) VALUES('ideas-exam',?,'oa',?,?,?,?)")
    .run(me.id, JSON.stringify(['lc-1']), now - 1000, now + 3_600_000, now - 1000);
  assert.deepEqual((await ideas(me, 'ids=lc-1,lc-3')).map((i) => i.id), ['lc-3']);
  assert.deepEqual((await ideas(other, 'ids=lc-1')).map((i) => i.id), ['lc-1'], "only the examinee's view changes");
  sqlite().prepare("DELETE FROM skill_attempts WHERE id='ideas-exam'").run();
  const many = Array.from({ length: 101 }, (_, i) => `lc-${i + 1}`).join(',');
  assert.equal(await status(me, `recall/ideas?ids=${many}`), 400);
  assert.equal((await ideas(me, `ids=${many.split(',').slice(0, 100).join(',')}`)).length, 100);
  assert.equal(await status(me, 'recall/ideas?ids=lc-1,bad%20id'), 400);
  assert.deepEqual(await ideas(me, 'ids='), []);
  assert.equal(await status(null, 'recall/ideas?ids=lc-1'), 401);
});
