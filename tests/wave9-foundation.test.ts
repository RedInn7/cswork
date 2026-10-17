import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

test('wave 9 migration adds its columns and tables additively', () => {
  const db = new Database(':memory:');
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
    entries: { idx: number; tag: string }[];
  };
  try {
    for (const entry of journal.entries) db.exec(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8'));
    const column = (table: string, name: string) =>
      (db.pragma(`table_info(${table})`) as { name: string; notnull: number; dflt_value: string | null }[]).find(
        (c) => c.name === name,
      );
    assert.deepEqual(
      [
        column('job_openings', 'auth_flags'),
        column('submissions', 'all_cases'),
        column('job_applications', 'offer_deadline'),
        column('experience_submissions', 'prep_weeks'),
        column('experience_submissions', 'prep_sources'),
      ].map((c) => c && [c.notnull, c.dflt_value]),
      [
        [1, '-1'],
        [1, '0'],
        [0, null],
        [0, null],
        [1, "'[]'"],
      ],
    );
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all();
    assert.ok(tables.includes('job_pay_samples'));
    assert.ok(tables.includes('experience_questions'));
  } finally {
    db.close();
  }
  const tag = journal.entries.find((e) => e.idx === 25)?.tag;
  assert.equal(tag, '0025_wave9_foundation');
  assert.doesNotMatch(readFileSync(`drizzle/${tag}.sql`, 'utf8'), /\b(drop|rename|delete|update|replace)\b/i);
});
