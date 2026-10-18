import { cellText, type AptCell, type AptFig, type AptShape } from '@/lib/aptitude';

/** Each shape in a 10×10 box, upright. flag, ell and eff have no symmetry at all. */
export const APT_POINTS: Record<AptShape, string> = {
  tri: '5,1.5 9,8.5 1,8.5',
  arrow: '5,1 9,5 6.5,5 6.5,9 3.5,9 3.5,5 1,5',
  flag: '2.5,1 8.5,3.2 3.5,5.4 3.5,9.5 2.5,9.5',
  ell: '3,1 5,1 5,7 7,7 7,9 3,9',
  eff: '4,2 8,2 8,4 6,4 6,8 4,8 4,6 2,6 2,4 4,4',
};

/** A cell's shapes inside the 30×30 box at (x, y): flipped left-right first, then turned. */
function Cell({ cell, x = 0, y = 0 }: { cell: AptCell; x?: number; y?: number }) {
  const size = [20, 13, 9][cell.n - 1] ?? 9;
  const width = cell.n * size + (cell.n - 1);
  const orient = `rotate(${cell.rot} 5 5)${cell.flip ? ' translate(10 0) scale(-1 1)' : ''}`;
  return (
    <>
      {Array.from({ length: cell.n }, (_, i) => (
        <g key={i} transform={`translate(${x + (30 - width) / 2 + i * (size + 1)} ${y + (30 - size) / 2}) scale(${size / 10})`}>
          <polygon points={APT_POINTS[cell.shape]} transform={orient} className={`apt-fill-${cell.fill}`} />
        </g>
      ))}
    </>
  );
}

/** A figure choice; its words are the choice text next to it (visually hidden). */
export function AptCellIcon({ cell }: { cell: AptCell }) {
  return (
    <svg className="apt-fig apt-fig-choice" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <Cell cell={cell} />
    </svg>
  );
}

/** The figure a question asks about: a 3×3 matrix, a shape to turn or mirror, or a bar chart. */
export function AptitudeFigure({ fig, zh }: { fig: AptFig; zh: boolean }) {
  const say = (cell: AptCell | null) => (cell ? cellText(cell)[zh ? 0 : 1] : zh ? '空格' : 'empty');
  if (fig.kind === 'matrix') {
    const label = [0, 1, 2]
      .map((row) => `${zh ? `第 ${row + 1} 行：` : `Row ${row + 1}: `}${fig.cells.slice(row * 3, row * 3 + 3).map(say).join(zh ? '；' : '; ')}`)
      .join(zh ? '。' : '. ');
    return (
      <svg className="apt-fig apt-fig-matrix" viewBox="0 0 98 98" role="img" aria-label={label}>
        {fig.cells.map((cell, i) => {
          const [x, y] = [2 + (i % 3) * 32, 2 + Math.floor(i / 3) * 32];
          return (
            <g key={i}>
              <rect x={x} y={y} width="30" height="30" rx="2" className={cell ? 'apt-box' : 'apt-box apt-box-empty'} />
              {cell ? <Cell cell={cell} x={x} y={y} /> : <text x={x + 15} y={y + 20} textAnchor="middle" className="apt-ask">?</text>}
            </g>
          );
        })}
      </svg>
    );
  }
  if (fig.kind === 'transform') {
    const label = `${zh ? '图形：' : 'Figure: '}${say(fig.from)}${fig.axis ? (zh ? '。虚线是镜子' : '. The dashed line is the mirror') : ''}`;
    return (
      <svg className="apt-fig apt-fig-transform" viewBox={fig.axis === 'v' ? '0 0 42 30' : fig.axis === 'h' ? '0 0 30 42' : '0 0 30 30'} role="img" aria-label={label}>
        <Cell cell={fig.from} />
        {fig.axis === 'v' && <line x1="37" y1="1" x2="37" y2="29" className="apt-mirror" />}
        {fig.axis === 'h' && <line x1="1" y1="37" x2="29" y2="37" className="apt-mirror" />}
      </svg>
    );
  }
  const top = Math.max(...fig.series) * 1.15;
  const slot = 280 / fig.labels.length;
  const label = `${zh ? `柱状图（单位：${fig.unit}）：` : `Bar chart (${fig.unit}): `}${fig.labels.map((l, i) => `${l}${zh ? ' 年 ' : ': '}${fig.series[i]}`).join(zh ? '；' : '; ')}`;
  return (
    <svg className="apt-fig apt-fig-bars" viewBox="0 0 320 190" role="img" aria-label={label}>
      <text x="4" y="12" className="apt-axis">{fig.unit}</text>
      <line x1="30" y1="160" x2="312" y2="160" className="apt-axis-line" />
      {fig.series.map((v, i) => {
        const h = (v / top) * 135;
        const x = 30 + i * slot + slot * 0.2;
        return (
          <g key={fig.labels[i]}>
            <rect x={x} y={160 - h} width={slot * 0.6} height={h} className="apt-bar" />
            <text x={x + slot * 0.3} y={155 - h} textAnchor="middle" className="apt-value">{v}</text>
            <text x={x + slot * 0.3} y="178" textAnchor="middle" className="apt-axis">{fig.labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
