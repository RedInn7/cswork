import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Ranked 1v1 duels (lib/server/duels.ts). No foreign keys: release.sh only applies additive SQL.
// The duel itself is a contest room (kind 'duel', no owner); these hold the queue and the result.

/** One row per waiting learner: their duel rating when queued; seen_at moves on every poll. */
export const duelQueue = sqliteTable('duel_queue', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  rating: integer('rating').notNull(),
  createdAt: integer('created_at').notNull(),
  seenAt: integer('seen_at').notNull(),
});

/** One row per settled ranked duel: winner null for a draw; duel ratings before and after. */
export const duelResults = sqliteTable(
  'duel_results',
  {
    roomId: text('room_id').primaryKey(),
    aUser: text('a_user').notNull(),
    bUser: text('b_user').notNull(),
    winner: text('winner'),
    aBefore: integer('a_before').notNull(),
    aAfter: integer('a_after').notNull(),
    bBefore: integer('b_before').notNull(),
    bAfter: integer('b_after').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('duel_results_a').on(t.aUser, t.createdAt), index('duel_results_b').on(t.bUser, t.createdAt)],
);
