import { joinFields, type Constraint } from './testcase-fields';

/**
 * A whitelisted parameter's rules (lib/content/stress-safe.json) on top of the statement's bounds
 * (lib/content/leetcode-constraints.json); its len and val fill or replace the statement's.
 */
export type StressRule = Constraint & {
  /** A string's alphabet; every whitelisted string names one. */
  chars?: string;
  /** An array in non-decreasing order. */
  sorted?: boolean;
  /** An array without repeated values. */
  distinct?: boolean;
  /** An integer[][]'s row length, the same for every row (a grid); square: as many as rows. */
  cols?: number[];
  square?: boolean;
  /** Each row strictly increasing: [start, end] with start < end. */
  interval?: boolean;
  /** As long as this earlier parameter. */
  lenOf?: string;
  /** An integer at most this earlier parameter's length (1 <= k <= nums.length). */
  maxLen?: string;
};

/** Cases per stress test, and the longest array, string or grid side one draws. */
export const STRESS_CASES = 30;
const CAP = 8;

/** mulberry32: the same seed draws the same cases on every server. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A window of `width` values inside [lo, hi], near zero, so values repeat: [-4, 5], [1, 10], [0, 9]. */
export function smallRange([lo, hi]: number[], width = 10) {
  const from = Math.max(lo, Math.min(hi - width + 1, -4));
  return [from, Math.min(hi, from + width - 1)];
}

type Param = { name: string; type: string };
type Spec = Param & StressRule;

function supported(s: Spec) {
  if (s.type === 'boolean') return true;
  if (s.type === 'integer') return !!s.val;
  const length = !!s.len || !!s.lenOf;
  if (s.type === 'string') return length && !!s.chars;
  if (s.type === 'integer[]') return length && !!s.val;
  if (s.type === 'integer[][]') return length && !!s.val && (!!s.cols || !!s.square);
  return false;
}

type Int = (lo: number, hi: number) => number;

/**
 * One case, each parameter's JSON on its own line (the custom-case format). Without n: a stress
 * case, lengths up to CAP and values in a 10-wide window, so duplicates and edge cases come up.
 * With n: a complexity probe's case, every length n inside its bounds (lenOf and maxLen as
 * before), a grid's cells about n (√n a side, or n / row length when that is fixed), values in an
 * n-wide window.
 */
function drawCase(specs: Spec[], int: Int, random: () => number, n?: number) {
  const width = n === undefined ? 10 : Math.max(10, n);
  const clamp = ([lo, hi]: number[], x: number) => Math.max(lo, Math.min(hi, x));
  const length = (range: number[], target?: number) =>
    target === undefined ? int(range[0], Math.max(range[0], Math.min(range[1], CAP))) : clamp(range, target);
  // count values from the window; distinct ones from a window wide enough for count (fewer if the bounds are narrower).
  const values = (val: number[], count: number, distinct?: boolean) => {
    const [lo, hi] = smallRange(val, distinct ? Math.max(width, count) : width);
    if (!distinct) return Array.from({ length: count }, () => int(lo, hi));
    if (n !== undefined) {
      // A probe's pool is up to n wide (an interval per row): shuffle only its first count places, kept sparse.
      const moved = new Map<number, number>();
      return Array.from({ length: Math.min(count, hi - lo + 1) }, (_, i) => {
        const j = int(i, hi - lo);
        const picked = moved.get(j) ?? lo + j;
        moved.set(j, moved.get(i) ?? lo + i);
        return picked;
      });
    }
    const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  };
  const made = new Map<string, unknown>();
  const sizeOf = (name?: string) => {
    const value = name === undefined ? undefined : made.get(name);
    return typeof value === 'string' ? [...value].length : Array.isArray(value) ? value.length : 0;
  };
  for (const s of specs) {
    let value: unknown;
    if (s.type === 'boolean') value = random() < 0.5;
    else if (s.type === 'integer') {
      const [lo, hi] = smallRange(s.val!, width);
      value = int(lo, s.maxLen ? Math.max(lo, Math.min(hi, sizeOf(s.maxLen))) : hi);
    } else {
      const grid = s.type === 'integer[][]';
      // A probe's grid row: √n long, or its fixed length; the rows then make up about n cells.
      const across = n === undefined || !grid || s.square ? undefined : length(s.cols!, Math.round(Math.sqrt(n)));
      const target = n === undefined || !grid ? n : Math.round(across ? n / across : Math.sqrt(n));
      const rows = s.lenOf ? sizeOf(s.lenOf) : length(s.len!, target);
      if (s.type === 'string') value = Array.from({ length: rows }, () => s.chars![int(0, s.chars!.length - 1)]).join('');
      else if (!grid) {
        const row = values(s.val!, rows, s.distinct);
        value = s.sorted ? row.sort((a, b) => a - b) : row;
      } else {
        const cols = s.square ? rows : (across ?? length(s.cols!));
        value = Array.from({ length: rows }, () => {
          const row = values(s.val!, cols, s.interval);
          return s.interval ? row.sort((a, b) => a - b) : row;
        });
      }
    }
    made.set(s.name, value);
  }
  return joinFields(specs.map((s) => JSON.stringify(made.get(s.name))));
}

