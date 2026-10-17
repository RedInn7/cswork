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
  /** Self-grades of review ACs, [the graded AC's time, grade]; absent when there are none. */
  grades?: [number, ReviewGrade][];
};
/** A review AC's self-grade (components/review-grade.tsx): Again, Hard, Good, Easy. */
export type ReviewGrade = 1 | 2 | 3 | 4;
export type ReviewState = {
  /** 0 relearn (back the next day), else the step on the ladder; past steps, mastered. */
  level: number;
  /** Reviews on this problem's ladder: one more for a solve with help. */
  steps: number;
  /** Local midnight of the day the review falls due (Infinity once mastered). */
  dueAt: number;
  /** A leech: Again on two review days in a row, or on three in all. */
  leech: boolean;
  mastered: boolean;
};
export type DueReview = ReviewState & { item: PracticeHistoryItem };

/** Days to wait after the n-th distinct AC day; past the last step a problem is mastered. */
export const REVIEW_LADDER = [3, 7, 21, 60];

/** Solved, or tried, with a hint, the editorial or the AI. */
export const assisted = (item: Pick<PracticeHistoryItem, 'help'>) =>
  item.help === 'hint' || item.help === 'solution';
/** A solve with help comes back after a day first, so mastering it takes one review more. */
export const reviewLadder = (item: Pick<PracticeHistoryItem, 'help'>) =>
  assisted(item) ? [1, ...REVIEW_LADDER] : REVIEW_LADDER;

// Day arithmetic on local dates keeps daylight-saving shifts out of the count.
const midnight = (time: number) => new Date(time).setHours(0, 0, 0, 0);
const addDays = (time: number, days: number) => {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
};

/** Each distinct local AC day, oldest first, with that day's last self-grade (undefined: none). */
function acDays(item: PracticeHistoryItem) {
  const days = new Map<number, [number, ReviewGrade | undefined]>();
  for (const at of item.acAt) if (!days.has(midnight(at))) days.set(midnight(at), [-Infinity, undefined]);
  for (const [at, grade] of item.grades ?? []) {
    const day = days.get(midnight(at));
    if (day && at >= day[0]) days.set(midnight(at), [at, grade]);
  }
  return [...days].sort((a, b) => a[0] - b[0]).map(([day, [, grade]]) => [day, grade] as const);
}

/**
 * Replays a solved problem's AC days: the first puts it on step 1; each later day moves it by
 * that day's last grade (none counts as Good): Again back to 0, Hard stays, Good +1, Easy +2.
 * All Good, the level is the count of distinct AC days, as before grades.
 */
export function reviewState(item: PracticeHistoryItem): ReviewState {
  const ladder = reviewLadder(item);
  const days = acDays(item);
  let level = 0;
  let again = 0;
  let run = 0;
  let leech = false;
  for (const [i, [, grade = 3]] of days.entries()) {
    if (i === 0) {
      level = 1;
      continue;
    }
    run = grade === 1 ? run + 1 : 0;
    if (grade === 1) again++;
    if (run >= 2 || again >= 3) leech = true;
    level = grade === 1 ? 0 : level + grade - 2;
  }
  const mastered = level > ladder.length;
  const last = days.at(-1)?.[0];
  const dueAt = last === undefined || mastered ? Infinity : addDays(last, level ? ladder[level - 1] : 1);
  return { level, steps: ladder.length, dueAt, leech, mastered };
}

/**
 * Accepted problems due for review on `now`'s local day or earlier, most overdue first.
 * Several ACs on one day count once, so re-submitting today never skips a step.
 */
export function dueReviews(history: PracticeHistoryItem[], now: number): DueReview[] {
  return history
    .flatMap((item) => {
      if (!item.acAt.length) return [];
      const state = reviewState(item);
      return !state.mastered && state.dueAt <= now ? [{ item, ...state }] : [];
    })
    .sort((a, b) => a.dueAt - b.dueAt);
}

