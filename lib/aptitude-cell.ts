/**
 * The figure types of aptitude questions and their words, kept apart from the generators in
 * lib/aptitude.ts so that drawing or exporting a figure (components/oa-mcq.tsx, the review
 * export) does not load the whole question bank.
 */

export type AptShape = 'tri' | 'arrow' | 'flag' | 'ell' | 'eff';
/** n copies of a shape; fill 0 outlined, 1 grey, 2 solid; rot clockwise degrees, after a left-right flip. */
export type AptCell = { shape: AptShape; n: number; fill: number; rot: number; flip?: boolean };
export type AptFig =
  | { kind: 'matrix'; cells: (AptCell | null)[]; choices: AptCell[] }
  | { kind: 'transform'; from: AptCell; axis?: 'v' | 'h'; choices: AptCell[] }
  | { kind: 'bars'; labels: string[]; series: number[]; unit: string };
type Tx = [zh: string, en: string];

export const SHAPE_NAMES: Record<AptShape, Tx> = {
  tri: ['三角形', 'triangle'],
  arrow: ['箭头', 'arrow'],
  flag: ['旗子', 'flag'],
  ell: ['L 形', 'L-shape'],
  eff: ['F 形', 'F-shape'],
};
// Hollow and solid rather than white and black: they stay true in the dark theme too.
export const FILL_NAMES: Tx[] = [['空心', 'outlined'], ['灰色', 'grey'], ['实心', 'solid']];

/** A cell in words, for screen readers and the choice text: "2 grey flags, turned 90° clockwise". */
export function cellText(cell: AptCell): Tx {
  const [zhShape, enShape] = SHAPE_NAMES[cell.shape];
  const [zhFill, enFill] = FILL_NAMES[cell.fill];
  const zhTail = `${cell.flip ? '，左右翻转' : ''}${cell.rot ? `，${cell.flip ? '再' : ''}顺时针转 ${cell.rot}°` : ''}`;
  const enTail = `${cell.flip ? ', mirrored' : ''}${cell.rot ? `,${cell.flip ? ' then' : ''} turned ${cell.rot}° clockwise` : ''}`;
  return [`${cell.n} 个${zhFill}${zhShape}${zhTail}`, `${cell.n} ${enFill} ${enShape}${cell.n > 1 ? 's' : ''}${enTail}`];
}

/** A question's figure in words: the drawing's aria-label, and the card text when exported. */
export function figText(fig: AptFig, zh: boolean) {
  const say = (cell: AptCell | null) => (cell ? cellText(cell)[zh ? 0 : 1] : zh ? '空格' : 'empty');
  if (fig.kind === 'matrix')
    return [0, 1, 2]
      .map((row) => `${zh ? `第 ${row + 1} 行：` : `Row ${row + 1}: `}${fig.cells.slice(row * 3, row * 3 + 3).map(say).join(zh ? '；' : '; ')}`)
      .join(zh ? '。' : '. ');
  if (fig.kind === 'transform') return `${zh ? '图形：' : 'Figure: '}${say(fig.from)}${fig.axis ? (zh ? '。虚线是镜子' : '. The dashed line is the mirror') : ''}`;
  return `${zh ? `柱状图（单位：${fig.unit}）：` : `Bar chart (${fig.unit}): `}${fig.labels.map((l, i) => `${l}${zh ? ' 年 ' : ': '}${fig.series[i]}`).join(zh ? '；' : '; ')}`;
}
