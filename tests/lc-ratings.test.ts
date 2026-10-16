// Contest ratings (zerotrac, MIT) on the bank: the data file, bands and chances, the list's
// rating / acceptance / list / solved-date filters and sorts, contests and level picks.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(resolve(tmpdir(), 'lc-ratings-'));
process.env.DATABASE_PATH = resolve(dir, 'db.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
const { sqlite } = await import('../db/sqlite');
const { listStudyLibrary, listLibrary, solvedPeriod } = await import('../lib/server/study-library');
const { lcRatingOf, lcRating } = await import('../lib/server/lc-ratings');
const lib = await import('../lib/lc-rating');
const { contestCode, convert } = await import('../scripts/import-lc-ratings.mjs');
const { handleOj } = await import('../lib/server/oj-api');
const file = (await import('../lib/content/lc-ratings.json')).default;

// Weekly 137 (four Line 500 problems), plus 1679 and 26 (unrated: a classic, no contest).
const W137 = [1046, 1047, 1048, 1049];
const NUMBERS = [...W137, 1679, 26];
const me = { id: 'rate-me', name: 'Me', email: 'me@example.test', role: 'student' as const, verified: true };

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','T','T','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','T','','t',0,'','1',0)",
  ).run();
  for (const n of NUMBERS) {
    const id = `lc-${n}`;
    // 26 stays unverified; the rest are judgeable.
    if (n !== 26) {
      db.prepare(
        `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',?,1,1,1)`,
      ).run(id, `v-${n}`);
      db.prepare(
        "INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,'{}','test','teacher',1)",
      ).run(`v-${n}`, id);
    }
    db.prepare(
      `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,
      case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES(?,?,?,?,?,?,'[]','{}','h',1,1,?,?,0)`,
    ).run(id, n, `p-${n}`, `题${n}`, `P${n}`, n === 1049 ? '困难' : '中等', id, n === 26 ? null : `h:v-${n}`);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const ids = (query: string, userId?: string) =>
  listStudyLibrary(new URLSearchParams(query), userId).items.map((item) => item.number);
const { ensurePracticeRound } = await import('../lib/server/practice-rounds');
// An AC in the learner's active round, as the judge records it.
const accept = (userId: string, n: number, at: number) =>
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,practice_round_id,created_at,updated_at)
      VALUES(?,?,?,'python','x','accepted',1,1,'judge',?,?,?)`,
    )
    .run(`s-${userId}-${n}-${at}`, userId, `lc-${n}`, ensurePracticeRound(userId), at, at);

void test('the data file carries the MIT notice and only numbers, contest codes and indices', () => {
  assert.match(file.license, /^MIT License/);
  assert.match(file.license, /Copyright \(c\) 2021 Shuxin Chen/);
  assert.match(file.source, /github\.com\/zerotrac\/leetcode_problem_rating/);
  const entries = Object.entries(file.ratings);
  assert.ok(entries.length > 2000);
  for (const [n, r] of entries) {
    assert.match(n, /^\d+$/);
    assert.deepEqual(Object.keys(r).sort(), ['contest', 'q', 'rating']);
    assert.equal(Number.isInteger(r.rating) && /^[wb]\d+$/.test(r.contest) && r.q >= 1 && r.q <= 5, true);
  }
  assert.equal(contestCode('weekly-contest-475'), 'w475');
  assert.equal(contestCode('biweekly-contest-12'), 'b12');
  assert.equal(contestCode('special'), null);
  assert.deepEqual(
    convert([{ ID: 1, Rating: 1234.6, ContestSlug: 'weekly-contest-9', ProblemIndex: 'Q2', Title: 'x' }]),
    { 1: { rating: 1235, contest: 'w9', q: 2 } },
  );
});

void test('the ratings file stays server-side: only lib/server/lc-ratings.ts imports it', () => {
  const hits: string[] = [];
  const walk = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|mjs)$/.test(name) && readFileSync(path, 'utf8').includes('lc-ratings.json')) hits.push(path);
    }
  };
  for (const folder of ['app', 'components', 'lib']) walk(folder);
  assert.deepEqual(hits, [join('lib', 'server', 'lc-ratings.ts')]);
});

void test('bands, chances, contest names, the median and level tiers', () => {
  assert.deepEqual(
    [1199, 1200, 1399, 1400, 1600, 1899, 1900, 2100, 2399, 2400].map(lib.ratingBand),
    ['grey', 'green', 'green', 'cyan', 'blue', 'blue', 'purple', 'orange', 'orange', 'red'],
  );
  assert.equal(lib.solveChance(1500, 1500), 0.5);
  assert.ok(Math.abs(lib.solveChance(1900, 1500) - 1 / 11) < 1e-9);
  assert.equal(lib.contestName('w475', true), '第 475 场周赛');
  assert.equal(lib.contestName('b12', false), 'Biweekly 12');
  assert.equal(lib.median([3, 1, 2]), 2);
  assert.equal(lib.median([1400, 1500]), 1450);
  assert.equal(lib.median([]), null);
  const tiers = lib.pickAtLevel(
    [1290, 1300, 1310, 1320, 1350, 1499, 1500, 1560, 1649, 1650, 1700, 1850, 1851].map((rating) => ({ rating })),
    1500,
  );
  assert.deepEqual(
    tiers.map((t) => [t.tier, t.items.map((i) => i.rating)]),
    [
      ['easy', [1310, 1320, 1350]],
      ['moderate', [1500, 1560, 1649]],
      ['hard', [1650, 1700, 1850]],
    ],
  );
});

void test('rows and the problem GET carry the rating; filters and sorts by rating keep unrated last', async () => {
  const r = (n: number) => lcRatingOf(n)!.rating;
  assert.equal(lcRating('lc-26'), null);
  assert.equal(lcRating('oa-x-1'), null);
  const items = listStudyLibrary(new URLSearchParams()).items;
  assert.equal(items.find((i) => i.number === 1046)!.rating, r(1046));
  assert.equal(items.find((i) => i.number === 26)!.rating, null);
  const rated = [...W137, 1679].sort((a, b) => r(a) - r(b));
  assert.deepEqual(ids('sort=rating'), [...rated, 26]);
  assert.deepEqual(ids('sort=rating&dir=desc'), [...rated.reverse(), 26]);
  const mid = r(rated[2]);
  assert.deepEqual(
    ids(`ratingMin=${mid}`).sort(),
    rated.filter((n) => r(n) >= mid).sort(),
  );
  assert.deepEqual(ids(`ratingMax=${mid - 1}`).sort(), rated.filter((n) => r(n) < mid).sort());
  assert.equal(ids('ratingMin=abc').length, NUMBERS.length, 'a bad bound is no bound');
  // number and difficulty either way; no company needed any more.
  assert.deepEqual(ids('sort=number&dir=desc'), [...NUMBERS].sort((a, b) => b - a));
  assert.equal(ids('sort=difficulty&dir=desc')[0], 1049);
  assert.equal(ids('sort=difficulty').at(-1), 1049);
  // The whole bank sorts in SQL the same way.
  const all = (query: string) =>
    listStudyLibrary(new URLSearchParams(`collection=all&${query}`)).items.map((i) => i.number);
  assert.deepEqual(all('sort=rating&dir=desc'), [...rated, 26]);
  assert.deepEqual(all(`ratingMin=${mid}&sort=rating`), rated.filter((n) => r(n) >= mid).reverse());
  assert.deepEqual(all('sort=difficulty&dir=desc')[0], 1049);
  assert.deepEqual(all('sort=number&dir=desc'), [...NUMBERS].sort((a, b) => b - a));
  const problem = (await (
    await handleOj(new Request('https://cswork.test/api/oj/problems/lc-1046'), me, ['problems', 'lc-1046'])
  ).json()) as { rating: number | null };
  assert.equal(problem.rating, r(1046));
});

void test('acceptance sorts by the share of people, problems under the floor last', () => {
  const db = sqlite();
  const insert = db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
    VALUES(?,?,?,'python','x',?,0,1,'judge',1,1)`,
  );
  // lc-1046: 20 of 20 people; lc-1047: 5 of 20; lc-1048: 19 people only (under MIN_PEOPLE).
  for (let i = 0; i < 20; i++) {
    insert.run(`a1-${i}`, `crowd-${i}`, 'lc-1046', 'accepted');
    insert.run(`a2-${i}`, `crowd-${i}`, 'lc-1047', i < 5 ? 'accepted' : 'wrong_answer');
    if (i < 19) insert.run(`a3-${i}`, `crowd-${i}`, 'lc-1048', 'accepted');
  }
  const list = listStudyLibrary(new URLSearchParams('sort=acceptance&dir=desc'));
  assert.deepEqual(list.items.slice(0, 2).map((i) => i.number), [1046, 1047]);
  assert.equal((list.items[0] as { acceptance?: number }).acceptance, 100);
  assert.equal((list.items[1] as { acceptance?: number }).acceptance, 25);
  assert.equal('acceptance' in list.items[2], false);
  assert.deepEqual(ids('sort=acceptance&dir=asc').slice(0, 2), [1047, 1046]);
});

