// Client-safe: the progress page, the notes tab and /api/oj/* share these.

/** UTF-8 bytes of one private note. */
export const NOTE_MAX_BYTES = 20 * 1024;

/** Longer than this, a solve timer was left running (closed tab, next day), not solving. */
export const MAX_SOLVE_SECONDS = 6 * 3600;
/**
 * Interview time budget in minutes per difficulty, keyed by the Chinese names problems carry
 * (lib/problems.ts difficulty, boot.problems): 简单 Easy, 中等 Medium, 困难 Hard.
 */
export const PRESETS: Record<string, number> = { 简单: 15, 中等: 25, 困难: 40 };

/** One problem's formal (judge) submissions by the signed-in learner. */
export type PracticeHistoryItem = {
  problemId: string;
  attempts: number;
  firstAt: number;
  lastAt: number;
  /** The first accepted submission, or null while unsolved. */
  firstAcAt: number | null;
  /** Failed verdicts before the first AC; every failure while unsolved. */
  failuresBeforeAc: number;
  lastStatus: string;
  languages: string[];
  /** Every accepted submission time; review levels count their distinct local days. */
  acAt: number[];
  /** Line 500 stop slug when the problem is on the line. */
  stop: string | null;
};
export type DueReview = {
  item: PracticeHistoryItem;
  /** Distinct local days with an AC, 1..REVIEW_LADDER.length. */
  level: number;
  /** Local midnight of the day the review falls due. */
  dueAt: number;
};

/** Days to wait after the n-th distinct AC day; past the last step a problem is mastered. */
export const REVIEW_LADDER = [3, 7, 21, 60];

const localDay = (time: number) => new Date(time).toDateString();

/**
 * Accepted problems due for review on `now`'s local day or earlier, most overdue first.
 * Several ACs on one day count once, so re-submitting today never skips a step.
 */
export function dueReviews(
  history: PracticeHistoryItem[],
  now: number,
): DueReview[] {
  const due: DueReview[] = [];
  for (const item of history) {
    if (!item.acAt.length) continue;
    const level = new Set(item.acAt.map(localDay)).size;
    if (level > REVIEW_LADDER.length) continue;
    const last = new Date(item.acAt.reduce((a, b) => Math.max(a, b)));
    // Day arithmetic on local dates keeps daylight-saving shifts out of the count.
    const dueAt = new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate() + REVIEW_LADDER[level - 1],
    ).getTime();
    if (dueAt <= now) due.push({ item, level, dueAt });
  }
  return due.sort((a, b) => a.dueAt - b.dueAt);
}

/** Unsolved problems, and solved ones that took two or more failures first. */
export const wrongBook = (history: PracticeHistoryItem[]) =>
  history.filter((item) => !item.firstAcAt || item.failuresBeforeAc >= 2);
