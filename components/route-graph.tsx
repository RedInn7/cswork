// The 35 stops as a prerequisite graph (lib/route-stops.ts STOP_PREREQS), in columns by
// depth. No hooks, so /roadmap renders it on the server; styles in app/roadmap/roadmap.css.
import { routeLayers, ROUTE_SLUGS, STOP_NAMES, stopHref, stopPrereqs } from '@/lib/route-stops';

export type StopProgress = Record<string, { solved: number; total: number }>;
export type GraphState = 'done' | 'active' | 'ready' | 'later';

const LAYERS = routeLayers();
const ROWS = Math.max(...LAYERS.map((layer) => layer.length));
const COL = 128;
const ROW = 66;
const R = 15;
// Room for the centred labels of the first and last columns.
const PAD_X = 58;
const PAD_Y = 12;
const WIDTH = PAD_X * 2 + (LAYERS.length - 1) * COL;
const HEIGHT = PAD_Y * 2 + ROWS * ROW;
const AT = new Map(
  LAYERS.flatMap((layer, col) =>
    layer.map((slug, i) => [
      slug,
      {
        x: PAD_X + col * COL,
        // Each column is centred on the tallest one.
        y: PAD_Y + ((ROWS - layer.length) * ROW) / 2 + i * ROW + R + 4,
      },
    ] as const),
  ),
);

const share = (progress: StopProgress, slug: string) => {
  const stop = progress[slug];
  return stop?.total ? stop.solved / stop.total : 0;
};
/**
 * A visual hint, never a lock: done at 80%, in progress once started, ready when every
 * prerequisite is at 60%, otherwise its prerequisites come first.
 */
export function graphState(progress: StopProgress, slug: string): GraphState {
  const done = share(progress, slug);
  if (done >= 0.8) return 'done';
  if (progress[slug]?.solved) return 'active';
  return stopPrereqs(slug).every((p) => share(progress, p) >= 0.6) ? 'ready' : 'later';
}

export function RouteGraph({
  progress,
  member,
  english,
}: {
  progress: StopProgress;
  /** Guests have no progress: plain nodes, no states. */
  member: boolean;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const name = (slug: string) => STOP_NAMES[slug][english ? 1 : 0];
  const stateText = (slug: string, state: GraphState) =>
    state === 'done'
      ? t('已完成', 'done')
      : state === 'active'
        ? t('进行中', 'in progress')
        : state === 'ready'
          ? t('可以开始', 'ready to start')
          : t(
              `建议先学${stopPrereqs(slug).map(name).join('、')}`,
              `learn ${stopPrereqs(slug).map(name).join(' and ')} first`,
            );
  return (
    <div className="route-graph">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-label={t('知识点依赖图', 'Topic prerequisite graph')}
      >
        <g aria-hidden="true">
          {ROUTE_SLUGS.flatMap((slug) =>
            stopPrereqs(slug).map((p) => {
              const a = AT.get(p)!;
              const b = AT.get(slug)!;
              const bend = (b.x - a.x) / 2;
              return (
                <path
                  key={`${p}-${slug}`}
                  className="route-graph-edge"
                  data-met={(member && share(progress, p) >= 0.6) || undefined}
                  d={`M${a.x + R} ${a.y}C${a.x + bend} ${a.y} ${b.x - bend} ${b.y} ${b.x - R} ${b.y}`}
                />
              );
            }),
          )}
        </g>
        {ROUTE_SLUGS.map((slug, index) => {
          const { x, y } = AT.get(slug)!;
          const { solved, total } = progress[slug] ?? { solved: 0, total: 0 };
          const state = member ? graphState(progress, slug) : undefined;
          const code = String(index + 1).padStart(2, '0');
          const label =
            t(`第 ${code} 站：${name(slug)}`, `Stop ${code}: ${name(slug)}`) +
            (member
              ? t(`，已通过 ${solved}/${total}，`, `, ${solved} of ${total} solved, `) + stateText(slug, state!)
              : t(`，共 ${total} 题`, `, ${total} problems`));
          return (
            <a key={slug} href={stopHref(slug)!} className="route-graph-node" data-state={state} aria-label={label}>
              <title>{label}</title>
              <circle className="route-graph-track" cx={x} cy={y} r={R} />
              {member && solved > 0 && (
                <circle
                  className="route-graph-ring"
                  cx={x}
                  cy={y}
                  r={R}
                  pathLength={100}
                  strokeDasharray={`${Math.min(100, (100 * solved) / Math.max(1, total))} 100`}
                  transform={`rotate(-90 ${x} ${y})`}
                />
              )}
              <text className="route-graph-code" x={x} y={y + 4} textAnchor="middle">
                {code}
              </text>
              <text className="route-graph-name" x={x} y={y + R + 15} textAnchor="middle">
                {name(slug)}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
