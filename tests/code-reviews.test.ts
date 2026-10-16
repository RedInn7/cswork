// Private code review links: only the author makes one, on their own formal submission; the
// token is shown once and stored as its sha256; comments sit on a real line; a closed link is
// gone; readers in a running contest on the problem are refused; nobody's name or email leaks.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-code-reviews-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.HIDDEN_COMPANIES = 'hiddenco';
delete process.env.CONTENT_DATABASE_PATH;
delete process.env.COURSE_ACCESS;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');

const ada: Person = { id: 'cr-ada', name: 'Ada Lovelace', email: 'ada@example.test', role: 'student', verified: true };
const ben: Person = { ...ada, id: 'cr-ben', name: 'Ben Secret', email: 'ben@example.test' };
const cat: Person = { ...ada, id: 'cr-cat', name: 'Cat', email: 'cat@example.test' };
const racer: Person = { ...ada, id: 'cr-racer', email: 'racer@example.test' };
const fresh: Person = { ...ada, id: 'cr-fresh', email: 'fresh@example.test', verified: false };

// ponytail: one loose shape for every endpoint's answer in this file.
type Data = { id: string; token: string; mine: boolean; code: string; language: string; author: string | null; items: { id: string }[];
  comments: { line: number; reviewer: number; handle: string | null; body: string }[] };
