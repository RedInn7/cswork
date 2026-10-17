import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

void test('wave 10 migration adds its column and tables additively', () => {
  const db = new Database(':memory:');
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  try {
    for (const entry of journal.entries) db.exec(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8'));
    const columns = (table: string) =>
      db.pragma(`table_info(${table})`) as { name: string; notnull: number; dflt_value: string | null }[];
    const tier = columns('job_applications').find((c) => c.name === 'tier');
    assert.deepEqual(tier && [tier.notnull, tier.dflt_value], [1, "''"]);
    assert.deepEqual(
      columns('resume_reviews').map((c) => c.name),
      ['id', 'owner_id', 'token_hash', 'snapshot', 'version', 'note', 'created_at', 'closed_at'],
    );
    assert.deepEqual(
      columns('resume_review_comments').map((c) => c.name),
      ['id', 'review_id', 'user_id', 'path', 'original', 'body', 'suggestion', 'accepted_at', 'created_at'],
    );
  } finally {
    db.close();
  }
  const tag = journal.entries.find((e) => e.idx === 26)?.tag;
  assert.equal(tag, '0026_wave10_foundation');
  assert.doesNotMatch(readFileSync(`drizzle/${tag}.sql`, 'utf8'), /\b(drop|rename|delete|update|replace)\b/i);
});
