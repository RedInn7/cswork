import Database from 'better-sqlite3';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const databasePath = resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite');
const filesPath = resolve(process.env.ATTACHMENTS_PATH || 'data/attachments');
const directory = resolve(process.env.BACKUP_PATH || '/var/lib/cswork/backups');
await mkdir(directory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshot = join(directory, `cswork-${stamp}.sqlite`);
const archive = join(directory, `cswork-${stamp}-attachments.tar.gz`);
const db = new Database(databasePath, { readonly: true });
try {
  await db.backup(snapshot);
  execFileSync('tar', ['-czf', archive, '-C', filesPath, '.']);
} finally { db.close(); }
for (const file of await readdir(directory)) {
  if (!/^cswork-[\dTZ-]+(?:\.sqlite|-attachments\.tar\.gz)$/.test(file)) continue;
  const path = join(directory, file);
  if (Date.now() - (await stat(path)).mtimeMs > 14 * 86400000) await unlink(path);
}
console.log('cswork database and attachment backup completed.');
