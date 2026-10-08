import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
} from './oj-data-budgets.mjs';

// Select the complete Java version: its array values and target are signed int.
// Check decimal length before BigInt conversion, including arbitrarily padded 0s.
function integer(token, low, high) {
  if (!/^[+-]?[0-9]+$/.test(token)) return null;
  const negative = token[0] === '-';
  const digits = token.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
  if (digits.length > 10) return null;
  const value = BigInt((negative ? '-' : '') + digits);
  return value < low || value > high ? null : value;
}

const MIN = -2147483648n;
const MAX = 2147483647n;

/** A counterexample to the original Java search, not a prescribed witness. */
export function binarySearchWitness(actual, _expected, input) {
  if (
    typeof input !== 'string' ||
    input.length > OJ_MAX_CASE_BYTES ||
    // eslint-disable-next-line no-control-regex -- Only conventional ASCII whitespace is valid input.
    /[^\x09-\x0d\x20]/.test(input) ||
    typeof actual !== 'string' ||
    actual.length > OJ_MAX_EXPECTED_BYTES ||
    // eslint-disable-next-line no-control-regex -- Enforce the ASCII three-line output protocol.
    /[^\x09\x0a\x0d\x20-\x7e]/.test(actual)
  )
    return false;
  // Three physical lines; accept LF/CRLF and an optional final line terminator.
  const text = actual.replace(/\r\n/g, '\n');
  if (text.includes('\r')) return false;
  const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
  if (lines.length !== 3) return false;
  const count = integer(lines[0].trim(), 0n, MAX);
  const target = integer(lines[2].trim(), MIN, MAX);
  if (count === null || target === null || count === 0n) return false;
  // Even single-character values need separators. Reject forged counts before
  // allocation; the physical output budget bounds both indexing and storage.
  if (count > BigInt(Math.ceil(lines[1].length / 2))) return false;
  const n = Number(count);
  const values = new Int32Array(n);
  let seen = 0;
  let member = false;
  for (const match of lines[1].matchAll(/[^ \t]+/g)) {
    if (seen === n) return false;
    const value = integer(match[0], MIN, MAX);
    if (value === null) return false;
    if (seen && BigInt(values[seen - 1]) > value) return false;
    values[seen++] = Number(value); // Exact after BigInt signed-int validation.
    if (value === target) member = true;
  }
  if (seen !== n) return false;
  let left = 0;
  let right = n - 1;
  while (left < right) {
    const middle = Math.floor((left + right + 1) / 2);
    if (BigInt(values[middle]) > target) right = middle - 1;
    else left = middle + 1;
  }
  // Java checks right (not left). Any matching index is correct, including
  // duplicates: the contract does not require the first matching position.
  const found = BigInt(values[right]) === target;
  return found !== member;
}
