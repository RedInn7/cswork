// Placement quiz (/placement): the speedrun's "which stop?" question, asked as a ladder in each
// group of ROUTE_SECTIONS. Pure and client-safe; lib/server/placement.ts keeps the answers.
import { ROUTE_SECTIONS, ROUTE_SLUGS } from './route-stops';
import { distractors, groupIndex, shuffle, type SpeedrunPoolItem } from './speedrun';

export const PER_GROUP = 3;
export const LADDER_START = 1500;
export const LADDER_STEP = 200;
export const RETAKE_DAYS = 30;
// Most of Line 500 has no contest rating; its difficulty stands in.
const PROXY: Record<string, number> = { easy: 1200, medium: 1600, hard: 2000, 简单: 1200, 中等: 1600, 困难: 2000 };

/** A problem's ladder score: its contest rating, else a stand-in by difficulty. */
export function placementScore(rating: number | null | undefined, difficulty?: string | null) {
  const key = difficulty?.toLowerCase() ?? '';
  return rating || (Object.hasOwn(PROXY, key) ? PROXY[key] : PROXY.medium);
}

export type PlacementItem = SpeedrunPoolItem & { score: number; rated: boolean };
/** One question as asked: the ladder's target, the answer and four choices; pick once answered. */
export type PlacementStep = Omit<PlacementItem, 'section'> & {
  group: number;
  target: number;
  answer: string;
  choices: string[];
  pick?: string;
};
export type PlacementPick = Pick<PlacementItem, 'id' | 'number' | 'titleZh' | 'titleEn' | 'score' | 'rated'>;
export type PlacementGroup = {
  group: number;
  right: number;
  total: number;
  /** Highest score answered right, null when none was. */
  level: number | null;
  skip: boolean;
  /** Weak groups only: two problems near the level, to check it by solving them. */
  picks: PlacementPick[];
};
export type PlacementResult = { at: number; groups: PlacementGroup[] };

const groupOf = (pool: readonly PlacementItem[], g: number) => pool.filter((item) => groupIndex(item.section) === g);

/** The ladder's target in a group: up a step per right answer, down per wrong one. */
export const ladderTarget = (steps: readonly PlacementStep[]) =>
  LADDER_START + LADDER_STEP * steps.reduce((n, s) => n + (s.pick === s.answer ? 1 : -1), 0);

/** Questions in a full quiz on this pool: PER_GROUP a group, fewer where a group is short. */
export const placementTotal = (pool: readonly PlacementItem[]) =>
  ROUTE_SECTIONS.reduce((n, _, g) => n + Math.min(PER_GROUP, groupOf(pool, g).length), 0);

/**
 * The next question, or null once the quiz is done: in the first group still short of PER_GROUP
 * with problems left, an unasked one drawn at random from those within half a step of the nearest
 * to the ladder's target, so learners and retakes don't all get the same questions. Problems in
 * `seen` (the last quiz's) come up only once a group has no others left.
 */
export function nextStep(
  pool: readonly PlacementItem[],
  steps: readonly PlacementStep[],
  random: () => number = Math.random,
  seen: ReadonlySet<string> = new Set(),
): PlacementStep | null {
  const asked = new Set(steps.map((s) => s.id));
  for (let g = 0; g < ROUTE_SECTIONS.length; g++) {
    const mine = steps.filter((s) => s.group === g);
    const unasked = groupOf(pool, g).filter((item) => !asked.has(item.id));
    if (mine.length >= PER_GROUP || !unasked.length) continue;
    const fresh = unasked.filter((item) => !seen.has(item.id));
    const left = fresh.length ? fresh : unasked;
    const target = ladderTarget(mine);
    const nearest = Math.min(...left.map((c) => Math.abs(c.score - target)));
    const band = left.filter((c) => Math.abs(c.score - target) < nearest + LADDER_STEP / 2);
    const { section, ...item } = band[Math.floor(random() * band.length)];
    return {
      ...item,
      group: g,
      target,
      answer: section,
      choices: shuffle([section, ...distractors(section, random)], random),
    };
  }
  return null;
}

/**
 * One group's ladder: the level is the highest score answered right, and the group can be skipped
 * when the ladder topped out with no miss below it, which PER_GROUP steps up from the start only
 * reach by answering every question right.
 */
export function groupResult(steps: readonly PlacementStep[]) {
  const right = steps.filter((s) => s.pick === s.answer);
  return {
    right: right.length,
    total: steps.length,
    level: right.length ? Math.max(...right.map((s) => s.score)) : null,
    skip: steps.length === PER_GROUP && right.length === PER_GROUP,
  };
}

/** The quiz's result: each asked group's ladder, and for a weak one two unasked, unsolved problems near its level. */
export function placementResult(
  pool: readonly PlacementItem[],
  steps: readonly PlacementStep[],
  solved: ReadonlySet<string>,
  at: number,
): PlacementResult {
  const asked = new Set(steps.map((s) => s.id));
  return {
    at,
    groups: ROUTE_SECTIONS.flatMap((_, g) => {
      const mine = steps.filter((s) => s.group === g);
      if (!mine.length) return [];
      const result = groupResult(mine);
      // Without a right answer, the ladder's floor.
      const near = result.level ?? LADDER_START - 2 * LADDER_STEP;
      const picks = result.skip
        ? []
        : groupOf(pool, g)
            .filter((item) => !asked.has(item.id) && !solved.has(item.id))
            .sort((a, b) => Math.abs(a.score - near) - Math.abs(b.score - near))
            .slice(0, 2)
            .map(({ id, number, titleZh, titleEn, score, rated }) => ({ id, number, titleZh, titleEn, score, rated }));
      return [{ group: g, ...result, picks }];
    }),
  };
}

/** Stops of the groups a placement result says can be skipped. */
export const masteredStops = (result: PlacementResult | null | undefined) =>
  new Set((result?.groups ?? []).flatMap((g) => (g.skip ? (ROUTE_SECTIONS[g.group]?.slugs ?? []) : [])));

/** The first stop from `from` on that is not mastered; `from` itself when all are. */
export function openStart(from: number, mastered: ReadonlySet<string>) {
  const at = ROUTE_SLUGS.findIndex((slug, i) => i >= from && !mastered.has(slug));
  return at < 0 ? from : at;
}
