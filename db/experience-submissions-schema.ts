import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// Member-written interview experiences (lib/server/experience-submissions.ts). No foreign keys:
// release.sh only applies additive SQL; withdrawing a submission is a runtime DELETE.

/**
 * One learner's interview experience, shown publicly only once a teacher approves it.
 * company_slug is an employer slug (lib/oa-company-brands.ts); rounds and questions are JSON
 * arrays; result is a lib/experience.ts RESULTS key or null; interview_month is YYYY-MM.
 * status: pending | approved | rejected. review_note is for the author only.
 */
export const experienceSubmissions = sqliteTable(
  'experience_submissions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    companySlug: text('company_slug').notNull(),
    title: text('title').notNull(),
    role: text('role').notNull(),
    rounds: text('rounds').notNull().default('[]'),
    result: text('result'),
    interviewMonth: text('interview_month').notNull(),
    body: text('body').notNull(),
    questions: text('questions').notNull().default('[]'),
    // Optional structured facts: difficulty 1-5, sentiment pos|neutral|neg, channel
    // referral|online|campus|recruiter|other, employment fulltime|intern, season like 2026-fall.
    difficulty: integer('difficulty'),
    sentiment: text('sentiment'),
    channel: text('channel'),
    employment: text('employment'),
    season: text('season'),
    location: text('location'),
    durationWeeks: integer('duration_weeks'),
    status: text('status').notNull().default('pending'),
    reviewNote: text('review_note').notNull().default(''),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('experience_submissions_user').on(t.userId, t.createdAt),
    index('experience_submissions_status').on(t.status, t.createdAt),
    index('experience_submissions_company').on(t.companySlug, t.status),
  ],
);

/** A reader's report on an approved submission: one per reader; enough of them hide it until reviewed. */
export const experienceFlags = sqliteTable(
  'experience_flags',
  {
    submissionId: text('submission_id').notNull(),
    userId: text('user_id').notNull(),
    reason: text('reason').notNull(),
    note: text('note').notNull().default(''),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.userId] })],
);
