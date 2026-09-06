import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const enrollmentInvites = sqliteTable(
  'enrollment_invites',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    courseIds: text('course_ids').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    redeemedAt: integer('redeemed_at'),
    redeemedBy: text('redeemed_by'),
    revokedAt: integer('revoked_at'),
  },
  (t) => [
    index('invite_email').on(t.email),
    index('invite_created').on(t.createdAt),
  ],
);
