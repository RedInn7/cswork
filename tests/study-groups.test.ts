import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-study-groups-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'hiddenco';
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { groupDetail, memberKey, HISTORY_DAYS } = await import('../lib/server/study-groups');

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: `Real ${id}`,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
const owner = person('g-owner');
const amy = person('g-amy');
const bob = person('g-bob');
const stranger = person('g-stranger');
const teacher = person('g-teacher', { role: 'teacher' });

type Detail = Awaited<ReturnType<typeof groupDetail>>;
function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, url.pathname.split('/').slice(3));
}
async function ok<T = Detail>(p: Person | null, method: string, path: string, body?: unknown) {
  const response = await call(p, method, path, body);
  assert.ok(response.status === 200 || response.status === 201, `${path} ${response.status}`);
  return (await response.json()) as T;
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
let n = 0;
function submit(user: string, problem: string, state: string, at: number) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','',?,0,4,'judge',?,?)`,
    )
    .run(`gs${++n}`, user, problem, state, at, at);
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('create, join by code, and members only ever see display names', async () => {
  assert.equal(await status(null, 'GET', 'groups'), 401);
  assert.equal(
    await status(person('g-unverified', { verified: false }), 'POST', 'groups', { name: 'Grind', displayName: 'X' }),
    403,
  );
  // An RTL override or zero-width character is not a name.
  assert.equal(await status(owner, 'POST', 'groups', { name: 'Grind', displayName: 'ab‮cd' }), 400);
  // Nor are names that render blank: Hangul fillers, the braille blank, a lone combining mark.
  for (const blank of ['\u3164', '\u115F', '\u2800', '\u3164\u3164', 'a\uFFA0', '\u0301'])
    assert.equal(await status(person('g-blank'), 'POST', 'groups', { name: 'Grind', displayName: blank }), 400, escape(blank));
  const made = await ok(owner, 'POST', 'groups', { name: 'Line 500 sprint', displayName: 'Captain' });
  assert.equal(made.role, 'owner');
  assert.match(made.inviteCode!, /^[A-HJ-NP-Z2-9]{8}$/);

  // Codes forgive case, spaces and dashes; the preview names the group before joining.
  const typed = `${made.inviteCode!.slice(0, 4).toLowerCase()}-${made.inviteCode!.slice(4)}`;
  const preview = await ok<{ id: string | null; name: string; members: number }>(
    amy,
    'GET',
    `groups/preview?code=${encodeURIComponent(typed)}`,
  );
  assert.deepEqual(preview, { id: null, name: 'Line 500 sprint', members: 1, full: false });
  assert.equal(await status(amy, 'GET', 'groups/preview?code=ZZZZZZZZ'), 404);
  assert.equal(await status(amy, 'POST', 'groups/join', { code: typed, displayName: 'captain' }), 409, 'names are unique per group');
  // Uniqueness folds non-ASCII case and compatibility forms too.
  await ok(owner, 'POST', `groups/${made.id}/me`, { displayName: 'Élan' });
  assert.equal(await status(amy, 'POST', 'groups/join', { code: typed, displayName: 'élan' }), 409);
  assert.equal(await status(amy, 'POST', 'groups/join', { code: typed, displayName: 'ÉＬＡＮ' }), 409);
  await ok(owner, 'POST', `groups/${made.id}/me`, { displayName: 'Captain' });
  const joined = await ok(amy, 'POST', 'groups/join', { code: typed, displayName: 'Amy' });
  assert.equal(joined.id, made.id);
  assert.equal(joined.role, 'member');
  // Joining again is a no-op, not a second row.
  await ok(amy, 'POST', 'groups/join', { code: made.inviteCode, displayName: 'Amy again' });
  const seen = await ok(amy, 'GET', `groups/${made.id}`);
  assert.deepEqual(
    seen.members.map((m) => [m.name, m.role, m.me]),
    [
      ['Captain', 'owner', false],
      ['Amy', 'member', true],
    ],
  );
  const raw = JSON.stringify(seen);
  for (const secret of ['g-owner', 'g-amy', 'example.test', 'Real '])
    assert.ok(!raw.includes(secret), `the page leaks ${secret}`);

  // Not a member: the group reads as missing, whatever the action.
  assert.equal(await status(stranger, 'GET', `groups/${made.id}`), 404);
  assert.equal(await status(stranger, 'POST', `groups/${made.id}`, { goalText: 'mine now' }), 404);
  assert.equal(await status(stranger, 'POST', `groups/${made.id}/leave`, {}), 404);
  // A teacher moderates from a report without being handed the invite code.
  const moderated = await ok(teacher, 'GET', `groups/${made.id}`);
  assert.equal(moderated.role, null);
  assert.equal(moderated.inviteCode, null);

  const mine = await ok<{ items: { id: string; members: number; role: string }[] }>(amy, 'GET', 'groups');
  assert.deepEqual(mine.items.map((g) => [g.id, g.members, g.role]), [[made.id, 2, 'member']]);
});

