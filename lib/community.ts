// Community posts beyond solutions (lib/server/solution-posts.ts). Client-safe.

/** Discussion channels, [zh, en, zh lead, en lead]. */
export const CHANNELS = {
  interview: ['面经讨论', 'Interviews', '聊面试流程、轮次和准备方法。', 'Interview processes, rounds and how to prepare.'],
  algo: ['算法', 'Algorithms', '题目思路、模板和复杂度。', 'Approaches, templates and complexity.'],
  career: ['求职', 'Careers', '投递、内推、简历和选 offer。', 'Applications, referrals, résumés and choosing offers.'],
  offer: ['上岸故事', 'Offers & timelines', '拿到 offer 的经历和时间线。', 'Offer stories and their timelines.'],
  site: ['站务', 'Site feedback', '建议、问题反馈和新功能。', 'Suggestions, bugs and new features.'],
} as const satisfies Record<string, readonly [string, string, string, string]>;
export type Channel = keyof typeof CHANNELS;
export const isChannel = (value: unknown): value is Channel =>
  typeof value === 'string' && Object.hasOwn(CHANNELS, value);

/**
 * What a post hangs off: a judge problem (a solution), discuss:<channel> (a thread),
 * exp:<experience slug> (a comment on an experience) or q:<question slug> (an answer).
 */
export type TargetKind = 'problem' | 'discuss' | 'exp' | 'q';
export function targetKind(target: string): TargetKind {
  const prefix = target.slice(0, target.indexOf(':'));
  return prefix === 'discuss' || prefix === 'exp' || prefix === 'q' ? prefix : 'problem';
}
export const discussTarget = (channel: Channel) => `discuss:${channel}`;
/** A thread's crawlable page. */
export const threadPath = (id: string) => `/discuss/${id}`;
/** Readers' reports that take a post or comment down until a moderator acts (as experiences' FLAGS_HIDE). */
export const REPORTS_HIDE = 3;
/**
 * A moderator's hide, unhide or dismiss marks a target's reports with this reason instead of
 * deleting them: they stop counting, and as a report is one per learner and target, the same
 * readers cannot take the post down again. Only reports made after that decision count.
 */
export const REPORT_CLEARED = 'cleared';
/** Up to this many votes a new thread stays out of search (spam rarely earns three). */
export const INDEX_VOTES = 3;

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
