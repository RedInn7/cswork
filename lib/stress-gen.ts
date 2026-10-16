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

/**
 * STRESS_CASES small inputs, smallest first, each one JSON line per parameter (the custom-case
 * format); null when a parameter's type or bounds are out of reach (no stress button then).
 * Lengths stop at 8 and values sit in a narrow window, so duplicates and edge cases come up.
 */
export function stressCases(
  params: Param[],
  bounds: Record<string, Constraint> | null,
  rules: Record<string, StressRule>,
  seed: number,
): string[] | null {
  const specs: Spec[] = params.map((p) => ({ ...bounds?.[p.name], ...rules[p.name], ...p }));
  if (!specs.length || !specs.every(supported)) return null;
  const random = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const length = ([lo, hi]: number[]) => int(lo, Math.max(lo, Math.min(hi, CAP)));
  // n values from the window; distinct ones from a window wide enough for n (fewer if the bounds are narrower).
  const values = (val: number[], n: number, distinct?: boolean) => {
    const [lo, hi] = smallRange(val, distinct ? Math.max(10, n) : 10);
    if (!distinct) return Array.from({ length: n }, () => int(lo, hi));
    const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
  };
  const cases = Array.from({ length: STRESS_CASES }, () => {
    const made = new Map<string, unknown>();
    const sizeOf = (name?: string) => {
      const value = name === undefined ? undefined : made.get(name);
      return typeof value === 'string' ? [...value].length : Array.isArray(value) ? value.length : 0;
    };
    for (const s of specs) {
      let value: unknown;
      if (s.type === 'boolean') value = random() < 0.5;
      else if (s.type === 'integer') {
        const [lo, hi] = smallRange(s.val!);
        value = int(lo, s.maxLen ? Math.max(lo, Math.min(hi, sizeOf(s.maxLen))) : hi);
      } else {
        const n = s.lenOf ? sizeOf(s.lenOf) : length(s.len!);
        if (s.type === 'string') value = Array.from({ length: n }, () => s.chars![int(0, s.chars!.length - 1)]).join('');
        else if (s.type === 'integer[]') {
          const row = values(s.val!, n, s.distinct);
          value = s.sorted ? row.sort((a, b) => a - b) : row;
        } else {
          const cols = s.square ? n : length(s.cols!);
          value = Array.from({ length: n }, () => {
            const row = values(s.val!, cols, s.interval);
            return s.interval ? row.sort((a, b) => a - b) : row;
          });
        }
      }
      made.set(s.name, value);
    }
    return joinFields(specs.map((s) => JSON.stringify(made.get(s.name))));
  });
  // The first case that disagrees is then the smallest one found: no shrinking needed.
  return cases.sort((a, b) => a.length - b.length);
}
