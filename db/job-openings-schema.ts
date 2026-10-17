import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// New-grad and intern openings from public ATS boards (company-job-openings): id is
// '<ats>:<board>:<jobId>', kind 'intern' or 'new-grad'; no description text is stored. Each board
// also has one kind 'board' row, id '<ats>:<board>:', recording its first and latest sync. Times are
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
    // Posted pay range when the board publishes one; unit is year|hour|month, '' when none.
    payMin: integer('pay_min'),
    payMax: integer('pay_max'),
    payCurrency: text('pay_currency').notNull().default(''),
    payUnit: text('pay_unit').notNull().default(''),
    // lib/job-tags.ts AUTH_FLAGS bits read from the description at sync; AUTH_UNKNOWN (-1) until judged.
    authFlags: integer('auth_flags').notNull().default(-1),
  },
  (t) => [
    index('job_openings_company').on(t.companySlug, t.lastSeenAt),
    index('job_openings_first_seen').on(t.firstSeenAt),
  ],
);

// When each company's openings of a kind showed up per hiring cycle (the start year they hire
// for), so past seasons stay visible after job_openings rows age out. peak is the most openings
// seen at once. Rows are never deleted: KEEP_FOR pruning applies to job_openings only.
export const jobSeasons = sqliteTable(
  'job_seasons',
  {
    companySlug: text('company_slug').notNull(),
    kind: text('kind').notNull(),
    cycle: integer('cycle').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    peak: integer('peak').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.companySlug, t.kind, t.cycle] })],
);

// The posted pay range of each opening the first time it was seen, kept past job_openings pruning
// for a later per-company pay view. jobs-auth-flags-block writes a row with INSERT OR IGNORE when it
// first sees an opening with a pay range and never changes it. role is a roleCategory(title), cycle
// a hiringCycle. Not pruned by KEEP_FOR; no foreign keys: release.sh only applies additive SQL.
export const jobPaySamples = sqliteTable(
  'job_pay_samples',
  {
    openingId: text('opening_id').primaryKey(),
    companySlug: text('company_slug').notNull(),
    kind: text('kind').notNull(),
    role: text('role').notNull(),
    cycle: integer('cycle').notNull(),
    unit: text('unit').notNull(),
    currency: text('currency').notNull(),
    payMin: integer('pay_min').notNull(),
    payMax: integer('pay_max').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
  },
  (t) => [index('job_pay_samples_company').on(t.companySlug, t.cycle)],
);
