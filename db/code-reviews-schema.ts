import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Private code review links on one of the owner's submissions (private-code-review): only the
// token's sha256 is stored; closed_at set means the link is closed. Comments sit on a 1-based
// line of the submission's code. No foreign keys (an ON DELETE clause is not additive SQL to
// deploy/check-additive-migrations.sh).
export const codeReviews = sqliteTable(
  'code_reviews',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    submissionId: text('submission_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    closedAt: integer('closed_at'),
  },
  (t) => [index('code_reviews_owner').on(t.ownerId)],
);

export const codeReviewComments = sqliteTable(
  'code_review_comments',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id').notNull(),
    userId: text('user_id').notNull(),
    line: integer('line').notNull(),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('code_review_comments_review').on(t.reviewId)],
);
