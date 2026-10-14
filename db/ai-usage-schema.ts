import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

/**
 * AI tutor calls per UTC day (YYYY-MM-DD), learner and kind (hint | review), from
 * lib/server/ai-tutor.ts. A row is the learner's daily quota; the day's SUM(count) is the
 * global budget. Counts and token totals only: prompts, code and replies are never stored.
 */
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    day: text('day').notNull(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    count: integer('count').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.userId, t.kind] })],
);
