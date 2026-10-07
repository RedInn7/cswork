import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { practiceRounds } from './practice-round-schema';

export const leetcodeSyncRuns = sqliteTable(
  'leetcode_sync_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    region: text('region').notNull(),
    externalUsername: text('external_username').notNull(),
    roundId: text('round_id')
      .notNull()
      .references(() => practiceRounds.id, { onDelete: 'restrict' }),
    status: text('status').notNull(),
    offset: integer('offset').notNull().default(0),
    lastKey: text('last_key').notNull().default(''),
    pages: integer('pages').notNull().default(0),
    scanned: integer('scanned').notNull().default(0),
    accepted: integer('accepted').notNull().default(0),
    matched: integer('matched').notNull().default(0),
    unmatched: integer('unmatched').notNull().default(0),
    error: text('error'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('leetcode_sync_request').on(t.userId, t.idempotencyKey),
    index('leetcode_sync_user_time').on(t.userId, t.createdAt),
  ],
);

export const leetcodeAcceptedRecords = sqliteTable(
  'leetcode_accepted_records',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    region: text('region').notNull(),
    externalUsername: text('external_username').notNull(),
    externalSubmissionId: text('external_submission_id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    language: text('language').notNull(),
    submittedAt: integer('submitted_at').notNull(),
    sourceUrl: text('source_url').notNull(),
    importedAt: integer('imported_at').notNull(),
  },
  (t) => [
    uniqueIndex('leetcode_accepted_external').on(
      t.userId,
      t.region,
      t.externalUsername,
      t.externalSubmissionId,
    ),
    index('leetcode_accepted_user_slug').on(t.userId, t.slug),
    index('leetcode_accepted_user_time').on(t.userId, t.submittedAt),
  ],
);

export const leetcodeRoundRecords = sqliteTable(
  'leetcode_round_records',
  {
    userId: text('user_id').notNull(),
    roundId: text('round_id')
      .notNull()
      .references(() => practiceRounds.id, { onDelete: 'restrict' }),
    recordId: text('record_id')
      .notNull()
      .references(() => leetcodeAcceptedRecords.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('leetcode_round_record').on(t.userId, t.roundId, t.recordId),
  ],
);

// Detect repeated/overlapping pages instead of claiming a partial history is complete.
export const leetcodeSyncSeen = sqliteTable(
  'leetcode_sync_seen',
  {
    runId: text('run_id')
      .notNull()
      .references(() => leetcodeSyncRuns.id, { onDelete: 'cascade' }),
    externalSubmissionId: text('external_submission_id').notNull(),
  },
  (t) => [
    uniqueIndex('leetcode_sync_seen_record').on(
      t.runId,
      t.externalSubmissionId,
    ),
  ],
);
