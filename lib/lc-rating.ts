// Contest difficulty ratings (zerotrac's Elo-style ratings, MIT; the data stays server-side in
// lib/server/lc-ratings.ts). These helpers are client-safe: bands, chances and contest names.

export type RatingBand = 'grey' | 'green' | 'cyan' | 'blue' | 'purple' | 'orange' | 'red';
/** <1200 grey, 1200 green, 1400 cyan, 1600 blue, 1900 purple, 2100 orange, ≥2400 red. */
export function ratingBand(rating: number): RatingBand {
  return rating >= 2400
    ? 'red'
    : rating >= 2100
      ? 'orange'
      : rating >= 1900
        ? 'purple'
        : rating >= 1600
          ? 'blue'
          : rating >= 1400
            ? 'cyan'
            : rating >= 1200
              ? 'green'
              : 'grey';
}

/** The Elo expectation that a learner at `level` solves a problem rated `rating`. */
export const solveChance = (rating: number, level: number) => 1 / (1 + 10 ** ((rating - level) / 400));

/** w475 → 第 475 场周赛 / Weekly 475; b12 → 第 12 场双周赛 / Biweekly 12. */
export function contestName(code: string, zh: boolean) {
  const weekly = code.startsWith('w');
  const n = code.slice(1);
  return zh ? `第 ${n} 场${weekly ? '' : '双'}周赛` : `${weekly ? 'Weekly' : 'Biweekly'} ${n}`;
}

export function median(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

/** Learners with no rated AC yet start here. */
export const START_LEVEL = 1300;
export type LevelTier = 'easy' | 'moderate' | 'hard';
/** Ratings relative to the level: [from, to) for each tier. */
export const LEVEL_TIERS: readonly [LevelTier, number, number][] = [
  ['easy', -200, 0],
  ['moderate', 0, 150],
  ['hard', 150, 350],
];

/**
 * Up to `per` candidates in each tier around `level`: the ones nearest the tier's middle,
 * shown easiest first. A problem lands in one tier only.
 */
export function pickAtLevel<T extends { rating: number }>(candidates: readonly T[], level: number, per = 3) {
  return LEVEL_TIERS.map(([tier, from, to]) => {
    const mid = level + (from + to) / 2;
    const items = candidates
      .filter((c) => c.rating >= level + from && (c.rating < level + to || (tier === 'hard' && c.rating <= level + to)))
      .sort((a, b) => Math.abs(a.rating - mid) - Math.abs(b.rating - mid))
      .slice(0, per)
      .sort((a, b) => a.rating - b.rating);
    return { tier, from: level + from, to: level + to, items };
  });
}
