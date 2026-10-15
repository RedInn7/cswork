// Course star ratings: one per verified learner who started the course (a completed lesson, or a
// self-paced chapter marked read), stars only, the average from five ratings on.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-course-ratings-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { courseRating, handleCourseRatings, rateCourse, ratingColumns, RATING_MIN } = await import('../lib/server/course-ratings');
const { SELF_PACED } = await import('../lib/server/certificates');

const person = (id: string, verified = true): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified });
const learners = Array.from({ length: 6 }, (_, i) => person(`r-${i}`));
const [ada, ben] = learners;
const fresh = person('r-fresh', false);

const post = (p: Person | null, body: unknown) =>
  handleCourseRatings(
    new Request('https://cswork.test/api/course-ratings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    p,
  ).then(
    (r) => r.status,
    (e: { status?: number; name?: string }) => e.status ?? (e.name === 'ZodError' ? 400 : 500),
  );

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  db.prepare(
    "INSERT INTO courses(id,title,summary,version,published,revision) VALUES('algo','Algorithms','s','1.0.0',1,1),('draft','Draft','s','1.0.0',0,1)",
  ).run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,published,updated_at) VALUES('a1','algo','One','s','sec',1,'b','1.0.0',1,1)",
  ).run();
  for (const p of [...learners, fresh])
    db.prepare('INSERT INTO progress(user_id,lesson_id,completed,updated_at) VALUES(?,?,1,1)').run(p.id, 'a1');
});
after(() => rmSync(dir, { recursive: true, force: true }));

void test('only a verified learner who started the course rates it, once, with 1-5 stars', async () => {
  const outsider = person('r-outsider');
  assert.equal(courseRating(outsider, 'algo').canRate, false);
  assert.throws(() => rateCourse(outsider, 'algo', 4), { status: 403 });
  assert.throws(() => rateCourse(fresh, 'algo', 4), { status: 403 });
  assert.equal(await post(null, { course: 'algo', stars: 4 }), 401);
  assert.equal(await post(ada, { course: 'algo', stars: 6 }), 400);
  assert.equal(await post(ada, { course: 'algo', stars: 4, body: 'great' }), 400, 'stars only, no text');
  assert.equal(await post(ada, { course: 'draft', stars: 4 }), 404);
  assert.equal(await post(ada, { course: 'nope', stars: 4 }), 404);

  assert.equal(courseRating(ada, 'algo').canRate, true);
  assert.deepEqual(rateCourse(ada, 'algo', 2), { avg: null, count: 1, mine: 2, canRate: true });
  // Rating again changes the one rating.
  assert.deepEqual(rateCourse(ada, 'algo', 5), { avg: null, count: 1, mine: 5, canRate: true });
  assert.equal(await post(ben, { course: 'algo', stars: 4 }), 200);
});

void test(`the average shows from ${RATING_MIN} ratings, here and in the course list`, () => {
  for (const p of learners.slice(2, 4)) rateCourse(p, 'algo', 4);
  assert.deepEqual(courseRating(null, 'algo'), { avg: null, count: 4, mine: null, canRate: false });
  rateCourse(learners[4], 'algo', 3);
  assert.deepEqual(courseRating(null, 'algo'), { avg: 4, count: 5, mine: null, canRate: false });
  const row = sqlite().prepare(`SELECT id,${ratingColumns('courses.id')} FROM courses WHERE id='algo'`).get();
  assert.deepEqual(row, { id: 'algo', rating_avg: 4, rating_count: 5 });
});

void test('a self-paced course is rated after one chapter is marked read', () => {
  const course = SELF_PACED.find((c) => c.id === 'sd:system-design')!;
  assert.equal(courseRating(ada, course.id).canRate, false);
  sqlite()
    .prepare("INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'read',1)")
    .run(ada.id, course.targets[0]);
  assert.deepEqual(rateCourse(ada, course.id, 5), { avg: null, count: 1, mine: 5, canRate: true });
});
