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

// Companies a learner follows (lib/server/follows.ts, at most 20): an approved member report
// notifies at once (experience-submissions review), new OA problems in one daily notice
// (lib/server/company-follows.ts) covering last_digest_at (or the follow) until then.
export const companyFollows = sqliteTable(
  'company_follows',
  {
    userId: text('user_id').notNull(),
    companySlug: text('company_slug').notNull(),
    createdAt: integer('created_at').notNull(),
    lastDigestAt: integer('last_digest_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.companySlug] }), index('company_follows_company').on(t.companySlug)],
);