/**
 * The review load settings, the learner's note `pref:review` (components/review-forecast.tsx):
 * at most dailyCap reviews a day, and a break of pausedDays days from the local day pausedFrom.
 */
export type ReviewPrefs = { dailyCap?: number; pausedFrom?: string; pausedDays?: number };
const whole = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
/** YYYY-MM-DD moved by n days, in calendar days. */
const shiftDate = (date: string, n: number) =>
  new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10);
/**
 * The note's body (or parsed JSON) as ReviewPrefs: a field out of range is dropped, and a break
 * needs both a real day and its length. No zod, so the client uses it too.
 */
export function parseReviewPrefs(body: unknown): ReviewPrefs {
  let raw = body;
  if (typeof raw === 'string')
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  if (!raw || typeof raw !== 'object') return {};
  const { dailyCap, pausedFrom, pausedDays } = raw as Record<string, unknown>;
  const prefs: ReviewPrefs = {};
  if (whole(dailyCap, 200)) prefs.dailyCap = dailyCap;
  if (
    typeof pausedFrom === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(pausedFrom) &&
    shiftDate(pausedFrom, 0) === pausedFrom &&
    whole(pausedDays, 60)
  )
    Object.assign(prefs, { pausedFrom, pausedDays });
  return prefs;
}
/** The break's local days, first and last inclusive (YYYY-MM-DD), or null without one. */
export function reviewPause(prefs: ReviewPrefs) {
  const { pausedFrom: from, pausedDays: days } = prefs;
  return from && days ? { from, to: shiftDate(from, days - 1) } : null;
}

/**
 * Today's reviews under the learner's load settings, and the next 30 days. A break pushes back
 * every review falling due from its first day by its length, for problems last solved before it,
 * and shows nothing while it lasts. Past dailyCap, the most overdue go first and the rest wait
 * for the next day with room (deferred today). forecast[i] is day i's reviews (0 is today,
 * overdue included); retention, the review days of the last 30 with a grade, and those graded
 * Good or Easy.
 * ponytail: one break is kept; a new one replaces it, and the old one's push-back goes with it.
 */
export function scheduleReviews(history: PracticeHistoryItem[], now: number, prefs: ReviewPrefs = {}) {
  const today = midnight(now);
  const pause = reviewPause(prefs);
  const [y, m, d] = (pause?.from ?? '').split('-').map(Number);
  const from = pause ? new Date(y, m - 1, d).getTime() : Infinity;
  const until = pause ? addDays(from, prefs.pausedDays!) : Infinity;
  const since = addDays(today, -29);
  const retention = { passed: 0, total: 0 };
  const states: DueReview[] = [];
  for (const item of history) {
    if (!item.acAt.length) continue;
    for (const [day, grade] of acDays(item).slice(1))
      if (grade && day >= since) {
        retention.total++;
        retention.passed += +(grade >= 3);
      }
    const state = reviewState(item);
    if (state.mastered) continue;
    if (midnight(Math.max(...item.acAt)) < from && state.dueAt >= from)
      state.dueAt = addDays(state.dueAt, prefs.pausedDays!);
    states.push({ item, ...state });
  }
  states.sort((a, b) => a.dueAt - b.dueAt);
  const cap = prefs.dailyCap ?? Infinity;
  const room = (day: number) => (day >= from && day < until ? 0 : cap);
  const due = states.filter((s) => s.dueAt <= now);
  const shown = due.slice(0, room(today));
  const fresh = new Map<number, number>();
  for (const s of states) {
    const day = Math.max(s.dueAt, today);
    fresh.set(day, (fresh.get(day) ?? 0) + 1);
  }
  const forecast: number[] = [];
  let carry = 0;
  for (let i = 0; i < 30; i++) {
    const day = addDays(today, i);
    const waiting = carry + (fresh.get(day) ?? 0);
    forecast.push(Math.min(room(day), waiting));
    carry = waiting - forecast[i];
  }
  return { today: shown, deferred: due.length - shown.length, forecast, retention };
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