function specsOf(params: Param[], bounds: Record<string, Constraint> | null, rules: Record<string, StressRule>) {
  const specs: Spec[] = params.map((p) => ({ ...bounds?.[p.name], ...rules[p.name], ...p }));
  return specs.length && specs.every(supported) ? specs : null;
}

/**
 * STRESS_CASES small inputs, smallest first, each one JSON line per parameter (the custom-case
 * format); null when a parameter's type or bounds are out of reach (no stress button then).
 */
export function stressCases(
  params: Param[],
  bounds: Record<string, Constraint> | null,
  rules: Record<string, StressRule>,
  seed: number,
): string[] | null {
  const specs = specsOf(params, bounds, rules);
  if (!specs) return null;
  const random = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const cases = Array.from({ length: STRESS_CASES }, () => drawCase(specs, int, random));
  // The first case that disagrees is then the smallest one found: no shrinking needed.
  return cases.sort((a, b) => a.length - b.length);
}

/** A complexity probe's input, both runs of every size (inputs are ASCII: length counts bytes). */
export const COMPLEXITY_BYTES = 512 * 1024;
/** Each size runs twice; the faster run counts. */
export const COMPLEXITY_RUNS = 2;

/**
 * A complexity probe's sizes, smallest first, before the byte budget: a baseline at the smallest
 * length, then up to 7 sizes halving down from min(the largest length or grid's cells, 16384),
 * none under 32. null when nothing has a length (a string, array or grid) or the bounds leave
 * fewer than 3 sizes past the baseline: too few to fit a slope.
 */
export function complexitySizes(
  params: Param[],
  bounds: Record<string, Constraint> | null,
  rules: Record<string, StressRule>,
) {
  const scaled = specsOf(params, bounds, rules)?.filter((s) => s.len && !s.lenOf && s.type !== 'integer');
  if (!scaled?.length) return null;
  const cells = (s: Spec) => s.len![1] * (s.type !== 'integer[][]' ? 1 : s.square ? s.len![1] : s.cols![1]);
  const baseline = Math.max(1, ...scaled.map((s) => s.len![0]));
  const sizes: number[] = [];
  for (let n = Math.min(16384, Math.max(...scaled.map(cells))); n >= 32 && n > baseline && sizes.length < 7; n = Math.floor(n / 2))
    sizes.unshift(n);
  return sizes.length >= 3 ? [baseline, ...sizes] : null;
}

/**
 * A complexity probe's cases, smallest first, COMPLEXITY_RUNS of each size, and the size `n` of
 * each (sizes[i] for cases[i]); the largest sizes drop until the whole fits COMPLEXITY_BYTES,
 * null if that leaves fewer than 3 past the baseline. The worker rebuilds them from the seed (lib/server/oj-submissions.ts ownCases): never stored.
 */
export function complexityCases(
  params: Param[],
  bounds: Record<string, Constraint> | null,
  rules: Record<string, StressRule>,
  seed: number,
): { sizes: number[]; cases: string[] } | null {
  const levels = complexitySizes(params, bounds, rules);
  if (!levels) return null;
  const specs = specsOf(params, bounds, rules)!;
  const random = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const drawn = levels.map((n) => drawCase(specs, int, random, n));
  let bytes = drawn.reduce((sum, c) => sum + c.length * COMPLEXITY_RUNS, 0);
  while (drawn.length > 4 && bytes > COMPLEXITY_BYTES) bytes -= drawn.pop()!.length * COMPLEXITY_RUNS;
  if (bytes > COMPLEXITY_BYTES) return null;
  return {
    sizes: drawn.flatMap((_, i) => Array<number>(COMPLEXITY_RUNS).fill(levels[i])),
    cases: drawn.flatMap((c) => Array<string>(COMPLEXITY_RUNS).fill(c)),
  };
}

