/** Mirrors the two production checkers accepted by the OA authoring pipeline. */
export function matchesOaOutput(actual, expected, checker) {
  if (checker === 'exact')
    return actual.replace(/\r\n/g, '\n') === expected.replace(/\r\n/g, '\n');
  if (checker !== 'tokens')
    throw new Error('Unsupported OA checker: ' + checker);
  const tokens = (text) => text.split(/[ \t\r\n\v\f]+/).filter(Boolean);
  const a = tokens(actual),
    b = tokens(expected);
  return a.length === b.length && a.every((token, i) => token === b[i]);
}
