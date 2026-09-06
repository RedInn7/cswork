/** Fixed JSON-line checkers with problem-specific ordering and multiplicity. */
export const STRING_STRUCTURE_IDS = [
  49, 249, 68, 257, 721, 131, 51, 130, 37,
] as const;
export type StringStructureId = (typeof STRING_STRUCTURE_IDS)[number];
const FLAT = new Set<number>([68, 257]);
const LIMIT = 64 * 1024 * 1024;
function validString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.includes('\0') &&
    !/[\uD800-\uDFFF]/u.test(value)
  );
}
export function validStringStructure(id: number, value: unknown): boolean {
  if (
    !(STRING_STRUCTURE_IDS as readonly number[]).includes(id) ||
    !Array.isArray(value) ||
    value.length > 1_000_000
  )
    return false;
  if (FLAT.has(id)) return value.every(validString);
  let total = 0;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      (total += row.length) <= 16_000_000 &&
      row.every(validString),
  );
}
export function parseStringStructure(
  id: number,
  output: string,
): string[] | string[][] | null {
  if (new TextEncoder().encode(output).byteLength > LIMIT) return null;
  const normalized = output.replace(/\r\n/g, '\n');
  if (!normalized.endsWith('\n') || /[\r\n]/.test(normalized.slice(0, -1)))
    return null;
  try {
    const value: unknown = JSON.parse(normalized.slice(0, -1));
    return validStringStructure(id, value)
      ? (value as string[] | string[][])
      : null;
  } catch {
    return null;
  }
}
function canonical(id: number, value: string[] | string[][]): string {
  if (id === 68 || id === 130 || id === 37) return JSON.stringify(value);
  if (id === 257) return JSON.stringify([...(value as string[])].sort());
  const groups = (value as string[][]).map((row) =>
    JSON.stringify(id === 49 || id === 249 ? [...row].sort() : row),
  );
  return JSON.stringify(groups.sort());
}
export function matchesStringStructure(
  id: number,
  actual: string,
  expected: string,
): boolean {
  const a = parseStringStructure(id, actual),
    b = parseStringStructure(id, expected);
  return a !== null && b !== null && canonical(id, a) === canonical(id, b);
}
