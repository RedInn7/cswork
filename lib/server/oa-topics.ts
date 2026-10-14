import file from '@/lib/content/oa-topics.json';
import { SLOTS, topicDistribution, type Slot } from '@/lib/mock-oa';

/** LLM-estimated topics (most important first), difficulty and kind of one OA problem. */
export type OaTopic = {
  t: string[];
  d: Slot;
  k: 'coding' | 'sql' | 'mcq' | 'other';
};
const problems = file.problems as Record<string, OaTopic>;
export const oaTopic = (id: string): OaTopic | undefined =>
  Object.hasOwn(problems, id) ? problems[id] : undefined;

const ZH: Record<Slot, string> = { easy: '简单', medium: '中等', hard: '困难' };
/**
 * Difficulty to show for an OA problem. The OA source has none and judge packages
 * default to 中等, so only a package's explicit 简单/困难 stands; otherwise the
 * estimate is shown (and flagged), falling back to the package value.
 */
export function oaDifficulty(id: string, packaged?: string | null) {
  if (packaged === '简单' || packaged === '困难')
    return { difficulty: packaged, difficultyEstimated: false };
  const estimate = oaTopic(id)?.d;
  if (estimate) return { difficulty: ZH[estimate], difficultyEstimated: true };
  return packaged ? { difficulty: packaged, difficultyEstimated: false } : {};
}

const SLOT_OF: Record<string, Slot> = { 简单: 'easy', 中等: 'medium', 困难: 'hard' };
/** The level oaDifficulty shows, as a slot (the OA library's ?difficulty= filter). */
export const oaDifficultySlot = (id: string, packaged?: string | null): Slot | undefined => {
  const shown = oaDifficulty(id, packaged).difficulty;
  return shown && Object.hasOwn(SLOT_OF, shown) ? SLOT_OF[shown] : undefined;
};

/** What a company's OA problems cover: topic shares and the estimated difficulty mix. */
export function oaTopicProfile(aliases: readonly string[]) {
  const pattern = new RegExp(
    `^oa-(?:${aliases.map((a) => a.replace(/[^a-z0-9-]/g, '')).join('|')})-\\d+$`,
  );
  const found = Object.entries(problems).filter(([id]) => pattern.test(id));
  const difficulty = Object.fromEntries(SLOTS.map((s) => [s, 0])) as Record<Slot, number>;
  for (const [, p] of found) difficulty[p.d]++;
  return {
    count: found.length,
    topics: topicDistribution(found.map(([, p]) => p.t)),
    difficulty,
  };
}
