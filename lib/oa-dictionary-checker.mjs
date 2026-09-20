// Bounded JSON parser: unlike JSON.parse, duplicate object keys are rejected.
// The grammar is the site's explicit dictionary-path transport, not executable code.
const keyPattern = /^[a-z][a-z0-9_]{0,31}$/;
const numericToken = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
function bounded(text, bytes) {
  return (
    typeof text === 'string' &&
    text.length <= bytes &&
    new TextEncoder().encode(text).length <= bytes
  );
}
function parseJson(text, bytes) {
  if (!bounded(text, bytes)) return null;
  let at = 0,
    nodes = 0,
    keys = 0;
  const fail = () => {
    throw new Error('Invalid dictionary JSON');
  };
  const space = () => {
    for (;;) {
      const ch = text.charCodeAt(at);
      if (ch !== 9 && ch !== 10 && ch !== 13 && ch !== 32) return;
      at++;
    }
  };
  const string = () => {
    if (text[at] !== '"') return fail();
    const start = at++;
    while (at < text.length) {
      const ch = text[at++];
      if (ch === '\\') {
        at++;
        continue;
      }
      if (ch !== '"') continue;
      const result = JSON.parse(text.slice(start, at));
      let count = 0;
      for (const character of result) {
        const point = character.codePointAt(0);
        if ((point >= 0xd800 && point <= 0xdfff) || ++count > 1000)
          return fail();
      }
      return result;
    }
    return fail();
  };
  const value = (depth) => {
    if (++nodes > 5000) return fail();
    space();
    const ch = text[at];
    if (ch === '"') return string();
    if (ch === '{' || ch === '[') {
      if (depth >= 30) return fail();
      at++;
      space();
      const object = ch === '{',
        close = object ? '}' : ']';
      const result = object ? Object.create(null) : [];
      if (text[at] === close) {
        at++;
        return result;
      }
      for (;;) {
        space();
        if (object) {
          const key = string();
          if (
            !keyPattern.test(key) ||
            Object.hasOwn(result, key) ||
            ++keys > 500
          )
            return fail();
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
    ])
      if (text.startsWith(literal, at)) {
        at += literal.length;
        return result;
      }
    numericToken.lastIndex = at;
    const match = numericToken.exec(text);
    if (!match) return fail();
    at = numericToken.lastIndex;
    const result = Number(match[0]);
    if (!Number.isInteger(result) || Math.abs(result) > 1e9) return fail();
    return result;
  };
  try {
    const result = value(0);
    space();
    return at === text.length ? { value: result, keys } : null;
  } catch {
    return null;
  }
}
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function equal(a, b) {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== typeof b ||
    typeof a !== 'object'
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a),
    bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  );
}
export function dictionaryPath(actual, expected, input) {
  if (!bounded(input, 4 * 1024 * 1024)) return false;
  const newline = input.indexOf('\n');
  if (newline < 0) return false;
  const parsed = parseJson(input.slice(0, newline), 4 * 1024 * 1024);
  const pathLines = input.slice(newline + 1).split('\n');
  if (pathLines.length > 2 || (pathLines.length === 2 && pathLines[1] !== ''))
    return false;
  const path = pathLines[0]
    .replace(/\r$/, '')
    .replace(/^[ \t]+|[ \t]+$/g, '')
    .split('.');
  if (
    !parsed ||
    !isObject(parsed.value) ||
    parsed.keys < 1 ||
    path.length > 31 ||
    path.some((key) => !keyPattern.test(key))
  )
    return false;
  let answer = parsed.value;
  for (const key of path) {
    if (!isObject(answer) || !Object.hasOwn(answer, key)) {
      answer = null;
      break;
    }
    answer = answer[key];
  }
  // Escaped Unicode can require up to 3x the UTF-8 input size.
  const a = parseJson(actual, 16 * 1024 * 1024),
    b = parseJson(expected, 16 * 1024 * 1024);
  return (
    a !== null && b !== null && equal(a.value, answer) && equal(b.value, answer)
  );
}
