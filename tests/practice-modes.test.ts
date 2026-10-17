import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// Whiteboard mode and "stress test agreed before AC" records (lib/server/practice-aids.ts).
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-practice-modes-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { solveQuality } = await import('../lib/practice-review');
type History = import('../lib/practice-review').PracticeHistoryItem;

const me: Person = { id: 'modes-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'modes-other', email: 'other@example.test' };

function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function post(p: Person, problem: string, body: unknown) {
  try {
    const response = await call(p, 'POST', `problems/${problem}/aids`, body);
    return { status: response.status, body: (await response.json()) as { recorded: boolean } };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: null };
  }
}
let clock = Date.now();
function submit(user: string, problem: string, status: string, mode = 'judge', customInput: string | null = null) {
  const id = randomUUID();
  clock += 1000;
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,problem_version_id,language,code,status,total,mode,custom_input,created_at,updated_at)
      VALUES(?,?,?,'v-modes','python','',?,1,?,?,?,?)`,
    )
    .run(id, user, problem, status, mode, customInput, clock, clock);
  return id;
}
const setStatus = (id: string, status: string) =>
  sqlite().prepare('UPDATE submissions SET status=? WHERE id=?').run(status, id);
function outputs(id: string, stdout: (string | null)[]) {
  stdout.forEach((out, ordinal) =>
    sqlite()
      .prepare('INSERT INTO oj_results(submission_id,ordinal,status,stdout,hidden) VALUES(?,?,?,?,0)')
      .run(id, ordinal, out === null ? 'runtime_error' : 'finished', out ?? ''),
  );
}
/** One stress test: the learner's side and the reference side on the same three cases. */
function stress(user: string, problem: string, mine: (string | null)[], reference: string[], seed = 1) {
  const cases = JSON.stringify({ cases: [`[${seed}]`, `[${seed + 1}]`, `[${seed + 2}]`] });
  const referenceId = submit(user, problem, 'finished', 'stress-ref', cases);
  const submissionId = submit(user, problem, mine.includes(null) ? 'runtime_error' : 'finished', 'stress', cases);
  outputs(referenceId, reference);
  outputs(submissionId, mine);
  return { kind: 'brute', submissionId, referenceId };
}
const history = async (p: Person) => {
  const response = await call(p, 'GET', 'history');
  return ((await response.json()) as { items: History[] }).items;
};

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite()
    .prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES('lc-53','c','l','v-modes',1,1,1)`,
    )
    .run();
  sqlite()
    .prepare(
      `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES('v-modes','lc-53',1,'{"checker":"tokens"}','x','t',1)`,
    )
    .run();
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('whiteboard: the latest formal submission once judged, first attempt only', async () => {
  const wb = (submissionId: string, p = me, problem = 'lc-53') => post(p, problem, { kind: 'whiteboard', submissionId });
  assert.equal((await post(me, 'lc-53', { kind: 'whiteboard' })).status, 400);
  assert.equal((await post(me, 'lc-53', { kind: 'whiteboard', submissionId: 'nope' })).status, 400);
  assert.equal((await post(me, 'lc-53', { kind: 'whiteboard', submissionId: randomUUID(), extra: 1 })).status, 400);
  // Somebody else's submission, a run, an older one: not this learner's whiteboard attempt.
  const theirs = submit(other.id, 'lc-53', 'accepted');
  assert.equal((await wb(theirs)).status, 404);
  const run = submit(me.id, 'lc-53', 'finished', 'run');
  assert.equal((await wb(run)).status, 404, 'runs are rejected');
  const older = submit(me.id, 'lc-53', 'accepted');
  const latest = submit(me.id, 'lc-53', 'queued');
  assert.equal((await wb(older)).status, 404, 'only the latest formal submission');
  assert.equal((await wb(latest, me, 'lc-1')).status, 404, 'the submission belongs to the problem in the path');
  assert.equal((await wb(latest)).status, 409, 'still judging');
  setStatus(latest, 'system_error');
  assert.deepEqual((await wb(latest)).body, { recorded: false }, 'a judge fault is no attempt');
  setStatus(latest, 'wrong_answer');
  assert.deepEqual((await wb(latest)).body, { recorded: true });
  const next = submit(me.id, 'lc-53', 'accepted');
  assert.deepEqual((await wb(next)).body, { recorded: false }, 'the first attempt stays');
  const item = (await history(me)).find((i) => i.problemId === 'lc-53')!;
  assert.equal(item.whiteboard, 0);
  // A pass on another problem; nobody else's record changes.
  const pass = submit(me.id, 'lc-70', 'accepted');
  assert.deepEqual((await wb(pass, me, 'lc-70')).body, { recorded: true });
  assert.equal((await history(me)).find((i) => i.problemId === 'lc-70')!.whiteboard, 1);
  assert.equal((await history(other)).find((i) => i.problemId === 'lc-53')!.whiteboard, null);
});

