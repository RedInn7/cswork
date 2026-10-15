import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Study group chat, work email badges and direct messages (lib/server/study-groups.ts,
// work-verify.ts, direct-messages.ts). No foreign keys: release.sh only applies additive SQL;
// retention (lib/server/http.ts), unblocking and removing a badge are runtime DELETEs.

/** hidden: 0 shown, 1 removed by its author, 2 hidden by a moderator. Reports: post_reports 'gmsg:<id>'. */
export const studyGroupMessages = sqliteTable(
  'study_group_messages',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id').notNull(),
    userId: text('user_id').notNull(),
    body: text('body').notNull(),
    hidden: integer('hidden').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('study_group_messages_group').on(t.groupId, t.createdAt),
    index('study_group_messages_time').on(t.createdAt),
  ],
);

/**
 * One row per learner: the work address as an HMAC with a server key (never the address), its
 * company and, while a code is out, the code's HMAC. A verified address belongs to one account.
 * Each show_* is where the badge appears; all off until the learner turns them on.
 */
export const workVerifications = sqliteTable(
  'work_verifications',
  {
    userId: text('user_id').primaryKey(),
    companySlug: text('company_slug').notNull(),
    domain: text('domain').notNull(),
    emailHash: text('email_hash').notNull(),
    codeHash: text('code_hash'),
    codeExpiresAt: integer('code_expires_at'),
    attempts: integer('attempts').notNull().default(0),
    verifiedAt: integer('verified_at'),
    showProfile: integer('show_profile').notNull().default(0),
    showPosts: integer('show_posts').notNull().default(0),
    showReferrals: integer('show_referrals').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('work_verifications_email').on(t.emailHash).where(sql`${t.verifiedAt} IS NOT NULL`)],
);

/**
 * thread: the two account ids, sorted, joined with "|". post_id is set only on a thread's first
 * message: the referral post it was opened from, or '' between mutual follows.
 * hidden: 0 shown, 2 hidden by a moderator. Reports: post_reports 'dm:<id>'.
 */
export const directMessages = sqliteTable(
  'direct_messages',
  {
    id: text('id').primaryKey(),
    thread: text('thread').notNull(),
    fromUser: text('from_user').notNull(),
    toUser: text('to_user').notNull(),
    body: text('body').notNull(),
    postId: text('post_id'),
    hidden: integer('hidden').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    readAt: integer('read_at'),
  },
  (t) => [
    index('direct_messages_thread').on(t.thread, t.createdAt),
    index('direct_messages_to').on(t.toUser, t.readAt),
    index('direct_messages_from').on(t.fromUser, t.createdAt),
    index('direct_messages_time').on(t.createdAt),
  ],
);

/** user_id no longer hears from blocked_id (either way: neither can write to the other). */
export const dmBlocks = sqliteTable(
  'dm_blocks',
  {
    userId: text('user_id').notNull(),
    blockedId: text('blocked_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockedId] })],
);

/** Who may start a conversation: all (mutual follows and referral requests), follows, none. */
export const dmSettings = sqliteTable('dm_settings', {
  userId: text('user_id').primaryKey(),
  open: text('open').notNull().default('all'),
  updatedAt: integer('updated_at').notNull(),
});
