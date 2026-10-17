import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// Each learner's first answer to a concept-drill MCQ (mcq-v2), for site-wide answer stats: only
// the first attempt is kept (INSERT OR IGNORE). picks is a JSON array of choice indexes; correct is
// 1 when the server graded it right. The primary key also serves lookups by question.
export const mcqAnswers = sqliteTable(
  'mcq_answers',
  {
    questionId: text('question_id').notNull(),
    userId: text('user_id').notNull(),
    picks: text('picks').notNull(),
    correct: integer('correct').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.userId] })],
);
