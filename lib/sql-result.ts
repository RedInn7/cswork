/**
 * The SQL judge's canonical output (lib/server/sql-judge.ts) read back as a
 * table: `columns: N`, then one JSON array per row. Client-safe.
 */
export type SqlCell = string | number | null | { blob: string } | { float: string };
export type SqlTable = { columns: number; rows: SqlCell[][] };

/**
 * Stored outputs are cut at FEEDBACK_BYTES (lib/server/oj-case-store.ts), with
 * no marker in the per-case path; a cut that lands on a line end still parses,
 * so text this long is treated as cut off.
 */
export const SQL_RESULT_MAX_BYTES = 32768;

/**
 * null when the text is not a whole canonical result (an error, a cut-off
 * output) or holds an integer JavaScript cannot hold exactly (SQLite's are
 * 64-bit), which would make two different rows look the same.
 */
export function parseSqlResult(text: string): SqlTable | null {
  if (new TextEncoder().encode(text).byteLength >= SQL_RESULT_MAX_BYTES) return null;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const head = /^columns: (\d+)$/.exec(lines[0] ?? '');
  if (!head) return null;
  const columns = Number(head[1]);
  const rows: SqlCell[][] = [];
  for (const line of lines.slice(1)) {
    try {
      const row = JSON.parse(line) as unknown;
      if (!Array.isArray(row) || row.length !== columns) return null;
      if (row.some((cell) => Number.isInteger(cell) && !Number.isSafeInteger(cell))) return null;
      rows.push(row as SqlCell[]);
    } catch {
      return null;
    }
  }
  return { columns, rows };
}

export type SqlDiffRow =
  | { kind: 'same'; cells: SqlCell[] }
  | { kind: 'missing'; cells: SqlCell[] }
  | { kind: 'extra'; cells: SqlCell[] }
  /** A row the learner got wrong: expected and actual side by side, differing columns listed. */
  | { kind: 'changed'; expected: SqlCell[]; actual: SqlCell[]; columns: number[] };

// ponytail: O(n·m) LCS; bigger results fall back to the raw text.
export const SQL_DIFF_MAX_ROWS = 400;

/**
 * Row diff in output order (sorted by the judge unless the problem compares
 * order): a longest common subsequence keeps matching rows, and a run of
 * missing rows next to a run of extra rows pairs up as changed rows.
 */
export function diffSqlResults(expected: SqlTable, actual: SqlTable): SqlDiffRow[] | null {
  const a = expected.rows.map((row) => JSON.stringify(row));
  const b = actual.rows.map((row) => JSON.stringify(row));
  if (a.length > SQL_DIFF_MAX_ROWS || b.length > SQL_DIFF_MAX_ROWS) return null;
  // lcs[i][j]: common rows of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: SqlDiffRow[] = [];
  let missing: SqlCell[][] = [];
  let extra: SqlCell[][] = [];
  const flush = () => {
    const pairs = expected.columns === actual.columns ? Math.min(missing.length, extra.length) : 0;
    for (let k = 0; k < pairs; k++) {
      const columns = missing[k]
        .map((cell, c) => (JSON.stringify(cell) === JSON.stringify(extra[k][c]) ? -1 : c))
        .filter((c) => c >= 0);
      out.push({ kind: 'changed', expected: missing[k], actual: extra[k], columns });
    }
    for (const cells of missing.slice(pairs)) out.push({ kind: 'missing', cells });
    for (const cells of extra.slice(pairs)) out.push({ kind: 'extra', cells });
    missing = [];
    extra = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      out.push({ kind: 'same', cells: expected.rows[i] });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      extra.push(actual.rows[j++]);
    } else {
      missing.push(expected.rows[i++]);
    }
  }
  flush();
  return out;
}

/** How a cell reads in the table; `typed` quotes text so '3' and 3 look different. */
export function sqlCellText(cell: SqlCell, typed = false) {
  if (cell === null) return 'NULL';
  if (typeof cell === 'string') return typed ? JSON.stringify(cell) : cell;
  if (typeof cell === 'number') return String(cell);
  return 'blob' in cell ? `x'${cell.blob}'` : cell.float;
}
