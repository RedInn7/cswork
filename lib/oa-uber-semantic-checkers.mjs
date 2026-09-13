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

export function regionalMaxima(actual, expected, input) {
  const values = numbers(input, 10002, 128 * 1024);
  if (!values) return false;
  const [rows, columns] = values;
  if (
    !(rows >= 1 && rows <= 100 && columns >= 1 && columns <= 100) ||
    values.length !== 2 + rows * columns
  )
    return false;
  const grid = values.slice(2);
  if (grid.some((v) => v < 0 || v > 1000000000)) return false;
  const order = grid
    .flatMap((v, index) => (v ? [index] : []))
    .sort((a, b) => grid[b] - grid[a]);
  // Offline descending sweep: the tree contains only strictly greater cells.
  // Query the original-radius rectangle and remove original corners, never
  // the corners produced by clipping the rectangle to the grid boundary.
  const width = columns + 1;
  const tree = new Int32Array((rows + 1) * width);
  const prefix = (row, column) => {
    let count = 0;
    for (let r = row; r > 0; r -= r & -r)
      for (let c = column; c > 0; c -= c & -c) count += tree[r * width + c];
    return count;
  };
  const required = new Set();
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    const radius = grid[order[start]];
    while (end < order.length && grid[order[end]] === radius) end++;
    for (let at = start; at < end; at++) {
      const id = order[at],
        row = Math.floor(id / columns),
        column = id % columns;
      const top = Math.max(0, row - radius),
        bottom = Math.min(rows, row + radius + 1);
      const left = Math.max(0, column - radius),
        right = Math.min(columns, column + radius + 1);
      let greater =
        prefix(bottom, right) -
        prefix(top, right) -
        prefix(bottom, left) +
        prefix(top, left);
      for (const r of [row - radius, row + radius])
        for (const c of [column - radius, column + radius])
          if (
            r >= 0 &&
            r < rows &&
            c >= 0 &&
            c < columns &&
            grid[r * columns + c] > radius
          )
            greater--;
      if (greater === 0) required.add(id);
    }
    // Insert a whole equal-valued group after querying, so equal neighbors are
    // accepted as maxima instead of accidentally requiring a strict maximum.
    for (let at = start; at < end; at++) {
      const id = order[at];
      for (let r = Math.floor(id / columns) + 1; r <= rows; r += r & -r)
        for (let c = (id % columns) + 1; c <= columns; c += c & -c)
          tree[r * width + c]++;
    }
    start = end;
  }
  const valid = (output) => {
    const result = numbers(output, 20001, 128 * 1024);
    if (
      !result ||
      result[0] !== required.size ||
      result.length !== 1 + required.size * 2
    )
      return false;
    const seen = new Set();
    for (let i = 1; i < result.length; i += 2) {
      const row = result[i],
        column = result[i + 1];
      if (row < 0 || row >= rows || column < 0 || column >= columns)
        return false;
      const id = row * columns + column;
      if (!required.has(id) || seen.has(id)) return false;
      seen.add(id);
    }
    return true;
  };
  return valid(actual) && valid(expected);
}
