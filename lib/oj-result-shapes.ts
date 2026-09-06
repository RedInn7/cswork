const count = /^(0|[1-9][0-9]{0,6})$/;
const integer = /^[+-]?[0-9]+$/;
const limit = 1_000_000;
export const MAX_INTEGER_ROWS = 4_000_000;
export const MAX_INTEGER_ROW_VALUES = 16_000_000;
export const MAX_STRUCTURED_OUTPUT_BYTES = 64 * 1024 * 1024;
/** ASCII whitespace only, matching the historical tokens checker. */
export function* asciiTokens(value: string): Generator<string> {
  const pattern = /[^\t\n\v\f\r ]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) yield match[0];
}

export function validStructuredResult(kind: string, value: unknown): boolean {
  if (
    !Array.isArray(value) ||
    value.length > (kind === 'integer-rows' ? MAX_INTEGER_ROWS : limit)
  )
    return false;
  if (kind === 'nullable-integer-array')
    return value.every((v) => v === null || typeof v === 'bigint');
  if (kind !== 'integer-rows') return false;
  let total = 0;
  return value.every((row) => {
    if (!Array.isArray(row)) return false;
    total += row.length;
    return (
      total <= MAX_INTEGER_ROW_VALUES && row.every((v) => typeof v === 'bigint')
    );
  });
}

function readRows(
  value: string,
  visit?: (tokens: Iterator<string>, length: number) => boolean,
): boolean {
  if (new TextEncoder().encode(value).byteLength > MAX_STRUCTURED_OUTPUT_BYTES)
    return false;
  const tokens = asciiTokens(value);
  const header = tokens.next().value;
  if (!header || !count.test(header) || Number(header) > MAX_INTEGER_ROWS)
    return false;
  let total = 0;
  for (let row = 0; row < Number(header); row++) {
    const token = tokens.next().value;
    if (!token || !/^(0|[1-9][0-9]{0,7})$/.test(token)) return false;
    const length = Number(token);
    total += length;
    if (total > MAX_INTEGER_ROW_VALUES) return false;
    if (visit) {
      if (!visit(tokens, length)) return false;
    } else
      for (let col = 0; col < length; col++) {
        const value = tokens.next().value;
        if (value === undefined || !integer.test(value)) return false;
      }
  }
  return tokens.next().done === true;
}

export function validStructuredOutput(kind: string, value: string): boolean {
  if (kind === 'integer-rows') return readRows(value);
  if (
    kind !== 'nullable-integer-array' ||
    new TextEncoder().encode(value).byteLength > MAX_STRUCTURED_OUTPUT_BYTES
  )
    return false;
  const tokens = asciiTokens(value);
  const header = tokens.next().value;
  if (!header || !count.test(header) || Number(header) > limit) return false;
  for (let i = 0; i < Number(header); i++) {
    const token = tokens.next().value;
    if (token === undefined || (token !== 'null' && !integer.test(token)))
      return false;
  }
  return tokens.next().done === true;
}

export type IntegerRowChecker =
  | 'int-row-set'
  | 'int-bag-row-set'
  | 'int-row-multiset';

/** Preserve row boundaries; only the selected fixed rule changes ordering/counts. */
export function parseIntegerRowCollection(
  output: string,
  checker: IntegerRowChecker,
): ReadonlyMap<string, number> | null {
  if (!['int-row-set', 'int-bag-row-set', 'int-row-multiset'].includes(checker))
    return null;
  const rows = new Map<string, number>();
  const valid = readRows(output, (tokens, length) => {
    let key = '[';
    const values: string[] = [];
    for (let col = 0; col < length; col++) {
      const token = tokens.next().value;
      if (token === undefined || !integer.test(token)) return false;
      const digits = token.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
      const normalized =
        token.startsWith('-') && digits !== '0' ? '-' + digits : digits;
      if (checker === 'int-bag-row-set') values.push(normalized);
      else key += (col ? ',' : '') + '"' + normalized + '"';
    }
    key =
      checker === 'int-bag-row-set' ? JSON.stringify(values.sort()) : key + ']';
    const previous = rows.get(key) || 0;
    if (previous && checker !== 'int-row-multiset') return false;
    rows.set(key, previous + 1);
    return true;
  });
  return valid ? rows : null;
}

export function parseIntegerRowSet(output: string): ReadonlySet<string> | null {
  const rows = parseIntegerRowCollection(output, 'int-row-set');
  return rows === null ? null : new Set(rows.keys());
}

export function validIntegerRowCollectionResult(
  kind: string,
  value: unknown,
): boolean {
  if (
    ![
      'integer-row-set',
      'integer-bag-row-set',
      'integer-row-multiset',
    ].includes(kind) ||
    !validStructuredResult('integer-rows', value)
  )
    return false;
  if (kind === 'integer-row-multiset') return true;
  const rows = value as bigint[][];
  const seen = new Set<string>();
  for (const row of rows) {
    const values = row.map(String);
    if (kind === 'integer-bag-row-set') values.sort();
    const key = JSON.stringify(values);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}
