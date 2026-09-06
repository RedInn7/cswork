import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import catalog from '../content/interview-catalog.json';
import curated from '../lib/content/ling-curated-500.json';
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-interview-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { seedInterview, upgradeInterview, INTERVIEW_COURSE_ID } =
  await import('../lib/server/seed-interview');
const db = sqlite();
migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const bodies = Object.fromEntries(
  catalog.map((c) => [
    `/content/lectures/${c.id}.md`,
    readFileSync(resolve(`content/lectures/${c.id}.md`), 'utf8'),
  ]),
);

test('curriculum has complete chapters and valid existing homework links', () => {
  assert.equal(catalog.length, 10);
  assert.equal(new Set(catalog.map((c) => c.id)).size, 10);
  assert.deepEqual(
    catalog.map((c) => c.position),
    Array.from({ length: 10 }, (_, i) => i + 1),
  );
  const ids = new Set(curated.map((p) => `lc-${p.number}`));
  for (const chapter of catalog) {
    const body = bodies[`/content/lectures/${chapter.id}.md`];
    assert.ok(body.replace(/```[\s\S]*?```/g, '').length > 1800, chapter.id);
    assert.ok(!body.includes('## 例题与课后练习'), chapter.id);
    assert.ok(body.includes('https://oi-wiki.org/'), chapter.id);
    assert.ok(chapter.homeworkProblemIds.length >= 2, chapter.id);
    for (const id of chapter.homeworkProblemIds) {
      assert.ok(ids.has(id), id);
      assert.ok(
        (chapter.homeworkNotes as Record<string, string | undefined>)[id],
        id,
      );
    }
    for (const match of body.matchAll(/problem=(lc-\d+)/g))
      assert.ok(ids.has(match[1]), match[1]);
  }
});

test('installation is atomic, idempotent, and does not overwrite instructor changes or grants', () => {
  assert.throws(() => seedInterview(catalog, {}), /Missing/);
  assert.equal(
    db.prepare('SELECT id FROM courses WHERE id=?').get(INTERVIEW_COURSE_ID),
    undefined,
  );
  seedInterview(catalog, bodies);
  assert.equal(
    (
      db
        .prepare('SELECT count(*) n FROM lessons WHERE course_id=?')
        .get(INTERVIEW_COURSE_ID) as { n: number }
    ).n,
    10,
  );
  db.prepare('UPDATE lessons SET body=?,published=0 WHERE id=?').run(
    'Instructor revision',
    catalog[0].id,
  );
  seedInterview(catalog, bodies);
  assert.deepEqual(
    db
      .prepare('SELECT body,published FROM lessons WHERE id=?')
      .get(catalog[0].id),
    { body: 'Instructor revision', published: 0 },
  );
  assert.equal(
    (db.prepare('SELECT count(*) n FROM revisions').get() as { n: number }).n,
    10,
  );
  assert.equal(
    (db.prepare('SELECT count(*) n FROM grants').get() as { n: number }).n,
    0,
  );
});

test('v2 upgrade preserves old revision, instructor changes and completion records', () => {
  const original = 'Original v1 packaged lesson';
  const ids = catalog.slice(0, 2).map((c) => c.id);
  db.prepare(
    'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)',
  ).run('student', 'Student', 'student@test.local');
  db.prepare(
    'INSERT INTO progress(user_id,lesson_id,completed,position,note,bookmarked,updated_at) VALUES(?,?,1,0,?,1,0)',
  ).run('student', ids[0], 'Keep my note');
  db.prepare(
    'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,0)',
  ).run('existing-grant', 'student@test.local', INTERVIEW_COURSE_ID, 'teacher');
  db.prepare("UPDATE courses SET version='1.0.0' WHERE id=?").run(
    INTERVIEW_COURSE_ID,
  );
  for (const id of ids) {
    db.prepare(
      "UPDATE lessons SET body=?,version='1.0.0',revision=1 WHERE id=?",
    ).run(original, id);
    db.prepare(
      "UPDATE revisions SET body=?,version='1.0.0' WHERE lesson_id=?",
    ).run(original, id);
  }
  db.prepare('UPDATE lessons SET body=? WHERE id=?').run(
    'Instructor wrote this',
    ids[1],
  );
  const hashes = Object.fromEntries(
    ids.map((id) => [id, createHash('sha256').update(original).digest('hex')]),
  );
  upgradeInterview(catalog, bodies, hashes);
  assert.deepEqual(
    db
      .prepare(
        'SELECT completed,note,bookmarked FROM progress WHERE user_id=? AND lesson_id=?',
      )
      .get('student', ids[0]),
    { completed: 1, note: 'Keep my note', bookmarked: 1 },
  );
  assert.equal(
    (db.prepare('SELECT count(*) n FROM grants').get() as { n: number }).n,
    1,
  );
  assert.equal(
    (
      db.prepare('SELECT body FROM lessons WHERE id=?').get(ids[0]) as {
        body: string;
      }
    ).body,
    bodies[`/content/lectures/${ids[0]}.md`],
  );
  assert.equal(
    (
      db.prepare('SELECT body FROM lessons WHERE id=?').get(ids[1]) as {
        body: string;
      }
    ).body,
    'Instructor wrote this',
  );
  assert.equal(
    (
      db
        .prepare(
          "SELECT body FROM revisions WHERE lesson_id=? AND version='1.0.0'",
        )
        .get(ids[0]) as { body: string }
    ).body,
    original,
  );
  const count = (
    db.prepare('SELECT count(*) n FROM revisions').get() as { n: number }
  ).n;
  upgradeInterview(catalog, bodies, hashes);
  assert.equal(
    (db.prepare('SELECT count(*) n FROM revisions').get() as { n: number }).n,
    count,
  );
});
