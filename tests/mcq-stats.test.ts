// Site-wide MCQ answers: only a learner's first answer counts, it is graded on the server, odd
// picks are refused, a question shows nothing under 20 people, and corrections file as tickets.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-mcq-stats-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleMcqStats, mcqStats, recordMcqAnswer, MCQ_STATS_MIN } = await import('../lib/server/mcq-stats');

const person = (id: string, verified = true): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified });

async function call(p: Person | null, path: string[], body?: unknown, query = '') {
  const request = new Request(`https://cswork.test/api/oj/mcq/${path.join('/')}${query}`, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
  try {
    const r = await handleMcqStats(request, p, path);
    return { status: r.status, data: (await r.json()) as Record<string, unknown> };
  } catch (e) {
    const err = e as { status?: number; name?: string };
    return { status: err.status ?? (err.name === 'ZodError' ? 400 : 500), data: null };
  }
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => rmSync(dir, { recursive: true, force: true }));

// mcq-os-1: four choices, answer [2].
const single = 'mcq-os-1';

void test('the first answer counts and is graded on the server; later ones change nothing', async () => {
  assert.equal((await call(null, ['answers'], { id: single, picks: [2] })).status, 401);
  assert.equal((await call(person('unverified', false), ['answers'], { id: single, picks: [2] })).status, 403);
  const ada = person('ada');
  const first = await call(ada, ['answers'], { id: single, picks: [1] });
  assert.equal(first.status, 200);
  assert.deepEqual(first.data, { correct: false, first: true });
  // A retry after seeing the answer is not a second vote.
  assert.deepEqual((await call(ada, ['answers'], { id: single, picks: [2] })).data, { correct: true, first: false });
  const row = sqlite().prepare('SELECT picks, correct FROM mcq_answers WHERE user_id=?').get('ada');
  assert.deepEqual(row, { picks: '[1]', correct: 0 });
});

void test('unknown questions and malformed picks are refused', async () => {
  const ben = person('ben');
  assert.equal((await call(ben, ['answers'], { id: 'mcq-nope-1', picks: [0] })).status, 404);
  for (const picks of [[], [4], [-1], [0, 0], [0, 1], [1.5]])
    assert.equal((await call(ben, ['answers'], { id: single, picks })).status, 400, JSON.stringify(picks));
  assert.equal((await call(ben, ['answers'], { picks: [0] })).status, 400);
  assert.equal(sqlite().prepare("SELECT COUNT(*) n FROM mcq_answers WHERE user_id='ben'").pluck().get(), 0);
  // A select-all question takes several picks, in any order, graded as a set.
  const multi = (await import('../lib/content/oa-mcq.json')).default.questions.find((q) => q.answer.length > 1)!;
  assert.deepEqual(recordMcqAnswer('ben', { id: multi.id, picks: [...multi.answer].reverse() }), { correct: true, first: true });
});

void test('counts appear from 20 people, cached for 10 minutes, at most 50 ids a call', async () => {
  const now = Date.UTC(2026, 9, 1);
  const q = 'mcq-os-2';
  for (let i = 0; i < MCQ_STATS_MIN - 1; i++) recordMcqAnswer(`u${i}`, { id: q, picks: [i % 3 === 0 ? 0 : 1] });
  assert.deepEqual(mcqStats([q], now), {}, '19 people: hidden');
  recordMcqAnswer('u-last', { id: q, picks: [1] });
  assert.deepEqual(mcqStats([q], now), {}, 'still the cached view');
  const stat = mcqStats([q, 'mcq-nope-1'], now + 10 * 60_000)[q];
  assert.equal(stat.n, 20);
  // The answer of mcq-os-2 decides `right`; picks count each choice.
  const answer = (await import('../lib/content/oa-mcq.json')).default.questions.find((x) => x.id === q)!.answer[0];
  const zeros = Math.ceil((MCQ_STATS_MIN - 1) / 3);
  assert.deepEqual(stat.picks, [zeros, 20 - zeros, 0, 0]);
  assert.equal(stat.right, stat.picks[answer]);

  // Signed out reads; too many ids is refused.
  const read = await call(null, ['stats'], undefined, `?ids=${q},${single}`);
  assert.equal(read.status, 200);
  assert.deepEqual(Object.keys(read.data!.items as object), [q]);
  const many = Array.from({ length: 51 }, (_, i) => `mcq-os-${i + 1}`).join(',');
  assert.equal((await call(null, ['stats'], undefined, `?ids=${many}`)).status, 400);
  assert.equal((await call(null, ['nope'], undefined)).status, 404);
});

void test('a correction is a ticket tagged [ref]; teachers can list corrections apart from questions, after them on the dashboard', async () => {
  const { TICKET_REF, ticketPage } = await import('../lib/server/lms-support');
  for (const ok of ['mcq:mcq-os-1', 'sd:cache', 'learn:cpp/pointers', 'course:intro_1.2']) assert.match(ok, TICKET_REF);
  for (const bad of ['mcq:', 'quiz:x', 'mcq:a b', `mcq:${'x'.repeat(121)}`, 'sd:<x>']) assert.doesNotMatch(bad, TICKET_REF);
  const insert = sqlite().prepare("INSERT INTO tickets(id,user_id,title,body,status,created_at,updated_at) VALUES(?,?,?,?,'open',?,?)");
  insert.run('t1', 'ada', '[mcq:mcq-os-1] 答案有误', 'B is right', 1, 1);
  insert.run('t2', 'ada', '[lc-1] Report', 'body', 2, 2);
  insert.run('t3', 'ada', 'Course access', 'body', 3, 3);
  const teacher: Person = { ...person('teacher'), role: 'teacher' };
  const list = async (kind: string) => (await ticketPage(teacher, new URL(`http://local/tickets?kind=${kind}`))).items.map((t) => t.id);
  assert.deepEqual(await list('content'), ['t1']);
  assert.deepEqual(await list('support'), ['t3', 't2']);
  assert.deepEqual(await list(''), ['t3', 't2', 't1']);
  // The dashboard's queue (oldest first) puts learners' questions before corrections.
  const { dashboard } = await import('../lib/server/lms-roster');
  assert.deepEqual((await dashboard(teacher)).tickets.map((t) => t.id), ['t2', 't3', 't1']);
});
