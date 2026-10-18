// Private resume review links: the owner snapshots a resume without its name or contact lines;
// the token is shown once and stored as its sha256; comments sit on a real line whose text the
// server reads from the snapshot; only the owner accepts a rewrite or closes the link; a closed
// link is gone; and a rewrite goes back into the resume where the line still reads the same.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import { applyRewrite, blankResume, lineAt, type Resume } from '../lib/resume-shape';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-resume-reviews-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');

const ada: Person = { id: 'rr-ada', name: 'Ada Lovelace', email: 'ada@example.test', role: 'student', verified: true };
const ben: Person = { ...ada, id: 'rr-ben', name: 'Ben Secret', email: 'ben@example.test' };
const cat: Person = { ...ada, id: 'rr-cat', name: 'Cat', email: 'cat@example.test' };
const fresh: Person = { ...ada, id: 'rr-fresh', email: 'fresh@example.test', verified: false };
const dan: Person = { ...ada, id: 'rr-dan', email: 'dan@example.test' };

const RESUME: Resume = {
  ...blankResume(),
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  phone: '+1 555 0100',
  location: 'London',
  links: 'github.com/ada',
  experience: [
    { title: 'Analytical Engines Ltd', subtitle: 'SWE Intern', dates: 'Jun 2026 – Aug 2026', bullets: '- Built a parser\n\n• Cut build time by 40%' },
    { title: 'Babbage Lab', subtitle: 'Research Assistant', dates: '2025', bullets: 'Wrote notes on the engine' },
  ],
  skills: 'Languages: Python, Go\nTools: Git',
  awards: '',
};

// ponytail: one loose shape for every endpoint's answer in this file.
type Data = {
  id: string;
  token: string;
  mine: boolean;
  version: string | null;
  author: string | null;
  snapshot: Resume;
  acceptedAt: number;
  items: { id: string; version: string; comments: number; pending: number }[];
  comments: { id: string; path: string; original: string; body: string; suggestion: string; acceptedAt: number | null; reviewer: number; handle: string | null; mine: boolean }[];
};
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
const make = async (p: Person, extra: Record<string, unknown> = {}) =>
  (await call(p, 'POST', 'resume-reviews', { resume: RESUME, version: '', note: '', ...extra })).data!;
const clearLimits = () => sqlite().prepare('DELETE FROM limits').run();

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  sqlite().prepare("INSERT INTO user_profiles(user_id,handle,visible,created_at,updated_at) VALUES(?,'cat_reads',1,1,1)").run(cat.id);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('lineAt reads a line by its path; applyRewrite keeps the mark, follows a moved entry and refuses an edited line', () => {
  assert.equal(lineAt(RESUME, 'experience.0.bullets.0'), 'Built a parser');
  assert.equal(lineAt(RESUME, 'experience.0.bullets.1'), 'Cut build time by 40%', 'blank lines do not count');
  assert.equal(lineAt(RESUME, 'skills.1'), 'Tools: Git');
  for (const bad of ['experience.0.bullets.2', 'experience.5.bullets.0', 'awards.0', 'name.0', 'experience.0.title.0', 'skills.-1', 'skills', 'skills.00', 'experience.00.bullets.0'])
    assert.equal(lineAt(RESUME, bad), null, bad);

  const inPlace = applyRewrite(RESUME, 'experience.0.bullets.1', 'Cut build time by 40%', 'Cut CI build time 40% (10 → 6 min)');
  assert.equal(inPlace?.experience[0].bullets, '- Built a parser\n\n• Cut CI build time 40% (10 → 6 min)');
  assert.equal(inPlace?.experience[1], RESUME.experience[1]);
  assert.equal(applyRewrite(RESUME, 'skills.0', 'Languages: Python, Go', 'Languages: Python, Go, C++')?.skills, 'Languages: Python, Go, C++\nTools: Git');

  // The owner moved the entry and added a line above it since the snapshot.
  const moved = { ...RESUME, experience: [RESUME.experience[1], { ...RESUME.experience[0], bullets: '- Led a team of 3\n' + RESUME.experience[0].bullets }] };
  assert.equal(applyRewrite(moved, 'experience.0.bullets.0', 'Built a parser', 'Built a recursive-descent parser')?.experience[1].bullets.split('\n')[1], '- Built a recursive-descent parser');

  // The same line in an earlier entry: a line added above the anchor's keeps the rewrite in the anchor entry.
  const twice = { ...RESUME, experience: [{ ...RESUME.experience[1], bullets: 'Used Git' }, { ...RESUME.experience[0], bullets: '- Shipped v2\n- Used Git' }] };
  const kept = applyRewrite(twice, 'experience.1.bullets.0', 'Used Git', 'Used Git rebase daily');
  assert.equal(kept?.experience[0].bullets, 'Used Git');
  assert.equal(kept?.experience[1].bullets, '- Shipped v2\n- Used Git rebase daily');

  const edited = { ...RESUME, experience: [{ ...RESUME.experience[0], bullets: '- Built a fast parser' }] };
  assert.equal(applyRewrite(edited, 'experience.0.bullets.0', 'Built a parser', 'x'), null);
  assert.equal(applyRewrite(RESUME, 'projects.0.bullets.0', 'Built a parser', 'x'), null, 'another section is not searched');
  assert.equal(applyRewrite(RESUME, 'bogus', 'Built a parser', 'x'), null);

  // A rewrite that would push the field past its cap is refused, not cut off on the next load.
  const full = { ...RESUME, experience: [{ ...RESUME.experience[0], bullets: '- Built a parser\n' + 'x'.repeat(2950) + ' END' }] };
  assert.equal(applyRewrite(full, 'experience.0.bullets.0', 'Built a parser', 'y'.repeat(400)), null);
  assert.equal(applyRewrite({ ...RESUME, skills: 'Go\n' + 'x'.repeat(1990) }, 'skills.0', 'Go', 'y'.repeat(20)), null);
});

