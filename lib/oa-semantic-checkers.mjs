import { optimalLoads, optimalDistinct } from './oa-allocation-checkers.mjs';
import { dictionaryPath } from './oa-dictionary-checker.mjs';
import {
  quadraticMinimum,
  compatibleGroups,
  footballTopTwo,
  regionalMaxima,
} from './oa-uber-semantic-checkers.mjs';
/** Fixed, non-executable OA contracts. Never accepts user-defined checker code. */
export const OA_SEMANTIC_IDS = Object.freeze({
  'oa-closest-pair': 'oa-meta-16',
  'oa-peak-index': 'oa-meta-17',
  'oa-window-averages': 'oa-meta-23',
  'oa-balanced-circle': 'oa-microsoft-15',
  'oa-magic-square': 'oa-google-17',
  'oa-newspaper': 'oa-uber-6',
  'oa-quadratic-minimum': 'oa-uber-25',
  'oa-compatible-groups': 'oa-uber-34',
  'oa-football-top-two': 'oa-uber-38',
  'oa-regional-maxima': 'oa-uber-57',
  'oa-optimal-loads': 'oa-amazon-136',
  'oa-optimal-distinct': 'oa-microsoft-63',
  'oa-dictionary-path': 'oa-nvidia-7',
});

// The source specifies spacing but no optimal/greedy line-breaking objective.
// Accept every partition satisfying those rules, not just the reference layout.
function newspaper(actual, expected, input) {
  if (typeof input !== 'string' || input.length > 16384) return false;
  const tokens = input.split(/[ \t\r\n\v\f]+/).filter(Boolean);
  let cursor = 0;
  const number = () => {
    const token = tokens[cursor++];
    return /^[0-9]+$/.test(token || '') ? Number(token) : NaN;
  };
  const width = number(),
    count = number();
  if (!(width >= 5 && width <= 50 && count >= 1 && count <= 20)) return false;
  const paragraphs = [];
  let totalWords = 0;
  for (let i = 0; i < count; i++) {
    const size = number();
    if (!(size >= 1 && size <= 10)) return false;
    const words = tokens.slice(cursor, cursor + size);
    if (
      words.length !== size ||
      words.some((word) => !/^[\x21-\x7e]+$/.test(word) || word.length > width)
    )
      return false;
    paragraphs.push(words);
    totalWords += size;
    cursor += size;
  }
  if (cursor !== tokens.length) return false;
  const border = '*'.repeat(width + 4);
  const valid = (output) => {
    if (typeof output !== 'string' || output.length > 32768) return false;
    const lines = output.replace(/\r\n/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (
      lines.length < 3 ||
      lines.length > totalWords + 2 ||
      lines[0] !== border ||
      lines.at(-1) !== border
    )
      return false;
    let paragraph = 0,
      offset = 0;
    for (const line of lines.slice(1, -1)) {
      if (
        paragraph >= count ||
        line.length !== width + 4 ||
        !line.startsWith('* ') ||
        !line.endsWith(' *')
      )
        return false;
      const content = line.slice(2, -2);
      const words = content.replace(/^ +| +$/g, '').split(/ +/);
      if (
        offset + words.length > paragraphs[paragraph].length ||
        words.some((word, i) => word !== paragraphs[paragraph][offset + i])
      )
        return false;
      offset += words.length;
      const last = offset === paragraphs[paragraph].length;
      const letters = words.reduce((sum, word) => sum + word.length, 0);
      if (letters + words.length - 1 > width) return false;
      let required;
      if (last || words.length === 1) {
        const joined = words.join(' '),
          padding = width - joined.length;
        required =
          ' '.repeat(Math.floor(padding / 2)) +
          joined +
          ' '.repeat(Math.ceil(padding / 2));
      } else {
        const gaps = words.length - 1,
          spaces = width - letters;
        required = words
          .map(
            (word, i) =>
              word +
              (i === gaps
                ? ''
                : ' '.repeat(
                    Math.floor(spaces / gaps) + (i < spaces % gaps ? 1 : 0),
                  )),
          )
          .join('');
      }
      if (content !== required) return false;
      if (last) {
        paragraph++;
        offset = 0;
      }
    }
    return paragraph === count && offset === 0;
  };
  return valid(actual) && valid(expected);
}

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
  if (checker === 'oa-dictionary-path')
    return dictionaryPath(actual, expected, input);
  if (checker === 'oa-optimal-loads')
    return optimalLoads(actual, expected, input);
  if (checker === 'oa-optimal-distinct')
    return optimalDistinct(actual, expected, input);
  if (!Object.hasOwn(OA_SEMANTIC_IDS, checker)) return false;
  if (checker === 'oa-quadratic-minimum')
    return quadraticMinimum(actual, expected, input);
  if (checker === 'oa-compatible-groups')
    return compatibleGroups(actual, expected, input);
  if (checker === 'oa-football-top-two')
    return footballTopTwo(actual, expected, input);
  if (checker === 'oa-regional-maxima')
    return regionalMaxima(actual, expected, input);
  if (checker === 'oa-newspaper') return newspaper(actual, expected, input);
  const parsed = integers(
    input,
    checker === 'oa-balanced-circle' ? 200001 : 100002,
  );
  if (!parsed) return false;
  const n = parsed[0];
  if (checker === 'oa-magic-square') {
    if (!(n >= 1 && n <= 50 && parsed.length === 1)) return false;
    if (n === 2) {
      const impossible = (output) =>
        typeof output === 'string' &&
        output.length <= 1024 &&
        output.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '') === 'null';
      return impossible(actual) && impossible(expected);
    }
    const size = n * n,
      sum = (n * (size + 1)) / 2;
    const valid = (output) => {
      const cells = integers(output, size);
      if (
        !cells ||
        cells.length !== size ||
        cells.some((value) => value < 1 || value > size) ||
        new Set(cells).size !== size
      )
        return false;
      let firstDiagonal = 0,
        secondDiagonal = 0;
      for (let row = 0; row < n; row++) {
        let rowSum = 0,
          columnSum = 0;
        for (let column = 0; column < n; column++) {
          rowSum += cells[row * n + column];
          columnSum += cells[column * n + row];
        }
        if (rowSum !== sum || columnSum !== sum) return false;
        firstDiagonal += cells[row * n + row];
        secondDiagonal += cells[row * n + n - 1 - row];
      }
      return firstDiagonal === sum && secondDiagonal === sum;
    };
    return valid(actual) && valid(expected);
  }
  if (checker === 'oa-balanced-circle') {
    const values = parsed.slice(1);
    if (
      !(n >= 1 && n <= 200000 && values.length === n) ||
      values.some((value) => value < 1 || value > 200000)
    )
      return false;
    const counts = new Int32Array(200001);
    let maximum = 0;
    for (const value of values) {
      counts[value]++;
      maximum = Math.max(maximum, value);
    }
    // Any interior height is crossed on the outward AND return journey, so
    // it needs two people. Singleton heights can only be interval endpoints.
    let current = 0,
      best = 0;
    for (let height = 1; height <= maximum; height++) {
      if (counts[height] === 0) {
        current = 0;
        continue;
      }
      current += counts[height];
      best = Math.max(best, current);
      if (counts[height] === 1) current = 1;
    }
    const valid = (output) => {
      const circle = integers(output, n + 1);
      if (!circle || circle[0] !== best || circle.length !== best + 1)
        return false;
      const remaining = counts.slice();
      for (let index = 1; index <= best; index++) {
        const height = circle[index],
          next = circle[index === best ? 1 : index + 1];
        if (
          height < 1 ||
          height > maximum ||
          --remaining[height] < 0 ||
          Math.abs(height - next) > 1
        )
          return false;
      }
      return true;
    };
    return valid(actual) && valid(expected);
  }
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
