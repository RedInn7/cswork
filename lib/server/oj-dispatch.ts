import type Database from 'better-sqlite3';

export const OJ_DISPATCH_INTERVAL_MS = 200;

/** Fast path only; the worker's full reconciliation still recovers Redis loss. */
export function createOutboxDispatcher(
  db: Database.Database,
  enqueue: (submissionId: string) => Promise<unknown>,
) {
  let active: Promise<void> | undefined;
  let stopped = false;
  const pending = db.prepare(
    "SELECT s.id FROM oj_outbox o JOIN submissions s ON s.id=o.submission_id WHERE o.dispatched_at IS NULL AND s.status='queued' AND s.cancel_requested=0 ORDER BY o.created_at LIMIT 128",
  );
  const markDispatched = db.prepare('UPDATE oj_outbox SET dispatched_at=? WHERE submission_id=?');
  async function dispatch() {
    for (const { id } of pending.all() as { id: string }[]) {
      if (stopped) break;
      // BullMQ receives the durable submission ID as its idempotent job ID.
      // A crash between enqueue and this update is safely retried.
      await enqueue(id);
      markDispatched.run(Date.now(), id);
    }
  }
  return {
    drain(): Promise<void> {
      if (stopped) return Promise.resolve();
      if (!active)
        active = dispatch().finally(() => {
          active = undefined;
        });
      return active;
    },
    async stop() {
      stopped = true;
      await active?.catch(() => {});
    },
  };
}
