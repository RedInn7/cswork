import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-bootstrap-catalogue-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
// bootstrap() (lib/server/api.ts) lists `listProblemSummaries`; api.ts needs Vite's import.meta.glob.
const {
  ensureOjSeed,
  listPublishedProblems,
  listProblemSummaries,
  problemSummary,
} = await import('../lib/server/oj-problems');
const teacher: Person = {
  id: 'teacher',
  email: 'teacher@example.test',
  name: 'Teacher',
  role: 'teacher',
  verified: true,
};
// Everything a catalogue entry may carry; statements load from oj/problems/:id.
const allowed = new Set([
  'id',
  'title',
  'titleEn',
  'difficulty',
  'tags',
  'lessonId',
  'courseId',
  'freeJudge',
]);

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare(
    'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
  ).run('gomall', 'GoMall', 'Original exercises', '1');
  await ensureOjSeed();
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('the bootstrap catalogue lists problems without statements, samples or case data', async () => {
  const full = await listPublishedProblems(teacher);
  const listed = await listProblemSummaries(teacher);
  assert.ok(full.length > 0);
  assert.deepEqual(
    listed.map((p) => p.id),
    full.map((p) => p.id),
  );
  for (const [i, entry] of listed.entries()) {
    const extra = Object.keys(entry).filter((key) => !allowed.has(key));
    assert.deepEqual(extra, [], entry.id);
    const source = full[i];
    assert.equal(entry.title, source.title);
    assert.equal(entry.difficulty, source.difficulty);
    assert.deepEqual(entry.tags, source.tags);
    assert.equal(entry.courseId, source.courseId);
    assert.equal(entry.lessonId, source.lessonId || undefined);
    assert.equal(entry.freeJudge, source.freeJudge);
  }
  const text = JSON.stringify(listed);
  for (const p of full) assert.ok(!text.includes(p.description), p.id);
  assert.ok(text.length * 4 < JSON.stringify(full).length);
});

void test('the English title rides along; the English statement does not', async () => {
  const [source] = await listPublishedProblems(teacher);
  const entry = problemSummary({
    ...source,
    translations: {
      en: {
        title: 'English title',
        description: 'English statement',
        input: 'in',
        output: 'out',
        explanation: 'why',
        hints: ['hint'],
      },
    },
  });
  assert.equal(entry.titleEn, 'English title');
  assert.ok(!JSON.stringify(entry).includes('English statement'));
});

// ponytail: source check; api.ts cannot load outside Vite. oj-integration.mjs asserts the HTTP payload.
void test('bootstrap() serves the summary list, never the full catalogue', () => {
  const api = readFileSync('lib/server/api.ts', 'utf8');
  assert.match(
    api,
    /problems: lite \? undefined : await listProblemSummaries\(p\)/,
  );
  assert.doesNotMatch(api, /listPublishedProblems/);
});
