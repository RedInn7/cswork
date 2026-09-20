/** Fixed future contract: oa-piecewise-linear / oa-two-sigma-5.
 * Independent exact absolute-error checker. Never trusts expected output.
 * Does not split either payload into an unbounded array of tokens or lines.
 */
export const PIECEWISE_LIMITS = Object.freeze({
  inputBytes: 9_600_040,
  outputBytes: 16 * 1024 * 1024,
  maxPoints: 200_000,
  maxQueries: 200_000,
  outputTokenBytes: 64,
  outputExponent: 30,
});
const SCALE = 1_000_000n;
const inputNumber = /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const outputNumber =
  /^([+-]?)([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE]([+-]?[0-9]+))?$/;
const asciiSpace = (c) => c === 32 || (c >= 9 && c <= 13);

// One bounded physical record at a time. LF/CRLF allowed; a lone CR is not.
function lineReader(text) {
  let offset = 0;
  return {
    next(count, tokenLimit) {
      if (offset >= text.length) return null;
      const newline = text.indexOf('\n', offset);
      let end = newline < 0 ? text.length : newline;
      if (newline >= 0 && end > offset && text.charCodeAt(end - 1) === 13)
        end--;
      let at = offset;
      offset = newline < 0 ? text.length : newline + 1;
      const tokens = [];
      for (let k = 0; k < count; k++) {
        while (
          at < end &&
          (text.charCodeAt(at) === 32 || text.charCodeAt(at) === 9)
        )
          at++;
        const start = at;
        while (
          at < end &&
          text.charCodeAt(at) !== 32 &&
          text.charCodeAt(at) !== 9
        ) {
          if (at - start >= tokenLimit) return null;
          at++;
        }
        if (at === start) return null;
        tokens.push(text.slice(start, at));
      }
      while (
        at < end &&
        (text.charCodeAt(at) === 32 || text.charCodeAt(at) === 9)
      )
        at++;
      return at === end ? tokens : null;
    },
    done() {
      return offset === text.length;
    },
  };
}

function outputReader(text) {
  let offset = 0;
  return {
    next() {
      while (offset < text.length && asciiSpace(text.charCodeAt(offset)))
        offset++;
      const start = offset;
      while (offset < text.length && !asciiSpace(text.charCodeAt(offset))) {
        if (offset - start >= PIECEWISE_LIMITS.outputTokenBytes) return null;
        offset++;
      }
      return offset === start ? null : text.slice(start, offset);
    },
    done() {
      while (offset < text.length && asciiSpace(text.charCodeAt(offset)))
        offset++;
      return offset === text.length;
    },
  };
}

// Returns an exact safe integer: |scaled input| <= 10^12 < 2^53.
function scaled(token) {
  if (!inputNumber.test(token)) return null;
  const negative = token[0] === '-';
  const unsigned =
    token[0] === '-' || token[0] === '+' ? token.slice(1) : token;
  const dot = unsigned.indexOf('.');
  const whole = dot < 0 ? unsigned : unsigned.slice(0, dot);
  const fraction = dot < 0 ? '' : unsigned.slice(dot + 1);
  const value = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
  if (!Number.isSafeInteger(value) || value > 1_000_000_000_000) return null;
  return negative ? -value : value;
}

function rational(token) {
  if (token === null) return null;
  const match = outputNumber.exec(token);
  if (!match) return null;
  const exponent = match[3] === undefined ? 0 : Number(match[3]);
  // Test BEFORE BigInt exponentiation; even 60-digit exponent bombs stay cheap.
  if (
    !Number.isInteger(exponent) ||
    Math.abs(exponent) > PIECEWISE_LIMITS.outputExponent
  )
    return null;
  const dot = match[2].indexOf('.');
  const decimals = dot < 0 ? 0 : match[2].length - dot - 1;
  const digits =
    dot < 0 ? match[2] : match[2].slice(0, dot) + match[2].slice(dot + 1);
  let numerator = BigInt(digits);
  if (match[1] === '-') numerator = -numerator;
  const power = exponent - decimals;
  if (power >= 0) return [numerator * 10n ** BigInt(power), 1n];
  return [numerator, 10n ** BigInt(-power)];
}

export function piecewiseLinear(actual, _expected, input) {
  const limits = PIECEWISE_LIMITS;
  if (
    typeof input !== 'string' ||
    input.length > limits.inputBytes ||
    Buffer.byteLength(input, 'utf8') > limits.inputBytes
  )
    return false;
  if (
    typeof actual !== 'string' ||
    actual.length > limits.outputBytes ||
    Buffer.byteLength(actual, 'utf8') > limits.outputBytes
  )
    return false;
  const source = lineReader(input),
    output = outputReader(actual);
  const header = source.next(2, 6);
  if (
    !header ||
    !/^[1-9][0-9]*$/.test(header[0]) ||
    !/^[1-9][0-9]*$/.test(header[1])
  )
    return false;
  const n = Number(header[0]),
    q = Number(header[1]);
  if (n < 2 || n > limits.maxPoints || q < 1 || q > limits.maxQueries)
    return false;
  let unsortedX = new Float64Array(n),
    unsortedY = new Float64Array(n);
  let order = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const record = source.next(2, 15);
    if (!record) return false;
    const x = scaled(record[0]),
      y = scaled(record[1]);
    if (x === null || y === null) return false;
    unsortedX[i] = x;
    unsortedY[i] = y;
    order[i] = i;
  }
  order.sort((a, b) => unsortedX[a] - unsortedX[b]);
  const xs = new Float64Array(n),
    ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = unsortedX[order[i]];
    ys[i] = unsortedY[order[i]];
    if (i > 0 && xs[i] === xs[i - 1]) return false;
  }
  // All exact integer coordinates now have a compact sorted representation.
  unsortedX = null;
  unsortedY = null;
  order = null;
  for (let query = 0; query < q; query++) {
    const record = source.next(1, 15);
    if (!record) return false;
    const x = scaled(record[0]);
    if (x === null) return false;
    const answer = rational(output.next());
    if (!answer) return false;
    let lo = 0,
      hi = n;
    while (lo < hi) {
      const middle = (lo + hi) >>> 1;
      if (xs[middle] <= x) lo = middle + 1;
      else hi = middle;
    }
    const i = Math.max(0, Math.min(n - 2, lo - 1));
    const denominator = BigInt(xs[i + 1]) - BigInt(xs[i]);
    const numerator =
      BigInt(ys[i]) * denominator +
      (BigInt(ys[i + 1]) - BigInt(ys[i])) * (BigInt(x) - BigInt(xs[i]));
    // truth = numerator/(denominator*SCALE), candidate = answer[0]/answer[1].
    // |candidate-truth| <= 1/SCALE iff the following integer inequality holds.
    const delta = answer[0] * denominator * SCALE - numerator * answer[1];
    if ((delta < 0n ? -delta : delta) > denominator * answer[1]) return false;
  }
  return source.done() && output.done();
}
