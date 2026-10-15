import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// Contest rooms, entries and weekly ratings (lib/server/contests.ts). No foreign keys: release.sh
// only applies additive SQL. Standings are never stored: they are read from submissions in each
// entrant's window, so judging and contests stay independent.

/**
 * kind: 'weekly' and 'starter' (the site contests, created lazily per week, ids weekly-<n> and
 * starter-<n>), 'mashup' or 'duel' (owner_id null for a ranked duel from the queue).
 * problem_ids_json: judge problem ids in question order. visibility: 'public' (site contests) or
 * 'private' (entrants only; others join with invite_code). rated_at: when a site contest's or a
 * ranked duel's ratings were settled, so settling runs once.
 */
export const contestRooms = sqliteTable(
  'contest_rooms',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id'),
    title: text('title').notNull(),
    kind: text('kind').notNull(),
    problemIdsJson: text('problem_ids_json').notNull(),
    startsAt: integer('starts_at').notNull(),
    durationMin: integer('duration_min').notNull(),
    inviteCode: text('invite_code').unique(),
    visibility: text('visibility').notNull().default('private'),
    ratedAt: integer('rated_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('contest_rooms_kind_start').on(t.kind, t.startsAt), index('contest_rooms_owner').on(t.ownerId)],
);

/**
 * virtual_start: null for a live entrant; the join time for a virtual run after the window.
 * share_code: 1 when the entrant chose to show their accepted code once the room is over.
 */
export const contestEntries = sqliteTable(
  'contest_entries',
  {
    roomId: text('room_id').notNull(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    joinedAt: integer('joined_at').notNull(),
    virtualStart: integer('virtual_start'),
    shareCode: integer('share_code').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.userId] }), index('contest_entries_user').on(t.userId, t.joinedAt)],
);

/** One row per rated weekly entrant: rating before and after, and the live rank. */
export const contestRatings = sqliteTable(
  'contest_ratings',
  {
    userId: text('user_id').notNull(),
    roomId: text('room_id').notNull(),
    before: integer('before').notNull(),
    after: integer('after').notNull(),
    rank: integer('rank').notNull(),
    entrants: integer('entrants').notNull(),
    solved: integer('solved').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roomId] }), index('contest_ratings_room').on(t.roomId)],
);
