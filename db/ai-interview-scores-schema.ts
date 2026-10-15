import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * One row per AI mock interview report (lib/server/ai-interviewer.ts): the rubric's 1–4 scores
 * and the verdict, never the transcript. kind is the template (phone, onsite, lld, custom, …),
 * level the role asked for ('' when none). Reports compare a score with others of the same kind.
 */
export const aiInterviewScores = sqliteTable(
  'ai_interview_scores',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    level: text('level').notNull().default(''),
    scoresJson: text('scores_json').notNull(),
    verdict: text('verdict'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('ai_interview_scores_kind').on(t.kind, t.createdAt)],
);