void test('list= shows a readable list only; solved= filters by AC month in the viewer zone', () => {
  const db = sqlite();
  for (const [id, owner, visibility] of [
    ['list-mine-01', me.id, 'private'],
    ['list-open-01', 'someone', 'public'],
    ['list-shut-01', 'someone', 'private'],
  ])
    db.prepare(
      `INSERT INTO user_lists(id,owner_id,title,description,visibility,created_at,updated_at) VALUES(?,?,?,'',?,1,1)`,
    ).run(id, owner, id, visibility);
  db.prepare('INSERT INTO user_list_items(list_id,problem_id,position,added_at) VALUES(?,?,1,1)').run('list-mine-01', 'lc-1047');
  db.prepare('INSERT INTO user_list_items(list_id,problem_id,position,added_at) VALUES(?,?,1,1)').run('list-open-01', 'lc-26');
  assert.deepEqual(ids('list=list-mine-01', me.id), [1047]);
  assert.deepEqual(ids('list=list-open-01'), [26], 'public lists for guests too');
  for (const list of ['list-shut-01', 'list-mine-01', 'nope']) {
    const userId = list === 'list-mine-01' ? 'other' : me.id;
    assert.throws(() => listStudyLibrary(new URLSearchParams(`list=${list}`), userId), { status: 404 });
  }
  // 15:30 UTC on 31 March is March in Beijing; 16:30 UTC is already 1 April there, still March in UTC.
  accept(me.id, 1048, Date.UTC(2026, 2, 31, 15, 30));
  accept(me.id, 1049, Date.UTC(2026, 2, 31, 16, 30));
  assert.deepEqual(ids('solved=2026-03', me.id), [1048]);
  assert.deepEqual(ids('solved=2026-04', me.id), [1049]);
  assert.deepEqual(ids('solved=2026-03&tz=0', me.id).sort(), [1048, 1049]);
  assert.deepEqual(ids('solved=2026', me.id).sort(), [1048, 1049]);
  assert.deepEqual(ids('solved=2026'), [], 'guests have solved nothing');
  assert.throws(() => listStudyLibrary(new URLSearchParams('solved=2026-13'), me.id), { status: 400 });
  assert.deepEqual(solvedPeriod('2026-12', '0'), [Date.UTC(2026, 11, 1), Date.UTC(2027, 0, 1)]);
});

