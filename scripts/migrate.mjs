import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const path = resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite');
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const db = new Database(path);
try {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  console.log('cswork database migrations applied.');
} finally {
  db.close();
}
