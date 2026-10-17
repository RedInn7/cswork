/**
 * The workspace's custom cases (components/problem-workspace.tsx): inputs per problem and coding
 * mode in this browser, each with an optional expected output the learner types, checked against
 * a run on that case. The expected outputs live under `${key}:expect`, so the inputs keep their
 * old format.
 */
import { activeStatuses } from './oj-client';
import { sameOutput } from './stress-gen';

export const MAX_CASES = 5;

function strings(raw: string | null) {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_CASES)
      : [];
  } catch {
    return [];
  }
}

/** Stored inputs (at least one, maybe blank) and their expected outputs, index by index ('' for none). */
export function parseCases(raw: string | null, rawExpect: string | null) {
  const found = strings(raw);
  const cases = found.length ? found : [''];
  const expect = strings(rawExpect);
  return { cases, expect: cases.map((_, i) => expect[i] ?? '') };
}

export function readCases(key: string) {
  try {
    return parseCases(localStorage.getItem(key), localStorage.getItem(`${key}:expect`));
  } catch {
    return parseCases(null, null);
  }
}

export function writeCases(key: string, cases: string[], expect: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(cases));
    if (expect.some(Boolean)) localStorage.setItem(`${key}:expect`, JSON.stringify(expect));
    else localStorage.removeItem(`${key}:expect`);
  } catch {
    /* Still usable for this visit. */
  }
}

// JSON text without the whitespace outside its strings. Numbers stay as written: a round trip
// through JSON.parse would turn a long past 2^53 into the nearest double (…993 reads as …992).
const json = (text: string) => {
  try {
    JSON.parse(text);
    return text.replace(/("(?:[^"\\]|\\.)*")|\s+/g, (_, quoted?: string) => quoted ?? '');
  } catch {
    return null;
  }
};
const lastNewlines = (text: string) => text.replace(/(?:\r?\n)+$/, '');

/**
 * A run on a custom case against the expected output the learner typed; null when there is none,
 * or no verdict to compare yet (still judging, cancelled, or a judge failure). An exact checker
 * compares as the judge does except for final newlines (a text box hides them); tokens compares
 * whitespace-separated tokens. Any other checker (floats, sets, any valid answer) falls back to
 * tokens and says `approx`: a ✗ may still be a right answer. `leetcode` compares returned values
 * as JSON, ignoring whitespace outside strings, when both sides parse, so [1, 2] matches [1,2].
 */
export function customVerdict(
  run: { status: string; stdout?: string },
  expected: string,
  checker = 'tokens',
  leetcode = false,
) {
  if (!expected.trim() || activeStatuses.has(run.status) || ['cancelled', 'system_error'].includes(run.status)) return null;
  const approx = checker !== 'exact' && checker !== 'tokens';
  if (run.status !== 'finished') return { pass: false, approx };
  const actual = run.stdout ?? '';
  const [a, b] = leetcode ? [json(actual), json(expected)] : [null, null];
  const pass =
    a !== null && b !== null
      ? a === b
      : checker === 'exact'
        ? sameOutput(lastNewlines(actual), lastNewlines(expected), 'exact')
        : sameOutput(actual, expected, 'tokens');
  return { pass, approx };
}