void test('view=contests groups the bank by contest, Q1–Q4 in order, with progress; members only', async () => {
  assert.throws(() => listLibrary(new URLSearchParams('view=contests')), { status: 401 });
  const page = listLibrary(new URLSearchParams('view=contests'), me.id) as {
    contests: { code: string; problems: { number: number; q: number; solved: boolean; rating: number }[] }[];
    total: number;
  };
  // 1679 is in a later contest (higher numbers are newer), so it comes first.
  assert.deepEqual(page.contests.map((c) => c.code), [lcRatingOf(1679)!.contest, 'w137']);
  const w137 = page.contests[1].problems;
  assert.deepEqual(w137.map((p) => p.q), [1, 2, 3, 4]);
  assert.equal(w137.find((p) => p.number === 1048)!.solved, true);
  assert.equal(page.total, 2);
});

void test('level picks: median of the latest 30 rated ACs, three tiers of unsolved problems with chances', async () => {
  const response = await handleOj(new Request('https://cswork.test/api/oj/recommend'), { ...me, id: 'fresh' }, ['recommend']);
  const fresh = (await response.json()) as { level: number; samples: number; tiers: { items: unknown[] }[] };
  assert.equal(fresh.level, lib.START_LEVEL);
  assert.equal(fresh.samples, 0);
  const { levelPicks } = await import('../lib/server/study-library');
  // me solved 1048 and 1049: level is their median; neither is offered again.
  const picks = await levelPicks(me.id);
  assert.equal(picks.level, lib.median([lcRatingOf(1048)!.rating, lcRatingOf(1049)!.rating]));
  const offered = picks.tiers.flatMap((t) => t.items.map((i) => i.id));
  assert.equal(offered.includes('lc-1048') || offered.includes('lc-1049') || offered.includes('lc-26'), false);
  for (const tier of picks.tiers)
    for (const item of tier.items) {
      assert.equal(item.rating >= tier.from && item.rating <= tier.to, true);
      assert.equal(item.chance, Math.round(100 * lib.solveChance(item.rating, picks.level)));
    }
  // An AC after the editorial does not set the level, but the problem still counts as solved.
  const aided = { ...me, id: 'aided' };
  sqlite()
    .prepare("INSERT INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES('aided','lc-1049','editorial',0,?)")
    .run(Date.UTC(2026, 2, 1));
  accept(aided.id, 1046, Date.UTC(2026, 2, 2));
  accept(aided.id, 1049, Date.UTC(2026, 2, 3));
  const assisted = await levelPicks(aided.id);
  assert.deepEqual([assisted.level, assisted.samples], [lcRatingOf(1046)!.rating, 1]);
  assert.equal(assisted.tiers.some((t) => t.items.some((i) => i.id === 'lc-1049')), false);
});
