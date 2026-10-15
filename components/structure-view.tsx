'use client';

import type { DemoGraph } from '@/lib/algorithm-demo';
import { useT } from '@/lib/i18n';
import { levelOrderTree } from '@/lib/testcase-fields';
import { DemoGraphView } from './algorithm-demo';

// No CSS import here, so node tests can render oj-results: the workspace imports
// app/algorithm-demo.css (graph marks) and app/workbench-tools.css (.cs-structure).

const MAX_NODES = 255;
const MAX_GRID = 40;
/** Pixels per SVG unit: algorithm-demo.css sizes nodes (r 4.2) and labels (3.6) in units. */
const SCALE = 3.2;

/** Trees, linked lists and 2-D arrays have a picture. */
export const drawable = (type: string) =>
  type === 'TreeNode' || type === 'ListNode' || /\[\]\[\]$|^list<list</.test(type);

/** A level-order tree: x by in-order rank, y by depth. null when it isn't one or is too big. */
export function treeGraph(value: unknown): DemoGraph | null {
  const nodes = Array.isArray(value) ? levelOrderTree(value) : null;
  if (!Array.isArray(nodes) || nodes.length > MAX_NODES) return null;
  const at: { rank: number; depth: number }[] = [];
  let rank = 0,
    deepest = 0;
  const walk = (i: number, depth: number) => {
    if (i < 0) return;
    walk(nodes[i].left, depth + 1);
    at[i] = { rank: rank++, depth };
    deepest = Math.max(deepest, depth);
    walk(nodes[i].right, depth + 1);
  };
  if (nodes.length) walk(0, 0);
  return {
    width: 12 + 10 * Math.max(0, nodes.length - 1),
    height: 12 + 13 * deepest,
    nodes: nodes.map((n, i) => ({ id: `${i}`, label: `${n.val}`, x: 6 + 10 * at[i].rank, y: 6 + 13 * at[i].depth })),
    edges: nodes.flatMap((n, i) =>
      [n.left, n.right].filter((child) => child >= 0).map((child) => ({ from: `${i}`, to: `${child}` })),
    ),
  };
}

/** A linked list's values in a row of arrows. */
export function listGraph(value: unknown): DemoGraph | null {
  if (!Array.isArray(value) || value.length > MAX_NODES || !value.every(Number.isInteger)) return null;
  return {
    width: 12 + 14 * Math.max(0, value.length - 1),
    height: 12,
    nodes: value.map((v, i) => ({ id: `${i}`, label: `${v}`, x: 6 + 14 * i, y: 6 })),
    edges: value.slice(1).map((_, i) => ({ from: `${i}`, to: `${i + 1}`, directed: true })),
  };
}

/** A printed tree or list ("n\nv null v", result_contract.py) back as its array; null otherwise. */
export function printedValues(text: string) {
  const [count, ...tokens] = text.trim().split(/\s+/);
  if (!/^\d+$/.test(count) || tokens.length !== Number(count)) return null;
  const values = tokens.map((token) => (token === 'null' ? null : /^-?\d+$/.test(token) ? Number(token) : undefined));
  return values.includes(undefined) ? null : (values as (number | null)[]);
}

/** One parameter's or result's picture; nothing for a value that doesn't parse as its type. */
export function StructureView({ type, value, label }: { type: string; value: unknown; label?: string }) {
  const t = useT();
  const caption = label && <figcaption>{label}</figcaption>;
  if (type === 'TreeNode' || type === 'ListNode') {
    const graph = type === 'TreeNode' ? treeGraph(value) : listGraph(value);
    if (!graph)
      return Array.isArray(value) && value.length > MAX_NODES ? (
        <p className="cs-structure-note">{t(`超过 ${MAX_NODES} 个节点，不画图。`, `Over ${MAX_NODES} nodes: not drawn.`)}</p>
      ) : null;
    return (
      <figure className="algorithm-demo cs-structure">
        {caption}
        {graph.nodes.length ? (
          <div style={{ width: graph.width * SCALE }}>
            <DemoGraphView graph={graph} />
          </div>
        ) : (
          <p className="cs-structure-note">{type === 'TreeNode' ? t('空树', 'Empty tree') : t('空链表', 'Empty list')}</p>
        )}
      </figure>
    );
  }
  if (!Array.isArray(value) || !value.every(Array.isArray)) return null;
  const columns = Math.max(0, ...value.map((row: unknown[]) => row.length));
  if (value.length > MAX_GRID || columns > MAX_GRID)
    return (
      <p className="cs-structure-note">
        {t(
          `${value.length} × ${columns} 的网格超过 ${MAX_GRID} 行或列，不画图。`,
          `A ${value.length} × ${columns} grid is over ${MAX_GRID} rows or columns: not drawn.`,
        )}
      </p>
    );
  return (
    <figure className="cs-structure">
      {caption}
      <table className="cs-structure-grid">
        <tbody>
          {value.map((row: unknown[], i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{typeof cell === 'string' ? cell : JSON.stringify(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
