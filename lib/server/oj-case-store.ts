import type Database from 'better-sqlite3';

export type CaseRecord = {
  submissionId: string;
  attempt: number;
  ordinal: number;
  status: string;
  runtimeMs: number;
  memoryKb: number;
  stdout?: string;
  stderr?: string;
  hidden: boolean;
};
export type CaseProgress = {
  passed: number;
  runtime: number;
  memory: number;
  score: number;
};

/**
 * Acquire the write lock before reading the current attempt. In WAL mode a
 * deferred read snapshot cannot upgrade after another process commits a write;
 * BEGIN IMMEDIATE waits for that writer instead of restarting completed tests.
 */
export function persistCase(
  db: Database.Database,
  guardCurrent: () => void,
  record: CaseRecord,
  progress: CaseProgress,
) {
  db.transaction(() => {
    guardCurrent();
    db.prepare(
      'INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,?,?,?,?,?,?,?)',
    ).run(
      record.submissionId,
      record.ordinal,
      record.status,
      record.runtimeMs,
      record.memoryKb,
      record.hidden ? null : (record.stdout ?? '').slice(0, 65536),
      record.hidden ? null : (record.stderr ?? '').slice(0, 65536),
      Number(record.hidden),
    );
    const updated = db
      .prepare(
        'UPDATE submissions SET passed=?,runtime=?,memory=?,score=?,updated_at=? WHERE id=? AND attempt=?',
      )
      .run(
        progress.passed,
        progress.runtime,
        progress.memory,
        progress.score,
        Date.now(),
        record.submissionId,
        record.attempt,
      );
    if (updated.changes !== 1) throw new Error('Submission attempt changed');
  }).immediate();
}