void test('brute: both stress sides compared on the server, before the first AC only', async () => {
  const p = 'lc-88';
  assert.equal((await post(me, p, { kind: 'brute' })).status, 400);
  // A disagreement or a crashed case records nothing.
  assert.deepEqual((await post(me, p, stress(me.id, p, ['1', '2', '4'], ['1', '2', '3']))).body, { recorded: false });
  assert.deepEqual((await post(me, p, stress(me.id, p, ['1', null, '3'], ['1', '2', '3']))).body, { recorded: false });
  // Not one stress test of this learner's on this problem.
  const theirs = stress(other.id, p, ['1', '2', '3'], ['1', '2', '3']);
  assert.equal((await post(me, p, theirs)).status, 404, "someone else's runs");
  // The problem's tokens checker: whitespace aside, these agree.
  const a = stress(me.id, p, ['1 ', '2\n', '3'], ['1', '2', '3'], 1);
  const b = stress(me.id, p, ['1', '2', '3'], ['1', '2', '3'], 7);
  assert.equal((await post(me, p, { ...a, referenceId: a.submissionId })).status, 404, 'two learner sides');
  assert.equal((await post(me, p, { ...a, referenceId: b.referenceId })).status, 404, 'different cases');
  assert.equal((await post(me, p, { ...a, submissionId: submit(me.id, p, 'wrong_answer') })).status, 404, 'a formal submission');
  assert.equal((await post(me, 'lc-1', a)).status, 404, 'the stress test belongs to the problem in the path');
  const running = stress(me.id, p, ['1', '2', '3'], ['1', '2', '3'], 20);
  setStatus(running.referenceId, 'running');
  assert.equal((await post(me, p, running)).status, 409, 'wait for both sides');
  assert.deepEqual((await post(me, p, a)).body, { recorded: true });
  assert.deepEqual((await post(me, p, b)).body, { recorded: false }, 'once per problem');
  assert.equal((await history(me)).find((i) => i.problemId === p)!.brute, true);
  // After the first AC an agreeing stress test is no longer "before AC".
  submit(me.id, 'lc-89', 'accepted');
  assert.deepEqual((await post(me, 'lc-89', stress(me.id, 'lc-89', ['1', '2', '3'], ['1', '2', '3']))).body, { recorded: false });
  assert.equal((await history(me)).find((i) => i.problemId === 'lc-89')!.brute, false);
  // Neither kind counts as help.
  assert.equal((await history(me)).find((i) => i.problemId === p)!.help, 'none');
});

void test('solve quality counts whiteboard attempts and passes, and stress-checked solves', () => {
  const item = (problemId: string, extra: Partial<History>): History => ({
    problemId,
    attempts: 1,
    firstAt: 1,
    lastAt: 1,
    firstAcAt: 1,
    failuresBeforeAc: 0,
    lastStatus: 'accepted',
    languages: ['python'],
    acAt: [1],
    stop: null,
    help: 'none',
    solveSeconds: null,
    whiteboard: null,
    brute: false,
    ...extra,
  });
  const q = solveQuality(
    [
      item('a', { whiteboard: 1, brute: true }),
      item('b', { whiteboard: 0, brute: true }),
      item('c', {}),
      // Unsolved: a failed whiteboard attempt counts, a stress check does not.
      item('d', { firstAcAt: null, acAt: [], whiteboard: 0, brute: true }),
    ],
    () => undefined,
  );
  assert.deepEqual([q.wbTried, q.wbPassed, q.brute], [3, 1, 2]);
});
