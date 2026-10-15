import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Timed skill certification attempts (lib/server/skill-tests.ts). No foreign keys: release.sh only
// applies additive SQL. The server sets the window and draws the questions; finishing (or the
// deadline) scores the learner's submissions inside it. score/max/passed stay null until then.
export const skillAttempts = sqliteTable(
  'skill_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    test: text('test').notNull(),
    idsJson: text('ids_json').notNull(),
    /** Only submissions in this language count; null for any. */
    language: text('language'),
    startedAt: integer('started_at').notNull(),
    deadline: integer('deadline').notNull(),
    finishedAt: integer('finished_at'),
    score: integer('score'),
    max: integer('max'),
    passed: integer('passed'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('skill_attempts_user_test').on(t.userId, t.test)],
);
