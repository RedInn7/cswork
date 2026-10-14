import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Practice points (lib/server/points.ts): one row per award (+) or redemption (−), the
 * balance is SUM(delta). (user, reason, ref) is unique, so replaying an event never pays
 * twice. Refs name what was rewarded (a Beijing date, a problem id, a post and voter, a
 * month's freeze slot); they are never shown to anyone but the ledger's owner.
 */
export const pointLedger = sqliteTable(
  'point_ledger',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    delta: integer('delta').notNull(),
    reason: text('reason').notNull(),
    refId: text('ref_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('point_ledger_once').on(t.userId, t.reason, t.refId)],
);
