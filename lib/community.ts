// Community posts beyond solutions (lib/server/solution-posts.ts). Client-safe.

/** Discussion channels, [zh, en, zh lead, en lead]. */
export const CHANNELS = {
  interview: ['面经讨论', 'Interviews', '聊面试流程、轮次和准备方法。', 'Interview processes, rounds and how to prepare.'],
  algo: ['算法', 'Algorithms', '题目思路、模板和复杂度。', 'Approaches, templates and complexity.'],
  career: ['求职', 'Careers', '投递、内推、简历和选 offer。', 'Applications, referrals, résumés and choosing offers.'],
  referral: ['内推', 'Referrals', '已验证的员工提供内推，按公司找。', 'Verified employees offering referrals, by company.'],
  offer: ['上岸故事', 'Offers & timelines', '拿到 offer 的经历和时间线。', 'Offer stories and their timelines.'],
  site: ['站务', 'Site feedback', '建议、问题反馈和新功能。', 'Suggestions, bugs and new features.'],
} as const satisfies Record<string, readonly [string, string, string, string]>;
export type Channel = keyof typeof CHANNELS;
export const isChannel = (value: unknown): value is Channel =>
  typeof value === 'string' && Object.hasOwn(CHANNELS, value);

/**
 * What a post hangs off: a judge problem (a solution), discuss:<channel> (a thread),
 * exp:<experience slug> (a comment on an experience), q:<question slug> (an answer) or
 * sd:<chapter slug> (a system design chapter's discussion). Problem ids have no colon, so an
 * unknown prefix is no target at all (null), never a problem.
 */
export type TargetKind = 'problem' | 'discuss' | 'exp' | 'q' | 'sd';
const PREFIXED = ['discuss', 'exp', 'q', 'sd'] as const;
export function targetKind(target: string): TargetKind | null {
  if (!target.includes(':')) return 'problem';
  const prefix = target.slice(0, target.indexOf(':'));
  return PREFIXED.find((kind) => kind === prefix) ?? null;
}
export const discussTarget = (channel: Channel) => `discuss:${channel}`;
/** A thread's crawlable page. */
export const threadPath = (id: string) => `/discuss/${id}`;
/** Where a post is read in place: its thread in the app, its library item, its chapter or its problem. */
export function postHref(target: string, postId: string) {
  const kind = targetKind(target);
  const key = target.slice(target.indexOf(':') + 1);
  if (kind === 'discuss') return `/?view=discuss&channel=${encodeURIComponent(key)}&post=${encodeURIComponent(postId)}`;
  if (kind === 'q' || kind === 'exp')
    return `/?${new URLSearchParams({ view: 'content', type: kind === 'q' ? 'interview_question' : 'experience', slug: key })}`;
  if (kind === 'sd') return `/system-design/${encodeURIComponent(key)}`;
  return `/?view=problem&problem=${encodeURIComponent(target)}`;
}
/** Channels where the verified employee badge may show on posts (lib/server/work-verify.ts). */
export const BADGE_CHANNELS: ReadonlySet<string> = new Set(['discuss:algo', 'discuss:referral', 'discuss:site']);
/**
 * Where a post may go up anonymously: discussion that carries no employee badge (so no referral
 * thread, which opens a direct message to its author) and never a judge problem's solution.
 */
export const anonymousAllowed = (target: string) => {
  const kind = targetKind(target);
  return !!kind && kind !== 'problem' && !BADGE_CHANNELS.has(target);
};
/** Readers' reports that take a post or comment down until a moderator acts (as experiences' FLAGS_HIDE). */
export const REPORTS_HIDE = 3;
/**
 * A moderator's hide, unhide or dismiss marks a target's reports with this reason instead of
 * deleting them: they stop counting, and as a report is one per learner and target, the same
 * readers cannot take the post down again. Only reports made after that decision count.
 */
export const REPORT_CLEARED = 'cleared';
/** Days a study group chat message (lib/server/study-groups.ts) is kept; the privacy page says so. */
export const CHAT_RETENTION_DAYS = 180;
/** Days a direct message (lib/server/direct-messages.ts) is kept; the privacy page says so. */
export const DM_RETENTION_DAYS = 365;
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
