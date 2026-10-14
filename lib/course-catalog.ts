// Course catalog filters (components/learning.tsx) and the values a teacher may pick
// (components/course-admin.tsx, lib/server/lms-courses.ts). Client-safe.

/** [value, zh, en]; '' means "not set" and is never a filter option. */
export const COURSE_CATEGORIES = [
  ['algorithms', '算法与数据结构', 'Algorithms'],
  ['system-design', '系统设计', 'System design'],
  ['backend', '后端工程', 'Backend engineering'],
  ['interview', '面试准备', 'Interview prep'],
  ['career', '求职与职业', 'Career'],
] as const;
export const COURSE_LEVELS = [
  ['beginner', '入门', 'Beginner'],
  ['intermediate', '进阶', 'Intermediate'],
  ['advanced', '高级', 'Advanced'],
] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number][0];
export type CourseLevel = (typeof COURSE_LEVELS)[number][0];
export const CATEGORY_VALUES = COURSE_CATEGORIES.map(([v]) => v) as [CourseCategory, ...CourseCategory[]];
export const LEVEL_VALUES = COURSE_LEVELS.map(([v]) => v) as [CourseLevel, ...CourseLevel[]];

/** A category or level in the locale; '' and unknown values give ''. */
export function catalogLabel(value: string | undefined, zh: boolean) {
  const row = [...COURSE_CATEGORIES, ...COURSE_LEVELS].find(([v]) => v === value);
  return row ? row[zh ? 1 : 2] : '';
}

/** Courses matching both filters; an empty filter matches everything. */
export function filterCourses<T extends { category?: string; level?: string }>(
  courses: T[],
  filter: { category?: string; level?: string },
) {
  return courses.filter(
    (c) => (!filter.category || c.category === filter.category) && (!filter.level || c.level === filter.level),
  );
}
