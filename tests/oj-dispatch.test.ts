import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createOutboxDispatcher } from '../lib/server/oj-dispatch';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE submissions (id TEXT PRIMARY KEY, status TEXT, cancel_requested INTEGER DEFAULT 0);
    CREATE TABLE oj_outbox (submission_id TEXT PRIMARY KEY, created_at INTEGER, dispatched_at INTEGER);
    INSERT INTO submissions VALUES ('fresh','queued',0),('sent','queued',0),('cancelled','queued',1),('running','running',0);
    INSERT INTO oj_outbox VALUES ('fresh',1,NULL),('sent',2,10),('cancelled',3,NULL),('running',4,NULL);`);
  return db;
}
test('dispatches committed undispatched queued rows immediately with stable job IDs', async () => {
  const db = fixture();
  const calls: unknown[] = [];
  const dispatch = createOutboxDispatcher(db, async (id) => {
    calls.push(id);
  });
  await dispatch.drain();
  assert.deepEqual(calls, ['fresh']);
  assert.ok(
    (
      db.prepare('SELECT dispatched_at FROM oj_outbox WHERE submission_id=?').get('fresh') as {
        dispatched_at: number;
      }
    ).dispatched_at,
  );
  await dispatch.drain();
  assert.deepEqual(calls, ['fresh']);
  db.close();
});
test('Redis failure preserves outbox and retry reuses the same submission ID', async () => {
  const db = fixture();
  let attempts = 0;
  const dispatch = createOutboxDispatcher(db, async (id) => {
    assert.equal(id, 'fresh');
    if (++attempts === 1) throw new Error('offline');
  });
  await assert.rejects(dispatch.drain(), /offline/);
  assert.equal(
    (
      db.prepare('SELECT dispatched_at FROM oj_outbox WHERE submission_id=?').get('fresh') as {
        dispatched_at: null;
      }
    ).dispatched_at,
    null,
  );
  await dispatch.drain();
  assert.equal(attempts, 2);
  db.close();
});
test('overlapping ticks share one drain and stop waits for inflight enqueue', async () => {
  const db = fixture();
  let release!: () => void;
  let calls = 0;
  const dispatch = createOutboxDispatcher(db, async () => {
    calls++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const first = dispatch.drain();
  const second = dispatch.drain();
  assert.equal(calls, 1);
  let stopped = false;
  const stop = dispatch.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  release();
  await Promise.all([first, second, stop]);
  await dispatch.drain();
  assert.equal(calls, 1);
  db.close();
});

test('actual createSubmission commits outbox before dispatch; idempotent retries enqueue once', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  const dir = mkdtempSync(resolve(tmpdir(), 'cswork-dispatch-tests-'));
  process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
  process.env.OJ_ENABLED = 'true';
  const { sqlite } = await import('../db/sqlite');
  const { ensureOjSeed } = await import('../lib/server/oj-problems');
  const { createSubmission } = await import('../lib/server/oj-submissions');
  const db = sqlite();
  try {
    migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
    db.prepare('INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)').run(
      'gomall',
      'GoMall',
      'Tests',
      '1',
    );
    for (const id of [
      '00-overview',
      '07-product-search',
      '00-overview-architecture',
      '14-middleware',
    ]) {
      db.prepare(
        'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)',
      ).run(id, 'gomall', id, '', 'chapter', '', '1');
    }
    await ensureOjSeed();
    db.prepare('INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)').run(
      'grant',
      'student@example.test',
      '*',
      'test',
      Date.now(),
    );
    const person = {
      id: 'student',
      name: 'Student',
      email: 'student@example.test',
      verified: true,
      role: 'student' as const,
    };
    const request = {
      problemId: 'watch-intervals',
      language: 'python',
      code: 'print(1)',
      mode: 'judge',
      idempotencyKey: 'dispatch-test-idempotency',
    };
    const submission = await createSubmission(person, request);
    const committed = new Database(process.env.DATABASE_PATH!, {
      readonly: true,
    });
    const ids: string[] = [];
    const dispatcher = createOutboxDispatcher(db, async (id) => {
      assert.equal(
        (
          committed.prepare('SELECT status FROM submissions WHERE id=?').get(id) as
            | { status: string }
            | undefined
        )?.status,
        'queued',
      );
      assert.ok(
        committed.prepare('SELECT submission_id FROM oj_outbox WHERE submission_id=?').get(id),
      );
      ids.push(id);
    });
    await dispatcher.drain();
    assert.deepEqual(await createSubmission(person, request), submission);
    await dispatcher.drain();
    assert.deepEqual(ids, [submission.id]);
    await dispatcher.stop();
    committed.close();
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
