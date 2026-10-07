const MAX_N = 200_000;
const MAX_INPUT = 32 * 1024 * 1024;
const MAX_OUTPUT = 8 * 1024 * 1024;

// Streaming numeric tokens avoid allocating millions of strings on hostile input.
function integers(text, horizontal = false) {
  let offset = 0;
  const space = (c) =>
    c === 32 || c === 9 || (!horizontal && c >= 10 && c <= 13);
  return {
    next() {
      while (offset < text.length && space(text.charCodeAt(offset))) offset++;
      if (offset === text.length) return null;
      let sign = 1;
      if (text[offset] === '-' || text[offset] === '+') {
        if (text[offset] === '-') sign = -1;
        offset++;
      }
      const start = offset;
      let value = 0;
      while (offset < text.length) {
        const digit = text.charCodeAt(offset) - 48;
        if (digit < 0 || digit > 9) break;
        value = value * 10 + digit;
        if (!Number.isSafeInteger(value)) throw new Error('unsafe integer');
        offset++;
      }
      if (
        offset === start ||
        (offset < text.length && !space(text.charCodeAt(offset)))
      ) {
        throw new Error('invalid integer');
      }
      return sign * value;
    },
  };
}

function scalar(line) {
  const tokens = integers(line, true);
  const value = tokens.next();
  if (value === null || tokens.next() !== null)
    throw new Error('expected scalar');
  return value;
}

/** Validate an optimal nonempty simple tree path using its node-ID witness. */
export function treeMaxPath(actual, _expected, input) {
  try {
    if (
      typeof input !== 'string' ||
      typeof actual !== 'string' ||
      input.length > MAX_INPUT ||
      actual.length > MAX_OUTPUT
    )
      return false;
    const tokens = integers(input);
    const n = tokens.next();
    if (n === null || n < 1 || n > MAX_N) return false;
    const values = new Float64Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const value = tokens.next();
      if (value === null || Math.abs(value) > 1e9) return false;
      values[i] = value;
      total += value;
    }
    const left = new Int32Array(n);
    const right = new Int32Array(n);
    const parent = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      for (const children of [left, right]) {
        const child = tokens.next();
        if (child === null || child < -1 || child >= n) return false;
        children[i] = child;
        if (child !== -1) {
          if (child === 0 || child === i || parent[child] !== -1) return false;
          parent[child] = i;
        }
      }
    }
    if (tokens.next() !== null) return false;
    // A root-first traversal followed in reverse is an iterative postorder.
    const order = new Int32Array(n);
    let count = 1;
    for (let i = 0; i < count; i++) {
      const node = order[i];
      for (const child of [left[node], right[node]]) {
        if (child !== -1) {
          if (count >= n) return false;
          order[count++] = child;
        }
      }
    }
    if (count !== n) return false;
    const gain = new Float64Array(n);
    let optimum = -Infinity;
    for (let i = n - 1; i >= 0; i--) {
      const node = order[i];
      const a = left[node] === -1 ? 0 : Math.max(0, gain[left[node]]);
      const b = right[node] === -1 ? 0 : Math.max(0, gain[right[node]]);
      gain[node] = values[node] + Math.max(a, b);
      optimum = Math.max(optimum, values[node] + a + b);
    }
    let normalized = actual.replace(/\r\n/g, '\n');
    if (normalized.endsWith('\n')) normalized = normalized.slice(0, -1);
    const lines = normalized.split('\n', 5);
    if (
      lines.length !== 4 ||
      scalar(lines[0]) !== total ||
      scalar(lines[1]) !== optimum
    ) {
      return false;
    }
    const pathValues = integers(lines[2], true);
    const ids = integers(lines[3], true);
    const visited = new Uint8Array(n);
    let previous = -1;
    let pathSum = 0;
    let pathLength = 0;
    for (;;) {
      const id = ids.next();
      const value = pathValues.next();
      if (id === null || value === null) {
        return (
          id === null && value === null && pathLength > 0 && pathSum === optimum
        );
      }
      if (
        ++pathLength > n ||
        id < 0 ||
        id >= n ||
        visited[id] ||
        values[id] !== value
      ) {
        return false;
      }
      if (previous !== -1 && parent[id] !== previous && parent[previous] !== id)
        return false;
      visited[id] = 1;
      pathSum += value;
      previous = id;
    }
  } catch {
    return false;
  }
}
