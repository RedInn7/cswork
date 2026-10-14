import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// Community solutions per problem (lib/server/solution-posts.ts). No foreign keys:
// release.sh only applies additive SQL. Removing is a runtime flag, never a DELETE of
// the text: hidden 0 shown, 1 removed by its author, 2 hidden by a moderator.
export const solutionPosts = sqliteTable(
  'solution_posts',
  {
    id: text('id').primaryKey(),
    problemId: text('problem_id').notNull(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    language: text('language').notNull().default(''),
    hidden: integer('hidden').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('solution_posts_problem').on(t.problemId, t.hidden, t.createdAt),
    index('solution_posts_user_time').on(t.userId, t.createdAt),
    index('solution_posts_time').on(t.createdAt),
  ],
);
export const postComments = sqliteTable(
  'post_comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    body: text('body').notNull(),
    hidden: integer('hidden').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('post_comments_post').on(t.postId, t.createdAt),
    index('post_comments_user_time').on(t.userId, t.createdAt),
    index('post_comments_time').on(t.createdAt),
  ],
);
/** One upvote per learner and post; taking it back is a runtime DELETE. */
export const postVotes = sqliteTable(
  'post_votes',
  {
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);
/** target: post:<id> or comment:<id>; one report per learner; cleared when a moderator acts. */
export const postReports = sqliteTable(
  'post_reports',
  {
    target: text('target').notNull(),
    userId: text('user_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.target, t.userId] }),
    index('post_reports_user_time').on(t.userId, t.createdAt),
  ],
);
