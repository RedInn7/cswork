import editorialFile from '@/lib/content/ling-editorials.json';
import edgeFile from '@/lib/content/ling-edges.json';
import followUpFile from '@/lib/content/ling-followups.json';
import editorialFileJa from '@/lib/content/ling-editorials.ja.json';
import editorialFileKo from '@/lib/content/ling-editorials.ko.json';
import editorialFileVi from '@/lib/content/ling-editorials.vi.json';
import type { ContentLanguage } from '@/lib/language';
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

// Each approach's name and idea in ja/ko/vi, in the editorial's own order; code is not translated.
const local: Record<ContentLanguage, Record<string, { name: string; idea: string }[]>> = {
  ja: editorialFileJa,
  ko: editorialFileKo,
  vi: editorialFileVi,
};
/** The Line 500 editorial's text in `language`; null unless every approach is translated. */
export function lingEditorialLocal(problemId: string, language: ContentLanguage) {
  const approaches = Object.hasOwn(local[language], problemId) ? local[language][problemId] : null;
  return approaches && approaches.length === lingEditorial(problemId)?.approaches.length ? { language, approaches } : null;
}

/** A problem's checked edge cases (LeetCode-mode stdin), null when none are written. */
export const lingEdges = (problemId: string) => (Object.hasOwn(edges, problemId) ? edges[problemId].edges : null);

/** The takeaway and follow-up questions served with the editorial, null when none are written. */
export const lingFollowUps = (problemId: string) =>
  Object.hasOwn(followUps, problemId) ? followUps[problemId] : null;
