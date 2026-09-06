import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { persistCase, type CaseRecord } from '../lib/server/oj-case-store';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'oj-case-store-'));
  const path = join(dir, 'db.sqlite');
  const db = new Database(path);
  db.pragma('journal_mode=WAL');
  db.pragma('busy_timeout=2000');
  db.exec(`CREATE TABLE submissions(id TEXT PRIMARY KEY, attempt INTEGER, cancel_requested INTEGER DEFAULT 0, passed INTEGER, runtime REAL, memory INTEGER, score INTEGER, updated_at INTEGER);
    CREATE TABLE oj_results(submission_id TEXT,ordinal INTEGER,status TEXT,runtime_ms REAL,memory_kb INTEGER,stdout TEXT,stderr TEXT,hidden INTEGER,UNIQUE(submission_id,ordinal));
    CREATE TABLE unrelated(value INTEGER); INSERT INTO unrelated VALUES(0);
    INSERT INTO submissions VALUES('job',1,0,23,0,0,82,0);`);
  const insert = db.prepare(
    "INSERT INTO oj_results VALUES('job',?,'accepted',0,0,NULL,NULL,1)",
  );
  for (let i = 0; i < 23; i++) insert.run(i);
  const guard = () => {
    const row = db
      .prepare(
        "SELECT attempt,cancel_requested FROM submissions WHERE id='job'",
      )
      .get() as { attempt: number; cancel_requested: number };
    if (row.attempt !== 1 || row.cancel_requested)
      throw new Error('Stale or cancelled attempt');
  };
  const record: CaseRecord = {
    submissionId: 'job',
    attempt: 1,
    ordinal: 23,
    status: 'accepted',
    runtimeMs: 2,
    memoryKb: 8,
    stdout: 'private',
    stderr: 'private',
    hidden: true,
  };
  const progress = { passed: 24, runtime: 0.002, memory: 8, score: 86 };
  return {
    db,
    path,
    guard,
    record,
    progress,
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

void test('a concurrent writer cannot discard 23 completed cases or force a new attempt', async () => {
  const f = fixture();
  const shared = new SharedArrayBuffer(4);
  const signal = new Int32Array(shared);
  const worker = new Worker(
    `
    const {workerData,parentPort}=require('node:worker_threads');
    const Database=require(workerData.module);
    const db=new Database(workerData.path); db.pragma('busy_timeout=2000');
    db.exec('BEGIN IMMEDIATE'); db.exec('UPDATE unrelated SET value=value+1');
    Atomics.store(new Int32Array(workerData.shared),0,1); Atomics.notify(new Int32Array(workerData.shared),0);
    setTimeout(()=>{db.exec('COMMIT');db.close();parentPort.postMessage('committed');},80);
  `,
    {
      eval: true,
      workerData: {
        path: f.path,
        shared,
        module: createRequire(import.meta.url).resolve('better-sqlite3'),
      },
    },
  );
  const done = new Promise<void>((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', (code) =>
      code ? reject(new Error(`Writer exited ${code}`)) : resolve(),
    );
  });
  try {
    assert.notEqual(Atomics.wait(signal, 0, 0, 5000), 'timed-out');
    persistCase(f.db, f.guard, f.record, f.progress);
    await done;
    assert.equal(
      (
        f.db.prepare('SELECT COUNT(*) AS n FROM oj_results').get() as {
          n: number;
        }
      ).n,
      24,
    );
    assert.deepEqual(
      f.db
        .prepare("SELECT attempt,passed,score FROM submissions WHERE id='job'")
        .get(),
      { attempt: 1, passed: 24, score: 86 },
    );
    assert.deepEqual(
      f.db
        .prepare('SELECT stdout,stderr FROM oj_results WHERE ordinal=23')
        .get(),
      { stdout: null, stderr: null },
    );
  } finally {
    await worker.terminate();
    await done.catch(() => {});
    f.close();
  }
});

void test('cancelled and superseded attempts cannot append a case or advance progress', () => {
  for (const change of ['cancel_requested=1', 'attempt=2']) {
    const f = fixture();
    try {
      f.db.exec(`UPDATE submissions SET ${change}`);
      assert.throws(
        () => persistCase(f.db, f.guard, f.record, f.progress),
        /Stale or cancelled/,
      );
      assert.equal(
        (
          f.db.prepare('SELECT COUNT(*) AS n FROM oj_results').get() as {
            n: number;
          }
        ).n,
        23,
      );
      assert.equal(
        (
          f.db.prepare('SELECT passed FROM submissions').get() as {
            passed: number;
          }
        ).passed,
        23,
      );
    } finally {
      f.close();
    }
  }
});

void test('progress write failure rolls the case back; public output stays bounded', () => {
  const f = fixture();
  try {
    f.db.exec(
      "CREATE TRIGGER reject_progress BEFORE UPDATE ON submissions BEGIN SELECT RAISE(ABORT,'progress rejected'); END",
    );
    assert.throws(
      () => persistCase(f.db, f.guard, f.record, f.progress),
      /progress rejected/,
    );
    assert.equal(
      (
        f.db.prepare('SELECT COUNT(*) AS n FROM oj_results').get() as {
          n: number;
        }
      ).n,
      23,
    );
    f.db.exec('DROP TRIGGER reject_progress');
    persistCase(
      f.db,
      f.guard,
      {
        ...f.record,
        hidden: false,
        stdout: 'x'.repeat(70000),
        stderr: 'y'.repeat(70000),
      },
      f.progress,
    );
    assert.deepEqual(
      f.db
        .prepare(
          'SELECT length(stdout) AS out,length(stderr) AS err FROM oj_results WHERE ordinal=23',
        )
        .get(),
      { out: 65536, err: 65536 },
    );
  } finally {
    f.close();
  }
});
