import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Peer mock interviews (lib/server/mock-peer.ts). No foreign keys: release.sh only applies
// additive SQL. Slots are UTC hour blocks: whole hours since the epoch.

/** A learner asking for a partner: one open request at a time; status open, matched or cancelled. */
export const mockMatchRequests = sqliteTable(
  'mock_match_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    kind: text('kind').notNull(),
    level: text('level').notNull(),
    slotsJson: text('slots_json').notNull(),
    /** Date#getTimezoneOffset minutes, for the times in this learner's notifications. */
    tz: integer('tz').notNull().default(0),
    status: text('status').notNull().default('open'),
    pairId: text('pair_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('mock_match_open').on(t.status, t.kind, t.level),
    index('mock_match_user').on(t.userId, t.createdAt),
  ],
);

/**
 * Two matched learners: two rounds of the same template, each candidate once, from `seed`.
 * x_no_show_at is when the other side reported x missing; status scheduled or cancelled.
 */
export const mockMatchPairs = sqliteTable(
  'mock_match_pairs',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    level: text('level').notNull(),
    slot: integer('slot').notNull(),
    seed: text('seed').notNull(),
    aUser: text('a_user').notNull(),
    aName: text('a_name').notNull(),
    bUser: text('b_user').notNull(),
    bName: text('b_name').notNull(),
    meetUrl: text('meet_url').notNull().default(''),
    status: text('status').notNull().default('scheduled'),
    aNoShowAt: integer('a_no_show_at'),
    bNoShowAt: integer('b_no_show_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('mock_pairs_a').on(t.aUser, t.slot), index('mock_pairs_b').on(t.bUser, t.slot)],
);
