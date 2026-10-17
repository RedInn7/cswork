/**
 * The step debugger's pictures (components/python-debugger.tsx): the tracer's JSON snapshots
 * (trace.shapes, referenced per step by trace.views) parsed and turned into what the panel
 * draws. Cells and labels are Python reprs, so they read exactly like the variables table.
 */
import type { DemoGraph, DemoNode } from './algorithm-demo';
import { previousInFrame, type Trace } from './python-debugger';
import { layoutTree } from '@/components/structure-view';

/** A flat list, tuple or deque (its first 64 items; n is the full length), or a string's characters. */
export type SeqShape = { k: 'seq'; v: string[]; n: number };
/** A 2-D list of scalars, up to 40 x 40 (rows may differ in length). */
export type GridShape = { k: 'grid'; v: string[][] };
/** A dict's first 30 entries as [key, value]; n is its size. */
export type DictShape = { k: 'dict'; v: [string, string][]; n: number };
/**
 * Linked-list or tree nodes as [val, next, left, right] (indexes, -1 for none) and the variables
 * pointing at them; more: nodes past the 255 cap were left out (links to them read -1 too).
 */
export type NodesShape = { k: 'nodes'; n: [string, number, number, number][]; p: [string, number][]; more?: true };
export type Shape = SeqShape | GridShape | DictShape | NodesShape;

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const pair = (value: unknown): value is [string, string] => strings(value) && value.length === 2;

/** One snapshot; null for anything malformed (an index past the nodes, a wrong type). */
export function parseShape(json: string): Shape | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { k, v, n, p, more } = raw as Record<string, unknown>;
  const size = Number.isInteger(n) ? (n as number) : -1;
  if (k === 'seq') return strings(v) && size >= v.length ? { k: 'seq', v, n: size } : null;
  if (k === 'grid') return Array.isArray(v) && v.length > 0 && v.every(strings) ? { k: 'grid', v } : null;
  if (k === 'dict') return Array.isArray(v) && v.every(pair) && size >= v.length ? { k: 'dict', v, n: size } : null;
  if (k !== 'nodes' || !Array.isArray(n) || !Array.isArray(p)) return null;
  const index = (value: unknown, least: number) =>
    Number.isInteger(value) && (value as number) >= least && (value as number) < n.length;
  const nodes = n.every(
    (node) => Array.isArray(node) && node.length === 4 && typeof node[0] === 'string' && node.slice(1).every((i) => index(i, -1)),
  );
  const pointers = p.every((item) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && index(item[1], 0));
  return nodes && pointers ? { k: 'nodes', n, p, ...(more === 1 ? { more: true as const } : {}) } : null;
}

const parsed = new WeakMap<readonly string[], (Shape | null)[]>();
/** trace.shapes[index] parsed, once per trace. */
export function shapeAt(shapes: readonly string[], index: number): Shape | null {
  let memo = parsed.get(shapes);
  if (!memo) parsed.set(shapes, (memo = []));
  if (memo[index] === undefined) memo[index] = index >= 0 && index < shapes.length ? parseShape(shapes[index]) : null;
  return memo[index];
}

const POINTERS = new Set(['i', 'j', 'k', 'l', 'r', 'lo', 'hi', 'left', 'right', 'mid', 'slow', 'fast', 'start', 'end', 'p', 'q']);
/**
 * Index-like variables (i, lo, slow, ...) holding 0..len, by the index they point at; len
 * itself is one past the end (a half-open hi).
 * ponytail: every 1-D sequence gets them, so two arrays both walked with i/j are both marked.
 */
export function pointers(vars: readonly [string, string][], len: number): Map<number, string[]> {
  const at = new Map<number, string[]>();
  for (const [name, value] of vars)
    if (POINTERS.has(name) && /^\d+$/.test(value) && Number(value) <= len) at.set(Number(value), [...(at.get(Number(value)) ?? []), name]);
  return at;
}

/**
 * What the line just run wrote, against the same variable at this call's previous step:
 * changed (or appended) seq cells "i", grid cells "r,c" (same shape only), dict keys changed or added.
 */
