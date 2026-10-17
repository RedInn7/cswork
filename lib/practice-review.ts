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
  /**
   * Help used before the first AC (every help while unsolved), from lib/server/practice-aids.ts:
   * solution is the editorial tab opened or an AI tutor answer, hint is a hint past the first.
   */
  help: 'none' | 'hint' | 'solution';
  /** The problem timer's seconds at the first AC, when it ran. */
  solveSeconds: number | null;
  /** The first whiteboard-mode submission: 1 accepted, 0 failed, null never tried. */
  whiteboard: 0 | 1 | null;
  /** A stress test agreed with the reference before the first AC. */
  brute: boolean;
};
export type DueReview = {
  item: PracticeHistoryItem;
  /** Distinct local days with an AC, 1..steps. */
  level: number;
  /** Reviews on this problem's ladder: one more for a solve with help. */
  steps: number;
  /** Local midnight of the day the review falls due. */
  dueAt: number;
};

/** Days to wait after the n-th distinct AC day; past the last step a problem is mastered. */
export const REVIEW_LADDER = [3, 7, 21, 60];

/** Solved, or tried, with a hint, the editorial or the AI. */
export const assisted = (item: Pick<PracticeHistoryItem, 'help'>) =>
  item.help === 'hint' || item.help === 'solution';
/** A solve with help comes back after a day first, so mastering it takes one review more. */
export const reviewLadder = (item: Pick<PracticeHistoryItem, 'help'>) =>
  assisted(item) ? [1, ...REVIEW_LADDER] : REVIEW_LADDER;

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
    const ladder = reviewLadder(item);
    const level = new Set(item.acAt.map(localDay)).size;
    if (level > ladder.length) continue;
    const last = new Date(item.acAt.reduce((a, b) => Math.max(a, b)));
    // Day arithmetic on local dates keeps daylight-saving shifts out of the count.
    const dueAt = new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate() + ladder[level - 1],
    ).getTime();
    if (dueAt <= now) due.push({ item, level, steps: ladder.length, dueAt });
  }
  return due.sort((a, b) => a.dueAt - b.dueAt);
}

/** Unsolved problems, and solved ones that took two or more failures first. */
export const wrongBook = (history: PracticeHistoryItem[]) =>
  history.filter((item) => !item.firstAcAt || item.failuresBeforeAc >= 2);

/**
 * The progress page's solve quality: how many solves needed no help and no failed verdict, the
 * median timed first solve per difficulty against its interview budget (PRESETS), whiteboard
 * attempts and passes, and solves a stress test agreed on before the first AC.
 */
export function solveQuality(
  history: PracticeHistoryItem[],
  difficultyOf: (problemId: string) => string | undefined,
) {
  const solved = history.filter((item) => item.firstAcAt != null);
  const times = new Map<string, number[]>();
  for (const item of solved) {
    const difficulty = difficultyOf(item.problemId);
    if (item.solveSeconds != null && difficulty && difficulty in PRESETS)
      times.set(difficulty, [...(times.get(difficulty) ?? []), item.solveSeconds]);
  }
  return {
    solved: solved.length,
    independent: solved.filter((item) => !assisted(item)).length,
    firstTry: solved.filter((item) => !item.failuresBeforeAc).length,
    wbTried: history.filter((item) => item.whiteboard != null).length,
    wbPassed: history.filter((item) => item.whiteboard === 1).length,
    brute: solved.filter((item) => item.brute).length,
    medians: Object.keys(PRESETS).flatMap((difficulty) => {
      const s = times.get(difficulty)?.sort((a, b) => a - b);
      if (!s) return [];
      const mid = s.length >> 1;
      const seconds = s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
      return [{ difficulty, seconds, budget: PRESETS[difficulty] * 60, count: s.length }];
    }),
  };
}