void test('owner moderation: goal, remove, rotate, leave and disband', async () => {
  const made = await ok(owner, 'POST', 'groups', { name: 'Mods', displayName: 'Boss' });
  await ok(amy, 'POST', 'groups/join', { code: made.inviteCode, displayName: 'Amy' });
  await ok(bob, 'POST', 'groups/join', { code: made.inviteCode, displayName: 'Bob' });
  // Members cannot manage; only real stops are goals.
  assert.equal(await status(amy, 'POST', `groups/${made.id}`, { goalText: 'x' }), 403);
  assert.equal(await status(owner, 'POST', `groups/${made.id}`, { goalStop: 'not-a-stop' }), 400);
  const goal = await ok(owner, 'POST', `groups/${made.id}`, { goalText: 'Finish hashing by Sunday', goalStop: 'hash-counting' });
  assert.equal(goal.goal?.stop, 'hash-counting');
  assert.equal(goal.goal?.stopTotal, 19);
  assert.ok(goal.members.every((m) => m.goal === 0));
  // Renaming through the edit form (which resends the goal) keeps the goal's date.
  sqlite().prepare('UPDATE study_groups SET goal_set_at=1 WHERE id=?').run(made.id);
  const renamed = await ok(owner, 'POST', `groups/${made.id}`, {
    name: 'Mods 2',
    goalText: 'Finish hashing by Sunday',
    goalStop: 'hash-counting',
  });
  assert.equal(renamed.name, 'Mods 2');
  assert.equal(renamed.goal?.setAt, 1);
  const reset = await ok(owner, 'POST', `groups/${made.id}`, { goalText: 'Finish hashing by Sunday', goalStop: '' });
  assert.ok((reset.goal?.setAt ?? 0) > 1, 'a changed goal is dated now');

  // Members rename themselves, but not into someone else's name.
  assert.equal(await status(bob, 'POST', `groups/${made.id}/me`, { displayName: 'boss' }), 409);
  await ok(bob, 'POST', `groups/${made.id}/me`, { displayName: 'Bobby' });

  const bobKey = memberKey(made.id, bob.id);
  assert.equal(await status(amy, 'POST', `groups/${made.id}/remove`, { member: bobKey }), 403);
  assert.equal(
    await status(owner, 'POST', `groups/${made.id}/remove`, { member: memberKey(made.id, owner.id) }),
    409,
  );
  const after = await ok(owner, 'POST', `groups/${made.id}/remove`, { member: bobKey });
  assert.deepEqual(after.members.map((m) => m.name).sort(), ['Amy', 'Boss']);
  assert.equal(await status(bob, 'GET', `groups/${made.id}`), 404);
  // Removing changes the code, so the removed member cannot walk straight back in.
  assert.notEqual(after.inviteCode, made.inviteCode);
  assert.equal(await status(bob, 'POST', 'groups/join', { code: made.inviteCode, displayName: 'Bob' }), 404);

  // A rotated code shuts the old link.
  const rotated = await ok(owner, 'POST', `groups/${made.id}/rotate`, {});
  assert.notEqual(rotated.inviteCode, after.inviteCode);
  assert.equal(await status(bob, 'POST', 'groups/join', { code: after.inviteCode, displayName: 'Bob' }), 404);

  assert.equal(await status(owner, 'POST', `groups/${made.id}/leave`, {}), 409);
  await ok(amy, 'POST', `groups/${made.id}/leave`, {});
  assert.equal(await status(amy, 'GET', `groups/${made.id}`), 404);
  await ok(owner, 'POST', `groups/${made.id}/delete`, {});
  assert.equal(await status(owner, 'GET', `groups/${made.id}`), 404);
  assert.equal(
    (sqlite().prepare('SELECT COUNT(*) AS n FROM study_group_members WHERE group_id=?').get(made.id) as { n: number }).n,
    0,
  );
});

