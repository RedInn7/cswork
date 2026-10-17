import file from '@/lib/content/resume-projects.json';
import type { ProjectLevel } from '@/lib/resume-projects';

/** One resume project as scripts/projects/build.mjs writes it (content/projects/<slug>/). */
export type ResumeProject = {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  level: ProjectLevel;
  roles: string[];
  hours: number;
  /** How accept_test.py reaches the learner's code: BASE_URL http://, BASE_URL tcp://, or CMD. */
  run: 'http' | 'tcp' | 'cmd';
  milestones: { zh: string; en: string }[];
  bulletZh: string;
  bulletEn: string;
  deepDive: { zh: string; en: string }[];
  /** Markdown without its title line. */
  briefZh: string;
  briefEn: string;
  /** accept_test.py, served by /projects/<slug>/accept. */
  accept: string;
};

/** The projects in the manifest's order: level, then hours. */
export const resumeProjects = file.projects as ResumeProject[];
export const resumeProject = (slug: string) => resumeProjects.find((p) => p.slug === slug);
/** Sitemap entries: the index and every project page. */
export const projectPaths = () => [{ path: '/projects' }, ...resumeProjects.map((p) => ({ path: `/projects/${p.slug}` }))];
