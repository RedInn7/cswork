import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// Feature removed: study groups are gone from the product; these tables are unused and kept
// only so drizzle-kit does not generate DROP statements (production rows stay as they are).

/** goal_stop is a Line 500 stop slug or ''; goal_set_at is when the owner last set the goal. */
export const studyGroups = sqliteTable(
  'study_groups',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ownerId: text('owner_id').notNull(),
    inviteCode: text('invite_code').notNull().unique(),
    goalText: text('goal_text').notNull().default(''),
    goalStop: text('goal_stop').notNull().default(''),
    goalSetAt: integer('goal_set_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('study_groups_owner').on(t.ownerId)],
);

/** One row per member; role is owner or member. Other members only ever see display_name. */
export const studyGroupMembers = sqliteTable(
  'study_group_members',
  {
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull().default('member'),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('study_group_members_user').on(t.userId),
  ],
);