void test('caps: 50 members a group, 3 owned groups and 10 joined', async () => {
  const lead = person('g-lead');
  const made = await ok(lead, 'POST', 'groups', { name: 'Big', displayName: 'Lead' });
  const insert = sqlite().prepare(
    `INSERT INTO study_group_members(group_id,user_id,display_name,role,joined_at) VALUES(?,?,?,'member',?)`,
  );
  for (let i = 1; i < 50; i++) insert.run(made.id, `filler-${i}`, `Filler ${i}`, i);
  assert.equal(await status(person('g-late'), 'POST', 'groups/join', { code: made.inviteCode, displayName: 'Late' }), 409);

  await ok(lead, 'POST', 'groups', { name: 'Two', displayName: 'Lead' });
  await ok(lead, 'POST', 'groups', { name: 'Three', displayName: 'Lead' });
  assert.equal(await status(lead, 'POST', 'groups', { name: 'Four', displayName: 'Lead' }), 409);

  const busy = person('g-busy');
  for (let i = 0; i < 10; i++) insert.run(`other-${i}`, busy.id, 'Busy', i);
  const open = await ok(owner, 'POST', 'groups', { name: 'Open', displayName: 'Owner' });
  assert.equal(await status(busy, 'POST', 'groups/join', { code: open.inviteCode, displayName: 'Busy' }), 409);
});

void test('daily counts follow the reader time zone; the week, hidden companies and goal progress', async () => {
  const lead = person('g-tz');
  const made = await ok(lead, 'POST', 'groups', { name: 'Clock', displayName: 'Tz' });
  await ok(lead, 'POST', `groups/${made.id}`, { goalStop: 'hash-counting' });
  const H = 3600000;
  // Wednesday 2026-10-14 12:00 in Beijing (UTC+8, getTimezoneOffset -480).
  const now = Date.UTC(2026, 9, 14, 4);
  const bj = (day: number, hour: number) => Date.UTC(2026, 9, day, hour) - 8 * H;
  submit(lead.id, 'lc-1', 'accepted', bj(14, 1));
  submit(lead.id, 'lc-1', 'accepted', bj(13, 10));
  submit(lead.id, 'lc-3', 'accepted', bj(13, 11));
  submit(lead.id, 'lc-49', 'wrong_answer', bj(13, 12));
  submit(lead.id, 'oa-hiddenco-1', 'accepted', bj(14, 2));
  submit(lead.id, 'course-x', 'accepted', bj(14, 3));
  submit(lead.id, 'lc-128', 'accepted', bj(11, 12)); // Sunday: last week
  const beijing = groupDetail(made.id, lead, -480, now).members[0];
  assert.equal(beijing.days.length, HISTORY_DAYS);
  assert.deepEqual(beijing.days.slice(-4), [1, 0, 2, 2]);
  assert.equal(beijing.week, 3, 'distinct problems since Monday, course ones counted as on the own calendar, hidden ones not');
  assert.equal(beijing.goal, 2, 'lc-1 and lc-128 are on the hashing stop');
  // In UTC the 01:00 and 03:00 Beijing ACs are still yesterday.
  assert.deepEqual(groupDetail(made.id, lead, 0, now).members[0].days.slice(-2), [3, 0]);
});

void test('time zones count in whole hours, so sweeping tz cannot time an AC to the minute', () => {
  const lead = person('g-sweep');
  const id = 'Sweep0000001';
  sqlite()
    .prepare(`INSERT INTO study_groups(id,name,owner_id,invite_code,created_at,updated_at) VALUES(?,?,?,?,0,0)`)
    .run(id, 'Sweep', lead.id, 'SWEEPAAA');
  sqlite()
    .prepare(`INSERT INTO study_group_members(group_id,user_id,display_name,role,joined_at) VALUES(?,?,?,'owner',0)`)
    .run(id, lead.id, 'Sweeper');
  const now = Date.UTC(2026, 9, 14, 12);
  submit(lead.id, 'lc-1', 'accepted', Date.UTC(2026, 9, 14, 10, 37));
  const at = (tz: number) => groupDetail(id, lead, tz, now).members[0].days.slice(-2).join();
  // Minute-exact boundaries would put 10:37 UTC past midnight at tz=-803 (UTC+13:23).
  assert.equal(at(-803), at(-780));
  assert.equal(at(-809), at(-780));
  assert.notEqual(at(-840), at(-780), 'a real hour still moves the day');
});
