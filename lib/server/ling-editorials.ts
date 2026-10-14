import editorialFile from '@/lib/content/ling-editorials.json';
import type { LingEditorial } from '@/lib/oj-client';

// Server-only like the hints: full solutions never enter a client bundle and reach a
// learner only inside their own problem payload.
const editorials = editorialFile as Record<string, LingEditorial>;

/** The Line 500 editorial of a problem, null when none is written yet. */
export const lingEditorial = (problemId: string) =>
  Object.hasOwn(editorials, problemId) ? editorials[problemId] : null;
