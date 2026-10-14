import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// The weekly newsletter (lib/server/newsletter.ts, scripts/newsletter.ts).

/**
 * One row per signed-in subscriber. confirmed_at is the double opt-in, by a link mailed once
 * mail is configured; only confirmed rows get issues. token signs the confirm and unsubscribe links.
 */
export const newsletterSubs = sqliteTable('newsletter_subs', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  locale: text('locale').notNull().default('en'),
  token: text('token').notNull().unique(),
  subscribedAt: integer('subscribed_at').notNull(),
  confirmedAt: integer('confirmed_at'),
  confirmSentAt: integer('confirm_sent_at'),
  unsubscribedAt: integer('unsubscribed_at'),
  lastIssue: text('last_issue'),
});

/** A composed issue, id the ISO week (2026-W42); the public archive reads these. */
export const newsletterIssues = sqliteTable('newsletter_issues', {
  id: text('id').primaryKey(),
  startsAt: integer('starts_at').notNull(),
  dataJson: text('data_json').notNull(),
  composedAt: integer('composed_at').notNull(),
  sentAt: integer('sent_at'),
});
