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
    // Optional OA outcome: problems solved of total, test cases passed %, minutes taken, and
    // whether it led to the next round (yes|no|pending).
    oaSolved: integer('oa_solved'),
    oaTotal: integer('oa_total'),
    oaTestsPct: integer('oa_tests_pct'),
    oaMinutes: integer('oa_minutes'),
    oaNext: text('oa_next'),
    // Optional preparation: weeks spent and a JSON array of lib/experience.ts PREP_SOURCES keys,
    // published with the post.
    prepWeeks: integer('prep_weeks'),
    prepSources: text('prep_sources').notNull().default('[]'),
    // 1: shown without the author's handle (the author and teachers still know whose it is).
    anonymous: integer('anonymous').notNull().default(0),
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

/**
 * Per-question metadata of a submission (experience-question-links); the question text stays in
 * experience_submissions.questions at the same idx. round is one of the post's rounds or ''; problem_id
 * a linked site problem or ''; similar 1 when the asked question only resembled it (not counted as asked).
 */
export const experienceQuestions = sqliteTable(
  'experience_questions',
  {
    submissionId: text('submission_id').notNull(),
    idx: integer('idx').notNull(),
    round: text('round').notNull().default(''),
    problemId: text('problem_id').notNull().default(''),
    similar: integer('similar').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.submissionId, t.idx] }),
    index('experience_questions_problem').on(t.problemId),
  ],
);
