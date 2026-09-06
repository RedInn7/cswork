import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { curatedEntries } from '../lib/ling-curated';

test('round migration preserves history and assigns only selected formal submissions', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const journal = JSON.parse(
    readFileSync('drizzle/meta/_journal.json', 'utf8'),
  ) as { entries: { idx: number; tag: string }[] };
  try {
    for (const entry of journal.entries.filter((e) => e.idx < 7))
      db.exec(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8'));
    db.prepare(
      `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,imported_at) VALUES('selected',?,'selected','题','Problem','简单','[]','{}','h',0,0,'selected-judge',1)`,
    ).run(curatedEntries[0].number);
    const insert = db.prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES(?,'learner',?,'python','private-code','accepted',1,1,1,?)`,
    );
    insert.run('formal', 'selected-judge', 'judge');
    insert.run('sample', 'selected-judge', 'run');
    insert.run('other', 'other-problem', 'judge');
    db.exec(readFileSync('drizzle/0007_practice_rounds.sql', 'utf8'));
    const rows = db
      .prepare('SELECT id,practice_round_id,code FROM submissions ORDER BY id')
      .all() as {
      id: string;
      practice_round_id: string | null;
      code: string;
    }[];
    assert.equal(rows.length, 3);
    assert.ok(rows.find((r) => r.id === 'formal')?.practice_round_id);
    assert.equal(rows.find((r) => r.id === 'sample')?.practice_round_id, null);
    assert.equal(rows.find((r) => r.id === 'other')?.practice_round_id, null);
    assert.ok(rows.every((r) => r.code === 'private-code'));
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.deepEqual(
      db.prepare('SELECT user_id,number,active FROM practice_rounds').all(),
      [{ user_id: 'learner', number: 1, active: 1 }],
    );
  } finally {
    db.close();
  }
});
