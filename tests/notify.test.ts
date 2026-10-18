import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

process.env.DATABASE_PATH = resolve(mkdtempSync(resolve(tmpdir(), 'cswork-notify-')), 'notify.sqlite');
const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: 'drizzle' });
const { notify } = await import('../lib/server/notify');

void test('notify: a fresh row each time without an id; with one, an upsert that re-surfaces it', () => {
  const rows = () =>
    sqlite().prepare("SELECT id,kind,title,body,href,read_at,created_at FROM notifications WHERE user_id='u1' ORDER BY created_at,rowid").all() as {
      id: string; kind: string; title: string; body: string; href: string; read_at: number | null; created_at: number;
    }[];
  const base = { userId: 'u1', kind: 'mock-peer', title: 'a', body: 'b', href: '/x' };
  assert.equal(notify({ ...base, now: 1 }), true);
  assert.equal(notify({ ...base, now: 2 }), true);
  assert.equal(rows().length, 2);
  assert.match(rows()[0].id, /^[0-9a-f]{32}$/);

  assert.equal(notify({ ...base, id: 'rem:2026-10-15:u1', kind: 'reminder', now: 3 }), true);
  sqlite().prepare("UPDATE notifications SET read_at=9 WHERE id='rem:2026-10-15:u1'").run();
  assert.equal(notify({ ...base, id: 'rem:2026-10-15:u1', kind: 'reminder', title: 'A', body: 'B', href: '/y', now: 4 }), false);
  const all = rows();
  assert.equal(all.length, 3);
  assert.deepEqual(all[2], { id: 'rem:2026-10-15:u1', kind: 'reminder', title: 'A', body: 'B', href: '/y', read_at: null, created_at: 4 });

  // Inside a caller's transaction it nests as a savepoint.
  sqlite().transaction(() => assert.equal(notify({ ...base, id: 'rem:2026-10-16:u1', now: 5 }), true))();
  assert.equal(rows().length, 4);
});
