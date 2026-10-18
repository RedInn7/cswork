import { randomBytes } from 'node:crypto';
import { sqlite } from '@/db/sqlite';

export type Notice = {
  /**
   * A deterministic id (e.g. `rem:${day}:${user}`) makes the notice an upsert: sending it again
   * refreshes the text and link and marks it unread and new instead of adding a second row.
   */
  id?: string;
  userId: string;
  /** What raised it: 'mock-peer', 'course-gift', … */
  kind: string;
  title: string;
  body: string;
  href: string;
  now?: number;
};

/** Kinds left by features since removed (direct messages): their links 404, so inboxes leave them out. */
export const REMOVED_KINDS = ` AND kind NOT IN ('dm')`;

/** Writes an in-app notification; true when a new row was created (false: an `id` refreshed). */
export function notify({ id, userId, kind, title, body, href, now = Date.now() }: Notice): boolean {
  const db = sqlite();
  const insert = (rowId: string, upsert: string) =>
    db
      .prepare(`INSERT INTO notifications(id,user_id,kind,title,body,href,created_at) VALUES(?,?,?,?,?,?,?)${upsert}`)
      .run(rowId, userId, kind, title, body, href, now);
  if (!id) {
    insert(randomBytes(16).toString('hex'), '');
    return true;
  }
  // IMMEDIATE so the existence check and the write see the same row; a savepoint inside a caller's transaction.
  return db
    .transaction(() => {
      const existed = db.prepare('SELECT 1 FROM notifications WHERE id=?').get(id);
      insert(
        id,
        ' ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,href=excluded.href,read_at=NULL,created_at=excluded.created_at',
      );
      return !existed;
    })
    .immediate();
}
