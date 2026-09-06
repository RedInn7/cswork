import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
const dir = mkdtempSync(resolve(tmpdir(), 'submission-watch-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { submissionDetail, waitForSubmission } =
  await import('../lib/server/oj-submissions');
const db = sqlite();
migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
const p = {
  id: 'alice',
  name: 'Alice',
  email: 'alice@test.local',
  role: 'student' as const,
  verified: true,
};
function insert(id: string) {
  db.prepare(
    "INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at) VALUES(?,'alice','lc-1','cpp','code','running',1,0,0)",
  ).run(id);
}
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test('waiting request receives a newly completed verdict without the old 750ms client delay', async () => {
  insert('fast');
  const before = await submissionDetail(p, 'fast');
  const started = performance.now();
  const timer = setTimeout(
    () =>
      db
        .prepare(
          "UPDATE submissions SET status='accepted',passed=1 WHERE id='fast'",
        )
        .run(),
    20,
  );
  try {
    const result = await waitForSubmission(
      p,
      'fast',
      before.watchToken,
      new AbortController().signal,
    );
    assert.equal(result.status, 'accepted');
    assert.ok(
      performance.now() - started < 600,
      'must notify before a 750ms polling interval',
    );
  } finally {
    clearTimeout(timer);
  }
});
test('ownership checked before waiting and cancellation releases waiting slots', async () => {
  insert('cancel');
  const before = await submissionDetail(p, 'cancel');
  await assert.rejects(
    waitForSubmission(
      { ...p, id: 'bob' },
      'cancel',
      before.watchToken,
      new AbortController().signal,
    ),
    /提交不存在/,
  );
  const controller = new AbortController();
  const waiting = waitForSubmission(
    p,
    'cancel',
    before.watchToken,
    controller.signal,
  );
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    waitForSubmission(p, 'cancel', before.watchToken, aborted.signal),
    { name: 'AbortError' },
  );
});
test('old tokens and terminal results return immediately; unchanged waits are bounded', async () => {
  insert('timeout');
  const before = await submissionDetail(p, 'timeout');
  const started = performance.now();
  assert.equal(
    (await waitForSubmission(p, 'timeout', 'old', new AbortController().signal))
      .status,
    'running',
  );
  const unchanged = await waitForSubmission(
    p,
    'timeout',
    before.watchToken,
    new AbortController().signal,
    30,
  );
  assert.equal(unchanged.watchToken, before.watchToken);
  assert.ok(performance.now() - started < 500);
  const finished = await submissionDetail(p, 'fast');
  assert.equal(
    (
      await waitForSubmission(
        p,
        'fast',
        finished.watchToken,
        new AbortController().signal,
      )
    ).status,
    'accepted',
  );
});
test('concurrent waits are capped and aborted requests release capacity', async () => {
  insert('capacity');
  const token = (await submissionDetail(p, 'capacity')).watchToken;
  const a = new AbortController(),
    b = new AbortController();
  const first = waitForSubmission(p, 'capacity', token, a.signal);
  const second = waitForSubmission(p, 'capacity', token, b.signal);
  await assert.rejects(
    waitForSubmission(p, 'capacity', token, new AbortController().signal),
    /请求过多/,
  );
  a.abort();
  b.abort();
  await Promise.all([
    assert.rejects(first, { name: 'AbortError' }),
    assert.rejects(second, { name: 'AbortError' }),
  ]);
  assert.equal(
    (
      await waitForSubmission(
        p,
        'capacity',
        token,
        new AbortController().signal,
        1,
      )
    ).status,
    'running',
  );
});
test('case progress bursts are coalesced, including stale tokens, but AC is immediate', async () => {
  insert('burst');
  let detail = await submissionDetail(p, 'burst');
  let count = 0;
  const updates = setInterval(
    () =>
      db
        .prepare(
          "UPDATE submissions SET passed=?,updated_at=? WHERE id='burst'",
        )
        .run(++count, count),
    15,
  );
  try {
    const firstStart = performance.now();
    detail = await waitForSubmission(
      p,
      'burst',
      detail.watchToken,
      new AbortController().signal,
    );
    assert.ok(
      performance.now() - firstStart >= 450,
      'coalesce same-status updates for 500ms',
    );
    // The next request arrives with a stale token after another case completes.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const secondStart = performance.now();
    detail = await waitForSubmission(
      p,
      'burst',
      detail.watchToken,
      new AbortController().signal,
    );
    assert.ok(
      performance.now() - secondStart >= 400,
      'stale token cannot bypass the update cadence',
    );
    const acceptedStart = performance.now();
    const finish = setTimeout(
      () =>
        db
          .prepare("UPDATE submissions SET status='accepted' WHERE id='burst'")
          .run(),
      20,
    );
    try {
      detail = await waitForSubmission(
        p,
        'burst',
        detail.watchToken,
        new AbortController().signal,
      );
      assert.equal(detail.status, 'accepted');
      assert.ok(
        performance.now() - acceptedStart < 400,
        'AC bypasses progress coalescing',
      );
    } finally {
      clearTimeout(finish);
    }
  } finally {
    clearInterval(updates);
  }
});

test('production wait has a three-second hard bound even without an abort signal', async () => {
  insert('hard-bound');
  const token = (await submissionDetail(p, 'hard-bound')).watchToken;
  const started = performance.now();
  const result = await waitForSubmission(
    p,
    'hard-bound',
    token,
    new AbortController().signal,
    60_000,
  );
  assert.equal(result.status, 'running');
  const elapsed = performance.now() - started;
  assert.ok(
    elapsed >= 2_900 && elapsed < 3_600,
    `hard-bound elapsed: ${elapsed}`,
  );
});
