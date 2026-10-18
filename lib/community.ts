// Community posts beyond solutions (lib/server/solution-posts.ts). Client-safe.

/**
 * What a post hangs off: a judge problem (a solution), exp:<experience slug> (a comment on an
 * experience), q:<question slug> (an answer) or sd:<chapter slug> (a system design chapter's
 * discussion). Problem ids have no colon, so an unknown prefix (the removed board's discuss:<channel>
 * among them) is no target at all (null), never a problem.
 */
export type TargetKind = 'problem' | 'exp' | 'q' | 'sd';
const PREFIXED = ['exp', 'q', 'sd'] as const;
export function targetKind(target: string): TargetKind | null {
  if (!target.includes(':')) return 'problem';
  const prefix = target.slice(0, target.indexOf(':'));
  return PREFIXED.find((kind) => kind === prefix) ?? null;
}
/** Where a post is read in place: its library item, its chapter or its problem. */
export function postHref(target: string) {
  const kind = targetKind(target);
  const key = target.slice(target.indexOf(':') + 1);
  if (kind === 'q' || kind === 'exp')
    return `/?${new URLSearchParams({ view: 'content', type: kind === 'q' ? 'interview_question' : 'experience', slug: key })}`;
  if (kind === 'sd') return `/system-design/${encodeURIComponent(key)}`;
  return `/?view=problem&problem=${encodeURIComponent(target)}`;
}
/** Where a post may go up anonymously: answers and comments, never a judge problem's solution. */
export const anonymousAllowed = (target: string) => {
  const kind = targetKind(target);
  return !!kind && kind !== 'problem';
};
/** Readers' reports that take a post or comment down until a moderator acts (as experiences' FLAGS_HIDE). */
export const REPORTS_HIDE = 3;
/**
 * A moderator's hide, unhide or dismiss marks a target's reports with this reason instead of
 * deleting them: they stop counting, and as a report is one per learner and target, the same
 * readers cannot take the post down again. Only reports made after that decision count.
 */
export const REPORT_CLEARED = 'cleared';
/**
 * Days a study group chat message is kept. Study groups are gone, but rows already written keep
 * expiring (lib/server/http.ts) as the privacy page promised.
 */
export const CHAT_RETENTION_DAYS = 180;
/** Days a direct message is kept (the feature is removed; old rows still age out, lib/server/http.ts). */
export const DM_RETENTION_DAYS = 365;

/**
 * Posts that need no title of their own (answers, comments) take their first line; a body of
 * only emoji or punctuation is its own title, so a non-empty body always gives one.
 */
export function autoTitle(body: string) {
  const line = body.split('\n').find((l) => /[\p{L}\p{N}]/u.test(l)) ?? '';
  const plain =
    line
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~[\]|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || body.replace(/\s+/g, ' ').trim();
  const chars = Array.from(plain);
  return chars.length > 80 ? `${chars.slice(0, 79).join('')}…` : plain;
}
/**
 * A post as plain text (list teasers, a thread's meta description): code blocks, and so spoilers, and Markdown marks dropped.
 * Linear on a whole 20000-character body: a fence starts only at the head of a run, takes the whole run,
 * and an unclosed one (even on the last line) runs to the end, so no start is retried.
 */
export const plainExcerpt = (md: string) =>
  md
    .replace(/(?<![`~])(`{3,}(?!`)|~{3,}(?!~))[^\n]*(?:\n|$)[\s\S]*?(?:\1|$)/g, ' ')
    .replace(/[#>*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
