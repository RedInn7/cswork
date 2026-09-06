import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const commerceCheckoutLocks = sqliteTable(
  'commerce_checkout_locks',
  {
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    orderId: text('order_id').notNull().unique(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);
export const orderRefunds = sqliteTable(
  'order_refunds',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    stripeRefundId: text('stripe_refund_id').unique(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    amount: integer('amount').notNull(),
    status: text('status').notNull(),
    reason: text('reason').notNull(),
    requestedBy: text('requested_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastError: text('last_error'),
  },
  (t) => [index('order_refund_order').on(t.orderId, t.createdAt)],
);
