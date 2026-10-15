import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Learner data that leaves the browser (lib/server/learner-cloud.ts). No foreign keys:
// release.sh only applies additive SQL; removing a list or a report is a runtime DELETE.

/**
 * Finished mock OAs, keyed by the browser's session id. The score columns are the
 * server's own report (mockReport), never the client's; null while verdicts were pending.
 * set_hash (sha-256 of the ordered ids) lets a later "same set" challenge find peers.
 */
export const mockSessions = sqliteTable(
  'mock_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    company: text('company'),
    name: text('name'),
    platform: text('platform'),
    preset: integer('preset').notNull(),
    scoring: text('scoring').notNull(),
    source: text('source').notNull(),
    setHash: text('set_hash').notNull(),
    idsJson: text('ids_json').notNull(),
    slotsJson: text('slots_json').notNull(),
    minutes: integer('minutes').notNull(),
    skew: integer('skew').notNull(),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at').notNull(),
    reason: text('reason').notNull(),
    score: integer('score'),
    max: integer('max'),
    solved: integer('solved'),
    estimate: integer('estimate'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('mock_sessions_user_time').on(t.userId, t.startedAt),
    index('mock_sessions_set').on(t.setHash),
  ],
);

/** A learner's own problem list; visibility private or public (public lists can be forked). */
export const userLists = sqliteTable(
  'user_lists',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    visibility: text('visibility').notNull().default('private'),
    forkedFrom: text('forked_from'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('user_lists_owner').on(t.ownerId, t.updatedAt),
    index('user_lists_fork').on(t.forkedFrom),
    index('user_lists_public').on(t.visibility, t.updatedAt),
  ],
);
export const userListItems = sqliteTable(
  'user_list_items',
  {
    listId: text('list_id').notNull(),
    problemId: text('problem_id').notNull(),
    position: integer('position').notNull(),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.problemId] })],
);

/**
 * Opt-in public page /u/<handle>: off by default, never shows the name or email. show_contest:
 * the weekly rating curve and contest badges, a second opt-in because each weekly's rank ties
 * the page to a contest name on the public scoreboards. featured_badge: a badge id (lib/achievements.ts)
 * shown beside the handle while it is still earned.
 */
export const userProfiles = sqliteTable(
  'user_profiles',
  {
    userId: text('user_id').primaryKey(),
    handle: text('handle').notNull().unique(),
    visible: integer('visible').notNull().default(0),
    indexable: integer('indexable').notNull().default(0),
    showContest: integer('show_contest').notNull().default(0),
    bio: text('bio').notNull().default(''),
    featuredBadge: text('featured_badge'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    // Self-reported card fields: up to 4 {kind, url} links, school (school_key: lowercased,
    // punctuation and spaces dropped, for the school boards), graduation year and target role.
    linksJson: text('links_json').notNull().default('[]'),
    school: text('school').notNull().default(''),
    schoolKey: text('school_key').notNull().default(''),
    gradYear: integer('grad_year'),
    targetRole: text('target_role').notNull().default(''),
  },
  (t) => [index('user_profiles_school').on(t.schoolKey)],
);

/**
 * "I was asked this": one report per learner, problem and month asked (YYYY-MM).
 * company is an employer slug or ''; round is oa, phone, onsite or ''. Reporters stay private.
 */
export const problemReports = sqliteTable(
  'problem_reports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    problemId: text('problem_id').notNull(),
    company: text('company').notNull().default(''),
    round: text('round').notNull().default(''),
    askedMonth: text('asked_month').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('problem_reports_once').on(t.userId, t.problemId, t.askedMonth),
    index('problem_reports_problem').on(t.problemId, t.askedMonth),
    index('problem_reports_company').on(t.company, t.askedMonth),
    index('problem_reports_user_time').on(t.userId, t.createdAt),
  ],
);
