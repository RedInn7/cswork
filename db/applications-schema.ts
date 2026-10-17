import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Wave-8 cross-branch conventions (every branch touching applications follows these):
// - "Write this experience" prefill query params: company (an oj/reports/companies slug), role,
//   employment (intern|fulltime), season (YYYY-term).
// - Resume versions live in localStorage 'cswork:resume:versions'; the tracker writes that string
//   literally rather than importing components/resume-builder.tsx.
// - jd_text is never in the list response (it returns hasJd); read it with GET <id>/jd.

// A learner's job applications for the tracker board (lib/server/applications.ts): private to
// their owner, never listed anywhere else. Times are epoch ms; stage is one of lib/applications.ts
// STAGES. No foreign keys: release.sh only applies additive SQL; removing one is a runtime DELETE.
export const jobApplications = sqliteTable(
  'job_applications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** The company page slug the name matched, or ''. */
    companySlug: text('company_slug').notNull().default(''),
    companyName: text('company_name').notNull(),
    role: text('role').notNull().default(''),
    stage: text('stage').notNull(),
    appliedAt: integer('applied_at'),
    oaDeadline: integer('oa_deadline'),
    interviewAt: integer('interview_at'),
    /** When the offer expires; only an Offer-stage card's counts (tracker-offer-deadlines). */
    offerDeadline: integer('offer_deadline'),
    referral: text('referral').notNull().default(''),
    link: text('link').notNull().default(''),
    notes: text('notes').notNull().default(''),
    /** JSON [[stage, at], ...], appended on each stage change. */
    stageLog: text('stage_log').notNull().default('[]'),
    /** A lib/experience.ts SOURCES key, or ''. */
    channel: text('channel').notNull().default(''),
    /** to-ask | asked | agreed | submitted | declined, or ''. */
    referralStatus: text('referral_status').notNull().default(''),
    nextAction: text('next_action').notNull().default(''),
    nextAt: integer('next_at'),
    jdText: text('jd_text').notNull().default(''),
    resumeVersion: text('resume_version').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('job_applications_user').on(t.userId, t.updatedAt)],
);
