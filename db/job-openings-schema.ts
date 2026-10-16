import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// New-grad and intern openings from public ATS boards (company-job-openings): id is
// '<ats>:<board>:<jobId>', kind 'intern' or 'new-grad'; no description text is stored. Times are
// epoch ms; posted_at is null when the board gives none. No foreign keys: release.sh only
// applies additive SQL.
export const jobOpenings = sqliteTable(
  'job_openings',
  {
    id: text('id').primaryKey(),
    companySlug: text('company_slug').notNull(),
    title: text('title').notNull(),
    location: text('location').notNull().default(''),
    url: text('url').notNull(),
    kind: text('kind').notNull(),
    postedAt: integer('posted_at'),
    firstSeenAt: integer('first_seen_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
  },
  (t) => [
    index('job_openings_company').on(t.companySlug, t.lastSeenAt),
    index('job_openings_first_seen').on(t.firstSeenAt),
  ],
);
