import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import {
  FLOWCHART,
  isLeaf,
  questionOrder,
  stopLabel,
  tutorialSlugs,
  type Question,
} from '../lib/pattern-flowchart';
import { ROUTE_SECTIONS, STOP_NAMES } from '../lib/route-stops';
import curated from '../lib/content/ling-curated-500.json';

const { start, nodes } = FLOWCHART;
const ids = Object.keys(nodes);
const CJK = /[㐀-鿿]/;

test('every edge lands on a node, every leaf on a real Line 500 stop', () => {
  assert.ok(!isLeaf(nodes[start]), 'the walk starts with a question');
  const stops = new Set(ROUTE_SECTIONS.flatMap((s) => s.slugs));
  for (const [id, node] of Object.entries(nodes)) {
    if (isLeaf(node)) {
      assert.ok(id.startsWith('to-') && Object.hasOwn(STOP_NAMES, node.stop) && stops.has(node.stop), id);
      if (node.tutorial) assert.match(node.tutorial, /^[a-z0-9-]+$/, id);
      continue;
    }
    assert.ok(id.startsWith('q-'), id);
    assert.ok(node.yes !== node.no, id);
    for (const next of [node.yes, node.no]) assert.ok(Object.hasOwn(nodes, next), `${id} -> ${next}`);
  }
  assert.equal(stopLabel('binary-search').code, '06');
  assert.equal(stopLabel('bits-math').code, '35');
});

test('the tree has no cycles, no orphans, one parent per node, and reaches all 35 stops', () => {
  const parents = new Map<string, number>();
  const seen = new Set<string>();
  const walk = (id: string, trail: Set<string>) => {
    assert.ok(!trail.has(id), `cycle through ${id}`);
    seen.add(id);
    const node = nodes[id];
    if (isLeaf(node)) return;
    for (const next of [node.yes, node.no]) {
      parents.set(next, (parents.get(next) ?? 0) + 1);
      walk(next, new Set([...trail, id]));
    }
  };
  walk(start, new Set());
  assert.deepEqual(ids.filter((id) => !seen.has(id)), [], 'unreachable nodes');
  assert.ok([...parents.values()].every((n) => n === 1), 'a node with two parents');
  const questions = ids.filter((id) => !isLeaf(nodes[id]));
  assert.ok(questions.length >= 20, `${questions.length} questions`);
  assert.equal(questionOrder().length, questions.length);
  const reached = new Set(ids.flatMap((id) => { const n = nodes[id]; return isLeaf(n) ? [n.stop] : []; }));
  assert.equal(reached.size, ROUTE_SECTIONS.flatMap((s) => s.slugs).length);
});

test('problems walked with honest answers land on the stop that lists them', () => {
  const sectionOf = new Map(curated.map((p) => [p.number, p.sectionSlug]));
  // Problem number -> the questions a reader would answer yes to; everything else is no.
  const walks: [number, string[]][] = [
    [56, ['q-intervals']], // Merge Intervals
    [57, ['q-intervals', 'q-sorted']], // Insert Interval: sorted, but intervals come first
    [79, ['q-graph', 'q-grid', 'q-board']], // Word Search
    [37, ['q-graph', 'q-board']], // Sudoku Solver
    [51, ['q-all', 'q-all-board']], // N-Queens
    [5, ['q-contig', 'q-contig-palin', 'q-optimize', 'q-palin']], // Longest Palindromic Substring
    [20, ['q-nest', 'q-pair', 'q-string']], // Valid Parentheses
    [224, ['q-nest', 'q-string']], // Basic Calculator
    [295, ['q-design', 'q-design-lookup', 'q-topk']], // Find Median from Data Stream
    [981, ['q-design', 'q-design-lookup']], // Time Based Key-Value Store
    [15, ['q-sorted', 'q-sorted-pair', 'q-pair']], // 3Sum
    [167, ['q-sorted', 'q-sorted-pair']], // Two Sum II
    [1186, ['q-contig', 'q-contig-best', 'q-optimize']], // Maximum Subarray Sum with One Deletion
    [215, ['q-topk']], // Kth Largest Element in an Array
  ];
  for (const [number, yes] of walks) {
    let id = start;
    for (let node = nodes[id]; !isLeaf(node); node = nodes[id]) id = yes.includes(id) ? node.yes : node.no;
    assert.equal((nodes[id] as { stop: string }).stop, sectionOf.get(number), `${number} -> ${id}`);
  }
});

test('every text is bilingual: Chinese first, English second', () => {
  for (const [id, node] of Object.entries(nodes)) {
    const texts = isLeaf(node) ? [node.why] : [(node as Question).q, (node as Question).eg];
    for (const [zh, en] of texts) {
      assert.ok(CJK.test(zh), `${id} zh`);
      assert.ok(en.trim().length > 0 && !CJK.test(en), `${id} en`);
    }
  }
});

// CI has no content library; locally: CONTENT_DATABASE_PATH=~/cswork-prachub/content.sqlite
const path = process.env.CONTENT_DATABASE_PATH;
test('leaf tutorials exist in the content library', { skip: !path || !existsSync(path) }, () => {
  const db = new Database(path!, { readonly: true });
  try {
    const has = db.prepare(
      "SELECT 1 FROM items WHERE type='algorithm' AND slug=? AND listed=1 AND partial=0 AND dup_of IS NULL",
    );
    for (const slug of tutorialSlugs()) assert.ok(has.get(slug), slug);
  } finally {
    db.close();
  }
});
