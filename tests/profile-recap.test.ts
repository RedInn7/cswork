import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-profile-recap-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { publicCompare, publicProfile, publicYear } = await import('../lib/server/learner-cloud');

const HOUR = 3600000;
const catalogue = new Map([
  ['lc-1', { difficulty: '简单' }],
  ['lc-3', { difficulty: '中等' }],
  ['lc-11', { difficulty: '中等' }],
  ['lc-20', { difficulty: '简单' }],
  ['oa-amazon-1', { difficulty: '困难' }],
]);
let n = 0;
function ac(user: string, problem: string, at: number, mode = 'judge') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','','accepted',1,1,?,?,?)`,
    )
    .run(`r${++n}`, user, problem, mode, at, at);
}
function profile(user: string, handle: string, visible = 1, showContest = 0) {
  sqlite()
    .prepare(
      `INSERT INTO user_profiles(user_id,handle,visible,indexable,show_contest,bio,created_at,updated_at) VALUES(?,?,?,0,?,'',1,1)`,
    )
    .run(user, handle, visible, showContest);
}
const now = Date.UTC(2026, 5, 1);

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  profile('u-ann', 'ann', 1, 1);
  profile('u-bob', 'bob');
  profile('u-cat', 'cat');
  profile('u-hid', 'hidden-one', 0);
  // Ann: one AC late on the last UTC day of 2025, one just after the new year, one in March.
  ac('u-ann', 'lc-1', Date.UTC(2025, 11, 31, 23, 30));
  ac('u-ann', 'lc-3', Date.UTC(2026, 0, 1, 0, 30));
  ac('u-ann', 'lc-11', Date.UTC(2026, 2, 3, 12));
  ac('u-ann', 'oa-amazon-1', Date.UTC(2026, 2, 4, 12));
  ac('u-ann', 'course-x', Date.UTC(2026, 2, 4, 12)); // not in the public catalogue
  ac('u-ann', 'lc-20', Date.UTC(2026, 2, 5, 12), 'drill'); // drills never count
  ac('u-ann', 'lc-1', Date.UTC(2024, 4, 1, 12));
  ac('u-bob', 'lc-1', Date.UTC(2026, 1, 1));
  ac('u-bob', 'lc-3', Date.UTC(2026, 1, 1));
  ac('u-bob', 'lc-20', Date.UTC(2026, 1, 1));
  ac('u-cat', 'lc-3', Date.UTC(2026, 1, 1));
  ac('u-hid', 'lc-1', Date.UTC(2026, 1, 1));
  const db = sqlite();
  for (const [id, at, before, after] of [
    ['weekly-500', Date.UTC(2025, 10, 1), 1500, 1520],
    ['weekly-510', Date.UTC(2026, 1, 1), 1520, 1555],
    ['weekly-520', Date.UTC(2026, 3, 1), 1555, 1540],
  ] as const) {
    db.prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
      VALUES(?,NULL,?,'weekly','[]',?,90,'public',?,1)`,
    ).run(id, id, at, at + 1);
    db.prepare(
      `INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES('u-ann',?,?,?,1,9,1,?)`,
    ).run(id, before, after, at + 1);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a year is only for visible profiles, from 2000 to this year', () => {
  assert.equal(publicYear('hidden-one', 2026, catalogue, now), null);
  assert.equal(publicYear('nobody', 2026, catalogue, now), null);
  assert.equal(publicYear('ann', 2027, catalogue, now), null, 'not yet');
  assert.equal(publicYear('ann', 1999, catalogue, now), null);
  assert.equal(publicYear('ann', 2026.5, catalogue, now), null);
  assert.ok(publicYear('ann', 2024, catalogue, now));
});

void test('the year counts its own UTC days and pads the heatmap for the reader’s time zone', () => {
  const y2025 = publicYear('ann', 2025, catalogue, now)!;
  assert.deepEqual(y2025.solved, { total: 1, easy: 1, medium: 0, hard: 0 });
  const y2026 = publicYear('ann', 2026, catalogue, now)!;
  assert.deepEqual(y2026.solved, { total: 3, easy: 0, medium: 2, hard: 1 }, 'drills and course exercises stay out');
  assert.deepEqual(y2026.stops, [{ slug: 'two-pointers-windows', solved: 2, total: y2026.stops[0].total }]);
  // 2025's buckets reach 14 hours into 2026: UTC+14 and UTC−12 readers cut their own year out.
  assert.deepEqual(
    y2025.activity.map((a) => a.created_at),
    [Date.UTC(2026, 0, 1, 0), Date.UTC(2025, 11, 31, 23)],
  );
  assert.ok(y2026.activity.some((a) => a.created_at === Date.UTC(2025, 11, 31, 23)));
  assert.ok(y2026.activity.every((a) => /^\d+$/.test(a.problem_id) && a.created_at % HOUR === 0), 'opaque, whole hours');
  assert.deepEqual(y2026.years, [2026, 2025, 2024]);
  assert.deepEqual(publicProfile('ann', catalogue, now)!.years, [2026, 2025, 2024]);
  // Contests shown: this year's two weeklies, the rating before the first and after the last.
  assert.deepEqual(y2026.contest, { contests: 2, start: 1520, end: 1540 });
  assert.equal(publicYear('bob', 2026, catalogue, now)!.contest, null, 'contests hidden');
  assert.equal(JSON.stringify(y2026).includes('u-ann'), false);
  assert.equal(JSON.stringify(y2026).includes('lc-'), false, 'no problem ids');
});

const follow = (from: string, to: string) =>
  sqlite().prepare('INSERT INTO user_follows(follower_id,followee_id,created_at) VALUES(?,?,1)').run(from, to);

void test('compare: per-person counts and the number solved by all, never which problems', () => {
  follow('u-ann', 'u-bob');
  follow('u-bob', 'u-ann');
  const two = publicCompare(['ann', 'bob'], catalogue, 'u-ann')!;
  assert.deepEqual(
    two.people.map((p) => [p.handle, p.solved.total]),
    [
      ['ann', 4],
      ['bob', 3],
    ],
  );
  assert.equal(two.common, 2, 'lc-1 and lc-3');
  assert.deepEqual(two.people[1].stops, { 'hash-counting': 1, 'two-pointers-windows': 1, 'stacks-heaps': 1 });
  assert.deepEqual(two.stops.map((s) => s.slug).sort(), ['hash-counting', 'stacks-heaps', 'two-pointers-windows']);
  assert.equal(JSON.stringify(two).includes('lc-'), false, 'no problem ids');
  assert.equal(publicCompare(['ann', 'bob'], catalogue, 'u-bob')!.common, 2, 'either side of the pair');
  follow('u-ann', 'u-cat');
  follow('u-cat', 'u-ann');
  assert.equal(publicCompare(['ann', 'bob', 'cat'], catalogue, 'u-ann')!.common, 1, 'lc-3 only');
  assert.equal(publicCompare(['ann', 'hidden-one'], catalogue), null);
  assert.equal(publicCompare(['ann', 'ann'], catalogue), null, 'two different people');
  assert.equal(publicCompare(['ann', 'bob', 'cat', 'hidden-one'], catalogue), null, 'three at most');
});

void test('compare: the shared count only for a compared viewer who follows each of the others both ways', () => {
  // A throwaway account that accepts one problem must not learn whether someone else solved it.
  const common = (handles: string[], viewer?: string | null) => publicCompare(handles, catalogue, viewer)!.common;
  sqlite().prepare('DELETE FROM user_follows').run();
  assert.equal(common(['ann', 'bob']), null, 'signed out');
  follow('u-ann', 'u-bob');
  assert.equal(common(['ann', 'bob'], 'u-ann'), null, 'one way only');
  assert.equal(common(['ann', 'bob'], 'u-bob'), null);
  follow('u-bob', 'u-ann');
  assert.equal(common(['ann', 'bob'], 'u-ann'), 2);
  assert.equal(common(['ann', 'bob'], 'u-cat'), null, 'not one of them');
  assert.equal(common(['ann', 'bob']), null);
  // Three people: the viewer and each of the other two, both ways; the other two need not.
  follow('u-cat', 'u-ann');
  assert.equal(common(['ann', 'bob', 'cat'], 'u-ann'), null, 'ann does not follow cat back');
  follow('u-ann', 'u-cat');
  assert.equal(common(['ann', 'bob', 'cat'], 'u-ann'), 1);
  assert.equal(common(['bob', 'cat', 'ann'], 'u-ann'), 1, 'any order');
  assert.equal(common(['ann', 'bob', 'cat'], 'u-bob'), null, 'bob and cat do not follow each other');
  const shown = publicCompare(['ann', 'bob'], catalogue, 'u-ann')!;
  assert.equal(JSON.stringify(shown).includes('u-'), false, 'no account ids');
});
