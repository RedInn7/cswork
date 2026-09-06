import {
  STRING_STRUCTURE_IDS,
  type StringStructureId,
} from './oj-string-structures';
export type StringStructureChecker = `strings-lc-${StringStructureId}`;
export const STRING_STRUCTURE_CHECKERS = STRING_STRUCTURE_IDS.map(
  (id) => `strings-lc-${id}` as StringStructureChecker,
);
export function stringStructureCheckerId(
  checker: string,
): StringStructureId | null {
  return (
    STRING_STRUCTURE_IDS.find((id) => checker === `strings-lc-${id}`) ?? null
  );
}
export function stringStructureKind(id: number): string {
  return id === 68 || id === 257 ? 'json-string-array' : 'json-string-rows';
}
