import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Source material and candidate test cases are private; public APIs select fields explicitly.
export const studyLibrary = sqliteTable(
  'study_library',
  {
    id: text('id').primaryKey(),
    number: integer('number').notNull(),
    slug: text('slug').notNull().unique(),
    titleZh: text('title_zh').notNull(),
    titleEn: text('title_en').notNull(),
    difficulty: text('difficulty').notNull(),
    topicsJson: text('topics_json').notNull(),
    payloadJson: text('payload_json').notNull(),
    contentHash: text('content_hash').notNull(),
    caseCount: integer('case_count').notNull(),
    expectedCount: integer('expected_count').notNull(),
    judgeProblemId: text('judge_problem_id'),
    verifiedHash: text('verified_hash'),
    importedAt: integer('imported_at').notNull(),
  },
  (t) => [index('study_library_number').on(t.number)],
);
