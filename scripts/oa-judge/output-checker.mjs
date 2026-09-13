/** Mirrors the production checkers accepted by the OA authoring pipeline. */
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../../lib/oa-semantic-checkers.mjs';

export function matchesOaOutput(actual, expected, checker, input) {
  if (Object.hasOwn(OA_SEMANTIC_IDS, checker))
    return matchesOaSemantic(checker, actual, expected, input);
  if (checker === 'float') {
    const parse = (value) => {
      if (typeof value !== 'string' || value.length > 1024 * 1024) return null;
      const token = value.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '');
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))
        return null;
      const result = Number(token);
      return Number.isFinite(result) ? result : null;
    };
    const a = parse(actual),
      b = parse(expected);
    return (
      a !== null &&
      b !== null &&
      Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b))
    );
  }
  if (checker === 'exact')
    return actual.replace(/\r\n/g, '\n') === expected.replace(/\r\n/g, '\n');
  if (checker !== 'tokens')
    throw new Error('Unsupported OA checker: ' + checker);
  const tokens = (text) => text.split(/[ \t\r\n\v\f]+/).filter(Boolean);
  const a = tokens(actual),
    b = tokens(expected);
  return a.length === b.length && a.every((token, i) => token === b[i]);
}
