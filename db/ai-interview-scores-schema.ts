import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * One row per AI mock interview report (lib/server/ai-interviewer.ts): the rubric's 1–4 scores
 * and the verdict, never the transcript. kind is the template (phone, onsite, lld, custom, …),
 * level the role asked for ('' when none). Reports compare a score with others of the same kind.
 * self_json is the learner's own 1–4 (or null) per dimension before the report, NULL when skipped.
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
    selfJson: text('self_json'),
  },
  (t) => [index('ai_interview_scores_kind').on(t.kind, t.createdAt)],
);
