// Contest pieces shared by /contest, the leaderboard and /u/<handle>. No hooks: server pages
// render them as they are. Styles in app/contest/contest.css.
import { CONTEST_BANDS, contestBand } from '@/lib/contest';
import { formatClock } from '@/lib/mock-oa';

/** The rating with its band, on the problem-rating chip (app/lc-rating.css). */
export function BandChip({ rating, zh }: { rating: number; zh: boolean }) {
  const band = contestBand(rating);
  return (
    <span className="lc-rating contest-band" data-band={band.color} title={zh ? `${band.zh}段` : `${band.en} band`}>
      <b>{rating}</b>
      <span>{zh ? band.zh : band.en}</span>
    </span>
  );
}

/** A moment in Beijing time, for server HTML before the reader's own zone is known. */
export function beijingTime(at: number, zh: boolean) {
  return `${new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)}${zh ? '（北京时间）' : ' (Beijing)'}`;
}

/** "1:05:09", or "—" for nothing. */
export const penaltyText = (ms: number | null) => (ms === null ? '—' : formatClock(ms));

const W = 640,
  H = 200,
  PAD = 28;
/**
 * The rating after each rated weekly as an SVG polyline over the band stripes. Points carry a
 * native tooltip; the caption says it in words.
 */
export function RatingCurve({
  points,
  zh,
}: {
  points: readonly { week: number; after: number; rank: number; entrants: number }[];
  zh: boolean;
}) {
  if (!points.length) return null;
  const ratings = points.map((p) => p.after);
  const lo = Math.floor((Math.min(1400, ...ratings) - 60) / 50) * 50;
  const hi = Math.ceil((Math.max(1700, ...ratings) + 60) / 50) * 50;
  const y = (r: number) => PAD + ((hi - r) / (hi - lo)) * (H - 2 * PAD);
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - 2 * PAD));
  const current = ratings[ratings.length - 1];
  const peak = Math.max(...ratings);
  const label = zh
    ? `${points.length} 场周赛后 rating ${current}，最高 ${peak}`
    : `Rating ${current} after ${points.length} weekl${points.length === 1 ? 'y' : 'ies'}, peak ${peak}`;
  return (
    <figure className="rating-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
        {CONTEST_BANDS.map((band, i) => {
          const top = Math.min(hi, CONTEST_BANDS[i + 1]?.from ?? Infinity);
          const bottom = Math.max(lo, band.from);
          if (top <= bottom) return null;
          return (
            <rect key={band.key} className="rating-curve-band" data-band={band.color} x={0} width={W} y={y(top)} height={y(bottom) - y(top)} />
          );
        })}
        <polyline className="rating-curve-line" points={points.map((p, i) => `${x(i)},${y(p.after)}`).join(' ')} />
        {points.map((p, i) => (
          <circle key={p.week} className="rating-curve-dot" cx={x(i)} cy={y(p.after)} r={4}>
            <title>
              {zh
                ? `第 ${p.week} 期：${p.after}（第 ${p.rank} / ${p.entrants} 名）`
                : `Weekly #${p.week}: ${p.after} (rank ${p.rank} of ${p.entrants})`}
            </title>
          </circle>
        ))}
      </svg>
      <figcaption>
        <BandChip rating={current} zh={zh} />
        <span>
          {zh ? '最高' : 'Peak'} <b>{peak}</b>
        </span>
        <span>
          {zh ? '周赛' : 'Weeklies'} <b>{points.length}</b>
        </span>
      </figcaption>
    </figure>
  );
}
