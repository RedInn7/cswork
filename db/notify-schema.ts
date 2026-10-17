import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Learning reminders (lib/server/reminders.ts). Opt-in: a learner without a notify_prefs row gets
// none. Each day's digest and each contest reminder is a notification with a deterministic id,
// so nothing goes out twice and no send log is kept.

/**
 * What the daily digest covers, at which local hour; tz is Date#getTimezoneOffset minutes and
 * locale the language it is written in. email adds a mail to the verified account address;
 * token signs its one-click unsubscribe link.
 */
export const notifyPrefs = sqliteTable('notify_prefs', {
  userId: text('user_id').primaryKey(),
  review: integer('review').notNull().default(1),
  streak: integer('streak').notNull().default(1),
  daily: integer('daily').notNull().default(0),
  contest: integer('contest').notNull().default(1),
  applications: integer('applications').notNull().default(1),
  email: integer('email').notNull().default(0),
  hour: integer('hour').notNull().default(20),
  tz: integer('tz').notNull().default(0),
  locale: text('locale').notNull().default('en'),
  token: text('token').notNull().unique(),
  updatedAt: integer('updated_at').notNull(),
});

/** A browser's Web Push endpoint (an allowlisted push service), at most 10 per learner. */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull().unique(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('push_subscriptions_user').on(t.userId)],
);
