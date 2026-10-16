import editorialFile from '@/lib/content/ling-editorials.json';
import edgeFile from '@/lib/content/ling-edges.json';
import followUpFile from '@/lib/content/ling-followups.json';
import type { LingEdge, LingEditorial, LingFollowUps } from '@/lib/oj-client';

// Server-only like the hints: full solutions never enter a client bundle and reach a
// learner only inside their own problem payload.
const editorials = editorialFile as Record<string, LingEditorial>;
// Edge cases and interview follow-ups (scripts/line500-extras/verify.ts checks both).
const edges = edgeFile as Record<string, { edges: LingEdge[] }>;
const followUps = followUpFile as Record<string, LingFollowUps>;

/** The Line 500 editorial of a problem, null when none is written yet. */
export const lingEditorial = (problemId: string) =>
  Object.hasOwn(editorials, problemId) ? editorials[problemId] : null;

/** A problem's checked edge cases (LeetCode-mode stdin), null when none are written. */
export const lingEdges = (problemId: string) => (Object.hasOwn(edges, problemId) ? edges[problemId].edges : null);

/** The takeaway and follow-up questions served with the editorial, null when none are written. */
export const lingFollowUps = (problemId: string) =>
  Object.hasOwn(followUps, problemId) ? followUps[problemId] : null;
