import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// When a learner got help on a problem (practice-assisted-solve): kind is hint, ai, editorial or
// time. hint, ai and editorial keep their first time only (INSERT OR IGNORE); time's value is the
// seconds of the first accepted solve. No foreign keys: release.sh only applies additive SQL.
export const practiceAids = sqliteTable(
  'practice_aids',
  {
    userId: text('user_id').notNull(),
    problemId: text('problem_id').notNull(),
    kind: text('kind').notNull(),
    /** Seconds for time; 0 otherwise. */
    value: integer('value').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.problemId, t.kind] })],
);