async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
  try {
    const r = await handleOj(request, p, url.pathname.split('/').slice(3));
    return { status: r.status, data: (await r.json()) as Data };
  } catch (e) {
    const err = e as { status?: number; name?: string };
    return { status: err.status ?? (err.name === 'ZodError' ? 400 : 500), data: null };
  }
}
const CODE = 'def two_sum(a, t):\n    seen = {}\n    for i, x in enumerate(a):\n        pass';
function submission(id: string, userId: string, problemId = 'lc-1', mode = 'judge') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
       VALUES(?,?,?,'python',?,'accepted',3,3,?,1,1)`,
    )
    .run(id, userId, problemId, CODE, mode);
}

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  for (const id of ['lc-1', 'lc-2', 'oa-hiddenco-1', 'course-x'])
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
  submission('sub-ada', ada.id);
  submission('sub-ada-run', ada.id, 'lc-1', 'run');
  submission('sub-ada-hidden', ada.id, 'oa-hiddenco-1');
  submission('sub-ada-2', ada.id, 'lc-2');
  submission('sub-ben', ben.id);
  db.prepare(
    "INSERT INTO user_profiles(user_id,handle,visible,created_at,updated_at) VALUES(?,'cat_codes',1,1,1)",
  ).run(cat.id);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('only the author opens a link on their own formal submission; the token is stored as its hash', async () => {
  assert.equal((await call(null, 'POST', 'reviews', { submissionId: 'sub-ada' })).status, 401);
  assert.equal((await call(ben, 'POST', 'reviews', { submissionId: 'sub-ada' })).status, 404);
  assert.equal((await call(ada, 'POST', 'reviews', { submissionId: 'missing' })).status, 404);
  assert.equal((await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada-run' })).status, 400);
  assert.equal((await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada-hidden' })).status, 404);
  assert.equal((await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada', note: 'x'.repeat(501) })).status, 400);

  const made = await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada', note: 'Is the dict needed?' });
  assert.equal(made.status, 200);
  const { id, token } = made.data!;
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  const row = sqlite().prepare('SELECT * FROM code_reviews WHERE id=?').get(id) as Record<string, unknown>;
  assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(row).includes(token), 'the token itself is never stored');
  assert.equal(row.owner_id, ada.id);

  const listed = await call(ada, 'GET', 'reviews?submission=sub-ada');
  assert.deepEqual(listed.data!.items.map((r) => r.id), [id]);
  assert.deepEqual((await call(ben, 'GET', 'reviews?submission=sub-ada')).data!.items, []);
});

void test('a reader with the link sees the code but no name or email; comments sit on a real line', async () => {
  const { id, token } = (await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada' })).data!;
  assert.equal((await call(null, 'GET', `reviews/${token}`)).status, 401);
  assert.equal((await call(ben, 'GET', `reviews/${id}`)).status, 404, 'the id is the author’s alone');
  assert.equal((await call(ben, 'GET', 'reviews/nottherighttokenxxxxxxxxxxxxxxxx')).status, 404);

  const view = await call(ben, 'GET', `reviews/${token}`);
  assert.equal(view.status, 200);
  assert.equal(view.data!.code, CODE);
  assert.equal(view.data!.language, 'python');
  assert.equal(view.data!.mine, false);
  assert.equal(view.data!.id, null);
  assert.equal(view.data!.author, null);
  const text = JSON.stringify(view.data);
  for (const leak of ['Ada Lovelace', 'ada@example.test', ada.id]) assert.ok(!text.includes(leak), leak);

  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 5, body: 'past the end' })).status, 400);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 0, body: 'zero' })).status, 400);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 1, body: ' ' })).status, 400);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 1, body: 'x'.repeat(2001) })).status, 400);
  assert.equal((await call(fresh, 'POST', `reviews/${token}/comments`, { line: 1, body: 'hi' })).status, 403);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 4, body: 'Return the pair here.' })).status, 200);
  assert.equal((await call(cat, 'POST', `reviews/${token}/comments`, { line: 2, body: '<b>dict is fine</b>' })).status, 200);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 2, body: 'Agreed.' })).status, 200);
  assert.equal((await call(ada, 'POST', `reviews/${id}/comments`, { line: 2, body: 'Thanks!' })).status, 200);

  const mine = await call(ada, 'GET', `reviews/${id}`);
  assert.equal(mine.data!.mine, true);
  assert.equal(mine.data!.id, id);
  const shown = mine.data!.comments.map((c) => [c.line, c.reviewer, c.handle, c.body]);
  assert.deepEqual(shown, [
    [4, 1, null, 'Return the pair here.'],
    [2, 2, 'cat_codes', '<b>dict is fine</b>'],
    [2, 1, null, 'Agreed.'],
    [2, 0, null, 'Thanks!'],
  ]);
  assert.ok(!JSON.stringify(mine.data).includes('Ben Secret'));

  // One upserted in-app notice for the author per link and day; none for their own comment.
  const notices = sqlite().prepare("SELECT id,href FROM notifications WHERE user_id=? AND kind='code-review'").all(ada.id);
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0], { id: `code-review:${id}:${new Date().toISOString().slice(0, 10)}`, href: `/review/${id}` });
});

void test('a closed link answers 404; only its author closes it', async () => {
  const { id, token } = (await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada' })).data!;
  assert.equal((await call(ben, 'POST', `reviews/${token}/close`, {})).status, 404);
  assert.equal((await call(ben, 'GET', `reviews/${token}`)).status, 200);
  assert.equal((await call(ada, 'POST', `reviews/${token}/close`, {})).status, 200);
  assert.equal((await call(ben, 'GET', `reviews/${token}`)).status, 404);
  assert.equal((await call(ada, 'GET', `reviews/${id}`)).status, 404);
  assert.equal((await call(ben, 'POST', `reviews/${token}/comments`, { line: 1, body: 'late' })).status, 404);
});

void test('a reader whose running contest holds the problem is refused, the author too', async () => {
  const { token } = (await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada-2' })).data!;
  const now = Date.now();
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
       VALUES('cr-room',NULL,'Mashup','mashup','["lc-2"]',?,60,'private',?)`,
    )
    .run(now - 60_000, now - 60_000);
  sqlite().prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('cr-room',?,'R',?)").run(racer.id, now);
  assert.equal((await call(racer, 'GET', `reviews/${token}`)).status, 403);
  assert.equal((await call(racer, 'POST', `reviews/${token}/comments`, { line: 1, body: 'x' })).status, 403);
  assert.equal((await call(ben, 'GET', `reviews/${token}`)).status, 200);
  sqlite().prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('cr-room',?,'A',?)").run(ada.id, now);
  assert.equal((await call(ada, 'POST', 'reviews', { submissionId: 'sub-ada-2' })).status, 403);
});

void test('an author keeps at most 20 open links', async () => {
  submission('sub-many', cat.id);
  for (let i = 0; i < 20; i++) assert.equal((await call(cat, 'POST', 'reviews', { submissionId: 'sub-many' })).status, 200);
  // The per-minute write limit (20) is not what this test is about.
  sqlite().prepare('DELETE FROM limits').run();
  assert.equal((await call(cat, 'POST', 'reviews', { submissionId: 'sub-many' })).status, 409);
  const [first] = (await call(cat, 'GET', 'reviews?submission=sub-many')).data!.items;
  assert.equal((await call(cat, 'POST', `reviews/${first.id}/close`, {})).status, 200);
  assert.equal((await call(cat, 'POST', 'reviews', { submissionId: 'sub-many' })).status, 200);
});
