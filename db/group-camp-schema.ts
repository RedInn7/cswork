import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * A study group's cohort plan (lib/server/group-camp.ts): from start_date (YYYY-MM-DD, day 1)
 * the group works through a classic list, per_day problems a day. Removed with its group.
 */
export const studyGroupCamps = sqliteTable('study_group_camps', {
  groupId: text('group_id').primaryKey(),
  plan: text('plan').notNull(),
  perDay: integer('per_day').notNull(),
  startDate: text('start_date').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
