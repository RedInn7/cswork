import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// Who follows whom (lib/server/follows.ts). No foreign keys: release.sh only applies additive
// SQL; unfollowing is a runtime DELETE. Only visible profiles can be followed, and pages list
// only followers and followees whose own profile is visible.
export const userFollows = sqliteTable(
  'user_follows',
  {
    followerId: text('follower_id').notNull(),
    followeeId: text('followee_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('user_follows_followee').on(t.followeeId, t.createdAt),
  ],
);
