import { statfsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sqlite } from '@/db/sqlite';
import { json } from './http';

// The worker beats every 5s; 120s tolerates a long maintenance pass without paging.
const JUDGE_STALE_SEC = 120;
const MIN_FREE_GIB = 2;

/** Unauthenticated probe for monitors and releases: no seed, no session, no secrets. */
export function health(now = Date.now()) {
  let db = false,
    judge = false,
    judgeAgeSec: number | null = null,
    diskFreeGiB: number | null = null;
  try {
    const connection = sqlite();
    db = connection.prepare('SELECT 1 AS ok').get() !== undefined;
    const row = connection
      .prepare("SELECT healthy,heartbeat_at FROM oj_runtime WHERE id='worker'")
      .get() as { healthy: number; heartbeat_at: number } | undefined;
    if (row) {
      judgeAgeSec = Math.max(0, Math.round((now - row.heartbeat_at) / 1000));
      judge = Boolean(row.healthy) && judgeAgeSec < JUDGE_STALE_SEC;
    }
  } catch {}
  try {
    const fs = statfsSync(
      dirname(resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite')),
    );
    diskFreeGiB = Math.round(((fs.bavail * fs.bsize) / 2 ** 30) * 10) / 10;
  } catch {}
  const ok = db && judge && diskFreeGiB !== null && diskFreeGiB >= MIN_FREE_GIB;
  return json({ ok, db, judge, judgeAgeSec, diskFreeGiB }, ok ? 200 : 503);
}
