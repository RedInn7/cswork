// Non-executable contracts: derive validity from the question input, not the reference layout.
function numbers(text, count, bytes = 8 * 1024 * 1024) {
  if (typeof text !== 'string' || text.length > bytes) return null;
  const tokens = text.trim().split(/\s+/);
  if (tokens.length > count || tokens.some((v) => !/^[+-]?\d+$/.test(v)))
    return null;
  const result = tokens.map(Number);
  return result.every(Number.isSafeInteger) ? result : null;
}

export function quadraticMinimum(actual, expected, input) {
  const v = numbers(input, 5001, 128 * 1024);
  if (!v || v[0] < 1 || v[0] > 1000 || v.length !== 1 + v[0] * 5) return false;
  const answers = [];
  for (let i = 1; i < v.length; i += 5) {
    const [a, b, c, left, right] = v.slice(i, i + 5);
    if (
      a < 1 ||
      a > 1000000 ||
      [b, c, left, right].some((x) => Math.abs(x) > 1000000) ||
      left > right
    )
      return false;
    const denominator = 2n * BigInt(a);
    const numerator = BigInt(-b);
    answers.push([
      numerator < BigInt(left) * denominator
        ? BigInt(left) * denominator
        : numerator > BigInt(right) * denominator
          ? BigInt(right) * denominator
          : numerator,
      denominator,
    ]);
  }
  const valid = (output) => {
    if (typeof output !== 'string' || output.length > 32768) return false;
    const tokens = output.trim().split(/\s+/);
    if (tokens.length !== answers.length) return false;
    return tokens.every((token, i) => {
      if (!/^[+-]?\d{1,7}\.\d{6}$/.test(token)) return false;
      const scaled = BigInt(token.replace('.', ''));
      const [numerator, denominator] = answers[i];
      const error = scaled * denominator - numerator * 1000000n;
      // Exact half-micro-unit tolerance; either tie-rounding convention is valid.
      return (error < 0n ? -error : error) * 2n <= denominator;
    });
  };
  return valid(actual) && valid(expected);
}

export function footballTopTwo(actual, expected, input) {
  const v = numbers(input, 400001);
  if (
    !v ||
    v[0] < 2 ||
    v[0] > 100000 ||
    v.length !== 1 + 4 * v[0] ||
    v.slice(1).some((x) => x < 0 || x > 1000000000)
  )
    return false;
  const n = v[0];
  const compare = (a, b) =>
    3 * v[1 + a] + v[1 + n + a] - (3 * v[1 + b] + v[1 + n + b]) ||
    v[1 + 2 * n + a] - v[1 + 3 * n + a] - (v[1 + 2 * n + b] - v[1 + 3 * n + b]);
  const valid = (output) => {
    const pair = numbers(output, 2, 128);
    if (
      !pair ||
      pair.length !== 2 ||
      pair[0] === pair[1] ||
      pair.some((x) => x < 0 || x >= n) ||
      compare(pair[0], pair[1]) < 0
    )
      return false;
    for (let i = 0; i < n; i++)
      if (i !== pair[0] && compare(i, pair[1]) > 0) return false;
    return true;
  };
  return valid(actual) && valid(expected);
}

export function compatibleGroups(actual, expected, input) {
  if (typeof input !== 'string' || input.length > 2 * 1024 * 1024) return false;
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (!/^\d+$/.test(lines[0])) return false;
  const n = Number(lines[0]);
  if (n < 1 || n > 10000 || lines.length !== 1 + 2 * n) return false;
  const rides = new Map(),
    locations = new Map();
  for (let i = 0; i < n; i++) {
    const match = /^(\d{1,10}) ([0-2]\d):([0-5]\d)$/.exec(lines[1 + 2 * i]);
    const location = lines[2 + 2 * i];
    if (
      !match ||
      Number(match[2]) > 23 ||
      !/^[\x20-\x7e]{1,100}$/.test(location)
    )
      return false;
    const id = Number(match[1]),
      time = Number(match[2]) * 60 + Number(match[3]);
    if (id < 1 || id > 1000000000 || rides.has(id)) return false;
    rides.set(id, { location, time, index: i });
    if (!locations.has(location)) locations.set(location, []);
    locations.get(location).push(time);
  }
  let optimum = 0;
  for (const times of locations.values()) {
    times.sort((a, b) => a - b);
    for (let i = 0; i < times.length;) {
      const start = i++;
      while (i < times.length && i - start < 3 && times[i] - times[start] <= 10)
        i++;
      optimum++;
    }
  }
  const valid = (output) => {
    const values = numbers(output, 1 + 2 * n, 256 * 1024);
    if (!values || values[0] !== optimum) return false;
    const used = new Set();
    let cursor = 1,
      previousIndex = -1;
    for (let group = 0; group < optimum; group++) {
      const size = values[cursor++];
      if (!(size >= 1 && size <= 3)) return false;
      let previousId = -1,
        location,
        minTime = Infinity,
        maxTime = -Infinity,
        firstIndex = Infinity;
      for (let j = 0; j < size; j++) {
        const id = values[cursor++],
          ride = rides.get(id);
        if (
          !ride ||
          used.has(id) ||
          id <= previousId ||
          (j && location !== ride.location)
        )
          return false;
        used.add(id);
        previousId = id;
        location = ride.location;
        minTime = Math.min(minTime, ride.time);
        maxTime = Math.max(maxTime, ride.time);
        firstIndex = Math.min(firstIndex, ride.index);
      }
      if (maxTime - minTime > 10 || firstIndex <= previousIndex) return false;
      previousIndex = firstIndex;
    }
    return cursor === values.length && used.size === n;
  };
  return valid(actual) && valid(expected);
}
