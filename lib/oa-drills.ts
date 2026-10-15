/**
 * OA debugging and code-review drills (scripts/oa-judge/build-drills.mjs builds them from the
 * verified mutants). Shared by the API (lib/server/oa-library.ts) and the drill UIs.
 */

/** A drill as the API hands it out: the buggy program and how many lines a fix may change. */
export type Drill = { n: number; code: string; budget: number };
/** POST oa-library/<id>/review: the marked lines scored against the planted bug. */
export type DrillReview = {
  hits: number[];
  missed: number[];
  falsePositives: number[];
  bugLines: number[];
  nameZh: string;
  nameEn?: string;
};

const lines = (code: string) =>
  code
    .replace(/\s+$/, '')
    .split('\n')
    .map((line) => line.trimEnd());

/**
 * Lines changed from `from` to `to`, trailing whitespace ignored: a line diff (LCS), so an
 * inserted line counts once rather than shifting every line after it; a replaced line counts once.
 */
export function changedLines(from: string, to: string) {
  const a = lines(from),
    b = lines(to);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length,
    endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const x = a.slice(start, endA),
    y = b.slice(start, endB);
  // ponytail: O(n·m) LCS on the edited middle; a pasted-over program just counts every line.
  if (x.length * y.length > 4_000_000) return Math.max(x.length, y.length);
  let row = new Array<number>(y.length + 1).fill(0);
  for (const line of x) {
    const next = [0];
    for (let j = 0; j < y.length; j++) next.push(line === y[j] ? row[j] + 1 : Math.max(row[j + 1], next[j]));
    row = next;
  }
  return Math.max(x.length, y.length) - row[y.length];
}

/** Marked lines against the bug's lines: found, missed and flagged by mistake. */
export function scoreReview(bugLines: number[], marked: number[]) {
  const bugs = new Set(bugLines),
    picked = new Set(marked);
  return {
    hits: bugLines.filter((line) => picked.has(line)),
    missed: bugLines.filter((line) => !picked.has(line)),
    falsePositives: [...picked].filter((line) => !bugs.has(line)).sort((p, q) => p - q),
  };
}

/** Passed drills in this browser only: `${problemId}:${n}` → when each mode was first passed. */
export type DrillProgress = Record<string, { fix?: number; review?: number }>;
export const DRILLS_KEY = 'cswork:drills:v1';

export function readDrillProgress(): DrillProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRILLS_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as DrillProgress) : {};
  } catch {
    return {};
  }
}

/** Records a pass (fix: accepted within the budget; review: every bug line, no false flag). */
export function markDrill(problemId: string, n: number, mode: 'fix' | 'review') {
  const progress = readDrillProgress(),
    key = `${problemId}:${n}`;
  if (progress[key]?.[mode]) return;
  progress[key] = { ...progress[key], [mode]: Date.now() };
  try {
    localStorage.setItem(DRILLS_KEY, JSON.stringify(progress));
  } catch {
    /* Progress is a nicety; the drill itself still works. */
  }
}
