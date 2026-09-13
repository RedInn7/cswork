// Fixed contracts only. Validate each answer from the input, never from a
// particular reference arrangement. All sums below remain below 2^53.
function integers(text, count) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024) return null;
  const tokens = text.trim().split(/[ \t\r\n\v\f]+/);
  if (tokens.length > count || tokens.some((v) => !/^[+-]?[0-9]+$/.test(v)))
    return null;
  const values = tokens.map(Number);
  return values.every(Number.isSafeInteger) ? values : null;
}

export function optimalLoads(actual, expected, input) {
  const data = integers(input, 100002);
  if (!data) return false;
  const [n, extra] = data;
  if (
    !(n >= 1 && n <= 100000 && extra >= 0 && extra <= 1e12) ||
    data.length !== n + 2
  )
    return false;
  const loads = data.slice(2);
  if (loads.some((v) => v < 0 || v > 1e9)) return false;
  let total = extra,
    maximum = 0;
  for (const load of loads) {
    total += load;
    maximum = Math.max(maximum, load);
  }
  const optimum = Math.max(maximum, Math.ceil(total / n));
  const valid = (output) => {
    const result = integers(output, n);
    if (!result || result.length !== n) return false;
    let sum = 0,
      largest = 0;
    for (let i = 0; i < n; i++) {
      if (result[i] < loads[i] || result[i] > optimum) return false;
      sum += result[i];
      largest = Math.max(largest, result[i]);
    }
    return sum === total && largest === optimum;
  };
  return valid(actual) && valid(expected);
}

export function optimalDistinct(actual, expected, input) {
  const data = integers(input, 50001);
  if (!data || data[0] < 1 || data[0] > 50000 || data.length !== data[0] + 1)
    return false;
  const limits = data.slice(1);
  if (limits.some((v) => v < 1 || v > 1e9)) return false;
  const descending = [...limits].sort((a, b) => b - a);
  let previous = 1e9 + 1,
    optimum = 0;
  for (const limit of descending) {
    previous = Math.min(limit, previous - 1);
    if (previous <= 0) return false; // Outside the source's feasible-input guarantee.
    optimum += previous;
  }
  const valid = (output) => {
    const result = integers(output, limits.length);
    if (!result || result.length !== limits.length) return false;
    const seen = new Set();
    let sum = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] < 1 || result[i] > limits[i] || seen.has(result[i]))
        return false;
      seen.add(result[i]);
      sum += result[i];
    }
    return sum === optimum;
  };
  return valid(actual) && valid(expected);
}
