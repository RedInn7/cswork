// Fixed IBM prediction-difference contract, with exact millionth decimals.
const numeric = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const encoder = new TextEncoder();
function bounded(text, bytes) {
  return (
    typeof text === 'string' &&
    text.length <= bytes &&
    encoder.encode(text).length <= bytes
  );
}
function parse(text) {
  let at = 0,
    nodes = 0;
  const fail = () => {
    throw new Error('Invalid JSON diff transport');
  };
  function space() {
    for (;;) {
      const code = text.charCodeAt(at);
      if (code !== 9 && code !== 10 && code !== 13 && code !== 32) return;
      at++;
    }
  }
  function string(maximum) {
    if (text[at] !== '"') return fail();
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === '\\') {
        at++;
        continue;
      }
      if (char !== '"') continue;
      const value = JSON.parse(text.slice(start, at));
      let count = 0;
      for (const point of value) {
        const code = point.codePointAt(0);
        if (++count > maximum || (code >= 0xd800 && code <= 0xdfff))
          return fail();
      }
      return value;
    }
    return fail();
  }
  function value(depth) {
    if (++nodes > 10000) return fail();
    space();
    const char = text[at];
    if (char === '"') return string(256);
    if (char === '{' || char === '[') {
      if (depth >= 20) return fail();
      at++;
      space();
      const object = char === '{',
        close = object ? '}' : ']';
      const result = object ? Object.create(null) : [];
      if (text[at] === close) {
        at++;
        return result;
      }
      for (;;) {
        space();
        if (object) {
          const key = string(64);
          if (Object.hasOwn(result, key)) return fail();
          space();
          if (text[at++] !== ':') return fail();
          result[key] = value(depth + 1);
        } else result.push(value(depth + 1));
        space();
        const delimiter = text[at++];
        if (delimiter === close) return result;
        if (delimiter !== ',') return fail();
      }
    }
    for (const [literal, result] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ]) {
      if (text.startsWith(literal, at)) {
        at += literal.length;
        return result;
      }
    }
    numeric.lastIndex = at;
    const match = numeric.exec(text);
    if (!match || match[0].length > 64) return fail();
    at = numeric.lastIndex;
    const token = match[0];
    const [mantissa, exponentText = '0'] = token.toLowerCase().split('e');
    const exponent = Number(exponentText);
    if (!Number.isInteger(exponent) || Math.abs(exponent) > 12) return fail();
    const negative = mantissa[0] === '-';
    const [whole, fraction = ''] = (
      negative ? mantissa.slice(1) : mantissa
    ).split('.');
    let scaled = BigInt(whole + fraction);
    const power = exponent - fraction.length + 6;
    if (power >= 0) scaled *= 10n ** BigInt(power);
    else {
      const divisor = 10n ** BigInt(-power);
      if (scaled % divisor !== 0n) return fail();
      scaled /= divisor;
    }
    if (scaled > 1000000000000000n) return fail();
    return negative ? -scaled : scaled;
  }
  try {
    const result = value(0);
    space();
    return at === text.length ? { value: result } : null;
  } catch {
    return null;
  }
}
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function equal(a, b) {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== typeof b ||
    typeof a !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  );
}
function compare(a, b) {
  const left = Array.from(a),
    right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = left[i].codePointAt(0) - right[i].codePointAt(0);
    if (difference) return difference;
  }
  return left.length - right.length;
}
export function jsonDiff(actual, expected, input) {
  if (!bounded(input, 4 * 1024 * 1024)) return false;
  const lines = input.split('\n');
  if (lines.length === 3 && lines[2] === '') lines.pop();
  if (lines.length !== 2) return false;
  const first = parse(lines[0]),
    second = parse(lines[1]);
  if (!first || !second || !object(first.value) || !object(second.value))
    return false;
  const left = first.value,
    right = second.value;
  if (Object.keys(left).length > 1000 || Object.keys(right).length > 1000)
    return false;
  const answer = [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter(
      (key) =>
        !Object.hasOwn(left, key) ||
        !Object.hasOwn(right, key) ||
        !equal(left[key], right[key]),
    )
    .sort(compare);
  const valid = (output) => {
    if (!bounded(output, 4 * 1024 * 1024)) return false;
    const parsed = parse(output);
    return (
      parsed !== null &&
      Array.isArray(parsed.value) &&
      parsed.value.length === answer.length &&
      parsed.value.every(
        (key, index) => typeof key === 'string' && key === answer[index],
      )
    );
  };
  return valid(actual) && valid(expected);
}