export function changedCells(before: Shape | null, now: Shape): Set<string> {
  const changed = new Set<string>();
  if (!before || before.k !== now.k) return changed;
  if (now.k === 'seq' && before.k === 'seq') now.v.forEach((cell, i) => cell !== before.v[i] && changed.add(`${i}`));
  if (now.k === 'grid' && before.k === 'grid' && before.v.length === now.v.length)
    now.v.forEach((row, r) => {
      if (row.length === before.v[r].length) row.forEach((cell, c) => cell !== before.v[r][c] && changed.add(`${r},${c}`));
    });
  if (now.k === 'dict' && before.k === 'dict') {
    const old = new Map(before.v);
    for (const [key, value] of now.v) if (old.get(key) !== value) changed.add(key);
  }
  return changed;
}

export type StepView = { name: string; shape: Shape; changed: Set<string> };
/** The pictures at a step, each with what changed since this call's previous step. */
export function stepViews(trace: Trace, index: number): StepView[] {
  const before = new Map(trace.views[previousInFrame(trace.steps, index)] ?? []);
  return (trace.views[index] ?? []).flatMap(([name, at]) => {
    const shape = shapeAt(trace.shapes, at);
    if (!shape) return [];
    const old = before.get(name);
    return [{ name, shape, changed: old === undefined ? new Set<string>() : changedCells(shapeAt(trace.shapes, old), shape) }];
  });
}

const ROW = 18;
/**
 * Nodes as a picture. Trees (any left/right) lay out like structure-view's, with next drawn as
 * dashed arrows (populating-next problems); lists get one row per chain, walking next from each
 * node nothing points to (then from what's left: a cycle) until a node already placed, so a
 * half-reversed list reads 2→1 above 3→4. Pointed-at nodes are active and named.
 * ponytail: a cycle's closing edge is a straight line back (its last node drops half a row so
 * it shows); a long cycle's edge runs under the nodes between.
 */
export function nodeGraph({ n: nodes, p }: NodesShape): DemoGraph {
  const names = new Map<number, string[]>();
  for (const [name, i] of p) names.set(i, [...(names.get(i) ?? []), name]);
  let graph: DemoGraph;
  if (nodes.some(([, , left, right]) => left >= 0 || right >= 0)) {
    const children = new Set(nodes.flatMap(([, , left, right]) => [left, right]));
    graph = layoutTree(
      nodes.map(([val, , left, right]) => ({ val, left, right })),
      [...nodes.keys()].filter((i) => !children.has(i)),
    );
    graph.edges.push(
      ...nodes.flatMap(([, next], i) => (next >= 0 ? [{ from: `${i}`, to: `${next}`, directed: true, state: 'muted' as const }] : [])),
    );
  } else {
    const at: { x: number; y: number }[] = [];
    let row = 0,
      widest = 0;
    const pointed = new Set(nodes.map(([, next]) => next));
    for (const start of [...[...nodes.keys()].filter((i) => !pointed.has(i)), ...nodes.keys()]) {
      let col = 0,
        last = -1,
        i = start;
      for (; i >= 0 && !at[i]; last = i, i = nodes[i][1]) at[i] = { x: 6 + 14 * col++, y: 6 + ROW * row };
      if (!col) continue;
      const cycle = i >= 0 && at[i].y === at[last].y && last !== i;
      if (cycle) at[last].y += ROW / 2;
      widest = Math.max(widest, col);
      row += cycle ? 2 : 1;
    }
    graph = {
      width: 12 + 14 * Math.max(0, widest - 1),
      height: ROW * row - 4,
      nodes: nodes.map(([val], i) => ({ id: `${i}`, label: val, ...at[i] })),
      edges: nodes.flatMap(([, next], i) => (next >= 0 ? [{ from: `${i}`, to: `${next}`, directed: true }] : [])),
    };
  }
  // Names sit under their nodes; a name right next to another drops a line so they don't overlap.
  const noted: DemoNode[] = [];
  for (const node of graph.nodes) {
    const named = names.get(Number(node.id));
    if (named) noted.push(Object.assign(node, { state: 'active' as const, note: named.join(',') }));
  }
  noted.sort((a, b) => a.y - b.y || a.x - b.x);
  noted.forEach((node, i) => {
    const left = noted[i - 1];
    if (left && left.y === node.y && node.x - left.x <= 14 && !left.noteDy) node.noteDy = 3.4;
  });
  if (noted.length) graph.height += 8;
  // Room for a long name under the first or last node (~0.9 units per character each side).
  const pad = Math.max(0, ...noted.map((node) => Math.ceil(node.note!.length * 0.9) - 5));
  for (const node of graph.nodes) node.x += pad;
  graph.width += 2 * pad;
  return graph;
}
