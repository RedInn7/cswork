import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const folder = mkdtempSync(join(tmpdir(), 'cswork-judge-feed-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { judgeFeed } = await import('../lib/server/judge-feed');
const db = sqlite();

const person = (id: string, role: 'student' | 'teacher' = 'student') => ({
  id,
  email: `${id}@secret.test`,
  name: id,
  role,
  verified: true,
});
const alice = person('alice'),
  bob = person('bob'),
  owner = person('owner', 'teacher');
for (const p of [alice, bob, owner])
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)',
  ).run(p.id, `${p.id}-nick`, p.email);
for (const course of ['gomall', 'sde-interview-foundations'])
  db.prepare(
    "INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,'s','1',1)",
  ).run(course, course);
db.prepare(
  "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','t','','s',0,'','1',0)",
).run();
for (const id of ['watch-intervals', 'lc-1', 'oa-amazon-1'])
  db.prepare(
    "INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview',0,0,0)",
  ).run(id);
db.prepare(
  "INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','h',1,1,'lc-1',0)",
).run();
let n = 0;
function submit(user: string, problem: string, status: string, mode = 'judge', language = 'python') {
  n++;
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,runtime,memory,created_at,updated_at,mode)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(`sub-${String(n).padStart(4, '0')}-xxxxxxxx`, user, problem, language, 'print("SECRET-CODE")', status, 3, 28, 0.042, 9216, 1000 + n, 1000 + n, mode);
}
submit('alice', 'lc-1', 'accepted');
submit('bob', 'oa-amazon-1', 'wrong_answer', 'judge', 'cpp');
submit('alice', 'lc-1', 'finished', 'run'); // custom-input runs never appear
submit('bob', 'watch-intervals', 'accepted');
submit('alice', 'lc-1', 'running');
const all = (viewer: Parameters<typeof judgeFeed>[0], query = '') =>
  judgeFeed(viewer, new URLSearchParams(query));
const status400 = (e: unknown) =>
  !!e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 400;

after(() => {
  delete process.env.COURSE_ACCESS;
  delete process.env.COURSE_OWNER_ID;
  rmSync(folder, { recursive: true, force: true });
});

void test('newest formal submissions first, metadata only', () => {
  const feed = all(null);
  assert.deepEqual(
    feed.items.map((i) => [i.problemId, i.status]),
    [
      ['lc-1', 'running'],
      ['watch-intervals', 'accepted'],
      ['oa-amazon-1', 'wrong_answer'],
      ['lc-1', 'accepted'],
    ],
  );
  const text = JSON.stringify(feed);
  for (const leak of ['SECRET-CODE', '@secret.test', '"alice"', 'user_id', 'sub-0001-xxxxxxxx'])
    assert.ok(!text.includes(leak), leak);
  const first = feed.items[3];
  assert.equal(first.user, 'alice-nick');
  assert.equal(first.run, 'sub-0001');
  assert.equal(first.runtimeMs, 42);
  assert.equal(first.memoryKb, 9216);
  assert.equal(first.codeBytes, Buffer.byteLength('print("SECRET-CODE")'));
  assert.deepEqual(feed.items[2].source, {
    kind: 'oa',
    company: { slug: 'amazon', name: 'Amazon' },
  });
  assert.equal(feed.items[3].source.kind, 'library');
  assert.equal(feed.items[1].source.kind, 'course');
  assert.equal(feed.stats?.judging, 1);
  assert.equal(feed.stats?.recent, 3);
  assert.equal(feed.stats?.recentAccepted, 2);
});

void test('mine marks only the viewer, and requires sign-in to filter', () => {
  assert.ok(all(alice).items.every((i) => i.mine === (i.user === 'alice-nick')));
  assert.equal(all(alice, 'mine=1').items.length, 2);
  assert.throws(() => all(null, 'mine=1'), (e: unknown) => (e as { status: number }).status === 401);
});

void test('filters: result, pending, language, problem, user; unknown values are rejected', () => {
  assert.equal(all(null, 'result=accepted').items.length, 2);
  assert.deepEqual(all(null, 'result=pending').items.map((i) => i.status), ['running']);
  assert.deepEqual(all(null, 'language=cpp').items.map((i) => i.problemId), ['oa-amazon-1']);
  assert.equal(all(null, 'problem=lc-1').items.length, 2);
  assert.equal(all(null, 'user=bob-nick').items.length, 2);
  assert.throws(() => all(null, 'result=hacked'), status400);
  assert.throws(() => all(null, 'language=rust'), status400);
});

void test('cursor pages walk back without overlap', () => {
  for (let i = 0; i < 40; i++) submit('bob', 'lc-1', 'accepted');
  const first = all(null);
  assert.equal(first.items.length, 30);
  assert.ok(first.next);
  const second = all(null, `cursor=${first.next}`);
  assert.equal(second.stats, undefined);
  assert.equal(second.items.length, 14);
  assert.equal(second.next, null);
  const seqs = [...first.items, ...second.items].map((i) => i.seq);
  assert.equal(new Set(seqs).size, seqs.length);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => b - a));
});

void test('owner-only mode hides course exercises from everyone but the owner', () => {
  process.env.COURSE_ACCESS = 'owner';
  process.env.COURSE_OWNER_ID = owner.id;
  try {
    const count = (viewer: Parameters<typeof judgeFeed>[0], problem: string) =>
      all(viewer, `problem=${problem}`).items.length;
    for (const viewer of [null, alice, person('other-admin', 'teacher')]) {
      assert.equal(count(viewer, 'watch-intervals'), 0);
      assert.equal(count(viewer, 'oa-amazon-1'), 1);
      assert.ok(count(viewer, 'lc-1') > 0);
    }
    assert.equal(count(owner, 'watch-intervals'), 1);
  } finally {
    delete process.env.COURSE_ACCESS;
    delete process.env.COURSE_OWNER_ID;
  }
});
