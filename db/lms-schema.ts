import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { lessons, reviews } from './schema';

export const lmsGrantRequests = sqliteTable(
  'lms_grant_requests',
  {
    actorId: text('actor_id').notNull(),
    key: text('key').notNull(),
    payloadJson: text('payload_json').notNull(),
    grantId: text('grant_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.key] })],
);

export const lmsLessonDrafts = sqliteTable(
  'lms_lesson_drafts',
  {
    lessonId: text('lesson_id')
      .primaryKey()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    payloadJson: text('payload_json').notNull(),
    revision: integer('revision').notNull(),
    baseRevision: integer('base_revision').notNull(),
    updatedBy: text('updated_by').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('lms_draft_revision', sql`${t.revision}>0`),
    check('lms_draft_json', sql`json_valid(${t.payloadJson})`),
  ],
);

export const lmsReviewEvents = sqliteTable(
  'lms_review_events',
  {
    id: text('id').primaryKey(),
    reviewId: text('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    note: text('note').notNull(),
    feedback: text('feedback'),
    status: text('status').notNull(),
    lessonVersion: text('lesson_version').notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('lms_review_revision').on(t.reviewId, t.revision),
    index('lms_review_event_time').on(t.reviewId, t.createdAt),
  ],
);
