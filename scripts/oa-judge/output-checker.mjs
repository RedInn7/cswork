/** Mirrors the production checkers accepted by the OA authoring pipeline. */
import { matchesFiniteFloats } from '../../lib/oj-finite-floats.mjs';
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../../lib/oa-semantic-checkers.mjs';

export function matchesOaOutput(actual, expected, checker, input) {
  if (Object.hasOwn(OA_SEMANTIC_IDS, checker))
    return matchesOaSemantic(checker, actual, expected, input);
  if (checker === 'float' || checker === 'float-array')
    return matchesFiniteFloats(actual, expected, checker === 'float-array');
  if (checker === 'exact')
    return actual.replace(/\r\n/g, '\n') === expected.replace(/\r\n/g, '\n');
  if (checker !== 'tokens')
    throw new Error('Unsupported OA checker: ' + checker);
  const tokens = (text) => text.split(/[ \t\r\n\v\f]+/).filter(Boolean);
  const a = tokens(actual),
    b = tokens(expected);
  return a.length === b.length && a.every((token, i) => token === b[i]);
}
