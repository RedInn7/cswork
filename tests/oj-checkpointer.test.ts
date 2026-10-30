import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { startCheckpointer } from '../lib/server/oj-checkpointer';

test('the checkpointer thread moves WAL pages into the database file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-checkpoint-'));
  const path = join(dir, 'main.sqlite');
  process.env.DATABASE_PATH = path;
  process.env.METRICS_DATABASE_PATH = join(dir, 'missing.sqlite');
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('wal_autocheckpoint = 0');
  db.exec('CREATE TABLE t(x BLOB)');
  const before = statSync(path).size;
  const insert = db.prepare('INSERT INTO t VALUES (randomblob(4096))');
  for (let i = 0; i < 200; i++) insert.run();
  assert.equal(statSync(path).size, before, 'nothing checkpointed yet');
  const thread = startCheckpointer(20);
  try {
    for (let i = 0; i < 100 && statSync(path).size === before; i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(statSync(path).size > before + 200 * 4096, 'pages reached the main file');
  } finally {
    await thread.terminate();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
