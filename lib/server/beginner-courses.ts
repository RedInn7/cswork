import file from '@/lib/content/beginner-courses.json';
import type { SdQuestion } from './system-design-course';

export type BeginnerChapter = {
  slug: string;
  titleZh: string;
  titleEn: string;
  /** Markdown, rendered by app/library/markdown.tsx. */
  bodyZh: string;
  bodyEn: string;
  quiz: SdQuestion[];
  /** Line 500 practice after the chapter, easy ones. */
  homework: { id: string; zh: string; en: string }[];
};
export type BeginnerCourse = {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  chapters: BeginnerChapter[];
};

/**
 * The free beginner crash courses (lib/content/beginner-courses.json), public pages under /learn.
 * They reuse the system design course's reader: a chapter's quiz answers and read mark live under
 * sd:<course>/<chapter> (learnKey), and reading every chapter issues the sd:<course> certificate.
 */
export const beginnerCourses = (file as { courses: BeginnerCourse[] }).courses;
export const beginnerCourse = (slug: string) => beginnerCourses.find((c) => c.slug === slug);
export const learnKey = (course: string, chapter: string) => `${course}/${chapter}`;
export const learnPath = (course?: string, chapter?: string) =>
  ['/learn', course, chapter].filter(Boolean).join('/');
/** Sitemap entries: the index, each course and every chapter. */
export const learnPaths = () => [
  { path: learnPath() },
  ...beginnerCourses.flatMap((c) => [
    { path: learnPath(c.slug) },
    ...c.chapters.map((chapter) => ({ path: learnPath(c.slug, chapter.slug) })),
  ]),
];
