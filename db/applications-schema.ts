import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

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
    referral: text('referral').notNull().default(''),
    link: text('link').notNull().default(''),
    notes: text('notes').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('job_applications_user').on(t.userId, t.updatedAt)],
);
