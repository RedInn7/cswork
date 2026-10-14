import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
const dir = mkdtempSync(resolve(tmpdir(), 'speedrun-'));
process.env.DATABASE_PATH = resolve(dir, 'db.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleSpeedrun } = await import('../lib/server/speedrun');
const { loadStudyLibrary } = await import('../scripts/load-study-library.mjs');
type Person = Parameters<typeof handleSpeedrun>[1];

const source = (number: number, slug: string) => ({
  id: `lc-${number}`,
  number,
  slug,
  titleZh: `题 ${number}`,
  titleEn: `Problem ${number}`,
  difficulty: '中等',
  topics: ['数组'],
  descriptionZh: `第 ${number} 题的首段。\n\n**示例 1：**`,
  descriptionEn: `Opening of ${number}.\n\n**Example 1:**`,
  sourceUrl: `https://leetcode.cn/problems/${slug}/`,
  sourceEnUrl: `https://leetcode.com/problems/${slug}/`,
  attribution: 'test',
  signature: { name: 'f' },
  codeSnippets: [],
  reference: { path: '/private/solution.py' },
  cases: [],
  caseStatus: 'missing',
});

before(() => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  const file = resolve(dir, 'source.jsonl');
  // 1 and 3 are judgeable; 26 has no judge binding, so it never appears.
  writeFileSync(
    file,
    [source(1, 'two-sum'), source(3, 'longest-substring'), source(26, 'remove-duplicates')]
      .map((s) => JSON.stringify(s))
      .join('\n') + '\n',
  );
  loadStudyLibrary(db, file);
  for (const id of ['lc-1', 'lc-3']) {
    db.prepare(
      `INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,'gomall','00-overview','v-'||?,1,1,1)`,
    ).run(id, id);
    db.prepare(
      `UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':v-' || ? WHERE id=?`,
    ).run(id, id, id);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const round = async (p: Person) => {
  const response = await handleSpeedrun(new Request('http://x/api/oj/speedrun'), p);
  return (await response.json()) as {
    questions: { id: string; answer: string; reasonEn: string; excerptZh?: string; excerptEn?: string }[];
  };
};
const person = (verified: boolean) =>
  ({ id: verified ? 'u-verified' : 'u-new', role: 'student', verified }) as unknown as Person;

void test('guests get titles, answers and reasons for judgeable problems only, never statements', async () => {
  const { questions } = await round(null);
  assert.deepEqual(questions.map((q) => q.id).sort(), ['lc-1', 'lc-3']);
  const two = questions.find((q) => q.id === 'lc-1')!;
  assert.equal(two.answer, 'hash-counting');
  assert.ok(two.reasonEn.length > 0);
  assert.equal(questions.some((q) => 'excerptZh' in q || 'excerptEn' in q), false);
});

void test('signed-in accounts get the first statement paragraph, verified or not, as the Line 500 detail does', async () => {
  const member = await round(person(true));
  const three = member.questions.find((q) => q.id === 'lc-3')!;
  assert.equal(three.excerptZh, '第 3 题的首段。');
  assert.equal(three.excerptEn, 'Opening of 3.');
  assert.equal(JSON.stringify(member).includes('/private/solution.py'), false);
  const fresh = await round(person(false));
  assert.equal(fresh.questions.find((q) => q.id === 'lc-1')?.excerptEn === 'Opening of 1.', true);
});
