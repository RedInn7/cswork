// Server-only: contest ratings from zerotrac/leetcode_problem_rating (MIT; the notice is kept in
// the JSON). scripts/import-lc-ratings.mjs refreshes the file; only numbers leave this module.
import file from '@/lib/content/lc-ratings.json';

export type LcRating = { rating: number; contest: string; q: number };
const ratings = file.ratings as Record<string, LcRating>;

export const lcRatingOf = (number: number): LcRating | null =>
  Object.hasOwn(ratings, number) ? ratings[number] : null;
/** The rating of a LeetCode problem id (lc-<number>), or null when its contest was not rated. */
export const lcRating = (problemId: string) => {
  const n = /^lc-(\d+)$/.exec(problemId)?.[1];
  return n ? (lcRatingOf(Number(n))?.rating ?? null) : null;
};
/** {number: rating} as a JSON parameter for SQL (json_each), built once. */
export const RATINGS_SQL_JSON = JSON.stringify(
  Object.fromEntries(Object.entries(ratings).map(([n, r]) => [n, r.rating])),
);
export const RATINGS_SOURCE = 'zerotrac/leetcode_problem_rating (MIT)';
