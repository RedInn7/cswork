import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-import-progress-test-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { practiceRoundState, changePracticeRound } =
  await import('../lib/server/practice-rounds');
const { listStudyLibrary } = await import('../lib/server/study-library');
const { studyProgress } = await import('../lib/server/practice-progress');
const db = sqlite();
migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const library = (userId: string, query = '') => {
  const result = listStudyLibrary(new URLSearchParams(query), userId);
  assert('collection' in result);
  return result;
};
function imported(
  id: string,
  user: string,
  region: string,
  round: string,
  slug = 'two-sum',
) {
  db.prepare(`INSERT INTO leetcode_accepted_records
    (id,user_id,region,external_username,external_submission_id,slug,title,language,submitted_at,source_url,imported_at)
    VALUES(?,?,?,?,?,?,'Two Sum','python3',1000,?,2000)`).run(
    id,
    user,
    region,
    'learner',
    id,
    slug,
    `https://leetcode.${region === 'cn' ? 'cn' : 'com'}/submissions/detail/123/`,
  );
  db.prepare(
    'INSERT INTO leetcode_round_records(user_id,round_id,record_id,created_at) VALUES(?,?,?,2000)',
  ).run(user, round, id);
}
test('external history is round/user scoped, deduplicates with local AC, never opens judge gates', () => {
  db.prepare(`INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,imported_at)
    VALUES('lc-1',1,'two-sum','两数之和','Two Sum','Easy','[]','{}','source',0,0,'lc-1',0),
    ('lc-49',49,'group-anagrams','字母异位词分组','Group Anagrams','Medium','[]','{}','source',0,0,NULL,0)`).run();
  const r1 = practiceRoundState('alice').activeRoundId;
  const bob = practiceRoundState('bob').activeRoundId;
  imported('cn-first', 'alice', 'cn', r1);
  imported('us-first', 'alice', 'us', r1);
  imported('unmatched', 'alice', 'cn', r1, 'future-problem');
  imported('no-judge', 'alice', 'us', r1, 'group-anagrams');
  imported('bob-only', 'bob', 'cn', bob);
  assert.equal(library('alice').collection.solved, 2);
  assert.equal(library('alice').collection.ready, 0);
  assert.equal(practiceRoundState('alice').rounds[0].solved, 2);
  const row = library('alice', 'q=1').items.find((x) => x.id === 'lc-1')!;
  assert.equal(row.solvedLocally, false);
  assert.deepEqual(row.importedSources, ['cn', 'us']);
  assert.equal(row.judgeProblemId, null);
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS n FROM submissions').get() as { n: number })
      .n,
    0,
  );
  db.prepare(`INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,practice_round_id)
    VALUES('local','alice','lc-1','python','private-code','accepted',1,1,1,'judge',?)`).run(
    r1,
  );
  assert.equal(library('alice').collection.solved, 2);
  assert.equal(studyProgress('alice', r1).get('lc-1')?.solvedLocally, true);
  const r2 = changePracticeRound('alice', {
    action: 'create',
    idempotencyKey: 'new-empty-round-0001',
  }).activeRoundId;
  assert.equal(library('alice').collection.solved, 0);
  assert.equal(library('bob').collection.solved, 1);
  assert.equal(practiceRoundState('alice').rounds[0].solved, 2);
  // An in-flight sync retains the round selected at start, not the newly active one.
  imported('late-old', 'alice', 'cn', r1, 'group-anagrams');
  assert.equal(library('alice').collection.solved, 0);
  // Even a malformed cross-user relation cannot leak another user's history.
  db.prepare(
    'INSERT INTO leetcode_round_records(user_id,round_id,record_id,created_at) VALUES(?,?,?,1)',
  ).run('alice', r2, 'bob-only');
  assert.equal(library('alice').collection.solved, 0);
  changePracticeRound('alice', { action: 'activate', roundId: r1 });
  assert.equal(library('alice', 'status=solved').total, 2);
  assert.equal(
    (
      db.prepare('SELECT code FROM submissions WHERE id=?').get('local') as {
        code: string;
      }
    ).code,
    'private-code',
  );
});
