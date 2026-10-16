import { ratingBand } from '@/lib/lc-rating';

/**
 * A problem's contest rating (zerotrac's Elo-style rating of LeetCode contest problems),
 * coloured by band; `estimated` for an OA problem's prior by difficulty (lib/server/oa-rating.ts).
 * Renders nothing for unrated problems. No hooks: server pages use it too.
 * Styles in app/lc-rating.css, which the pages showing it import (plain node tests load no CSS).
 */
export function RatingBadge({
  rating,
  english,
  estimated,
}: {
  rating?: number | null;
  english: boolean;
  estimated?: boolean;
}) {
  if (!rating) return null;
  return (
    <span
      className="lc-rating"
      data-band={ratingBand(rating)}
      title={
        estimated
          ? english
            ? `Estimated rating ${rating}, from the problem's difficulty`
            : `估计难度分 ${rating}（按题目难度估算）`
          : english
            ? `Contest rating ${rating} (zerotrac)`
            : `周赛难度分 ${rating}（zerotrac 数据）`
      }
    >
      <span className="sr-only">{english ? 'Rating ' : '难度分 '}</span>
      {estimated ? (english ? `≈${rating} (est.)` : `≈${rating}（估计）`) : rating}
    </span>
  );
}
