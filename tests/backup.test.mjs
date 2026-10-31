import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-backup-test-'));
  const files = join(dir, 'files'),
    media = join(dir, 'media'),
    backups = join(dir, 'backups'),
    bin = join(dir, 'bin'),
    path = join(dir, 'staging.sqlite');
  for (const d of [files, media, backups, bin]) mkdirSync(d);
  const id = randomUUID(),
    db = new Database(path);
  db.exec(
    'CREATE TABLE attachments(id TEXT PRIMARY KEY,size INTEGER); CREATE TABLE media_assets(id TEXT PRIMARY KEY,storage_key TEXT,size INTEGER,status TEXT)',
  );
  db.prepare('INSERT INTO attachments VALUES(?,?)').run(id, 8);
  writeFileSync(join(files, id), 'evidence');
  const env = {
    ...process.env,
    DATABASE_PATH: path,
    ATTACHMENTS_PATH: files,
    MEDIA_PATH: media,
    BACKUP_PATH: backups,
  };
  const run = (extra) =>
    spawnSync(process.execPath, ['scripts/backup.mjs'], {
      cwd: root,
      env: { ...env, ...extra },
      encoding: 'utf8',
      timeout: 20000,
    });
  const snapshots = () =>
    readdirSync(backups).filter((f) => f.endsWith('.sqlite'));
  const close = () => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  };
  return {
    dir,
    files,
    media,
    backups,
    bin,
    path,
    id,
    db,
    env,
    run,
    snapshots,
    close,
  };
}
void test('retained attachment inode survives real live deletion after SQLite snapshot, before tar', () => {
  const f = setup();
  try {
    const remove = join(f.dir, 'concurrent-delete.mjs');
    writeFileSync(
      remove,
      `import {createRequire} from 'node:module';import {unlinkSync} from 'node:fs';import {join} from 'node:path';const require=createRequire(${JSON.stringify(join(root, 'package.json'))});const Database=require('better-sqlite3');unlinkSync(join(process.env.ATTACHMENTS_PATH,process.env.REMOVE_ID));const db=new Database(process.env.DATABASE_PATH);db.prepare('DELETE FROM attachments WHERE id=?').run(process.env.REMOVE_ID);db.close();`,
    );
    writeFileSync(
      join(f.bin, 'tar'),
      '#!/bin/sh\n"$BACKUP_TEST_NODE" "$BACKUP_TEST_DELETE"\nexec /usr/bin/tar "$@"\n',
      { mode: 0o755 },
    );
    const r = f.run({
      PATH: f.bin + ':' + process.env.PATH,
      BACKUP_TEST_NODE: process.execPath,
      BACKUP_TEST_DELETE: remove,
      REMOVE_ID: f.id,
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /completed/);
    assert.equal(
      f.db.prepare('SELECT COUNT(*) AS n FROM attachments').get().n,
      0,
    );
    const saved = new Database(join(f.backups, f.snapshots()[0]), {
      readonly: true,
    });
    assert.equal(
      saved.prepare('SELECT COUNT(*) AS n FROM attachments').get().n,
      1,
    );
    saved.close();
    const archive = readdirSync(f.backups).find((p) =>
      p.endsWith('-attachments.tar.gz'),
    );
    const restore = join(f.dir, 'restored');
    mkdirSync(restore);
    execFileSync('/usr/bin/tar', [
      '-xzf',
      join(f.backups, archive),
      '-C',
      restore,
    ]);
    assert.equal(readFileSync(join(restore, f.id), 'utf8'), 'evidence');
    assert.equal(
      readdirSync(f.backups).filter((p) => p.endsWith('-complete.json')).length,
      1,
    );
    assert.equal(
      readdirSync(f.backups).some((p) => p.startsWith('.backup')),
      false,
    );
  } finally {
    f.close();
  }
});
void test('missing or incomplete referenced files fail without replacing prior backups or keeping partial output', () => {
  const f = setup();
  try {
    assert.equal(f.run().status, 0);
    const before = readdirSync(f.backups).sort();
    const contents = new Map(
      before.map((name) => [name, readFileSync(join(f.backups, name))]),
    );
    unlinkSync(join(f.files, f.id));
    const absent = f.run();
    assert.notEqual(absent.status, 0);
    assert.equal(absent.stdout.includes('completed'), false);
    assert.deepEqual(readdirSync(f.backups).sort(), before);
    writeFileSync(join(f.files, f.id), 'short');
    const partial = f.run();
    assert.notEqual(partial.status, 0);
    assert.equal(partial.stdout.includes('completed'), false);
    assert.deepEqual(readdirSync(f.backups).sort(), before);
    for (const name of before)
      assert.deepEqual(readFileSync(join(f.backups, name)), contents.get(name));
  } finally {
    f.close();
  }
});
void test('archive includes only snapshot references, and immutable media objects are reused', () => {
  const f = setup();
  try {
    writeFileSync(
      join(f.files, 'unreferenced-private-file'),
      'must not be archived',
    );
    writeFileSync(join(f.media, 'video-a.mp4'), 'video-content');
    f.db
      .prepare('INSERT INTO media_assets VALUES(?,?,?,?)')
      .run('video-a', 'video-a.mp4', 13, 'ready');
    const first = f.run();
    assert.equal(first.status, 0, first.stderr);
    const objects = join(f.backups, 'media-objects');
    assert.deepEqual(readdirSync(objects), ['video-a.mp4']);
    const archive = readdirSync(f.backups).find((p) =>
      p.endsWith('-attachments.tar.gz'),
    );
    const listing = execFileSync(
      '/usr/bin/tar',
      ['-tzf', join(f.backups, archive)],
      { encoding: 'utf8' },
    );
    assert.match(listing, new RegExp(f.id));
    assert.equal(listing.includes('unreferenced-private-file'), false);
    const again = f.run();
    assert.equal(again.status, 0, again.stderr);
    assert.deepEqual(readdirSync(objects), ['video-a.mp4']);
    assert.equal(f.snapshots().length, 2);
    assert.equal(
      readFileSync(join(objects, 'video-a.mp4'), 'utf8'),
      'video-content',
    );
  } finally {
    f.close();
  }
});
void test('media failure removes this run partial artifacts and leaves older complete backups intact', () => {
  const f = setup();
  try {
    assert.equal(f.run().status, 0);
    const before = readdirSync(f.backups).sort();
    f.db
      .prepare('INSERT INTO media_assets VALUES(?,?,?,?)')
      .run('missing-media', 'missing.mp4', 13, 'ready');
    const failed = f.run();
    assert.notEqual(failed.status, 0);
    assert.equal(failed.stdout.includes('completed'), false);
    assert.deepEqual(
      readdirSync(f.backups)
        .filter((p) => p !== 'media-objects')
        .sort(),
      before,
    );
    assert.deepEqual(readdirSync(join(f.backups, 'media-objects')), []);
  } finally {
    f.close();
  }
});

test('backup finishes while another process keeps writing', () => {
  const f = setup();
  try {
    const db = new Database(f.path);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE churn(x BLOB)');
    const insert = db.prepare('INSERT INTO churn VALUES (randomblob(4096))');
    db.transaction(() => { for (let i = 0; i < 20000; i++) insert.run(); })();
    db.close();
    // Production writes never pause; the snapshot must still complete in one pass.
    const writer = spawn(process.execPath, ['-e', `
      const db = new (require('better-sqlite3'))(${JSON.stringify(f.path)});
      const insert = db.prepare('INSERT INTO churn VALUES (randomblob(4096))');
      setInterval(() => insert.run(), 2);`], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    // Wait for its first write, so the backup really runs against a writer.
    const rows = () => { const r = new Database(f.path, { readonly: true }); const n = r.prepare('SELECT count(*) FROM churn').pluck().get(); r.close(); return n; };
    const start = Date.now();
    while (rows() === 20000 && Date.now() - start < 5000) execFileSync('sleep', ['0.05']);
    assert.ok(rows() > 20000, 'writer is running');
    try {
      const result = f.run();
      assert.equal(result.status, 0, result.stderr);
      assert.equal(f.snapshots().length, 1);
    } finally {
      writer.kill();
    }
  } finally {
    f.close();
  }
});
