// The placement quiz API (lib/server/placement.ts): answers stay on the server, the ladder is
// judged there, the result is written once, a retake waits 30 days, and the notes API can't reach it.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
const dir = mkdtempSync(resolve(tmpdir(), 'placement-'));
process.env.DATABASE_PATH = resolve(dir, 'db.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handlePlacement } = await import('../lib/server/placement');
const { handleOj } = await import('../lib/server/oj-api');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');
type Person = Parameters<typeof handlePlacement>[1];

// Linear Structures: 1, 26, 125 and 283; Lists & Trees: 203 and 206 (only two, so a short group).
const NUMBERS = [1, 26, 125, 283, 203, 206];
const source = (number: number) => ({
  id: `lc-${number}`,
  number,
  slug: `p-${number}`,
  titleZh: `题 ${number}`,
  titleEn: `Problem ${number}`,
  difficulty: number === 283 ? '简单' : '中等',
  topics: ['数组'],
  descriptionZh: `第 ${number} 题的首段。\n\n**示例 1：**`,
  descriptionEn: `Opening of ${number}.\n\n**Example 1:**`,
  sourceUrl: `https://leetcode.cn/problems/p-${number}/`,
  sourceEnUrl: `https://leetcode.com/problems/p-${number}/`,
  attribution: 'test',
  signature: { name: 'f' },
  codeSnippets: [],
  reference: { path: '/private/solution.py' },
  cases: [],
  caseStatus: 'missing',
});

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const file = resolve(dir, 'source.jsonl');
  writeFileSync(file, NUMBERS.map((n) => JSON.stringify(source(n))).join('\n') + '\n');
  loadStudyLibrary(db, file);
  for (const n of NUMBERS) {
    const id = `lc-${n}`;
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
    db.prepare(`UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':v-' || ? WHERE id=?`).run(id, id, id);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const me = { id: 'u-place', name: 'Me', email: 'me@example.test', role: 'student', verified: true } as unknown as Person;
type View = {
  latest: { at: number; groups: { group: number; right: number; total: number; skip: boolean; level: number | null }[] } | null;
  retakeAt: number | null;
  session: { total: number; index: number; answered: boolean[]; group: number; question: { id: string; choices: string[]; excerptEn?: string } } | null;
  verdict?: { id: string; answer: string; right: boolean; reasonEn: string };
};
async function call(data?: unknown, p: Person = me) {
  const request = new Request('http://x/api/oj/speedrun/placement', {
    method: data === undefined ? 'GET' : 'POST',
    ...(data !== undefined && { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
  });
  return (await (await handlePlacement(request, p)).json()) as View;
}
/** The answer on the server, which the client never sees. */
const answerOf = (userId = me.id) =>
  (JSON.parse(
    sqlite().prepare("SELECT body FROM user_notes WHERE user_id=? AND target='placement:session'").pluck().get(userId) as string,
  ) as { steps: { answer: string }[] }).steps.at(-1)!.answer;

void test('a quiz runs group by group with the answers kept server-side, and writes one result', async () => {
  assert.deepEqual(await call(), { latest: null, retakeAt: null, session: null });
  await assert.rejects(call({ id: 'lc-1', pick: 'hash-counting' }), { status: 409 });
  const started = await call({ start: true });
  const session = started.session!;
  assert.equal(session.total, 5, 'three from the first group, both of the short second');
  assert.equal(session.group, 0);
  assert.equal(session.question.choices.length, 4);
  assert.equal(session.question.excerptEn?.startsWith('Opening of'), true);
  const shown = JSON.stringify(started);
  for (const secret of ['"answer"', '"reason', '"score"', '"target"', '/private/solution.py']) assert.equal(shown.includes(secret), false, secret);
  // Starting again resumes the same question instead of drawing a new one.
  assert.equal((await call({ start: true })).session!.question.id, session.question.id);
  await assert.rejects(call({ id: 'lc-999', pick: session.question.choices[0] }), { status: 409 });
  await assert.rejects(call({ id: session.question.id, pick: 'not-a-stop' }), { status: 400 });
  await assert.rejects(call({ id: session.question.id, pick: answerOf(), extra: 1 }), { name: 'ZodError' });

  let view = started;
  const groups: number[] = [];
  while (view.session) {
    const { question, group } = view.session;
    groups.push(group);
    const answer = answerOf();
    // The first group right throughout, the second wrong.
    const pick = group === 0 ? answer : question.choices.find((c) => c !== answer)!;
    view = await call({ id: question.id, pick });
    assert.deepEqual([view.verdict!.id, view.verdict!.answer, view.verdict!.right], [question.id, answer, group === 0]);
    assert.ok(view.verdict!.reasonEn.length > 0, 'the reason comes with the verdict');
  }
  assert.deepEqual(groups, [0, 0, 0, 1, 1]);
  const { latest, retakeAt } = view;
  assert.deepEqual(
    latest!.groups.map(({ group, right, total, skip }) => ({ group, right, total, skip })),
    [
      { group: 0, right: 3, total: 3, skip: true },
      { group: 1, right: 0, total: 2, skip: false },
    ],
  );
  assert.equal(retakeAt, latest!.at + 30 * 86_400_000);
  assert.equal(sqlite().prepare("SELECT COUNT(*) FROM user_notes WHERE target='placement:session'").pluck().get(), 0);
  // A retake waits 30 days; then it opens.
  await assert.rejects(call({ start: true }), { status: 409 });
  sqlite()
    .prepare("UPDATE user_notes SET body=json_set(body,'$.at',?) WHERE user_id=? AND target='placement:latest'")
    .run(latest!.at - 31 * 86_400_000, me.id);
  assert.equal((await call({ start: true })).session!.index, 0);
});

void test('the notes API can neither read a session nor write a result', async () => {
  const other = { ...me, id: 'u-notes' } as Person;
  await call({ start: true }, other);
  for (const target of ['placement:session', 'placement:latest']) {
    const url = `http://x/api/oj/notes?target=${encodeURIComponent(target)}`;
    await assert.rejects(handleOj(new Request(url), other, ['notes']), { name: 'ZodError' });
    await assert.rejects(
      handleOj(new Request(url, { method: 'PUT', body: JSON.stringify({ body: '{"at":0,"groups":[]}' }) }), other, ['notes']),
      { name: 'ZodError' },
    );
  }
});

void test('problems in the learner’s running contest stay out of the quiz', async () => {
  const racer = { ...me, id: 'u-racer' } as Person;
  const now = Date.now();
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,created_at)
      VALUES('room-1','u-racer','Room','room',?,?,90,?)`,
    )
    .run(JSON.stringify(NUMBERS.map((n) => `lc-${n}`)), now - 60_000, now);
  sqlite().prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('room-1','u-racer','R',?)").run(now);
  await assert.rejects(call({ start: true }, racer), { status: 409 });
});
