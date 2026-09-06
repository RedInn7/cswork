import { COMPLEX_DESIGN_IDS } from './oj-complex-design-checkers';
export type ComplexDesignChecker =
  `design-lc-${(typeof COMPLEX_DESIGN_IDS)[number]}`;
export const COMPLEX_DESIGN_CHECKERS = COMPLEX_DESIGN_IDS.map(
  (id) => `design-lc-${id}` as ComplexDesignChecker,
);
export function complexDesignCheckerId(checker: string): number | null {
  return COMPLEX_DESIGN_IDS.find((id) => checker === `design-lc-${id}`) ?? null;
}
