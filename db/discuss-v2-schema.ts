import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

/** One upvote per learner and comment (post_comments); pays no points. Taking it back is a runtime DELETE. */
export const commentVotes = sqliteTable(
  'comment_votes',
  {
    commentId: text('comment_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);
