// Client-safe: self-graded review of open questions (components/recall-rate.tsx, recall-queue.tsx).
import { MCQ_MASTERED, MCQ_REVIEW_DAYS, mcqDue } from './mock-oa';

export type RecallGrade = 'know' | 'partial' | 'no';
/** One card: [box 0–4, the UTC day number that set it (mcqDay), the question's title]. */
export type RecallCard = [number, number, string];
/**
 * The learner's cards by target: `content:<type>/<slug>` or `sd:<chapter>`. Boxes 0–3 come back
 * after MCQ_REVIEW_DAYS (1/3/7/21 days); box 4 is mastered and does not come back.
 */
export type RecallQueue = { v: 1; items: Record<string, RecallCard> };

/** The private note that holds the queue when signed in (lib/server/my-practice.ts). */
export const RECALL_NOTE = 'recall:queue';
/** The queue in this browser when signed out. */
export const RECALL_KEY = 'cswork:recall:v1';
export const RECALL_MAX = 300;
const TARGET = /^(?:content:[a-z_]+\/|sd:)[\w./-]{1,200}$/;
const TITLE_MAX = 80;

export const emptyRecall = (): RecallQueue => ({ v: 1, items: {} });

/**
 * Up to 8 checkable points: the top-level list items of the first part that has any (the rubric
 * before the reference answer), with Markdown marks taken out. Code blocks are skipped.
 */
export function keyPoints(...parts: (string | null | undefined)[]) {
  for (const part of parts) {
    const points: string[] = [];
    let fence = false;
    for (const line of (part ?? '').split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      const item = fence ? null : /^ ?(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line);
      if (!item) continue;
      // Code spans keep their text as is; emphasis and links outside them lose their marks.
      const text = item[1]
        .split(/(`[^`]*`)/)
        .map((bit, i) =>
          i % 2
            ? bit.slice(1, -1)
            : bit
                .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
                .replace(/(^|\W)([*_])(\S(?:.*?\S)?)\2(?=\W|$)/g, '$1$3'),
        )
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) points.push(text);
      if (points.length === 8) return points;
    }
    if (points.length) return points;
  }
  return [];
}

const due = (card: RecallCard, today: number) => mcqDue([card[0], card[1]], today);

/**
 * The queue after grading `target`: "know" moves a new or due card up a box (not one that isn't
 * due yet: no cramming), "partial" keeps the box and restarts its wait today, "no" goes back to
 * box 0. Over RECALL_MAX cards, mastered ones go first, then the longest unseen.
 */
export function rateRecall(queue: RecallQueue, target: string, title: string, grade: RecallGrade, today: number): RecallQueue {
  const card = queue.items[target];
  const name = title.trim().slice(0, TITLE_MAX) || card?.[2] || '';
  const next: RecallCard =
    grade === 'no'
      ? [0, today, name]
      : grade === 'partial'
        ? [card?.[0] ?? 0, today, name]
        : !card
          ? [1, today, name]
          : due(card, today)
            ? [Math.min(card[0] + 1, MCQ_MASTERED), today, name]
            : [card[0], card[1], name];
  return capRecall({ v: 1, items: { ...queue.items, [target]: next } });
}

/** The cards in keeping order: not mastered first, then the most recently set. */
const ranked = (items: RecallQueue['items']) =>
  Object.entries(items).sort(
    (a, b) => Number(b[1][0] < MCQ_MASTERED) - Number(a[1][0] < MCQ_MASTERED) || b[1][1] - a[1][1],
  );

export function capRecall(queue: RecallQueue): RecallQueue {
  const entries = ranked(queue.items);
  return entries.length > RECALL_MAX ? { v: 1, items: Object.fromEntries(entries.slice(0, RECALL_MAX)) } : queue;
}

/** A stored queue, keeping only well-formed cards; anything else reads as empty. */
export function parseRecall(raw: string | null | undefined): RecallQueue {
  try {
    const value = JSON.parse(raw || '{}') as Partial<RecallQueue> | null;
    const items = value?.items;
    if (value?.v !== 1 || !items || typeof items !== 'object' || Array.isArray(items)) return emptyRecall();
    return capRecall({
      v: 1,
      items: Object.fromEntries(
        Object.entries(items).filter(
          ([target, c]) =>
            TARGET.test(target) &&
            Array.isArray(c) &&
            c.length === 3 &&
            Number.isInteger(c[0]) &&
            c[0] >= 0 &&
            c[0] <= MCQ_MASTERED &&
            Number.isInteger(c[1]) &&
            typeof c[2] === 'string',
        ),
      ) as RecallQueue['items'],
    });
  } catch {
    return emptyRecall();
  }
}

/** This browser's cards moving into the account's: the account's copy of a card wins. */
export const mergeRecall = (local: RecallQueue, saved: RecallQueue) =>
  capRecall({ v: 1, items: { ...local.items, ...saved.items } });

/**
 * The queue as JSON within `maxBytes` (the note cap), dropping cards in the same order as the
 * card cap. Empty when there are no cards, which removes the note.
 */
// ponytail: one card at a time is O(n²) bytes, fine for RECALL_MAX cards.
export function fitRecall(queue: RecallQueue, maxBytes: number) {
  const entries = ranked(queue.items);
  const body = () => (entries.length ? JSON.stringify({ v: 1, items: Object.fromEntries(entries) }) : '');
  let text = body();
  while (new TextEncoder().encode(text).length > maxBytes) {
    entries.pop();
    text = body();
  }
  return text;
}

/** The day a card comes back, or null once mastered. */
export const recallNext = (card: RecallCard) => (card[0] < MCQ_MASTERED ? card[1] + MCQ_REVIEW_DAYS[card[0]] : null);

/** Cards due today, the longest overdue first. */
export const dueRecall = (queue: RecallQueue, today: number) =>
  Object.entries(queue.items)
    .filter(([, card]) => due(card, today))
    .sort((a, b) => (recallNext(a[1]) ?? 0) - (recallNext(b[1]) ?? 0));

/** Cards per box, 0–4 (4 = mastered). */
export function recallBoxes(queue: RecallQueue) {
  const boxes = Array<number>(MCQ_MASTERED + 1).fill(0);
  for (const card of Object.values(queue.items)) boxes[card[0]]++;
  return boxes;
}

/** The queue without its mastered cards. */
export const dropMastered = (queue: RecallQueue): RecallQueue => ({
  v: 1,
  items: Object.fromEntries(Object.entries(queue.items).filter(([, c]) => c[0] < MCQ_MASTERED)),
});

/** Where a card's question lives: the content library item or the system design chapter. */
export function recallHref(target: string) {
  const content = /^content:([a-z_]+)\/(.+)$/.exec(target);
  if (content) return `/?view=content&type=${encodeURIComponent(content[1])}&slug=${encodeURIComponent(content[2])}`;
  return target.startsWith('sd:') ? `/system-design/${encodeURIComponent(target.slice(3))}` : null;
}