void test('the owner makes a link; the token is stored as its hash; the snapshot holds no name or contact', async () => {
  assert.equal((await call(null, 'POST', 'resume-reviews', { resume: RESUME })).status, 401);
  assert.equal((await call(ada, 'POST', 'resume-reviews', { resume: blankResume() })).status, 400, 'nothing to comment on');
  assert.equal((await call(ada, 'POST', 'resume-reviews', { resume: RESUME, note: 'x'.repeat(501) })).status, 400);
  const made = await call(ada, 'POST', 'resume-reviews', { resume: RESUME, version: 'Backend', note: 'Too long?' });
  assert.equal(made.status, 200);
  const { id, token } = made.data!;
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  const row = sqlite().prepare('SELECT * FROM resume_reviews WHERE id=?').get(id) as Record<string, string>;
  assert.equal(row.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(row).includes(token), 'the token itself is never stored');
  assert.equal(row.version, 'Backend');
  for (const leak of ['Ada Lovelace', 'ada@example.test', '555 0100', 'London', 'github.com/ada']) assert.ok(!row.snapshot.includes(leak), leak);
  assert.ok(row.snapshot.includes('Built a parser'));

  const listed = (await call(ada, 'GET', 'resume-reviews')).data!.items;
  assert.deepEqual(listed.map((r) => [r.id, r.version, r.comments, r.pending]), [[id, 'Backend', 0, 0]]);
  assert.deepEqual((await call(ben, 'GET', 'resume-reviews')).data!.items, []);
});

void test('a reader with the link comments on real lines; the server reads the original; nobody else reads by id', async () => {
  const { id, token } = await make(ada, { version: 'Backend', note: 'Be blunt' });
  assert.equal((await call(null, 'GET', `resume-reviews/${token}`)).status, 401);
  assert.equal((await call(ben, 'GET', `resume-reviews/${id}`)).status, 404, 'the id is the owner’s alone');
  assert.equal((await call(ben, 'GET', 'resume-reviews/nottherighttokenxxxxxxxxxxxxxxxx')).status, 404);

  const view = await call(ben, 'GET', `resume-reviews/${token}`);
  assert.equal(view.status, 200);
  assert.deepEqual([view.data!.mine, view.data!.id, view.data!.version, view.data!.author], [false, null, null, null]);
  assert.equal(view.data!.snapshot.experience[0].bullets, RESUME.experience[0].bullets);
  assert.equal(view.data!.snapshot.name, '');
  for (const leak of ['Ada Lovelace', 'ada@example.test', ada.id]) assert.ok(!JSON.stringify(view.data).includes(leak), leak);

  const post = (p: Person, body: unknown, key = token) => call(p, 'POST', `resume-reviews/${key}/comments`, body);
  assert.equal((await post(ben, { path: 'experience.0.bullets.2', body: 'past the end' })).status, 400);
  assert.equal((await post(ben, { path: 'experience.0.title.0', body: 'not a line' })).status, 400);
  assert.equal((await post(ben, { path: 'skills.0', body: ' ' })).status, 400);
  assert.equal((await post(ben, { path: 'skills.0', body: 'x'.repeat(2001) })).status, 400);
  assert.equal((await post(ben, { path: 'skills.0', body: 'x', suggestion: 'two\nlines' })).status, 400);
  assert.equal((await post(fresh, { path: 'skills.0', body: 'hi' })).status, 403, 'a verified email is needed');
  assert.equal((await post(ben, { path: 'experience.0.bullets.1', body: 'Which build?', suggestion: 'Cut CI build time 40%', original: 'forged' })).status, 400, 'strict body');
  assert.equal((await post(ben, { path: 'experience.0.bullets.1', body: 'Which build?', suggestion: 'Cut CI build time 40%' })).status, 200);
  assert.equal((await post(cat, { path: 'skills.0', body: '<b>Add C++</b>' })).status, 200);
  assert.equal((await post(ben, { path: 'experience.1.bullets.0', body: 'Weak verb.', suggestion: 'Documented the engine' })).status, 200);
  assert.equal((await post(ada, { path: 'skills.0', body: 'Thanks!' }, id)).status, 200);

  const mine = await call(ada, 'GET', `resume-reviews/${id}`);
  assert.deepEqual([mine.data!.mine, mine.data!.id, mine.data!.version], [true, id, 'Backend']);
  assert.deepEqual(
    mine.data!.comments.map((c) => [c.path, c.original, c.suggestion, c.reviewer, c.handle]),
    [
      ['experience.0.bullets.1', 'Cut build time by 40%', 'Cut CI build time 40%', 1, null],
      ['skills.0', 'Languages: Python, Go', '', 2, 'cat_reads'],
      ['experience.1.bullets.0', 'Wrote notes on the engine', 'Documented the engine', 1, null],
      ['skills.0', 'Languages: Python, Go', '', 0, null],
    ],
  );
  assert.ok(!JSON.stringify(mine.data).includes('Ben Secret'));
  const counts = (await call(ada, 'GET', 'resume-reviews')).data!.items.find((r) => r.id === id)!;
  assert.deepEqual([counts.comments, counts.pending], [4, 2]);

  // One upserted in-app notice for the owner per link and day; none for their own comment.
  const notices = sqlite().prepare("SELECT id,href FROM notifications WHERE user_id=? AND kind='resume-review'").all(ada.id);
  assert.deepEqual(notices, [{ id: `resume-review:${id}:${new Date().toISOString().slice(0, 10)}`, href: `/career/resume/review/${id}` }]);

  // Accepting: the owner only, a rewrite only, once.
  const [rewrite, plain] = mine.data!.comments;
  const accept = (p: Person, commentId: string, key = id) => call(p, 'POST', `resume-reviews/${key}/accept`, { commentId });
  assert.equal((await accept(ben, rewrite.id)).status, 404);
  assert.equal((await accept(ben, rewrite.id, token)).status, 404, 'the token is not enough');
  assert.equal((await accept(ada, plain.id)).status, 400, 'nothing to accept');
  assert.equal((await accept(ada, 'missing')).status, 404);
  const first = await accept(ada, rewrite.id, token);
  assert.equal(first.status, 200);
  assert.equal((await accept(ada, rewrite.id)).data!.acceptedAt, first.data!.acceptedAt, 'accepting twice keeps the first time');
  assert.equal((await call(ada, 'GET', 'resume-reviews')).data!.items.find((r) => r.id === id)!.pending, 1);
});

