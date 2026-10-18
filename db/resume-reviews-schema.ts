import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Private resume review links (resume-review-links), shaped like code_reviews: only the token's
// sha256 is stored; snapshot is the owner's resume JSON without name or contact lines
// (education/experience/projects/skills/awards) and version the named copy it came from ('' = the
// base). Closing a link sets closed_at and empties snapshot. A comment sits on one line, path like
// 'experience.0.bullets.2' or 'skills.3' (a lib/resume-check `where` plus the line index);
// original is that line as the server read it from the snapshot; a non-empty suggestion is a
// rewrite the owner may accept (accepted_at). No foreign keys, as in code-reviews-schema.ts.
export const resumeReviews = sqliteTable(
  'resume_reviews',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    snapshot: text('snapshot').notNull().default('{}'),
    version: text('version').notNull().default(''),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    closedAt: integer('closed_at'),
  },
  (t) => [index('resume_reviews_owner').on(t.ownerId)],
);

export const resumeReviewComments = sqliteTable(
  'resume_review_comments',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id').notNull(),
    userId: text('user_id').notNull(),
    path: text('path').notNull(),
    original: text('original').notNull(),
    body: text('body').notNull(),
    suggestion: text('suggestion').notNull().default(''),
    acceptedAt: integer('accepted_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('resume_review_comments_review').on(t.reviewId)],
);
