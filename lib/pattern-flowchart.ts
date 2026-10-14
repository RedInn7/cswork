// Our own "which pattern is this?" decision tree. Client-safe: only the JSON and stop names.
import data from './content/pattern-flowchart.json';
import { ROUTE_SECTIONS, STOP_NAMES } from './route-stops';

/** [zh, en], the same order as STOP_NAMES (an array so the JSON type-checks without a cast). */
export type Text = string[];
export type Question = { q: Text; eg: Text; yes: string; no: string };
/** A leaf names a Line 500 stop, why it fits, and optionally a content library algorithm tutorial. */
export type Leaf = { stop: string; why: Text; tutorial?: string };
export type FlowNode = Question | Leaf;
export type Flowchart = { start: string; nodes: Record<string, FlowNode> };

export const FLOWCHART: Flowchart = data;
export const isLeaf = (node: FlowNode): node is Leaf => 'stop' in node;

const lineOrder = ROUTE_SECTIONS.flatMap((section) => section.slugs);
/** A stop's number on the line ("01".."35") and its short names. */
export function stopLabel(slug: string) {
  const [zh, en] = Object.hasOwn(STOP_NAMES, slug) ? STOP_NAMES[slug] : [slug, slug];
  return { code: String(lineOrder.indexOf(slug) + 1).padStart(2, '0'), zh, en };
}

/** Question ids depth first, yes before no: the order they are numbered and listed in. */
export function questionOrder(chart: Flowchart = FLOWCHART) {
  const order: string[] = [];
  const visit = (id: string) => {
    const node = chart.nodes[id];
    if (!node || isLeaf(node) || order.includes(id)) return;
    order.push(id);
    visit(node.yes);
    visit(node.no);
  };
  visit(chart.start);
  return order;
}

/** Every algorithm tutorial slug the leaves point at. */
export const tutorialSlugs = () => [
  ...new Set(
    Object.values(FLOWCHART.nodes).flatMap((node) =>
      isLeaf(node) && node.tutorial ? [node.tutorial] : [],
    ),
  ),
];
