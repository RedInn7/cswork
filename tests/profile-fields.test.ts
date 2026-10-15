import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-profile-fields-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { publicProfile, schoolKey } = await import('../lib/server/learner-cloud');
const { leaderboard, schoolBoards } = await import('../lib/server/contests');

const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const me = person('pf-me');

async function post(p: Person, body: unknown) {
  const url = new URL('https://cswork.test/api/oj/profile');
  try {
    const response = await handleOj(
      new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
      p,
      ['profile'],
    );
    return { status: response.status, body: (await response.json()) as { profile: Record<string, unknown> } };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: null };
  }
}

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('profile links must be https on the right site; javascript:, http: and look-alike hosts are refused', async () => {
  const base = { handle: 'link-rider', visible: true };
  const refused = [
    { kind: 'website', url: 'javascript:alert(1)' },
    { kind: 'website', url: 'http://example.com' },
    { kind: 'website', url: 'https://localhost/' },
    { kind: 'website', url: 'https://user:pw@example.com/' },
    { kind: 'github', url: 'https://gitlab.com/ada' },
    { kind: 'github', url: 'https://github.com.evil.test/ada' },
    { kind: 'github', url: 'https://evilgithub.com/ada' },
    { kind: 'linkedin', url: 'http://www.linkedin.com/in/ada' },
    { kind: 'x', url: 'https://example.com/ada' },
    { kind: 'mastodon', url: 'https://mastodon.social/@ada' },
  ];
  for (const link of refused) assert.equal((await post(me, { ...base, links: [link] })).status, 400, link.url);
  const five = Array.from({ length: 5 }, (_, i) => ({ kind: 'website', url: `https://a${i}.example.com` }));
  assert.equal((await post(me, { ...base, links: five })).status, 400, 'four at most');
  assert.equal((await post(me, { ...base, school: 'x'.repeat(81) })).status, 400);
  assert.equal((await post(me, { ...base, targetRole: 'x'.repeat(61) })).status, 400);
  assert.equal((await post(me, { ...base, gradYear: 1989 })).status, 400);
  assert.equal((await post(me, { ...base, gradYear: 2041 })).status, 400);

  const links = [
    { kind: 'website', url: 'https://ada.example.com' },
    { kind: 'github', url: 'https://github.com/ada' },
    { kind: 'linkedin', url: 'https://cn.linkedin.com/in/ada' },
    { kind: 'x', url: 'https://twitter.com/ada' },
  ];
  const saved = await post(me, { ...base, links, school: ' M.I.T. ', gradYear: 2027, targetRole: 'Backend SWE' });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body!.profile.links, [
    { kind: 'website', url: 'https://ada.example.com/' },
    { kind: 'github', url: 'https://github.com/ada' },
    { kind: 'linkedin', url: 'https://cn.linkedin.com/in/ada' },
    { kind: 'x', url: 'https://twitter.com/ada' },
  ]);
  assert.equal(saved.body!.profile.school, 'M.I.T.');
  assert.equal(sqlite().prepare('SELECT school_key FROM user_profiles WHERE user_id=?').pluck().get(me.id), 'mit');

  // An older settings page sends none of the new fields: nothing is cleared.
  const kept = await post(me, { ...base, bio: 'still here' });
  assert.deepEqual(
    [kept.body!.profile.links, kept.body!.profile.school, kept.body!.profile.gradYear, kept.body!.profile.targetRole],
    [saved.body!.profile.links, 'M.I.T.', 2027, 'Backend SWE'],
  );
  const page = publicProfile('link-rider', new Map())!;
  assert.equal(page.school, 'M.I.T.');
  assert.equal(page.gradYear, 2027);
  assert.equal(page.targetRole, 'Backend SWE');
  assert.equal(page.links.length, 4);
  // Sent empty, they clear.
  const cleared = await post(me, { ...base, links: [], school: '', gradYear: null, targetRole: '' });
  assert.deepEqual(
    [cleared.body!.profile.links, cleared.body!.profile.school, cleared.body!.profile.gradYear, cleared.body!.profile.targetRole],
    [[], '', null, ''],
  );
  assert.equal((await post(me, { handle: 'compare', visible: true })).status, 400, 'reserved for /u/compare');
});

void test('school keys fold case, punctuation and spaces', () => {
  assert.equal(schoolKey('M.I.T.'), 'mit');
  assert.equal(schoolKey('University of  Washington'), 'universityofwashington');
  assert.equal(schoolKey('清华大学（深圳）'), '清华大学深圳');
});

void test('a school board lists only learners showing both their profile and their contests', async () => {
  const db = sqlite();
  db.prepare(
    `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
    VALUES('weekly-900',NULL,'Weekly 900','weekly','[]',1000,90,'public',2000,1)`,
  ).run();
  const add = (id: string, rating: number, profile: { visible: number; show: number; school: string } | null) => {
    db.prepare(
      `INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES(?,'weekly-900',1500,?,1,9,1,2000)`,
    ).run(id, rating);
    db.prepare(`INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('weekly-900',?,?,1)`).run(id, `Racer ${id}`);
    if (profile)
      db.prepare(
        `INSERT INTO user_profiles(user_id,handle,visible,indexable,show_contest,bio,school,school_key,created_at,updated_at)
        VALUES(?,?,?,0,?,'',?,?,1,1)`,
      ).run(id, `h-${id}`, profile.visible, profile.show, profile.school, schoolKey(profile.school));
  };
  add('s1', 1700, { visible: 1, show: 1, school: 'Tsinghua' });
  add('s2', 1600, { visible: 1, show: 1, school: 'tsinghua' });
  add('s3', 1550, { visible: 1, show: 1, school: 'TsingHua.' });
  add('s4', 1800, { visible: 1, show: 0, school: 'Tsinghua' }); // contests hidden
  add('s5', 1900, { visible: 0, show: 1, school: 'Tsinghua' }); // profile hidden
  add('s6', 2000, { visible: 1, show: 1, school: 'MIT' }); // another school
  add('s7', 2100, null); // no profile at all

  assert.deepEqual(schoolBoards(), [{ key: 'tsinghua', name: 'TsingHua.', members: 3 }], 'MIT has one member');
  const board = await leaderboard(null, 100, 3000, 'tsinghua');
  assert.deepEqual(
    board.map((r) => [r.rank, r.name, r.handle]),
    [
      [1, 'Racer s1', 'h-s1'],
      [2, 'Racer s2', 'h-s2'],
      [3, 'Racer s3', 'h-s3'],
    ],
  );
  const everyone = await leaderboard(null, 100, 3000);
  assert.equal(everyone.length, 7, 'the site board is unchanged');
  assert.ok(everyone.every((r) => r.handle === null), 'and never names a handle');
});
