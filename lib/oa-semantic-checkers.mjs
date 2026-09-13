/** Fixed, non-executable OA contracts. Never accepts user-defined checker code. */
export const OA_SEMANTIC_IDS = Object.freeze({
  'oa-closest-pair': 'oa-meta-16',
  'oa-peak-index': 'oa-meta-17',
  'oa-window-averages': 'oa-meta-23',
});

function integers(text, maximum) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024) return null;
  const tokens = text.split(/[ \t\r\n\v\f]+/).filter(Boolean);
  if (
    tokens.length > maximum ||
    tokens.some((token) => !/^[+-]?\d+$/.test(token))
  )
    return null;
  const values = tokens.map(Number);
  return values.every(Number.isSafeInteger) ? values : null;
}

export function matchesOaSemantic(checker, actual, expected, input) {
  if (!Object.hasOwn(OA_SEMANTIC_IDS, checker)) return false;
  const parsed = integers(input, 100002);
  if (!parsed) return false;
  const n = parsed[0];
  if (checker === 'oa-window-averages') {
    const window = parsed[1],
      values = parsed.slice(2);
    if (
      !(
        n >= 0 &&
        n <= 50000 &&
        values.length === n &&
        window >= 1 &&
        window <= 1000000000
      ) ||
      values.some((v) => Math.abs(v) > 1000000000)
    )
      return false;
    const count = Math.max(0, n - window + 1);
    const parse = (output) => {
      if (typeof output !== 'string' || output.length > 4 * 1024 * 1024)
        return null;
      const tokens = output.split(/[ \t\r\n\v\f]+/).filter(Boolean);
      if (
        !/^(0|[1-9]\d*)$/.test(tokens[0] || '') ||
        Number(tokens[0]) !== count ||
        tokens.length !== count + 1
      )
        return null;
      const results = tokens.slice(1);
      if (
        results.some(
          (token) =>
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) ||
            !Number.isFinite(Number(token)),
        )
      )
        return null;
      return results.map(Number);
    };
    const a = parse(actual),
      b = parse(expected);
    if (!a || !b) return false;
    // Derive truth from the integer input, not a potentially malformed answer file.
    let sum = 0;
    for (let i = 0; i < Math.min(n, window); i++) sum += values[i];
    for (let i = 0; i < count; i++) {
      const answer = sum / window,
        tolerance = 1e-5 * Math.max(1, Math.abs(answer));
      if (
        Math.abs(a[i] - answer) > tolerance ||
        Math.abs(b[i] - answer) > tolerance
      )
        return false;
      if (i + window < n) sum += values[i + window] - values[i];
    }
    return true;
  }
  if (checker === 'oa-peak-index') {
    const values = parsed.slice(1);
    if (
      !(n >= 1 && n <= 1000 && values.length === n) ||
      values.some(
        (v, i) =>
          v < -2147483648 || v > 2147483647 || (i > 0 && v === values[i - 1]),
      )
    )
      return false;
    const valid = (output) => {
      const valuesOut = integers(output, 1);
      if (!valuesOut || valuesOut.length !== 1) return false;
      const index = valuesOut[0];
      return (
        index >= 0 &&
        index < n &&
        (index === 0 || values[index] > values[index - 1]) &&
        (index === n - 1 || values[index] > values[index + 1])
      );
    };
    return valid(actual) && valid(expected);
  }
  const target = parsed[1],
    values = parsed.slice(2);
  if (
    !(
      n >= 2 &&
      n <= 100000 &&
      values.length === n &&
      target >= -2147483648 &&
      target <= 2147483647
    ) ||
    values.some(
      (v, i) => v < 1 || v > 2147483647 || (i > 0 && v < values[i - 1]),
    )
  )
    return false;
  let left = 0,
    right = n - 1,
    best = Infinity;
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  while (left < right) {
    const sum = values[left] + values[right];
    best = Math.min(best, Math.abs(sum - target));
    if (sum < target) left++;
    else right--;
  }
  const valid = (output) => {
    const pair = integers(output, 2);
    if (!pair || pair.length !== 2) return false;
    const [a, b] = pair;
    return (
      counts.has(a) &&
      counts.has(b) &&
      (a !== b || counts.get(a) >= 2) &&
      Math.abs(a + b - target) === best
    );
  };
  return valid(actual) && valid(expected);
}
