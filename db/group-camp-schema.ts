import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Feature removed: a study group's cohort plan (from start_date the group worked through a classic
 * list). Unused, kept only so drizzle-kit does not generate a DROP statement.
 */
export const studyGroupCamps = sqliteTable('study_group_camps', {
  groupId: text('group_id').primaryKey(),
  plan: text('plan').notNull(),
  perDay: integer('per_day').notNull(),
  startDate: text('start_date').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
