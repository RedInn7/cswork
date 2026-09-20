/** Fixed IPv4 minimum exact-cover contract. No signed 32-bit arithmetic. */
const SPACE = 2 ** 32;
const decimal = /^(?:0|[1-9][0-9]*)$/;
function address(text) {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (part.length > 3 || !decimal.test(part) || Number(part) > 255)
      return null;
    value = value * 256 + Number(part);
  }
  return value;
}
function tokens(text, limit) {
  if (typeof text !== 'string' || text.length > limit) return null;
  return text.split(/[ \t\r\n\v\f]+/).filter(Boolean);
}

export function ipv4Cidr(actual, expected, input) {
  const parsed = tokens(input, 128);
  if (!parsed || parsed.length !== 2) return false;
  const start = address(parsed[0]);
  if (start === null || !decimal.test(parsed[1])) return false;
  const count = Number(parsed[1]);
  if (!Number.isSafeInteger(count) || count < 1 || start + count > SPACE)
    return false;
  const end = start + count;
  // Maximal aligned dyadic blocks are the unique minimal partition: splitting
  // one uses more blocks, and merging across a maximal boundary is impossible.
  let position = start,
    minimum = 0;
  while (position < end) {
    let size = 1;
    while (
      size < SPACE &&
      position % (size * 2) === 0 &&
      position + size * 2 <= end
    )
      size *= 2;
    position += size;
    minimum++;
  }
  const valid = (output) => {
    const parts = tokens(output, 4096);
    if (
      !parts ||
      !decimal.test(parts[0] || '') ||
      Number(parts[0]) !== minimum ||
      parts.length !== minimum + 1
    )
      return false;
    const intervals = [];
    for (const part of parts.slice(1)) {
      const pieces = part.split('/');
      if (
        pieces.length !== 2 ||
        !decimal.test(pieces[1]) ||
        pieces[1].length > 2 ||
        Number(pieces[1]) > 32
      )
        return false;
      const low = address(pieces[0]);
      const size = 2 ** (32 - Number(pieces[1]));
      if (low === null || low % size !== 0 || low < start || low + size > end)
        return false;
      intervals.push([low, low + size]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let next = start;
    for (const [low, high] of intervals) {
      if (low !== next) return false;
      next = high;
    }
    return next === end;
  };
  // Expected data is validated independently too, not trusted as a gold string.
  return valid(actual) && valid(expected);
}
