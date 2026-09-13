/** Fixed finite-number comparison, with an optional count-prefixed vector. */
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
/** @param {string} value @param {boolean} array @returns {number[] | null} */
export function parseFiniteFloats(value, array) {
  if (typeof value !== 'string' || value.length > 1024 * 1024) return null;
  const tokens = value
    .replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '')
    .split(/[\t\n\v\f\r ]+/);
  if (array) {
    const count = tokens.shift();
    if (
      !count ||
      !/^(0|[1-9][0-9]{0,4})$/.test(count) ||
      Number(count) !== tokens.length
    )
      return null;
  } else if (tokens.length !== 1) return null;
  if (tokens.some((v) => !decimal.test(v) || !Number.isFinite(Number(v))))
    return null;
  return tokens.map(Number);
}
/** @param {string} actual @param {string} expected @param {boolean} array */
export function matchesFiniteFloats(actual, expected, array) {
  const a = parseFiniteFloats(actual, array),
    b = parseFiniteFloats(expected, array);
  return (
    a !== null &&
    b !== null &&
    a.length === b.length &&
    a.every((v, i) =>
      // -1 is the exact unknown-query sentinel in Evaluate Division.
      array && b[i] === -1
        ? v === -1
        : Math.abs(v - b[i]) <= 1e-5 * Math.max(1, Math.abs(b[i])),
    )
  );
}
