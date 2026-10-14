import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// Private per-learner annotations. No foreign keys: release.sh only applies
// additive SQL, and an empty note or a cleared mark is a runtime DELETE.
// target: problem:lc-1 or content:interview_question/<slug>.
export const userNotes = sqliteTable(
  'user_notes',
  {
    userId: text('user_id').notNull(),
    target: text('target').notNull(),
    body: text('body').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.target] })],
);
// mark: star, redo, or a problem vote (up/down, one of the two); read and asked later,
// so no CHECK constraint. Target list:<id> with star is a saved public list. The target index
// counts a problem's votes (problem-stats) and a list's stars.
export const userMarks = sqliteTable(
  'user_marks',
  {
    userId: text('user_id').notNull(),
    target: text('target').notNull(),
    mark: text('mark').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.target, t.mark] }),
    index('user_marks_target_mark').on(t.target, t.mark),
  ],
);
