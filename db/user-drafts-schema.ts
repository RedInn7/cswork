import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// Editor drafts that follow a signed-in learner across devices (lib/server/learner-cloud.ts).
// No foreign keys: release.sh only applies additive SQL; the per-learner cap is a runtime DELETE.
// updated_at is on the server's clock (the edit's age by the browser's clock, taken from the
// server's now); clients shift it to their own clock before comparing with local drafts.
export const userDrafts = sqliteTable(
  'user_drafts',
  {
    userId: text('user_id').notNull(),
    problemId: text('problem_id').notNull(),
    language: text('language').notNull(),
    codingMode: text('coding_mode').notNull(),
    code: text('code').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.problemId, t.language, t.codingMode] }),
    index('user_drafts_user_time').on(t.userId, t.updatedAt),
  ],
);
