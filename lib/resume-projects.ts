/**
 * Resume projects (/projects, lib/content/resume-projects.json), shared by the pages, the progress
 * buttons and the notes API. Client-safe: no server imports, and not the manifest itself.
 */
export const PROJECT_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ProjectLevel = (typeof PROJECT_LEVELS)[number];
export const LEVEL_NAMES: Record<ProjectLevel, [string, string]> = {
  beginner: ['入门', 'Beginner'],
  intermediate: ['进阶', 'Intermediate'],
  advanced: ['挑战', 'Advanced'],
};
/** Start / done are the learner's user_marks 'doing' and 'done' on this target. */
export const projectTarget = (slug: string) => `content:project/${slug}`;
/** The private note holding the learner's repo link, as JSON { repo }. */
export const projectNote = (slug: string) => `project:${slug}`;
/** Repo links: https on github.com, gitlab.com or codeberg.org, nothing else. */
export const REPO_LINK = /^https:\/\/(?:github\.com|gitlab\.com|codeberg\.org)(?:\/[\w.~%+-]+){2,6}\/?$/;
export const REPO_MAX = 300;

/** The repo link in a project note, or null when the note is missing or malformed. */
export function parseProjectNote(body: string | null | undefined): string | null {
  try {
    const value: unknown = JSON.parse(body || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'repo') return null;
    const repo = (value as { repo: unknown }).repo;
    return typeof repo === 'string' && repo.length <= REPO_MAX && REPO_LINK.test(repo) ? repo : null;
  } catch {
    return null;
  }
}
