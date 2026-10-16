import { oaDifficulty, oaTopic } from './oa-topics';

// ponytail: a prior per difficulty only. OA problems have too few attempts to fit a rating from
// attempters' levels (the plan's Elo fit); add it once problems reach ~10 attempters of known level.
const PRIOR: Record<string, number> = { 简单: 1400, 中等: 1750, 困难: 2150 };

/**
 * An OA coding problem's estimated contest rating: the prior of the difficulty it shows
 * (oaDifficulty). Null for other ids and for SQL, multiple-choice and other non-coding questions.
 */
export function oaRating(id: string, packaged?: string | null) {
  if (!id.startsWith('oa-')) return null;
  const kind = oaTopic(id)?.k;
  if (kind && kind !== 'coding') return null;
  const shown = oaDifficulty(id, packaged).difficulty;
  return shown && Object.hasOwn(PRIOR, shown) ? PRIOR[shown] : null;
}
