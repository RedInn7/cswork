/**
 * The SQL workspace's previews of a learner's query (components/sql-workspace.tsx):
 * each CTE of its leading WITH on its own, and SQLite's EXPLAIN QUERY PLAN. Both
 * run as 'sql-peek' submissions on the sample's data. Client-safe.
 */
import type { SqlTable } from './sql-result';

/** A query starting with this line also gets its column names, as one JSON line on stderr (lib/server/sql-judge.ts). */
export const SQL_NAMES = '-- cswork:names';
export const CTE_PREVIEW_ROWS = 50;

type Token = { text: string; start: number; end: number };
// Whitespace, comments, strings, quoted names, words, then any one character.
const TOKEN =
  /\s+|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*'?|"(?:[^"]|"")*"?|`(?:[^`]|``)*`?|\[[^\]]*\]?|[\p{L}\p{N}_$]+|[\s\S]/uy;

/** SQLite's tokens without whitespace and comments; a string or a quoted name is one token. */
function tokens(sql: string) {
  const out: Token[] = [];
  TOKEN.lastIndex = 0;
  for (let m: RegExpExecArray | null; TOKEN.lastIndex < sql.length && (m = TOKEN.exec(sql)); )
    if (!/^(?:\s|--|\/\*)/.test(m[0])) out.push({ text: m[0], start: m.index, end: TOKEN.lastIndex });
  return out;
}
const word = (token: Token | undefined, text: string) => token?.text.toUpperCase() === text;
const isName = (text: string) => /^(?:[\p{L}_][\p{L}\p{N}_$]*|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\])$/u.test(text);
const unquote = (text: string) =>
  text[0] === '"' || text[0] === '`'
    ? text.slice(1, -1).replaceAll(text[0] + text[0], text[0])
    : text[0] === '[' ? text.slice(1, -1) : text;
/** The index of the ')' closing the '(' at `open`, or -1. */
function closing(list: Token[], open: number) {
  let depth = 0;
  for (let i = open; i < list.length; i++) {
    if (list[i].text === '(') depth++;
    else if (list[i].text === ')' && --depth === 0) return i;
  }
  return -1;
}

export type WithClause = { head: 'WITH' | 'WITH RECURSIVE'; ctes: { name: string; text: string }[] };

/**
 * The statement's leading WITH: each CTE as written (`name [(cols)] AS [NOT]
 * [MATERIALIZED] (…)`). null without one, or when it does not parse; a WITH
 * inside a subquery is part of its CTE's text.
 */
export function withClause(sql: string): WithClause | null {
  const list = tokens(sql);
  if (!word(list[0], 'WITH')) return null;
  const recursive = word(list[1], 'RECURSIVE');
  const ctes: WithClause['ctes'] = [];
  for (let i = recursive ? 2 : 1; ; i++) {
    const name = list[i];
    if (!name || !isName(name.text)) return null;
    if (list[++i]?.text === '(') {
      i = closing(list, i);
      if (i < 0) return null;
      i++;
    }
    if (!word(list[i++], 'AS')) return null;
    if (word(list[i], 'NOT')) i++;
    if (word(list[i], 'MATERIALIZED')) i++;
    if (list[i]?.text !== '(') return null;
    i = closing(list, i);
    if (i < 0) return null;
    ctes.push({ name: unquote(name.text), text: sql.slice(name.start, list[i].end) });
    if (list[i + 1]?.text !== ',') return list[i + 1] ? { head: recursive ? 'WITH RECURSIVE' : 'WITH', ctes } : null;
    i++;
  }
}

/**
 * One CTE's first rows, with column names. Every CTE comes along, so the ones
 * it reads are defined whatever their order.
 */
export function ctePreview(sql: string, name: string) {
  const clause = withClause(sql);
  if (!clause?.ctes.some((cte) => cte.name === name)) return null;
  return `${SQL_NAMES}\n${clause.head} ${clause.ctes.map((cte) => cte.text).join(',\n')}\nSELECT * FROM "${name.replaceAll('"', '""')}" LIMIT ${CTE_PREVIEW_ROWS}`;
}

/** The harness runs this read-only like any query; its rows are [id, parent, notused, detail]. */
export const explainQuery = (sql: string) => `EXPLAIN QUERY PLAN ${sql}`;

export type PlanNode = { id: number; detail: string; children: PlanNode[] };

/**
 * EXPLAIN QUERY PLAN's rows as a tree. They are sorted by id first: the judge
 * sorts result rows as text unless the dataset is ordered. null for any other shape.
 */
export function parsePlan(table: SqlTable | null): PlanNode[] | null {
  if (!table || table.columns !== 4) return null;
  const rows: { id: number; parent: number; detail: string }[] = [];
  for (const [id, parent, , detail] of table.rows) {
    if (!Number.isInteger(id) || !Number.isInteger(parent) || typeof detail !== 'string') return null;
    rows.push({ id: id as number, parent: parent as number, detail });
  }
  rows.sort((a, b) => a.id - b.id);
  const roots: PlanNode[] = [];
  const nodes = new Map<number, PlanNode>();
  for (const { id, parent, detail } of rows) {
    const node: PlanNode = { id, detail, children: [] };
    const siblings = parent === 0 ? roots : nodes.get(parent)?.children;
    if (!siblings) return null;
    siblings.push(node);
    nodes.set(id, node);
  }
  return roots;
}
