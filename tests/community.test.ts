import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

// Discussion threads, answers and comments; structured experience fields; the list plaza;
// follows and the richer public profile.
const dir = mkdtempSync(join(tmpdir(), 'cswork-community-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.HIDDEN_COMPANIES = 'google';
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
delete process.env.COURSE_ACCESS;

const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
const item = content.prepare(
  `INSERT INTO items(id,type,slug,title,company_slug,company_name,role,category,published_at,extra,body)
  VALUES(?,?,?,?,?,?,'Software Engineer',?,'2026-09-30T00:00:00.000Z',?,'Body')`,
);
for (const slug of ['amz-1', 'amz-2', 'amz-3'])
  item.run(slug, 'experience', slug, `Amazon ${slug}`, 'amazon', 'Amazon', null, JSON.stringify({ date: '2026-09-01', dateBasis: 'interview' }));
item.run('q1', 'interview_question', 'tell-me-conflict', 'Tell me about a conflict', 'amazon', 'Amazon', 'Behavioral & Leadership', '{}');
item.run('g1', 'interview_question', 'google-design', 'Design search', 'google', 'Google', 'System Design', '{}');
content.close();

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { handleContent } = await import('../lib/server/content-library');
const { publicPosts, publicPost } = await import('../lib/server/solution-posts');
const { communityLists, publicProfile } = await import('../lib/server/learner-cloud');
const { followBoard, followPeople } = await import('../lib/server/follows');
const { memberExperienceStats, STATS_MIN } = await import('../lib/server/experience-submissions');
const { longestStreak } = await import('../lib/achievements');
const { autoTitle, targetKind } = await import('../lib/community');

const person = (id: string, o: Partial<Person> = {}): Person => ({
  id,
  name: id === 'c-me' ? 'Ada Lovelace' : 'Grace',
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...o,
});
const me = person('c-me');
const others = [1, 2, 3, 4].map((i) => person(`c-other-${i}`));
const fresh = person('c-fresh', { verified: false });
const teacher = person('c-teacher', { role: 'teacher' });

async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const r = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  const parts = url.pathname.split('/').slice(3);
  try {
    const response = path.startsWith('content/') ? await handleContent(r, p, parts) : await handleOj(r, p, parts);
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
async function ok(p: Person | null, method: string, path: string, body?: unknown) {
  const r = await call(p, method, path, body);
  assert.ok(r.status === 200 || r.status === 201, `${method} ${path} → ${r.status}`);
  return r.data;
}
let n = 0;
const ac = (user: string, problem: string, at: number, language = 'python') =>
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,?,'','accepted',4,4,'judge',?,?)`,
    )
    .run(`s${++n}`, user, problem, language, at, at);
const profile = (user: string, handle: string, visible = 1) =>
  sqlite()
    .prepare(
      `INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,?,0,'',1,1)
      ON CONFLICT(user_id) DO UPDATE SET visible=excluded.visible`,
    )
    .run(user, handle, visible);

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const id of ['oa-amazon-1', 'lc-1'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
  for (const p of [me, ...others, teacher])
    db.prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(
      p.id,
      p.name,
      p.email,
    );
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('targets and titles', () => {
  assert.equal(targetKind('lc-1'), 'problem');
  assert.equal(targetKind('discuss:algo'), 'discuss');
  assert.equal(targetKind('exp:member.abc'), 'exp');
  assert.equal(targetKind('q:tell-me'), 'q');
  assert.equal(autoTitle('\n## **STAR** answer: the [conflict](x)\nmore'), 'STAR answer: the conflict');
  assert.equal(autoTitle('x'.repeat(100)).length, 80);
  assert.equal(autoTitle(' 👍👍 \n!!'), '👍👍 !!', 'only emoji: the body itself');
  assert.equal(autoTitle('[](https://x.test)'), '[](https://x.test)');
});

void test('threads: channels read signed out, writes need a verified account and a known company tag', async () => {
  assert.equal((await call(null, 'GET', 'oj/posts?problem=oa-amazon-1')).status, 401, 'solutions stay signed in');
  assert.deepEqual(await ok(null, 'GET', 'oj/posts?problem=discuss:algo'), { solved: true, items: [], more: false });
  assert.equal((await call(null, 'GET', 'oj/posts?problem=discuss:gossip')).status, 404);
  const thread = { problemId: 'discuss:career', title: 'Amazon referral timeline?', body: 'How long did yours take?' };
  assert.equal((await call(null, 'POST', 'oj/posts', thread)).status, 401);
  assert.equal((await call(fresh, 'POST', 'oj/posts', thread)).status, 403);
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, problemId: 'discuss:gossip' })).status, 404);
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, title: ' ' })).status, 400, 'threads need a title');
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, tag: 'nope' })).status, 400);
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, tag: 'google' })).status, 400, 'hidden company');
  assert.equal((await call(me, 'POST', 'oj/posts', { ...thread, tag: 'two-pointers-windows' })).status, 400);
  const tagged = await ok(me, 'POST', 'oj/posts', { ...thread, tag: 'amazon' });
  assert.equal(tagged.post.tag, 'amazon');
  await ok(others[0], 'POST', 'oj/posts', { problemId: 'discuss:algo', title: 'Monotonic stack', body: 'Template?' });
  // Back-to-back posts can share a millisecond (then the uuid decides); make the career one older.
  sqlite().prepare('UPDATE solution_posts SET created_at=created_at-1000 WHERE id=?').run(tagged.post.id);
  const career = await ok(null, 'GET', 'oj/posts?problem=discuss:career&tag=amazon');
  assert.deepEqual(career.items.map((p: { title: string }) => p.title), ['Amazon referral timeline?']);
  assert.equal(career.items[0].author, 'Ad***', 'masked for guests');
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=discuss:career&tag=meta')).items.length, 0);
  // Server pages: every channel at once, and one thread.
  const all = await publicPosts('discuss:all', { sort: 'new' });
  assert.deepEqual(all?.items.map((p) => p.problemId), ['discuss:algo', 'discuss:career']);
  assert.equal((await publicPost(tagged.post.id))?.post.title, 'Amazon referral timeline?');
  assert.equal(await publicPost('not-an-id'), null);
  assert.equal(await publicPosts('discuss:gossip'), null);
  // Replies and votes work signed in like solutions.
  await ok(others[1], 'POST', `oj/posts/${tagged.post.id}/comments`, { body: 'About two weeks' });
  await ok(others[1], 'POST', `oj/posts/${tagged.post.id}/vote`, { on: true });
  const read = await ok(null, 'GET', `oj/posts/${tagged.post.id}`);
  assert.equal(read.post.votes, 1);
  assert.equal(read.comments.length, 1);
  assert.ok(!JSON.stringify(read).includes('example.test'));
});

void test('three reports take a thread down for everyone but its author until a moderator acts', async () => {
  const { post } = await ok(me, 'POST', 'oj/posts', { problemId: 'discuss:site', title: 'Buy cheap pills', body: 'spam' });
  for (const p of others.slice(0, 3)) await ok(p, 'POST', `oj/posts/${post.id}/report`, { reason: 'spam' });
  assert.equal((await call(others[3], 'GET', `oj/posts/${post.id}`)).status, 404);
  // Nothing lands on a post that reads as missing: no comment saved, no vote counted.
  assert.equal((await call(others[3], 'POST', `oj/posts/${post.id}/comments`, { body: 'still here' })).status, 404);
  assert.equal((await call(others[3], 'POST', `oj/posts/${post.id}/vote`, { on: true })).status, 404);
  const landed = sqlite().prepare('SELECT (SELECT COUNT(*) FROM post_comments WHERE post_id=@id)+(SELECT COUNT(*) FROM post_votes WHERE post_id=@id)');
  assert.equal(landed.pluck().get({ id: post.id }), 0);
  assert.equal((await call(me, 'POST', `oj/posts/${post.id}/comments`, { body: 'context' })).status, 201, 'its author still can');
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=discuss:site')).items.length, 0);
  assert.equal((await ok(me, 'GET', 'oj/posts?problem=discuss:site')).items.length, 1, 'the author still sees it');
  assert.equal((await call(teacher, 'GET', `oj/posts/${post.id}`)).status, 200);
  const queue = await ok(teacher, 'GET', 'oj/posts/moderation');
  assert.ok(queue.reported.some((i: { id: string }) => i.id === post.id), 'threads reach the queue');
  await ok(teacher, 'POST', `oj/posts/${post.id}/dismiss`, {});
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=discuss:site')).items.length, 1);
  // The same three cannot take it down again; three new reports after the decision can.
  for (const p of others.slice(0, 3)) await ok(p, 'POST', `oj/posts/${post.id}/report`, { reason: 'spam' });
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=discuss:site')).items.length, 1);
  assert.equal((await ok(teacher, 'GET', 'oj/posts/moderation')).reported.some((i: { id: string }) => i.id === post.id), false);
  await ok(others[3], 'POST', `oj/posts/${post.id}/report`, { reason: 'spam' });
  assert.equal((await ok(teacher, 'GET', 'oj/posts/moderation')).reported.find((i: { id: string }) => i.id === post.id)?.reports, 1);
  await ok(teacher, 'POST', `oj/posts/${post.id}/dismiss`, {});
  // Every channel at once reads through the problem_id index, not a scan of every solution.
  const plan = sqlite()
    .prepare(`EXPLAIN QUERY PLAN SELECT id FROM solution_posts sp WHERE sp.problem_id>='discuss:' AND sp.problem_id<'discuss;'`)
    .all() as { detail: string }[];
  assert.equal(plan.some((r) => /^SCAN sp$/.test(r.detail)), false, JSON.stringify(plan));
});

void test('answers to questions and comments on experiences take their first line as a title', async () => {
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'q:no-such', body: 'x' })).status, 404);
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'q:google-design', body: 'x' })).status, 404, 'hidden company');
  const answer = await ok(me, 'POST', 'oj/posts', { problemId: 'q:tell-me-conflict', body: '**Situation**: a launch slipped.\nTask…' });
  assert.equal(answer.post.title, 'Situation: a launch slipped.');
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=q:tell-me-conflict&body=1')).items[0].body.includes('Task'), true);
  await ok(others[0], 'POST', 'oj/posts', { problemId: 'exp:amz-1', body: 'Thanks, same loop for me.' });
  assert.equal((await ok(null, 'GET', 'oj/posts?problem=exp:amz-1')).items.length, 1);
  const thumbs = await ok(others[1], 'POST', 'oj/posts', { problemId: 'exp:amz-2', body: '👍👍' });
  assert.equal(thumbs.post.title, '👍👍', 'no title box, so never "please add a title"');
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'exp:member.AAAAAAAAAAAA', body: 'x' })).status, 404);
  // A Line 500 stop tags a solution with its technique.
  assert.equal((await call(me, 'POST', 'oj/posts', { problemId: 'oa-amazon-1', title: 't', body: 'b', tag: 'amazon' })).status, 400);
  const solution = await ok(me, 'POST', 'oj/posts', { problemId: 'oa-amazon-1', title: 'Window', body: 'b', tag: 'two-pointers-windows' });
  assert.equal(solution.post.tag, 'two-pointers-windows');
  assert.equal((await ok(me, 'GET', 'oj/posts?problem=oa-amazon-1&tag=binary-search')).items.length, 0);
  assert.equal((await ok(me, 'GET', 'oj/posts?problem=oa-amazon-1&tag=two-pointers-windows')).items.length, 1);
  const edited = await ok(me, 'POST', `oj/posts/${solution.post.id}/edit`, { title: 'Window', body: 'b2', tag: 'binary-search' });
  assert.equal(edited.post.tag, 'binary-search');
});

void test('experience fields: validated, shown, filtered (member posts only) and aggregated from five', async () => {
  const month = new Date().toISOString().slice(0, 7);
  const body = 'Two coding rounds and one behavioral round, then a long wait for the team match. '.repeat(2);
  const submit = (p: Person, o: Record<string, unknown> = {}) =>
    call(p, 'POST', 'oj/experiences', {
      company: 'amazon', title: 'Amazon SDE intern loop', role: 'SDE Intern', rounds: ['Onsite'], month, body, agree: true, ...o,
    });
  for (const bad of [{ difficulty: 6 }, { sentiment: 'great' }, { channel: 'friend' }, { employment: 'contract' }, { season: '2026-autumn' }, { durationWeeks: 200 }])
    assert.equal((await submit(me, bad)).status, 400, JSON.stringify(bad));
  const ids: string[] = [];
  for (const [i, p] of [me, ...others].entries()) {
    const r = await submit(p, {
      difficulty: i + 1, sentiment: i < 3 ? 'pos' : 'neg', channel: 'referral', employment: 'intern',
      season: '2026-summer', location: ' Seattle ', durationWeeks: [2, 4, 6, 8, 30][i],
    });
    assert.equal(r.status, 201);
    ids.push(r.data.member.id);
  }
  const first = await ok(me, 'GET', `content/item?type=experience&slug=member.${ids[0]}`);
  assert.deepEqual(first.details, {
    difficulty: 1, sentiment: 'pos', channel: 'referral', employment: 'intern', season: '2026-summer',
    location: 'Seattle', durationWeeks: 2, verified: true,
  });
  assert.equal(memberExperienceStats('amazon'), null, 'nothing public yet');
  for (const id of ids.slice(0, STATS_MIN - 1)) await ok(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'approved' });
  assert.equal(memberExperienceStats('amazon'), null, 'four posts are too few');
  await ok(teacher, 'POST', `oj/experiences/${ids[4]}/review`, { status: 'approved' });
  const stats = memberExperienceStats('amazon')!;
  assert.equal(stats.posts, 5);
  assert.equal(stats.difficulty?.average, 3);
  assert.deepEqual(stats.sentiment?.rows, [{ value: 'pos', n: 3 }, { value: 'neg', n: 2 }]);
  assert.equal(stats.weeks?.median, 6);
  const filtered = await ok(null, 'GET', 'content/list?type=experience&employment=intern');
  assert.equal(filtered.memberOnly, true);
  assert.equal(filtered.total, 5, 'library experiences carry no employment');
  assert.ok(filtered.items.every((i: { member?: unknown }) => i.member));
  assert.equal((await ok(null, 'GET', 'content/list?type=experience&season=2025-fall')).total, 0);
  const plain = await ok(null, 'GET', 'content/list?type=experience');
  assert.equal(plain.total, 8);
  assert.deepEqual(plain.memberFacets.employment, [{ value: 'intern', label: 'intern', n: 5 }]);
});

void test('list plaza: saves and copies count, hot and new orders, title search', async () => {
  const make = async (p: Person, title: string) =>
    (await ok(p, 'POST', 'oj/lists', { title, visibility: 'public', problemIds: ['lc-1'] })).id as string;
  const a = await make(me, 'Sliding windows');
  const b = await make(others[0], 'Graphs week');
  const at = sqlite().prepare('UPDATE user_lists SET created_at=?,updated_at=? WHERE id=?');
  at.run(Date.now() - 2000, Date.now() - 2000, a);
  at.run(Date.now() - 1000, Date.now() - 1000, b);
  await ok(others[1], 'POST', 'oj/lists', { title: 'Empty one', visibility: 'public' });
  assert.equal((await call(me, 'POST', `oj/lists/${a}/star`, { on: true })).status, 400, 'not your own');
  assert.equal((await call(me, 'POST', 'oj/marks', { target: `list:${b}`, mark: 'star', on: true })).status, 400);
  for (const p of others.slice(1, 3)) await ok(p, 'POST', `oj/lists/${b}/star`, { on: true });
  await ok(others[1], 'POST', `oj/lists/${b}/star`, { on: true });
  await ok(others[3], 'POST', `oj/lists/${a}/fork`, {});
  // Copies count each other verified account once: not the owner's own, not repeats, not unverified ones.
  for (const p of [me, me, others[3], fresh]) await ok(p, 'POST', `oj/lists/${a}/fork`, {});
  assert.equal((await ok(null, 'GET', `oj/lists/${a}`)).forks, 1);
  const read = await ok(others[1], 'GET', `oj/lists/${b}`);
  assert.deepEqual([read.stars, read.forks, read.starred], [2, 0, true]);
  assert.deepEqual((await ok(others[1], 'GET', 'oj/lists/starred')).items.map((l: { id: string }) => l.id), [b]);
  await ok(others[2], 'POST', `oj/lists/${b}/star`, { on: false });
  assert.equal((await ok(null, 'GET', `oj/lists/${b}`)).stars, 1);
  // Hot: 1 save vs 1 copy (worth two); empty and private lists stay out.
  assert.deepEqual(communityLists({}).items.map((l) => l.title), ['Sliding windows', 'Graphs week']);
  assert.deepEqual(communityLists({ sort: 'new' }).items.map((l) => l.title), ['Graphs week', 'Sliding windows']);
  assert.deepEqual(communityLists({ q: 'graph' }).items.map((l) => l.id), [b]);
  assert.deepEqual(communityLists({ q: '%' }).items, []);
  const row = communityLists({ q: 'graph' }).items[0];
  assert.deepEqual([row.count, row.stars, row.forks, row.owner], [1, 1, 0, null]);
});

void test('follows: visible profiles only, counted and listed only when visible, and a weekly board', async () => {
  profile(me.id, 'ada');
  profile(others[0].id, 'grace');
  profile(others[1].id, 'quiet', 0);
  assert.equal((await call(me, 'POST', 'oj/follows', { handle: 'quiet', on: true })).status, 404);
  assert.equal((await call(me, 'POST', 'oj/follows', { handle: 'ada', on: true })).status, 400);
  assert.equal((await call(null, 'POST', 'oj/follows', { handle: 'grace', on: true })).status, 401);
  await ok(me, 'POST', 'oj/follows', { handle: 'grace', on: true });
  await ok(others[1], 'POST', 'oj/follows', { handle: 'grace', on: true });
  // Following back answers mutual, so the button shows "Message" without a reload.
  assert.equal((await ok(others[0], 'POST', 'oj/follows', { handle: 'ada', on: true })).mutual, true);
  assert.equal((await ok(others[0], 'POST', 'oj/follows', { handle: 'ada', on: false })).mutual, false);
  const state = await ok(null, 'GET', 'oj/follows?handle=grace');
  assert.deepEqual(state, { following: false, mutual: false, self: false, signedIn: false, followers: 1, followees: 0 }, 'the hidden follower is not counted');
  assert.equal((await ok(me, 'GET', 'oj/follows?handle=grace')).following, true);
  assert.deepEqual(followPeople('grace', 'followers')?.items.map((f) => f.handle), ['ada']);
  assert.deepEqual(followPeople('ada', 'following')?.items.map((f) => f.handle), ['grace']);
  assert.equal(followPeople('quiet', 'followers'), null);
  const now = Date.UTC(2026, 9, 14, 12); // a Wednesday
  ac(others[0].id, 'lc-1', now - 3600000);
  ac(others[0].id, 'oa-amazon-1', now - 7200000);
  ac(others[0].id, 'oa-google-1', now - 7200000);
  ac(others[0].id, 'course-x', now - 7200000);
  ac(others[0].id, 'lc-2', Date.UTC(2026, 9, 11, 12), 'cpp'); // last Sunday
  ac(me.id, 'lc-1', now - 60000);
  const board = followBoard(me, 0, now);
  assert.deepEqual(board.items, [
    { handle: 'grace', n: 2, me: false },
    { handle: 'ada', n: 1, me: true },
  ]);
  await ok(me, 'POST', 'oj/follows', { handle: 'grace', on: false });
  assert.equal(followBoard(me, 0, now).items.length, 1);
});

void test('the public profile adds languages, earned badges, posts with their votes and follow counts', async () => {
  const catalogue = new Map([
    ['lc-1', { difficulty: '简单' }],
    ['lc-2', { difficulty: '中等' }],
    ['oa-amazon-1', { difficulty: '中等' }],
  ]);
  await ok(others[2], 'POST', 'oj/follows', { handle: 'grace', on: true });
  profile(others[2].id, 'linus');
  const page = publicProfile('grace', catalogue)!;
  assert.deepEqual(page.languages, [
    { language: 'python', n: 2 },
    { language: 'cpp', n: 1 },
  ]);
  assert.equal(page.followers, 1);
  assert.ok(Array.isArray(page.badges) && page.badges.every((b) => b.id && b.zh && b.en));
  assert.equal(page.posts.total, 1, 'the algo thread');
  assert.equal(page.posts.items[0].target, 'discuss:algo');
  const ada = publicProfile('ada', catalogue)!;
  // The answer to a question is not listed; the solution, two threads and the reported-down spam
  // (now dismissed) are, with their upvotes.
  assert.deepEqual(ada.posts.items.map((p) => p.target).sort(), ['discuss:career', 'discuss:site', 'oa-amazon-1']);
  assert.equal(ada.posts.votes, 1);
  assert.equal(ada.listStars, 0);
  assert.equal(publicProfile('grace', catalogue)!.listStars, 1);
  assert.ok(!JSON.stringify(ada).includes('c-me'), 'no account id');
});

void test('longest streak bridges one empty day per freeze, two a month', () => {
  const day = (d: number) => new Date(2026, 0, d, 10).getTime();
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak([day(1), day(2), day(3)]), 3);
  assert.equal(longestStreak([day(1), day(3), day(5), day(7)]), 3, 'a third gap in one month breaks the run');
  assert.equal(longestStreak([day(30), day(32), day(34)]), 3, 'gaps in two months');
  assert.equal(longestStreak([day(1), day(3), day(5)]), 3);
  assert.equal(longestStreak([day(1), day(4)]), 1);
});
