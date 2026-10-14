import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-group-camp-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { campTasks } = await import('../lib/server/group-camp');
const { classicList } = await import('../lib/classic-lists');

const DAY = 86400000;
const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const owner = person('c-owner');
const amy = person('c-amy');
const stranger = person('c-stranger');
type Camp = {
  plan: string;
  planName: [string, string];
  perDay: number;
  startDate: string;
  day: number;
  days: number;
  total: number;
  tasks: { id: string; number: number; titleEn: string }[];
};
type Detail = { id: string; camp: Camp | null; members: { name: string; camp: { today: boolean[]; done: number } | null }[] };
function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function ok(p: Person, method: string, path: string, body?: unknown) {
  const response = await call(p, method, path, body);
  assert.ok(response.status < 300, `${path} ${response.status}`);
  return (await response.json()) as Detail;
}
async function status(p: Person, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const date = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// Blind 75 in list order; the first five are judgeable here, the sixth is not.
const numbers = classicList('blind-75')!.groups.flatMap((g) => g.numbers).slice(0, 6);
let n = 0;
const solve = (user: string, number: number, at = Date.now()) =>
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','','accepted',1,1,'judge',?,?)`,
    )
    .run(`cs${++n}`, user, `lc-${number}`, at, at);

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  for (const [i, number] of numbers.entries()) {
    db.prepare(
      `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,imported_at)
      VALUES(?,?,?,?,?,'简单','[]','{}','source',1,1,1)`,
    ).run(`lc-${number}`, number, `p-${number}`, `题 ${number}`, `Problem ${number}`);
    if (i === 5) continue;
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
    ).run(`lc-${number}`, `v-${number}`);
    db.prepare(
      `INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,'{}','hash','teacher',1)`,
    ).run(`v-${number}`, `lc-${number}`);
    db.prepare(`UPDATE study_library SET judge_problem_id=id,verified_hash=content_hash || ':' || ? WHERE number=?`).run(
      `v-${number}`,
      number,
    );
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('the plan is the list’s judgeable problems in order', () => {
  assert.deepEqual(
    campTasks('blind-75').map((t) => t.number),
    numbers.slice(0, 5),
  );
  assert.deepEqual(campTasks('no-such-list'), []);
});

void test('the owner sets a cohort; members see day N, today’s slice and who finished it', async () => {
  const group = await ok(owner, 'POST', 'groups', { name: 'Blind sprint', displayName: 'Cap' });
  const code = (sqlite().prepare('SELECT invite_code FROM study_groups WHERE id=?').get(group.id) as { invite_code: string })
    .invite_code;
  await ok(amy, 'POST', 'groups/join', { code, displayName: 'Amy' });
  assert.equal(group.camp, null);
  const now = Date.now();
  const yesterday = date(now - DAY);
  // Members cannot set it; strangers cannot see the group at all.
  assert.equal(await status(amy, 'POST', `groups/${group.id}/camp`, { plan: 'blind-75', perDay: 2, startDate: yesterday }), 403);
  assert.equal(await status(stranger, 'POST', `groups/${group.id}/camp`, { plan: 'blind-75', perDay: 2, startDate: yesterday }), 404);
  for (const bad of [
    { plan: 'nope', perDay: 2, startDate: yesterday },
    { plan: 'blind-75', perDay: 0, startDate: yesterday },
    { plan: 'blind-75', perDay: 11, startDate: yesterday },
    { plan: 'blind-75', perDay: 2, startDate: date(now - 90 * DAY) },
    { plan: 'blind-75', perDay: 2, startDate: '2026-13-45' },
  ])
    assert.equal(await status(owner, 'POST', `groups/${group.id}/camp`, bad), 400, JSON.stringify(bad));
  // Day 2 of a two-a-day plan: problems 3 and 4.
  const [, , third, fourth] = numbers;
  solve(amy.id, third);
  solve(amy.id, numbers[0]);
  solve(owner.id, fourth, now - 5 * DAY); // Before day 1: does not count.
  const set = await ok(owner, 'POST', `groups/${group.id}/camp?tz=0`, { plan: 'blind-75', perDay: 2, startDate: yesterday });
  const camp = set.camp!;
  assert.equal(camp.day, 2);
  assert.equal(camp.days, 3);
  assert.equal(camp.total, 5);
  assert.deepEqual(camp.planName, ['Blind 75', 'Blind 75']);
  assert.deepEqual(
    camp.tasks.map((t) => t.number),
    [third, fourth],
  );
  const byName = new Map(set.members.map((m) => [m.name, m.camp!]));
  assert.deepEqual(byName.get('Amy'), { today: [true, false], done: 2 });
  assert.deepEqual(byName.get('Cap'), { today: [false, false], done: 0 });
  // Everyone in the group reads the same plan.
  assert.equal((await ok(amy, 'GET', `groups/${group.id}?tz=0`)).camp?.day, 2);
  // Before the start: no slice yet; after the last day: none either.
  const later = await ok(owner, 'POST', `groups/${group.id}/camp?tz=0`, { plan: 'blind-75', perDay: 2, startDate: date(now + 3 * DAY) });
  assert.equal(later.camp!.day, -2);
  assert.deepEqual(later.camp!.tasks, []);
  const over = await ok(owner, 'POST', `groups/${group.id}/camp?tz=0`, { plan: 'blind-75', perDay: 5, startDate: date(now - 5 * DAY) });
  assert.equal(over.camp!.day, 6);
  assert.deepEqual(over.camp!.tasks, []);
  // Removing it, and disbanding the group, clear the row.
  assert.equal((await ok(owner, 'POST', `groups/${group.id}/camp`, { plan: '' })).camp, null);
  await ok(owner, 'POST', `groups/${group.id}/camp`, { plan: 'grind-75', perDay: 3, startDate: yesterday });
  await call(owner, 'POST', `groups/${group.id}/delete`, {});
  assert.equal(sqlite().prepare('SELECT COUNT(*) AS n FROM study_group_camps').pluck().get(), 0);
});
