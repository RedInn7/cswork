import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
} from './oj-data-budgets.mjs';

function boundedAscii(text, budget) {
  return (
    typeof text === 'string' &&
    text.length <= budget &&
    !/[^\x09-\x0d\x20-\x7e]/.test(text)
  );
}

// Lazy scanning bounds token allocations even for whitespace/token floods.
function tokens(text) {
  return text.matchAll(/[^\x09-\x0d\x20]+/g);
}

function integer(token, limit, signed = false) {
  if (!/^[+-]?\d+$/.test(token)) return null;
  const negative = token[0] === '-';
  const digits =
    (token[0] === '+' || negative ? token.slice(1) : token).replace(
      /^0+/,
      '',
    ) || '0';
  if (negative && !signed && digits !== '0') return null;
  const bound = String(limit);
  if (
    digits.length > bound.length ||
    (digits.length === bound.length && digits > bound)
  )
    return null;
  const value = Number(digits);
  return negative ? -value : value;
}

/** Validate any optimal partition directly; expected is not an oracle. */
export function morganBricks(actual, _expected, input) {
  if (
    !boundedAscii(input, OJ_MAX_CASE_BYTES) ||
    !boundedAscii(actual, OJ_MAX_EXPECTED_BYTES)
  )
    return false;
  const inputTokens = tokens(input);
  const read = (limit) => {
    const next = inputTokens.next();
    return next.done ? null : integer(next.value[0], limit);
  };
  const n = read(200000),
    k = read(200000);
  if (n === null || n < 1 || k === null) return false;
  const strengths = [],
    distinct = new Set();
  let total = 0;
  for (let i = 0; i < n; i++) {
    const strength = read(1000000000);
    if (strength === null || strength < 1 || distinct.has(strength))
      return false;
    strengths.push(strength);
    distinct.add(strength);
    total += strength;
  }
  if (!inputTokens.next().done) return false;

  // At most four rows are allocated: a fourth row proves malformed output.
  // Permit surrounding whitespace and either Unix or Windows line endings.
  const rows = actual.trim().split(/\r\n|\r|\n/, 4);
  if (rows.length !== 3) return false;
  const totalTokens = tokens(rows[0]);
  const first = totalTokens.next();
  if (first.done || !totalTokens.next().done) return false;
  // n * 1e9 <= 2e14 is an exact safe JS integer (not a 32-bit quantity).
  const claimed = integer(first.value[0], n * 1000000000);
  if (claimed === null || claimed < n) return false;

  const seen = new Uint8Array(n + 1);
  let used = 0,
    bigCount = 0,
    actualCost = 0;
  for (let row = 1; row <= 2; row++) {
    const indices = tokens(rows[row]);
    const head = indices.next();
    if (head.done) return false;
    const firstIndex = integer(head.value[0], n, true);
    if (firstIndex === -1) {
      if (!indices.next().done) return false;
      continue;
    }
    let previous = 0;
    const accept = (index) => {
      if (
        index === null ||
        index <= previous ||
        index < 1 ||
        index > n ||
        seen[index]
      )
        return false;
      previous = index;
      seen[index] = 1;
      used++;
      if (row === 1) {
        bigCount++;
        if (bigCount > k) return false;
        actualCost++;
      } else actualCost += strengths[index - 1];
      return true;
    };
    if (!accept(firstIndex)) return false;
    for (const [token] of indices) if (!accept(integer(token, n))) return false;
  }
  if (used !== n || actualCost !== claimed) return false;

  // A big hit saves strength-1. Selecting at most k largest nonnegative
  // savings is optimal; saving zero (strength 1) is deliberately optional.
  const descending = [...strengths].sort((a, b) => b - a);
  for (let i = 0; i < Math.min(k, n); i++) total -= descending[i] - 1;
  return claimed === total;
}
