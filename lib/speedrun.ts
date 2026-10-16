// Pattern speedrun (?view=speedrun): name the Line 500 stop a problem belongs to.
// Client-safe: only lib/route-stops, never the curated JSON.
import { ROUTE_SECTIONS } from './route-stops';

export const SPEEDRUN_SIZE = 10;

export type SpeedrunPoolItem = {
  /** Judge problem id, the "Solve it" target. */
  id: string;
  number: number;
  titleZh: string;
  titleEn: string;
  /** The problem's Line 500 stop: the correct answer. */
  section: string;
  reason: string;
  reasonEn: string;
};
export type SpeedrunQuestion = Omit<SpeedrunPoolItem, 'section'> & {
  answer: string;
  /** Four stop slugs in display order, the answer among them. */
  choices: string[];
  /** First statement paragraph, members only. */
  excerptZh?: string;
  excerptEn?: string;
};

const LINE = ROUTE_SECTIONS.flatMap((group, g) =>
  group.slugs.map((slug) => ({ slug, g })),
);
const position = new Map(LINE.map((stop, i) => [stop.slug, i]));

export function shuffle<T>(list: readonly T[], random: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Three stops from the answer's group in random order, borrowing the nearest stops outside it
 * when the group is short. A fixed nearest-three pick made the answer guessable from stop numbers. */
export function distractors(slug: string, random: () => number) {
  const at = position.get(slug)!;
  const g = LINE[at].g;
  return LINE.map((stop, i) => ({
    slug: stop.slug,
    // Same group sorts first ([-1, 0)); outsiders by distance, random among equals.
    rank: stop.g === g ? random() - 1 : Math.abs(i - at) + random(),
  }))
    .filter((stop) => stop.slug !== slug)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((stop) => stop.slug);
}

/** One round: distinct stops while they last, each with the answer and three stops from its group. */
export function speedrunRound(
  pool: readonly SpeedrunPoolItem[],
  random: () => number = Math.random,
  size = SPEEDRUN_SIZE,
): SpeedrunQuestion[] {
  const known = shuffle(
    pool.filter((item) => position.has(item.section)),
    random,
  );
  const seen = new Set<string>();
  const fresh = known.filter((item) => !seen.has(item.section) && !!seen.add(item.section));
  const picked = [...fresh, ...known.filter((item) => !fresh.includes(item))].slice(0, size);
  return picked.map(({ section, ...item }) => ({
    ...item,
    answer: section,
    choices: shuffle([section, ...distractors(section, random)], random),
  }));
}

/** First prose paragraph of a Markdown statement, at most ~`max` characters. */
export function firstParagraph(markdown: string, max = 360) {
  const block =
    markdown
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .find(
        (part) =>
          part &&
          !/^(?:!\[[^\]]*\]\([^)]*\)\s*)+$/.test(part) &&
          !/^(?:#|```|~~~|<img|\|)/.test(part),
      ) ?? '';
  if (block.length <= max) return block;
  // Cut after the last sentence end that fits, else hard cut.
  const cut = block.slice(0, max);
  const end = Math.max(...['。', '. ', '！', '？', '; ', '；'].map((m) => cut.lastIndexOf(m)));
  return end > max / 3 ? cut.slice(0, end + 1).trim() : cut.trimEnd() + '…';
}

/** Group (ROUTE_SECTIONS) of a stop, for the end-of-round breakdown. */
export function groupIndex(slug: string) {
  const at = position.get(slug);
  return at === undefined ? -1 : LINE[at].g;
}
/** Two-digit stop code as Line 500 shows it. */
export function stopCode(slug: string) {
  const at = position.get(slug);
  return at === undefined ? '--' : String(at + 1).padStart(2, '0');
}
