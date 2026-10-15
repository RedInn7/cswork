import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

// Star ratings of a course (lib/server/course-ratings.ts): one per learner and course, stars only,
// no text. course_id is a course row's id or a self-paced course (sd:<slug>, lib/server/certificates.ts).
export const courseRatings = sqliteTable(
  'course_ratings',
  {
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    stars: integer('stars').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] }), index('course_ratings_course').on(t.courseId)],
);
