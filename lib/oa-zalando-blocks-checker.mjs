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

function quota(token) {
  if (!/^[+-]?\d+$/.test(token)) return null;
  const negative = token[0] === '-';
  const digits = token.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
  if (negative && digits !== '0') return null;
  if (digits.length > 2 || (digits.length === 2 && digits > '10')) return null;
  return Number(digits);
}

const blocks = ['AA', 'AB', 'BB'];

// The previous whole block determines all possible triples at the join.
// Remaining counts decrease on every edge; at most 11^3 * 4 states exist.
function longest(aa, ab, bb) {
  const memo = new Int8Array(11 ** 3 * 4).fill(-1);
  function visit(a, b, c, previous) {
    const key = ((a * 11 + b) * 11 + c) * 4 + previous;
    if (memo[key] !== -1) return memo[key];
    const remaining = [a, b, c];
    let best = 0;
    for (let next = 0; next < 3; next++) {
      if (!remaining[next]) continue;
      const joined = (previous ? blocks[previous - 1] : '') + blocks[next];
      if (/AAA|BBB/.test(joined)) continue;
      remaining[next]--;
      best = Math.max(best, 2 + visit(...remaining, next + 1));
      remaining[next]++;
    }
    memo[key] = best;
    return best;
  }
  return visit(aa, ab, bb, 0);
}

/** Verify a longest whole-block witness without trusting expected output. */
export function zalandoBlocks(actual, _expected, input) {
  if (
    !boundedAscii(input, OJ_MAX_CASE_BYTES) ||
    !boundedAscii(actual, OJ_MAX_EXPECTED_BYTES)
  )
    return false;
  const iterator = input.matchAll(/[^\x09-\x0d\x20]+/g);
  const counts = [];
  for (let i = 0; i < 3; i++) {
    const next = iterator.next();
    if (next.done) return false;
    const value = quota(next.value[0]);
    if (value === null) return false;
    counts.push(value);
  }
  if (!iterator.next().done || counts.every((value) => value === 0))
    return false;
  const text = actual.trim();
  if (
    !text.length ||
    text.length > 60 ||
    text.length % 2 !== 0 ||
    /[^AB]/.test(text) ||
    /AAA|BBB/.test(text)
  )
    return false;
  const used = [0, 0, 0];
  for (let i = 0; i < text.length; i += 2) {
    const block = blocks.indexOf(text.slice(i, i + 2));
    if (block === -1 || ++used[block] > counts[block]) return false;
  }
  return text.length === longest(...counts);
}
