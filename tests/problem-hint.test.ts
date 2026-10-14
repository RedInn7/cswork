import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { hintUnlocked, leetcodeSolutionsUrl } from '../lib/oj-client';
import { curatedHint } from '../lib/ling-curated';

test('only a failed formal submission unlocks the Line 500 hint', () => {
  assert.equal(hintUnlocked([]), false);
  for (const status of ['accepted', 'system_error', 'cancelled', 'queued'])
    assert.equal(hintUnlocked([{ mode: 'judge', status }]), false, status);
  assert.equal(hintUnlocked([{ mode: 'run', status: 'wrong_answer' }]), false);
  for (const status of ['wrong_answer', 'compile_error', 'time_limit', 'runtime_error'])
    assert.equal(
      hintUnlocked([
        { mode: 'judge', status: 'accepted' },
        { mode: 'judge', status },
      ]),
      true,
      status,
    );
});

test('solutions link follows the language, from either LeetCode source', () => {
  for (const source of [
    'https://leetcode.cn/problems/two-sum/',
    'https://leetcode.com/problems/two-sum/description/',
  ]) {
    assert.equal(
      leetcodeSolutionsUrl(source, false),
      'https://leetcode.cn/problems/two-sum/solutions/',
    );
    assert.equal(
      leetcodeSolutionsUrl(source, true),
      'https://leetcode.com/problems/two-sum/solutions/',
    );
  }
  for (const source of ['', undefined, 'https://evil.test/problems/two-sum/'])
    assert.equal(leetcodeSolutionsUrl(source, true), '');
});

test('curated hints exist only for Line 500 problems', () => {
  assert.deepEqual(Object.keys(curatedHint('lc-26') ?? {}), ['zh', 'en']);
  assert.ok(curatedHint('lc-26')?.en.includes('pointer'));
  assert.equal(curatedHint('lc-999999'), null);
  assert.equal(curatedHint('oa-26'), null);
});

test('the hint is earned per practice round, from all history', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cswork-hint-test-'));
  process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
  const { sqlite } = await import('../db/sqlite');
  const { hintEarned } = await import('../lib/server/oj-submissions');
  const db = sqlite();
  try {
    migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
    db.prepare(
      "INSERT INTO practice_rounds(id,user_id,number,created_at,active) VALUES('r1','alice',1,0,0),('r2','alice',2,0,1)",
    ).run();
    const add = (id: string, status: string, mode: string, round: string | null, at: number) =>
      db
        .prepare(
          `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id) VALUES(?,'alice','lc-26','python','',?,1,?,?,?,?)`,
        )
        .run(id, status, at, at, mode, round);
    add('wa', 'wrong_answer', 'judge', 'r1', 0);
    // Later sample runs push the failure past the first history page.
    for (let n = 1; n <= 25; n++) add(`run-${n}`, 'wrong_answer', 'run', null, n);
    add('judge-down', 'system_error', 'judge', 'r2', 30);
    assert.equal(hintEarned('alice', 'lc-26', 'r1'), true);
    assert.equal(hintEarned('alice', 'lc-26'), true);
    // A fresh round starts locked again, as Solved does.
    assert.equal(hintEarned('alice', 'lc-26', 'r2'), false);
    assert.equal(hintEarned('alice', 'lc-27', 'r1'), false);
    assert.equal(hintEarned('bob', 'lc-26'), false);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