void test('a closed link answers 404 and drops its snapshot; only its owner closes it', async () => {
  const { id, token } = await make(ada);
  assert.equal((await call(ben, 'POST', `resume-reviews/${token}/close`, {})).status, 404);
  assert.equal((await call(ben, 'POST', `resume-reviews/${id}/close`, {})).status, 404);
  assert.equal((await call(ada, 'POST', `resume-reviews/${token}/close`, {})).status, 200);
  assert.equal((await call(ben, 'GET', `resume-reviews/${token}`)).status, 404);
  assert.equal((await call(ada, 'GET', `resume-reviews/${id}`)).status, 404);
  assert.equal((await call(ben, 'POST', `resume-reviews/${token}/comments`, { path: 'skills.0', body: 'late' })).status, 404);
  assert.equal(sqlite().prepare('SELECT snapshot FROM resume_reviews WHERE id=?').pluck().get(id), '{}');
  clearLimits();
});

void test('an owner keeps at most 10 open links and makes at most 20 a day', async () => {
  for (let i = 0; i < 10; i++) assert.ok((await make(cat)).token);
  assert.equal((await call(cat, 'POST', 'resume-reviews', { resume: RESUME })).status, 409);
  const all = (await call(cat, 'GET', 'resume-reviews')).data!.items;
  assert.equal(all.length, 10);
  assert.equal((await call(cat, 'POST', `resume-reviews/${all[0].id}/close`, {})).status, 200);
  assert.equal((await call(cat, 'POST', 'resume-reviews', { resume: RESUME })).status, 200);

  const insert = sqlite().prepare("INSERT INTO resume_reviews(id,owner_id,token_hash,created_at,closed_at) VALUES(?,?,?,?,?)");
  const now = Date.now();
  for (let i = 0; i < 19; i++) insert.run(`dan-${i}`, dan.id, `h-dan-${i}`, now - 1000, now);
  insert.run('dan-old', dan.id, 'h-dan-old', now - 86_400_000 - 1000, now);
  clearLimits();
  assert.equal((await call(dan, 'POST', 'resume-reviews', { resume: RESUME })).status, 200);
  assert.equal((await call(dan, 'POST', 'resume-reviews', { resume: RESUME })).status, 429);
});

void test('a link takes at most 300 comments', async () => {
  clearLimits();
  const { id, token } = await make(ada);
  const insert = sqlite().prepare("INSERT INTO resume_review_comments(id,review_id,user_id,path,original,body,created_at) VALUES(?,?,'rr-ben','skills.0','x','x',1)");
  sqlite().transaction(() => {
    for (let i = 0; i < 300; i++) insert.run(`many-${i}`, id);
  })();
  assert.equal((await call(cat, 'POST', `resume-reviews/${token}/comments`, { path: 'skills.0', body: 'one more' })).status, 409);
});
