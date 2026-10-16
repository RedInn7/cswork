// The profile's practice charts (practiceCurves in lib/server/learner-cloud.ts) as plain SVG with
// no hooks, so the server page renders them. Styles: .rating-curve (contest.css) and u.css.
import { levelOf } from '@/lib/classic-lists';

const W = 640,
  H = 180,
  PAD = 24;
const DAY = 86400000;
const LEVELS = ['easy', 'medium', 'hard'] as const;
const utcDate = (time: number, zh: boolean) =>
  new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(time);

/** Distinct problems solved by the end of each week since the first AC, as one line. */
export function ClimbChart({ climb, zh }: { climb: { start: number; weeks: number[] }; zh: boolean }) {
  const { weeks } = climb;
  const total = weeks.at(-1) ?? 0;
  const x = (i: number) => (weeks.length === 1 ? W / 2 : PAD + (i / (weeks.length - 1)) * (W - 2 * PAD));
  const y = (n: number) => H - PAD - (n / Math.max(1, total)) * (H - 2 * PAD);
  const from = utcDate(climb.start, zh);
  return (
    <figure className="rating-curve practice-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={zh ? `${from} 起 ${weeks.length} 周，累计通过 ${total} 题` : `${total} solved over ${weeks.length} weeks since ${from}`}
      >
        <line className="practice-axis" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        <polyline className="rating-curve-line" points={weeks.map((n, i) => `${x(i)},${y(n)}`).join(' ')} />
        <circle className="rating-curve-dot" cx={x(weeks.length - 1)} cy={y(total)} r={4} />
      </svg>
      <figcaption>
        <span>
          {zh ? '起点' : 'Since'} <b>{from}</b>
        </span>
        <span>
          {zh ? '累计' : 'Solved'} <b>{total}</b>
        </span>
      </figcaption>
    </figure>
  );
}

/** First solves per day of the last 12 weeks, stacked easy, medium, hard from the bottom. */
export function EffortChart({ effort, zh }: { effort: { start: number; days: number[][] }; zh: boolean }) {
  const { days } = effort;
  const unit = (H - 2 * PAD) / Math.max(1, ...days.map((d) => d[0] + d[1] + d[2]));
  const slot = (W - 2 * PAD) / days.length;
  const names = LEVELS.map((key) => levelOf(key)![zh ? 1 : 2]);
  const sums = LEVELS.map((_, l) => days.reduce((sum, d) => sum + d[l], 0));
  const summary = names.map((name, l) => `${name} ${sums[l]}`).join(zh ? '，' : ', ');
  return (
    <figure className="rating-curve practice-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={zh ? `最近 12 周首次通过：${summary}` : `First solves in the last 12 weeks: ${summary}`}
      >
        <line className="practice-axis" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        {days.map((d, i) => {
          if (!(d[0] + d[1] + d[2])) return null;
          let base = H - PAD;
          return (
            <g key={i}>
              <title>{`${utcDate(effort.start + i * DAY, zh)}: ${names.map((name, l) => `${name} ${d[l]}`).join(', ')}`}</title>
              {LEVELS.map((key, l) => {
                const height = d[l] * unit;
                base -= height;
                return height ? <rect key={key} data-level={key} x={PAD + i * slot + 1} width={slot - 2} y={base} height={height} /> : null;
              })}
            </g>
          );
        })}
      </svg>
      <figcaption>
        {LEVELS.map((key, l) => (
          <span key={key}>
            <i className="practice-swatch" data-level={key} aria-hidden="true" />
            {names[l]} <b>{sums[l]}</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
