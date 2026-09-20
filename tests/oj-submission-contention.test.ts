// Isolated temporary SQLite fixture: never opens or deletes a configured database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
test('submission creation waits for a competing WAL writer and preserves atomicity', async (t) => {
  const root = process.cwd(),
    require = createRequire(resolve(root, 'package.json'));
  const dir = mkdtempSync(resolve(tmpdir(), 'cswork-submission-wal-'));
  process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
  process.env.OJ_ENABLED = 'true';
  delete process.env.REDIS_URL;
  const load = (name: string) =>
    import(pathToFileURL(resolve(root, name)).href);
  const { sqlite } = await load('db/sqlite.ts');
  const { createSubmission } = await load('lib/server/oj-submissions.ts');
  const { ensureOjSeed } = await load('lib/server/oj-problems.ts');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const db = sqlite();
  let worker: Worker | undefined;
  const originalTransaction = db.transaction;
  try {
    migrate(drizzle(db), { migrationsFolder: resolve(root, 'drizzle') });
    db.prepare(
      'INSERT INTO courses(id,title,summary,version,published) VALUES(?,?,?,?,1)',
    ).run('gomall', 'GoMall', 'Tests', '1');
    for (const id of [
      '00-overview',
      '07-product-search',
      '00-overview-architecture',
      '14-middleware',
    ])
      db.prepare(
        'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,0,?,?,0)',
      ).run(id, 'gomall', id, '', 'chapter', '', '1');
    await ensureOjSeed();
    db.exec(
      'CREATE TABLE wal_probe(id INTEGER PRIMARY KEY,value INTEGER NOT NULL); INSERT INTO wal_probe VALUES(1,0)',
    );
    const user = {
      id: 'wal-student',
      name: 'Student',
      email: 'wal@example.test',
      verified: true,
      role: 'student',
    };
    db.prepare(
      'INSERT INTO grants(id,email,course_id,source,created_at) VALUES(?,?,?,?,?)',
    ).run('grant', user.email, '*', 'test', Date.now());
    const input = {
      problemId: 'watch-intervals',
      language: 'python',
      code: 'print(1)',
      mode: 'judge',
      idempotencyKey: 'wal-regression-request-0001',
    };
    const flags = new Int32Array(new SharedArrayBuffer(8));
    let injected = false,
      workerDone: Promise<void> | undefined;
    db.transaction = function (callback: Function) {
      // Inject only at createSubmission's duplicate/count/write transaction.
      if (injected || !String(callback).includes('const duplicate'))
        return originalTransaction.call(db, callback);
      injected = true;
      const tx = originalTransaction.call(db, callback);
      worker = new Worker(
        `
      const {workerData}=require('node:worker_threads');
      const Database=require(workerData.module);const flags=new Int32Array(workerData.flags);
      let db;
      try {
        db=new Database(workerData.path);db.pragma('busy_timeout=5000');
        db.exec('BEGIN IMMEDIATE; UPDATE wal_probe SET value=value+1 WHERE id=1');
        Atomics.store(flags,0,1);Atomics.notify(flags,0);
        Atomics.wait(flags,1,0,80);
        db.exec('COMMIT');Atomics.store(flags,0,2);Atomics.notify(flags,0);
      } catch(e) {Atomics.store(flags,0,-1);Atomics.notify(flags,0);throw e;}
      finally {if(db)db.close();}
    `,
        {
          eval: true,
          workerData: {
            module: require.resolve('better-sqlite3'),
            path: process.env.DATABASE_PATH,
            flags: flags.buffer,
          },
          resourceLimits: { maxOldGenerationSizeMb: 16 },
        },
      );
      workerDone = new Promise((yes, no) => {
        worker!.once('error', no);
        worker!.once('exit', (code) =>
          code === 0 ? yes() : no(new Error('writer exit ' + code)),
        );
      });
      assert.notEqual(
        Atomics.wait(flags, 0, 0, 5000),
        'timed-out',
        'writer failed to acquire WAL lock',
      );
      assert.equal(
        Atomics.load(flags, 0),
        1,
        'writer must still own lock before transaction starts',
      );
      return tx;
    };
    const start = performance.now();
    let result: any, error: any;
    try {
      result = await createSubmission(user, input);
    } catch (e) {
      error = e;
    }
    const elapsedMs = performance.now() - start;
    db.transaction = originalTransaction;
    await workerDone;
    assert.equal(
      injected,
      true,
      'actual createSubmission transaction must be instrumented',
    );
    assert.equal(Atomics.load(flags, 0), 2, 'competing transaction committed');
    const submissions = () =>
      db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;
    const outbox = () =>
      db.prepare('SELECT COUNT(*) AS n FROM oj_outbox').get().n;
    assert.ifError(error);
    assert.equal(result.status, 'queued');
    assert.equal(submissions(), 1);
    assert.equal(outbox(), 1);
    assert.deepEqual(await createSubmission(user, input), result);
    await assert.rejects(
      createSubmission(user, { ...input, code: 'print(2)' }),
      (e: any) => e.status === 409,
    );
    await assert.rejects(
      createSubmission(
        { ...user, verified: false },
        { ...input, idempotencyKey: 'unverified-request-0001' },
      ),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      createSubmission(
        { ...user, id: 'other', email: 'other@example.test' },
        { ...input, idempotencyKey: 'unentitled-request-0001' },
      ),
      (e: any) => e.status === 403,
    );
    assert.equal(submissions(), 1);
    assert.equal(outbox(), 1);
    t.diagnostic(
      JSON.stringify({
        elapsedMs,
        submissions: submissions(),
        outbox: outbox(),
      }),
    );
  } finally {
    db.transaction = originalTransaction;
    if (worker) await worker.terminate();
    db.close();
    // dir is exclusively the exact fresh mkdtemp fixture created above.
    rmSync(dir, { recursive: true, force: true });
  }
});
