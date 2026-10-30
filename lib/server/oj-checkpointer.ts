import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';

/** How often the WAL is checkpointed; a PASSIVE checkpoint of 10s of writes takes tens of ms. */
export const CHECKPOINT_INTERVAL_MS = 10_000;

/**
 * Checkpoints the databases' WALs from a separate thread, so no event loop (the worker's or the
 * web's, see db/sqlite.ts) ever waits for one. PASSIVE never blocks writers; busy_timeout 0 means a
 * busy round is skipped, not waited on. Fails open: a dead thread leaves SQLite's fallback bound.
 */
export function startCheckpointer(intervalMs = CHECKPOINT_INTERVAL_MS) {
  const paths = [
    resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite'),
    resolve(process.env.METRICS_DATABASE_PATH || 'data/metrics.sqlite'),
  ];
  // Eval'd CommonJS: resolves better-sqlite3 from the release's node_modules (the cwd).
  const thread = new Worker(
    `const { workerData } = require('node:worker_threads');
    const Database = require(require.resolve('better-sqlite3', { paths: [process.cwd()] }));
    const dbs = [];
    for (const path of workerData.paths) {
      try {
        const db = new Database(path, { fileMustExist: true });
        db.pragma('busy_timeout = 0');
        dbs.push(db);
      } catch {}
    }
    setInterval(() => {
      for (const db of dbs) try { db.pragma('wal_checkpoint(PASSIVE)'); } catch {}
    }, workerData.interval);`,
    { eval: true, workerData: { paths, interval: intervalMs } },
  );
  thread.on('error', (error) =>
    console.error(JSON.stringify({ event: 'oj_checkpointer_failed', error: error.message })),
  );
  thread.unref();
  return thread;
}
