import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-practice-board-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { publicProfile } = await import('../lib/server/learner-cloud');
const { badgeSvg, practiceBoard, practiceCard, problemPoints } = await import('../lib/server/practice-board');
const { GET } = await import('../app/u/[handle]/badge.svg/route');

const HOUR = 3600000;
// 15:00 local: an AC an hour ago is today, a day and an hour ago yesterday, in any process TZ.
const now = new Date(2026, 5, 10, 15).getTime();
// lc-1000 has a zerotrac rating of 2423; the rest fall back to their difficulty.
const catalogue = new Map([
  ['lc-1', { difficulty: '简单' }],
  ['lc-1000', { difficulty: '困难' }],
  ['lc-2', { difficulty: '中等' }],
  ['oa-amazon-1', { difficulty: '困难' }],
  ['course-x', { difficulty: '简单' }],
]);
let n = 0;
function profile(id: string, handle: string, { visible = 1, practice = 1, school = '' } = {}) {
  sqlite()
    .prepare(
      `INSERT INTO user_profiles(user_id,handle,visible,show_practice,school,school_key,created_at,updated_at)
      VALUES(?,?,?,?,?,?,1,1)`,
    )
    .run(id, handle, visible, practice, school, school.toLowerCase().replace(/\W/g, ''));
}
function ac(user: string, problem: string, at: number, language = 'python', mode = 'judge') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,?,'','accepted',1,1,?,?,?)`,
    )
    .run(`s${++n}`, user, problem, language, mode, at, at);
}

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  profile('u-ada', 'ada', { school: 'M.I.T.' });
  ac('u-ada', 'lc-1000', now - HOUR);
  ac('u-ada', 'lc-1', now - 25 * HOUR, 'cpp');
  ac('u-ada', 'lc-1', now - 2 * HOUR); // a second language, the same problem
  ac('u-ada', 'oa-amazon-1', now - 3 * HOUR, 'java');
  ac('u-ada', 'course-x', now - HOUR); // a course exercise never counts
  ac('u-ada', 'lc-9', now - HOUR); // nor a problem outside the public catalogue
  ac('u-ada', 'lc-2', now - HOUR, 'python', 'custom'); // nor a custom run
  profile('u-bo', 'bo', { school: 'M.I.T.' });
  ac('u-bo', 'lc-2', now - HOUR);
  profile('u-cy', 'cy', { school: 'mit' });
  ac('u-cy', 'lc-2', now - 5 * 24 * HOUR);
  ac('u-cy', 'lc-1', now - 5 * 24 * HOUR);
  // Two at CMU: below the 3 a school board needs.
  profile('u-di', 'di', { school: 'CMU' });
  ac('u-di', 'lc-1', now - HOUR);
  profile('u-ed', 'ed', { school: 'CMU' });
  ac('u-ed', 'lc-1', now - HOUR);
  // Public but not on the board, and on the board but not public.
  profile('u-quiet', 'quiet', { practice: 0, school: 'MIT' });
  ac('u-quiet', 'lc-1000', now - HOUR);
  profile('u-hidden', 'hidden', { visible: 0, school: 'MIT' });
  ac('u-hidden', 'lc-1000', now - HOUR);
  // Opted in, but only a course exercise: not listed yet.
  profile('u-new', 'newbie');
  ac('u-new', 'course-x', now - HOUR);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('points: the zerotrac rating, else 1200/1600/2000 by difficulty, each problem once', () => {
  assert.equal(problemPoints('lc-1000', catalogue), 2423);
  assert.deepEqual(['lc-1', 'lc-2', 'oa-amazon-1'].map((id) => problemPoints(id, catalogue)), [1200, 1600, 2000]);
  const board = practiceBoard(catalogue, {}, 'u-ada', now);
  const ada = board.rows.find((r) => r.handle === 'ada')!;
  assert.deepEqual(ada, { rank: 1, handle: 'ada', score: Math.round((2423 + 1200 + 2000) / 100), solved: 3, streak: 2, me: true });
  assert.deepEqual(board.mine, ada);
  // Only learners with a visible profile and show_practice on; nobody else's rows say "me".
  assert.deepEqual(board.rows.map((r) => r.handle).sort(), ['ada', 'bo', 'cy', 'di', 'ed']);
  assert.equal(board.rows.filter((r) => r.me).length, 1);
  assert.equal(board.optedIn, true);
  const waiting = practiceBoard(catalogue, {}, 'u-new', now);
  assert.deepEqual([waiting.mine, waiting.optedIn], [null, true]);
  assert.equal(practiceBoard(catalogue, {}, 'u-quiet', now).optedIn, false);
  assert.equal(practiceBoard(catalogue, {}, null, now).optedIn, false);
  // Ties share a rank: di and ed both solved one easy problem.
  const di = board.rows.find((r) => r.handle === 'di')!;
  assert.equal(board.rows.find((r) => r.handle === 'ed')!.rank, di.rank);
  // By streak: cy's last AC was five days ago.
  assert.equal(practiceBoard(catalogue, { sort: 'streak' }, null, now).rows.at(-1)!.handle, 'cy');
  assert.equal(practiceBoard(catalogue, { sort: 'solved' }, null, now).rows[0].handle, 'ada');
});

void test('a language counts only the problems accepted in it', () => {
  const python = practiceBoard(catalogue, { language: 'python' }, null, now).rows.find((r) => r.handle === 'ada')!;
  assert.deepEqual([python.solved, python.score], [2, Math.round((2423 + 1200) / 100)]);
  const java = practiceBoard(catalogue, { language: 'java' }, null, now).rows;
  assert.deepEqual(java.map((r) => [r.handle, r.solved, r.score]), [['ada', 1, 20]]);
  assert.deepEqual(practiceBoard(catalogue, { language: 'go' }, null, now).rows, []);
});

void test('a school needs 3 listed learners; spellings meet on the school key', () => {
  const { schools } = practiceBoard(catalogue, {}, null, now);
  // The most used spelling names it. quiet and hidden say MIT too, but are not listed, so they do not count.
  assert.deepEqual(schools, [{ key: 'mit', name: 'M.I.T.', members: 3 }]);
  const mit = practiceBoard(catalogue, { school: 'mit' }, null, now);
  assert.deepEqual(mit.rows.map((r) => r.handle), ['ada', 'cy', 'bo']);
  assert.equal(mit.school?.name, 'M.I.T.');
  const cmu = practiceBoard(catalogue, { school: 'cmu' }, null, now);
  assert.deepEqual([cmu.school, cmu.rows], [null, []]);
});

void test('opting out leaves the cached board at once; opting in joins it at once', () => {
  practiceBoard(catalogue, {}, null, now);
  sqlite().prepare('UPDATE user_profiles SET show_practice=0 WHERE user_id=?').run('u-bo');
  sqlite().prepare('UPDATE user_profiles SET show_practice=1 WHERE user_id=?').run('u-quiet');
  const handles = practiceBoard(catalogue, {}, null, now).rows.map((r) => r.handle);
  assert.equal(handles.includes('bo'), false);
  assert.equal(handles.includes('quiet'), true);
  sqlite().prepare('UPDATE user_profiles SET show_practice=1 WHERE user_id=?').run('u-bo');
  sqlite().prepare('UPDATE user_profiles SET show_practice=0 WHERE user_id=?').run('u-quiet');
});

void test('the badge: 404 while the profile is hidden, score and rank only on the board, escaped', async () => {
  const get = (handle: string, lang = '') =>
    GET(new Request(`https://cswork.test/u/${handle}/badge.svg${lang}`), { params: Promise.resolve({ handle }) });
  for (const handle of ['hidden', 'nobody-here', 'X<script>']) {
    const response = await get(handle);
    assert.equal(response.status, 404, handle);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  const response = await get('quiet', '?lang=en');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'");
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const svg = await response.text();
  assert.match(svg, /^<svg[^>]+width="320" height="60"/);
  assert.match(svg, /@quiet/);
  assert.equal(/pts|rank/.test(svg), false, 'off the board: no score or rank');

  assert.deepEqual(practiceCard('quiet', catalogue, now), { handle: 'quiet', solved: 1, streak: 1, score: null, rank: null });
  assert.deepEqual(practiceCard('ada', catalogue, now), { handle: 'ada', solved: 3, streak: 2, score: 56, rank: 1 });
  assert.equal(practiceCard('hidden', catalogue, now), null);
  const listed = badgeSvg(practiceCard('ada', catalogue, now)!, true);
  assert.match(listed, /通过 3 · 积分 56 · 第 1 名 · 连续 2 天/);
  const odd = badgeSvg({ handle: 'a<b>&"\'', solved: 0, streak: 0, score: null, rank: null }, false);
  assert.equal(odd.includes('<b>'), false);
  assert.match(odd, /@a&#60;b&#62;&#38;&#34;&#39;/);
});

void test('the profile charts: distinct problems by week, first solves per day by difficulty', () => {
  const page = publicProfile('ada', catalogue, now)!;
  assert.equal(page.climb!.weeks.at(-1), page.solved.total);
  assert.equal(page.climb!.weeks.at(-1), 3);
  assert.equal(page.effort.days.length, 84);
  // lc-1 counts once, on its first AC (yesterday, in C++).
  const sums = [0, 1, 2].map((l) => page.effort.days.reduce((s, d) => s + d[l], 0));
  assert.deepEqual(sums, [1, 0, 2]);
  assert.equal(page.effort.start + 83 * 86400000 <= now, true);
  assert.equal(publicProfile('quiet', new Map(), now)!.climb, null, 'nothing shown, no curve');
});
