import Database from 'better-sqlite3';
import {
  mkdir,
  mkdtemp,
  readdir,
  stat,
  lstat,
  unlink,
  link,
  copyFile,
  writeFile,
  rm,
  open,
  statfs,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const databasePath = resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite');
const filesPath = resolve(process.env.ATTACHMENTS_PATH || 'data/attachments');
const mediaPath = resolve(process.env.MEDIA_PATH || 'data/media');
const directory = resolve(process.env.BACKUP_PATH || '/var/lib/cswork/backups');
const reserve = BigInt(3 * 1024 * 1024 * 1024);
async function requireSpace(bytes) {
  const disk = await statfs(directory, { bigint: true });
  if (disk.bavail * disk.bsize < reserve + BigInt(bytes))
    throw new Error(
      'Backup would leave less than 3 GiB of available disk space',
    );
}
async function verifyFile(path, size) {
  const info = await lstat(path);
  if (!info.isFile() || info.size !== size)
    throw new Error(
      'A snapshot file is missing, incomplete, or not a regular file',
    );
}
async function keepFile(source, target, size, onRetained = () => {}) {
  await verifyFile(source, size);
  try {
    await link(source, target);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    await requireSpace(size);
    await copyFile(source, target, constants.COPYFILE_EXCL);
  }
  onRetained();
  // Validate the retained inode, even if the source was deleted after linking.
  await verifyFile(target, size);
}

await mkdir(directory, { recursive: true, mode: 0o700 });
const lockPath = join(directory, '.backup.lock');
let lock;
try {
  lock = await open(lockPath, 'wx', 0o600);
} catch (e) {
  if (e.code === 'EEXIST')
    throw new Error(
      'Another backup is active, or a previous run left .backup.lock; inspect it before retrying',
    );
  throw e;
}
let work = null,
  db = null,
  saved = null,
  committed = false;
const published = [],
  newObjects = [];
try {
  await lock.writeFile(
    `pid=${process.pid}\nstarted=${new Date().toISOString()}\n`,
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  work = await mkdtemp(join(directory, '.backup-pending-'));
  const snapshot = join(work, 'snapshot.sqlite');
  await requireSpace((await stat(databasePath)).size);
  db = new Database(databasePath, { readonly: true, fileMustExist: true });
  await db.backup(snapshot);
  db.close();
  db = null;
  saved = new Database(snapshot, { readonly: true });
  const hasTable = (name) =>
    !!saved
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
  const attachments = hasTable('attachments')
    ? saved.prepare('SELECT id,size FROM attachments ORDER BY id').all()
    : [];
  const fixedFiles = join(work, 'attachments');
  await mkdir(fixedFiles, { mode: 0o700 });
  for (const attachment of attachments) {
    if (
      !/^[a-f0-9-]{36}$/.test(attachment.id) ||
      !Number.isSafeInteger(attachment.size) ||
      attachment.size < 1
    )
      throw new Error('Invalid attachment record in database snapshot');
    await keepFile(
      join(filesPath, attachment.id),
      join(fixedFiles, attachment.id),
      attachment.size,
    );
  }
  // This directory contains exactly the immutable files referenced by the snapshot.
  // Concurrent uploads/deletes affect the live directory, not this retained set.
  const archive = join(work, 'attachments.tar.gz');
  const archiveBudget = attachments.reduce(
    (sum, a) => sum + a.size + 2048,
    1024 * 1024,
  );
  await requireSpace(archiveBudget);
  execFileSync('tar', ['-czf', archive, '-C', fixedFiles, '.']);
  const assets = hasTable('media_assets')
    ? saved
        .prepare(
          "SELECT id,storage_key,size FROM media_assets WHERE status IN ('ready','archived') ORDER BY id",
        )
        .all()
    : [];
  const objects = join(directory, 'media-objects');
  if (assets.length) await mkdir(objects, { recursive: true, mode: 0o700 });
  for (const asset of assets) {
    if (
      !/^[a-zA-Z0-9_-]+\.(mp4|webm)$/.test(asset.storage_key) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1
    )
      throw new Error('Invalid media record in database snapshot');
    const target = join(objects, asset.storage_key);
    let present = false;
    try {
      await lstat(target);
      present = true;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    if (present) await verifyFile(target, asset.size);
    else {
      // The backup lock prevents concurrent runs from observing uncommitted objects.
      await keepFile(
        join(mediaPath, asset.storage_key),
        target,
        asset.size,
        () => newObjects.push(target),
      );
    }
  }
  const mediaManifest = join(work, 'media.json');
  await writeFile(mediaManifest, JSON.stringify(assets, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  saved.close();
  saved = null;
  const pairs = [
    [snapshot, `cswork-${stamp}.sqlite`],
    [archive, `cswork-${stamp}-attachments.tar.gz`],
    [mediaManifest, `cswork-${stamp}-media.json`],
  ];
  for (const [source, name] of pairs) {
    const destination = join(directory, name);
    // Names are unique within the locked run; never replace a previous backup.
    await link(source, destination);
    published.push(destination);
  }
  const marker = join(directory, `cswork-${stamp}-complete.json`);
  const markerFile = await open(marker, 'wx', 0o600);
  published.push(marker);
  try {
    await markerFile.writeFile(
      JSON.stringify({
        createdAt: new Date().toISOString(),
        files: pairs.map(([, name]) => name),
        attachments: attachments.length,
        media: assets.length,
      }),
    );
  } finally {
    await markerFile.close();
  }
  committed = true;
  // Retention runs only after a complete, validated backup was published.
  for (const file of await readdir(directory)) {
    if (
      !/^cswork-[\dTZ-]+(?:\.sqlite|-attachments\.tar\.gz|-media\.json|-complete\.json)$/.test(
        file,
      )
    )
      continue;
    const path = join(directory, file);
    if (Date.now() - (await stat(path)).mtimeMs > 14 * 86400000)
      await unlink(path);
  }
  console.log(
    'cswork database, fixed attachment set and immutable media backup completed.',
  );
} finally {
  saved?.close();
  db?.close();
  if (!committed) {
    for (const path of [...published, ...newObjects])
      await unlink(path).catch((e) => {
        if (e.code !== 'ENOENT')
          console.error(`Uncommitted backup file requires cleanup: ${path}`);
      });
  }
  if (work) await rm(work, { recursive: true, force: true });
  await lock.close();
  await unlink(lockPath);
}
