/**
 * A SQL track dataset (the stdin datasetSql() in scripts/sql-track/build.ts
 * writes) read back as tables, for the workspace's grids and schema sidebar.
 * Only that writing is read: marker lines first, CREATE TABLE with one column
 * per line (a trailing `--` comment is the column's note), INSERT INTO t
 * [(cols)] VALUES of NULL, numbers and '…' strings. Anything else is null and
 * the page shows the raw SQL instead. Client-safe.
 */
import type { SqlCell } from './sql-result';

export type SqlColumn = { name: string; type?: string; pk?: boolean; notNull?: boolean; note?: string };
export type SqlDatasetTable = { name: string; columns: SqlColumn[]; rows: SqlCell[][] };
export type SqlDataset = { ordered: boolean; tables: SqlDatasetTable[] };

const CREATE = /CREATE TABLE (\w+) \(\n/y;
const INSERT = /INSERT INTO (\w+)(?: ?\(([\w, ]+)\))? VALUES\s*/y;
const VALUE = /\s*(?:(NULL)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|'((?:[^']|'')*)')\s*/y;
const SPACE = /\s*/y;
const COLUMN_CONSTRAINT = /^(?:PRIMARY|NOT|NULL|UNIQUE|CHECK|DEFAULT|COLLATE|REFERENCES|GENERATED|AS|CONSTRAINT)$/i;

function cell(m: RegExpExecArray): SqlCell | undefined {
  if (m[1]) return null;
  if (m[3] !== undefined) return m[3].replaceAll("''", "'");
  const n = Number(m[2]);
  // 64-bit integers JavaScript cannot hold exactly would show the wrong value.
  return Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n)) ? n : undefined;
}

function columns(body: string): SqlColumn[] | null {
  const out: SqlColumn[] = [];
  const keys: string[] = [];
  for (const line of body.split('\n')) {
    const comment = line.indexOf('--');
    const def = (comment < 0 ? line : line.slice(0, comment)).trim().replace(/,$/, '').trim();
    const note = comment < 0 ? '' : line.slice(comment + 2).trim();
    if (!def) continue;
    // ponytail: quoted names and DEFAULT '…' are not datasetSql's writing.
    if (/['"`[]/.test(def)) return null;
    const words = def.split(/\s+/);
    if (/^(?:PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)$/i.test(words[0])) {
      // Table constraints: only a PRIMARY KEY (a, b) shows, on its columns.
      const pk = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(def);
      if (pk) keys.push(...pk[1].split(',').map((name) => name.trim()));
      continue;
    }
    if (!/^\w+$/.test(words[0])) return null;
    const end = words.findIndex((w, k) => k > 0 && COLUMN_CONSTRAINT.test(w));
    out.push({
      name: words[0],
      type: words.slice(1, end < 0 ? undefined : end).join(' '),
      pk: /\bPRIMARY\s+KEY\b/i.test(def),
      notNull: /\bNOT\s+NULL\b/i.test(def),
      ...(note ? { note } : {}),
    });
  }
  for (const key of keys) {
    const column = out.find((c) => c.name.toLowerCase() === key.toLowerCase());
    if (!column) return null;
    column.pk = true;
  }
  return out.length ? out : null;
}

export function parseSqlDataset(text: string): SqlDataset | null {
  const ordered = text.startsWith('-- cswork:ordered\n');
  const tables: SqlDatasetTable[] = [];
  // Marker lines the harnesses read (-- cswork:ordered, -- cswork:index {…}, …).
  let i = /^(?:-- cswork:\w+(?: [^\n]*)?\n)*/.exec(text)![0].length;
  const at = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(text);
    if (m) i = re.lastIndex;
    return m;
  };
  for (; ; ) {
    at(SPACE);
    if (i >= text.length) return tables.length ? { ordered, tables } : null;
    const create = at(CREATE);
    if (create) {
      const end = text.indexOf('\n);', i);
      const list = end < 0 ? null : columns(text.slice(i, end));
      if (!list || tables.some((t) => t.name === create[1])) return null;
      tables.push({ name: create[1], columns: list, rows: [] });
      i = end + 3;
      continue;
    }
    const insert = at(INSERT);
    const table = insert && tables.find((t) => t.name === insert[1]);
    if (!insert || !table) return null;
    const names = insert[2]?.split(',').map((name) => name.trim());
    const order = (names ?? table.columns.map((c) => c.name)).map((name) =>
      table.columns.findIndex((c) => c.name === name),
    );
    // A column list must name every column once: a left-out one would take its DEFAULT.
    if (order.length !== table.columns.length || order.some((k, n) => k < 0 || order.indexOf(k) !== n)) return null;
    for (;;) {
      if (text[i++] !== '(') return null;
      const values: SqlCell[] = [];
      do {
        const m = at(VALUE);
        const value = m ? cell(m) : undefined;
        if (value === undefined) return null;
        values.push(value);
      } while (text[i] === ',' && ++i);
      if (text[i++] !== ')' || values.length !== order.length) return null;
      const row = new Array<SqlCell>(order.length);
      order.forEach((k, n) => (row[k] = values[n]));
      table.rows.push(row);
      at(SPACE);
      const next = text[i++];
      if (next === ';') break;
      if (next !== ',') return null;
      at(SPACE);
    }
  }
}
