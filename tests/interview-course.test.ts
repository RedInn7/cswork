import test, { after } from 'node:test';
import assert from 'node:assert/strict';
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
const { seedInterview, INTERVIEW_COURSE_ID } =
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
    assert.ok(body.length > 500, chapter.id);
    assert.ok(body.includes('https://oi-wiki.org/'), chapter.id);
    assert.ok(chapter.homeworkProblemIds.length >= 2, chapter.id);
    for (const id of chapter.homeworkProblemIds) assert.ok(ids.has(id), id);
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
