/** Fixed node adapter identities; uploaded code cannot supply adapters. */
export const SPECIAL_NODE_IDS = [
  141, 160, 142, 138, 708, 430, 116, 117, 236, 1644, 1650, 1123, 235, 285, 426,
  1110, 652, 863,
] as const;
export function validSpecialIdentity(
  value: number | undefined,
  problemId: string,
): boolean {
  return (
    value === undefined ||
    (SPECIAL_NODE_IDS.some((id) => id === value) && problemId === `lc-${value}`)
  );
}

export function validAuxiliaryIdentity(
  value: number | undefined,
  problemId: string,
): boolean {
  return (
    value === undefined ||
    ((value === 1095 || value === 759) && problemId === `lc-${value}`)
  );
}
