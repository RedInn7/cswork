// Server-side fairness in a running contest: the Line 500 editorial leaves the problem payload for
// its own endpoint, and the editorial, community solutions and the AI tutor refuse (403) a problem
// of a contest window running for the learner; other problems and other learners are unaffected.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import { englishMessage } from '../lib/messages-en';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-contest-fairness-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
process.env.ANTHROPIC_API_KEY = 'test-key';
delete process.env.CONTENT_DATABASE_PATH;
delete process.env.COURSE_ACCESS;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { inRunningContest, runningContestProblems } = await import('../lib/server/contests');
const { lingEditorial } = await import('../lib/server/ling-editorials');

const MIN = 60000;
const LOCKED = '这道题在你正在进行的比赛里，题解、讨论和 AI 助教赛后开放';
const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const amy = person('f-amy'); // live entrant of the running room
const bob = person('f-bob'); // not in any room
const cat = person('f-cat'); // virtual entrant, own window running
const dan = person('f-dan'); // live entrant of an ended room, owner of a waiting duel

function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
async function refusal(p: Person, method: string, path: string, body?: unknown) {
  try {
    await call(p, method, path, body);
  } catch (error) {
    return error as { status: number; message: string };
  }
  assert.fail(`${path} was not refused`);
}
const room = (id: string, kind: string, problems: string[], startsAt: number) =>
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
      VALUES(?,NULL,?,?,?,?,60,'private',0)`,
    )
    .run(id, id, kind, JSON.stringify(problems), startsAt);
const entry = (roomId: string, p: Person, virtualStart: number | null = null) =>
  sqlite()
    .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,0,?)')
    .run(roomId, p.id, p.id, virtualStart);
// A study problem with no Line 500 editorial: the first lc-<n> the editorial file leaves out.
let bareNumber = 1;
while (lingEditorial(`lc-${bareNumber}`)) bareNumber++;
const bare = `lc-${bareNumber}`;
const ai = (p: Person, problemId: string) =>
  status(p, 'POST', 'ai/complexity', { problemId, language: 'python', code: 'x = 1' });

const realFetch = globalThis.fetch;
before(() => {
  // No model call may happen: every AI request here stops at a gate.
  globalThis.fetch = async () => assert.fail('no upstream call');
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','T','T','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','T','','t',0,'','1',0)",
  ).run();
  // lc-1 (in the room) and lc-20 (not) both have a Line 500 editorial; `bare` has none.
  assert.ok(lingEditorial('lc-1') && lingEditorial('lc-20'));
  for (const [n, id] of [1, bareNumber, 20].map((n) => [n, `lc-${n}`] as const)) {
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
    ).run(id, `v-${n}`);
    db.prepare(
      "INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,'{}','test','teacher',1)",
    ).run(`v-${n}`, id);
    db.prepare(
      `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,
      case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES(?,?,?,?,?,'简单','[]','{}','h',1,1,?,?,0)`,
    ).run(id, n, `p-${n}`, `题${n}`, `P${n}`, id, `h:v-${n}`);
  }
  const now = Date.now();
  room('live', 'mashup', ['lc-1', 'oa-acme-1'], now - 10 * MIN);
  entry('live', amy);
  // Ended an hour ago for its live entrant; a virtual run started five minutes ago is still on.
  room('past', 'mashup', ['lc-1'], now - 120 * MIN);
  entry('past', dan);
  entry('past', cat, now - 5 * MIN);
  // A duel waits for its second entrant: its clock has not started.
  room('duel', 'duel', ['lc-1'], now - 5 * MIN);
  entry('duel', dan);
});
after(() => {
  globalThis.fetch = realFetch;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a room runs for an entrant inside their window only, and only for its problems', () => {
  const at = Date.now();
  assert.deepEqual([...runningContestProblems(amy.id, at)].sort(), ['lc-1', 'oa-acme-1']);
  assert.equal(inRunningContest(amy.id, 'lc-1', at), true);
  assert.equal(inRunningContest(amy.id, 'lc-20', at), false);
  assert.equal(inRunningContest(bob.id, 'lc-1', at), false);
  // Live window: [start, end).
  const start = sqlite().prepare("SELECT starts_at FROM contest_rooms WHERE id='live'").pluck().get() as number;
  assert.equal(inRunningContest(amy.id, 'lc-1', start - 1), false);
  assert.equal(inRunningContest(amy.id, 'lc-1', start), true);
  assert.equal(inRunningContest(amy.id, 'lc-1', start + 60 * MIN - 1), true);
  assert.equal(inRunningContest(amy.id, 'lc-1', start + 60 * MIN), false);
  // Virtual: the entrant's own window, not the room's.
  assert.equal(inRunningContest(cat.id, 'lc-1', at), true);
  assert.equal(inRunningContest(cat.id, 'lc-1', at - 6 * MIN), false);
  // The room's window ended for its live entrant, and the waiting duel hasn't started.
  assert.equal(inRunningContest(dan.id, 'lc-1', at), false);
});

void test('the problem payload carries no editorial, only whether one exists and is verified', async () => {
  const response = await call(amy, 'GET', 'problems/lc-1');
  assert.equal(response.status, 200);
  const problem = (await response.json()) as Record<string, unknown>;
  assert.equal('lingEditorial' in problem, false);
  assert.equal(typeof problem.lingEditorialVerified, 'boolean');
  // No approach's code, in any language, rides along (compared JSON-escaped, as the payload carries it).
  const payload = JSON.stringify(problem);
  for (const approach of lingEditorial('lc-1')!.approaches)
    for (const code of [approach.python, approach.cpp])
      assert.equal(payload.includes(JSON.stringify(code).slice(1, -1)), false);
  const none = (await (await call(amy, 'GET', `problems/${bare}`)).json()) as Record<string, unknown>;
  assert.equal(none.lingEditorialVerified, null);
  // The hint ladder stays server-side in the contest too; outside it, the same problem has it.
  assert.equal(problem.lingHints, null);
  assert.equal(problem.curatedHint, null);
  const outside = (await (await call(bob, 'GET', 'problems/lc-1')).json()) as Record<string, unknown>;
  assert.notEqual(outside.lingHints, null);
});

void test('the editorial endpoint: signed in, 403 in a running contest, open elsewhere and after', async () => {
  assert.equal(await status(null, 'GET', 'problems/lc-1/editorial'), 401);
  assert.equal(await status(bob, 'GET', `problems/${bare}/editorial`), 404);
  const refused = await refusal(amy, 'GET', 'problems/lc-1/editorial');
  assert.equal(refused.status, 403);
  assert.equal(refused.message, LOCKED);
  assert.notEqual(englishMessage(LOCKED), LOCKED, 'the refusal has an English message');
  assert.equal(await status(cat, 'GET', 'problems/lc-1/editorial'), 403);
  // Not in the room, or a problem outside it.
  const open = (await (await call(bob, 'GET', 'problems/lc-1/editorial')).json()) as { approaches: unknown[] };
  assert.ok(open.approaches.length > 0);
  assert.equal(await status(amy, 'GET', 'problems/lc-20/editorial'), 200);
  assert.equal(await status(dan, 'GET', 'problems/lc-1/editorial'), 200);
  // An OA editorial is closed the same way.
  assert.equal(await status(amy, 'GET', 'oa-library/oa-acme-1/solution'), 403);
});

void test('community solutions: list, read and write refuse during the contest', async () => {
  const created = await call(bob, 'POST', 'posts', { problemId: 'lc-1', title: 'Hash map', body: 'one pass' });
  assert.equal(created.status, 201);
  const { post } = (await created.json()) as { post: { id: string } };
  assert.equal(await status(bob, 'GET', 'posts?problem=lc-1'), 200);
  assert.equal(await status(bob, 'GET', `posts/${post.id}`), 200);
  assert.equal(await status(amy, 'GET', 'posts?problem=lc-1'), 403);
  assert.equal(await status(amy, 'GET', `posts/${post.id}`), 403);
  assert.equal(await status(cat, 'GET', 'posts?problem=lc-1'), 403);
  assert.equal(await status(amy, 'POST', 'posts', { problemId: 'lc-1', title: 'Leak', body: 'the answer' }), 403);
  assert.equal(await status(amy, 'POST', `posts/${post.id}/comments`, { body: 'thanks' }), 403);
  assert.equal(await status(amy, 'POST', `posts/${post.id}/vote`, { on: true }), 403);
  assert.equal(sqlite().prepare("SELECT COUNT(*) FROM solution_posts WHERE problem_id='lc-1'").pluck().get(), 1);
  // A problem outside the room stays open.
  assert.equal(await status(amy, 'GET', 'posts?problem=lc-20'), 200);
});

void test('the AI tutor refuses a problem of the running contest before any quota', async () => {
  assert.equal(await ai(amy, 'lc-1'), 403);
  assert.equal(await ai(cat, 'lc-1'), 403);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM ai_usage').pluck().get(), 0);
  // Past the contest gate: complexity waits for an AC (409) and never calls the model.
  assert.equal(await ai(bob, 'lc-1'), 409);
  assert.equal(await ai(amy, 'lc-20'), 409);
});

void test('once the window ends everything opens again', async () => {
  sqlite().prepare("UPDATE contest_rooms SET starts_at=? WHERE id='live'").run(Date.now() - 120 * MIN);
  assert.equal(inRunningContest(amy.id, 'lc-1'), false);
  assert.equal(await status(amy, 'GET', 'problems/lc-1/editorial'), 200);
  assert.equal(await status(amy, 'GET', 'posts?problem=lc-1'), 200);
  assert.equal(await ai(amy, 'lc-1'), 409);
});
