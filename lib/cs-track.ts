// Client-safe: /roadmap's fourth track, "CS fundamentals" (app/roadmap/tracks.tsx).
import { STEP_DONE } from './content/role-paths';
import { MCQ_MASTERED, type McqReview } from './mock-oa';
import type { RecallQueue } from './recall';

/**
 * One subject: its id is an OA multiple-choice topic (lib/content/oa-mcq.json); `after` lists the
 * subjects to learn first; `course` is a /learn crash course (lib/content/beginner-courses.json),
 * `sd` a system design chapter to read alongside.
 */
export type CsNode = { id: string; after: string[]; course?: string; sd?: string };
export const CS_NODES: CsNode[] = [
  { id: 'arch', after: [] },
  { id: 'linux', after: [] },
  { id: 'git', after: [] },
  { id: 'os', after: ['arch'], course: 'os' },
  { id: 'concurrency', after: ['os'], sd: 'concurrency-primitives' },
  { id: 'network', after: ['os'], course: 'network' },
  { id: 'dbms', after: ['concurrency'], sd: 'building-blocks' },
  { id: 'security', after: ['network'] },
];

/** The nodes by depth: those without prerequisites first, then each one a layer below its deepest prerequisite. */
export function csLayers(nodes = CS_NODES) {
  const depth = new Map<string, number>();
  const of = (id: string, seen: string[] = []): number => {
    if (seen.includes(id)) throw new Error(`cs-track: ${[...seen, id].join(' → ')} is a cycle`);
    const known = depth.get(id);
    if (known !== undefined) return known;
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`cs-track: unknown node ${id}`);
    const d = Math.max(-1, ...node.after.map((a) => of(a, [...seen, id]))) + 1;
    depth.set(id, d);
    return d;
  };
  const layers: CsNode[][] = [];
  for (const node of nodes) (layers[of(node.id)] ??= []).push(node);
  return layers;
}

/** A question's topic from its id, `mcq-<topic>-N`. */
export const mcqTopic = (id: string) => /^mcq-([a-z]+)-\d+$/.exec(id)?.[1] ?? null;

/** The review's entries of one topic. */
export const topicReview = (review: McqReview, topic: string): McqReview =>
  Object.fromEntries(Object.entries(review).filter(([id]) => mcqTopic(id) === topic));

export type CsMastery = { answered: number; right: number; mastered: number; read: number; cards: number };

/**
 * A subject's numbers: of its `total` questions, how many the learner answered, how many stand
 * right (box ≥ 1: the last answer was right) and mastered (box 4); of the course's chapter targets
 * (`sd:<course>/<chapter>`), how many are read and how many are on the review queue.
 */
export function csMastery(
  total: number,
  review: McqReview,
  chapters: readonly string[],
  read: ReadonlySet<string>,
  recall: RecallQueue,
): CsMastery & { total: number } {
  const boxes = Object.values(review).map((entry) => entry[0]);
  return {
    total,
    answered: boxes.length,
    right: boxes.filter((box) => box >= 1).length,
    mastered: boxes.filter((box) => box === MCQ_MASTERED).length,
    read: chapters.filter((key) => read.has(key)).length,
    cards: chapters.filter((key) => key in recall.items).length,
  };
}

/**
 * Done once STEP_DONE of the questions are answered and STEP_DONE of those stand right, plus every
 * chapter read when the subject has a course; active with any record; todo otherwise.
 */
export function csState(m: CsMastery & { total: number }, chapters: number): 'done' | 'active' | 'todo' {
  if (m.answered > 0 && m.answered >= STEP_DONE * m.total && m.right >= STEP_DONE * m.answered && m.read >= chapters)
    return 'done';
  return m.answered || m.read || m.cards ? 'active' : 'todo';
}
