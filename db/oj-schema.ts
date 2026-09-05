import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const ojProblems = sqliteTable(
  'oj_problems',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    currentVersionId: text('current_version_id'),
    published: integer('published').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('oj_problem_course').on(t.courseId, t.published),
    check('oj_problem_published_boolean', sql`${t.published} IN (0,1)`),
    check(
      'oj_problem_published_version',
      sql`${t.published} = 0 OR ${t.currentVersionId} IS NOT NULL`,
    ),
  ],
);

export const ojProblemVersions = sqliteTable(
  'oj_problem_versions',
  {
    id: text('id').primaryKey(),
    problemId: text('problem_id')
      .notNull()
      .references(() => ojProblems.id, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    specJson: text('spec_json').notNull(),
    checksum: text('checksum').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('oj_version_revision').on(t.problemId, t.revision),
    check('oj_version_positive_revision', sql`${t.revision} > 0`),
    check('oj_version_valid_spec', sql`json_valid(${t.specJson})`),
  ],
);

export const ojTestCases = sqliteTable(
  'oj_test_cases',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => ojProblemVersions.id, { onDelete: 'restrict' }),
    ordinal: integer('ordinal').notNull(),
    input: text('input').notNull(),
    expectedOutput: text('expected_output').notNull(),
    hidden: integer('hidden').notNull(),
    name: text('name').notNull(),
    weight: integer('weight').notNull(),
  },
  (t) => [
    uniqueIndex('oj_case_ordinal').on(t.versionId, t.ordinal),
    check('oj_case_ordinal_nonnegative', sql`${t.ordinal} >= 0`),
    check('oj_case_hidden_boolean', sql`${t.hidden} IN (0,1)`),
    check('oj_case_weight_valid', sql`${t.weight} BETWEEN 1 AND 100`),
  ],
);

export const ojProblemDrafts = sqliteTable(
  'oj_problem_drafts',
  {
    problemId: text('problem_id')
      .primaryKey()
      .references(() => ojProblems.id, { onDelete: 'cascade' }),
    payloadJson: text('payload_json').notNull(),
    revision: integer('revision').notNull(),
    updatedBy: text('updated_by').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    check('oj_draft_positive_revision', sql`${t.revision} > 0`),
    check('oj_draft_valid_payload', sql`json_valid(${t.payloadJson})`),
  ],
);
