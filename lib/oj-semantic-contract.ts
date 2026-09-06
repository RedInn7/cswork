import { SEMANTIC_IDS, type SemanticId } from './oj-semantic-checkers';
export type SemanticChecker = `semantic-lc-${SemanticId}`;
export const SEMANTIC_CHECKERS = SEMANTIC_IDS.map(
  (id) => `semantic-lc-${id}` as SemanticChecker,
);
export const SEMANTIC_RESULT_KINDS: Record<SemanticId, string> = {
  5: 'string',
  1044: 'string',
  1092: 'string',
  1249: 'string',
  767: 'string',
  1405: 'string',
  269: 'string',
  162: 'integer',
  324: 'integer-array',
  870: 'integer-array',
  368: 'integer-array',
  210: 'integer-array',
  1171: 'integer-array',
  373: 'integer-rows',
  2392: 'integer-rows',
  701: 'nullable-integer-array',
  108: 'nullable-integer-array',
  450: 'nullable-integer-array',
  109: 'nullable-integer-array',
};
export function semanticCheckerId(checker: string): SemanticId | null {
  const found = SEMANTIC_IDS.find((id) => checker === `semantic-lc-${id}`);
  return found ?? null;
}
