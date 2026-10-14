import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Course completion certificates (lib/server/certificates.ts): issued once per learner and
 * course when every published lesson is completed. The id is the random verification code
 * printed on /certificate/<id>; nothing else about the learner is stored here. on_profile is
 * the learner's opt-in to list it on their public profile (the page shows the account name).
 */
export const certificates = sqliteTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    issuedAt: integer('issued_at').notNull(),
    onProfile: integer('on_profile').notNull().default(0),
  },
  (t) => [uniqueIndex('certificates_user_course').on(t.userId, t.courseId)],
);
