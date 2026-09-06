import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';
export const practiceRounds = sqliteTable(
  'practice_rounds',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    number: integer('number').notNull(),
    createdAt: integer('created_at').notNull(),
    active: integer('active').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
  },
  (t) => [
    uniqueIndex('practice_round_user_number').on(t.userId, t.number),
    uniqueIndex('practice_round_request').on(t.userId, t.idempotencyKey),
    uniqueIndex('practice_round_active')
      .on(t.userId)
      .where(sql`${t.active}=1`),
    check('practice_round_positive', sql`${t.number}>0`),
    check('practice_round_boolean', sql`${t.active} IN (0,1)`),
  ],
);
