import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * A course bought as a gift (lib/server/course-gifts.ts): the row exists from checkout, so it
 * also marks the order as a gift; code is set once paid and replaced when the buyer reissues.
 * Redeeming grants the course to the redeemer (grant id gift:<order>); a full refund revokes both.
 */
export const courseGifts = sqliteTable(
  'course_gifts',
  {
    orderId: text('order_id').primaryKey(),
    buyerId: text('buyer_id').notNull(),
    courseId: text('course_id').notNull(),
    code: text('code').unique(),
    createdAt: integer('created_at').notNull(),
    issuedAt: integer('issued_at'),
    redeemedAt: integer('redeemed_at'),
    redeemedBy: text('redeemed_by'),
    revokedAt: integer('revoked_at'),
  },
  (t) => [index('course_gifts_buyer').on(t.buyerId, t.createdAt)],
);
