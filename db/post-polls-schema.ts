import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// Removed with the discussion board: polls are no longer read or written; the tables stay (no
// DROP) so existing rows are kept. Was: a poll on a discussion thread, one per post: 2–6 options
// of up to 80 characters as a JSON array; closes_at null ran until the thread went.
export const postPolls = sqliteTable('post_polls', {
  postId: text('post_id').primaryKey(),
  question: text('question').notNull(),
  optionsJson: text('options_json').notNull(),
  multi: integer('multi').notNull().default(0),
  closesAt: integer('closes_at'),
  createdAt: integer('created_at').notNull(),
});
/** One row per option a voter picked (several on a multiple-choice poll); only counts leave the server. */
export const pollVotes = sqliteTable(
  'poll_votes',
  {
    postId: text('post_id').notNull(),
    userId: text('user_id').notNull(),
    option: integer('option').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.option] })],
);