/**
 * A probe's reading: a fitted slope, one measurable size only (`ms` past the baseline), too fast
 * to tell, a timeout at n, or another failure at n.
 */
export type ComplexityFit =
  | { kind: 'fit'; slope: number; grade: 0 | 1 | 2 | 3; few: boolean }
  | { kind: 'one'; n: number; ms: number }
  | { kind: 'fast'; large: boolean }
  | { kind: 'timeout'; n: number; slope?: number }
  | { kind: 'error'; n: number; status: string };

/**
 * A probe's runs read as growth: the faster run of each size, less the baseline's time t0
 * (start-up and reading input); a size counts once that net time reaches max(15 ms, t0). Two or
 * more such sizes: the least-squares slope of log time on log n, graded under 1.3 about O(n) or
 * O(n log n), under 1.7 between O(n log n) and O(n²), under 2.5 about O(n²), else O(n³) or worse
 * (`few`: only two). One: that size alone, no bound claimed. None: too fast to tell (`large`: n ≥ 8192 still ran
 * under 15 ms past the baseline, so at most about O(n log n); not relative to t0, which is large
 * for Java's start-up or a native language's bridge).
 */
export function fitComplexity(points: { n: number; ms: number; status: string }[]): ComplexityFit {
  const failed = points.find((p) => !['finished', 'skipped', 'pending'].includes(p.status));
  if (failed && failed.status !== 'time_limit') return { kind: 'error', n: failed.n, status: failed.status };
  const best = new Map<number, number>();
  for (const p of points) if (p.status === 'finished') best.set(p.n, Math.min(best.get(p.n) ?? Infinity, p.ms));
  const sizes = [...new Set(points.map((p) => p.n))].sort((a, b) => a - b);
  const t0 = best.get(sizes[0]);
  const valid = t0 === undefined ? [] : sizes.slice(1).filter((n) => (best.get(n) ?? 0) - t0 >= Math.max(15, t0));
  const xy = valid.map((n) => [Math.log(n), Math.log(best.get(n)! - t0!)]);
  let slope: number | undefined;
  if (xy.length >= 2) {
    const mx = xy.reduce((sum, [x]) => sum + x, 0) / xy.length,
      my = xy.reduce((sum, [, y]) => sum + y, 0) / xy.length;
    slope = xy.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0) / xy.reduce((sum, [x]) => sum + (x - mx) ** 2, 0);
  }
  if (failed) return { kind: 'timeout', n: failed.n, slope };
  if (valid.length === 1) return { kind: 'one', n: valid[0], ms: Math.round(best.get(valid[0])! - t0!) };
  if (slope === undefined) {
    const top = Math.max(...best.keys());
    return { kind: 'fast', large: t0 !== undefined && top >= 8192 && best.get(top)! - t0 < 15 };
  }
  return { kind: 'fit', slope, grade: slope < 1.3 ? 0 : slope < 1.7 ? 1 : slope < 2.5 ? 2 : 3, few: xy.length === 2 };
}

/** Two outputs as the judge's checker compares them: exact (CRLF aside) or ASCII-whitespace tokens. */
export function sameOutput(a: string, b: string, checker: string) {
  if (checker === 'exact') return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
  const tokens = (text: string) => text.split(/[ \t\n\r\f\v]+/).filter(Boolean).join(' ');
  return tokens(a) === tokens(b);
}

/**
 * The index of the first case, smallest first, where the learner's run disagrees with a finished
 * reference run: another verdict (runtime error, time limit, skipped) or another output; -1 when
 * every case agrees.
 */
export function firstMismatch(
  mine: { status: string; stdout?: string }[],
  reference: { stdout?: string }[],
  checker: string,
) {
  return reference.findIndex(
    (r, i) => mine[i]?.status !== 'finished' || !sameOutput(mine[i].stdout ?? '', r.stdout ?? '', checker),
  );
}
