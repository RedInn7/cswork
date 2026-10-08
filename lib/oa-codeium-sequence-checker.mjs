import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
} from './oj-data-budgets.mjs';

// ASCII makes the character budget equal to the byte budget. Scan tokens lazily
// so an attacker cannot allocate millions of token objects before count checks.
function tokens(text, budget) {
  if (
    typeof text !== 'string' ||
    text.length > budget ||
    /[^\x09-\x0d\x20-\x7e]/.test(text)
  )
    return null;
  return text.matchAll(/[^\x09-\x0d\x20]+/g);
}

// Saturation is a mathematical >limit classification, not an input value cap.
// In particular, p can have arbitrarily many decimal digits within the shared
// input byte budget; never convert those digits to Number or BigInt.
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
  const magnitude =
    digits.length > bound.length ||
    (digits.length === bound.length && digits > bound)
      ? limit + 1
      : Number(digits);
  return negative ? -magnitude : magnitude;
}

function feasible(p) {
  const degrees = [...p].sort((a, b) => a - b);
  let left = 0,
    right = degrees.length - 1,
    offset = 0;
  while (left <= right) {
    const remaining = right - left + 1;
    if (degrees[left] < offset || degrees[right] > offset + remaining)
      return false;
    if (degrees[left] === offset) left++;
    else if (degrees[right] === offset + remaining) {
      right--;
      offset++;
    } else return false;
  }
  return true;
}

/** Check the actual optimum directly; expected is deliberately not an oracle. */
export function codeiumSequence(actual, _expected, input) {
  const inputTokens = tokens(input, OJ_MAX_CASE_BYTES);
  if (!inputTokens) return false;
  const first = inputTokens.next();
  if (first.done) return false;
  const n = integer(first.value[0], 100000);
  if (n === null || n < 1 || n > 100000) return false;
  const p = [];
  let impossible = false;
  for (const [token] of inputTokens) {
    if (p.length === n) return false;
    const value = integer(token, n);
    if (value === null) return false;
    if (value > n) impossible = true;
    p.push(value);
  }
  if (p.length !== n) return false;

  const outputTokens = tokens(actual, OJ_MAX_EXPECTED_BYTES);
  if (!outputTokens) return false;
  const outputFirst = outputTokens.next();
  if (outputFirst.done) return false;
  if (outputFirst.value[0] === 'None')
    return outputTokens.next().done === true && (impossible || !feasible(p));
  if (impossible) return false;

  const a = [],
    seenMagnitude = new Uint8Array(n + 1);
  const accept = (token) => {
    if (a.length === n) return false;
    const value = integer(token, n, true);
    if (value === null) return false;
    const magnitude = Math.abs(value);
    if (!magnitude || magnitude > n || seenMagnitude[magnitude]) return false;
    seenMagnitude[magnitude] = 1;
    a.push(value);
    return true;
  };
  if (!accept(outputFirst.value[0])) return false;
  for (const [token] of outputTokens) if (!accept(token)) return false;
  if (a.length !== n) return false;

  // Distinct nonzero magnitudes <=n force exactly 1..n: all such witnesses
  // attain the lower bound n and have neither duplicates nor opposite pairs.
  const sorted = [...a].sort((x, y) => x - y);
  for (let i = 0; i < n; i++) {
    let low = 0,
      high = n;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (sorted[mid] <= -a[i]) low = mid + 1;
      else high = mid;
    }
    // Includes j=i, exactly as specified by the original problem.
    if (n - low !== p[i]) return false;
  }
  return true;
}
