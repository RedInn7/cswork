import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const folder = mkdtempSync(join(tmpdir(), 'cswork-health-'));
process.env.DATABASE_PATH = join(folder, 'test.sqlite');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { health } = await import('../lib/server/health');
const db = sqlite();
after(() => {
  db.close();
  rmSync(folder, { recursive: true, force: true });
});

const beat = (at: number, healthy = 1) =>
  db
    .prepare(
      "INSERT INTO oj_runtime(id,heartbeat_at,healthy,details) VALUES('worker',?,?,'{}') ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,healthy=excluded.healthy",
    )
    .run(at, healthy);
const probe = async (now: number) => {
  const r = health(now);
  const text = await r.text();
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.ok(text.length <= 200, text);
  return { status: r.status, body: JSON.parse(text) };
};

test('health needs a fresh, healthy judge heartbeat', async () => {
  const now = 1_800_000_000_000;
  const missing = await probe(now);
  assert.equal(missing.status, 503);
  assert.equal(missing.body.db, true);
  assert.equal(missing.body.judgeAgeSec, null);
  // The test runs on a real disk; the free-space field must be a number.
  assert.equal(typeof missing.body.diskFreeGiB, 'number');

  beat(now - 3000);
  const fresh = await probe(now);
  assert.deepEqual(
    { ...fresh.body, diskFreeGiB: 0 },
    { ok: fresh.body.diskFreeGiB >= 2, db: true, judge: true, judgeAgeSec: 3, diskFreeGiB: 0 },
  );
  assert.equal(fresh.status, fresh.body.ok ? 200 : 503);

  beat(now - 121_000);
  const stale = await probe(now);
  assert.equal(stale.status, 503);
  assert.equal(stale.body.judge, false);
  assert.equal(stale.body.judgeAgeSec, 121);

  beat(now, 0);
  assert.equal((await probe(now)).body.judge, false);
});
