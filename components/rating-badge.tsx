import { ratingBand } from '@/lib/lc-rating';

/**
 * A problem's contest rating (zerotrac's Elo-style rating of LeetCode contest problems),
 * coloured by band. Renders nothing for unrated problems. No hooks: server pages use it too.
 * Styles in app/lc-rating.css, which the pages showing it import (plain node tests load no CSS).
 */
export function RatingBadge({ rating, english }: { rating?: number | null; english: boolean }) {
  if (!rating) return null;
  return (
    <span
      className="lc-rating"
      data-band={ratingBand(rating)}
      title={english ? `Contest rating ${rating} (zerotrac)` : `周赛难度分 ${rating}（zerotrac 数据）`}
    >
      <span className="sr-only">{english ? 'Rating ' : '难度分 '}</span>
      {rating}
    </span>
  );
}
