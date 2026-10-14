// The ten newer algorithm demos: every generator ends in the state a brute force agrees with,
// draws only nodes and edges it declares, and has the same frames in Chinese and English.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIJKSTRA_EDGES,
  TOPO_EDGES,
  backtrackingTrace,
  createDemoTrace,
  demoKinds,
  dfsTrace,
  dijkstraTrace,
  dpTableTrace,
  enText,
  heapTrace,
  monotonicStackTrace,
  topoSortTrace,
  trieTrace,
  twoPointersTrace,
  unionFindTrace,
  type DemoTrace,
} from '../lib/algorithm-demo';
import { STOP_DEMOS, STOP_NAMES } from '../lib/route-stops';

const last = (trace: DemoTrace) => trace.frames.at(-1)!;
const stat = (trace: DemoTrace, label: string) => Object.fromEntries(last(trace).stats)[label];

test('every kind builds, ends on a done frame, and draws a consistent graph in both languages', () => {
  assert.equal(demoKinds.length, 14);
  for (const kind of demoKinds)
    for (const english of [false, true]) {
      const trace = createDemoTrace(kind, english);
      assert.ok(trace.frames.length >= 3, kind);
      assert.equal(last(trace).done, true, kind);
      assert.equal(trace.frames.filter((f) => f.done).length, 1, kind);
      for (const frame of trace.frames) {
        assert.ok(frame.caption.length > 0);
        if (trace.columns) assert.equal(frame.cells.length % trace.columns, 0, kind);
        if (!frame.graph) continue;
        const ids = new Set(frame.graph.nodes.map((n) => n.id));
        assert.equal(ids.size, frame.graph.nodes.length, `${kind} duplicate node`);
        assert.ok(frame.graph.edges.every((e) => ids.has(e.from) && ids.has(e.to)), `${kind} dangling edge`);
        assert.ok(
          frame.graph.nodes.every(
            (n) => n.x >= 0 && n.x <= frame.graph!.width && n.y >= 0 && n.y <= frame.graph!.height,
          ),
          `${kind} node outside the box`,
        );
      }
      // English captions carry no Chinese; the two languages walk the same frames.
      if (english) {
        assert.ok(trace.frames.every((f) => !/[一-鿿]/.test(f.caption + f.stats.flat().join(''))), kind);
        assert.equal(trace.frames.length, createDemoTrace(kind).frames.length, kind);
      }
    }
});

test('two pointers finds a pair exactly when one exists', () => {
  const values = [1, 3, 4, 6, 8, 11, 15];
  for (let target = 0; target <= 30; target++) {
    const exists = values.some((a, i) => values.some((b, j) => i < j && a + b === target));
    const answer = last(twoPointersTrace(values, target)).cells.flatMap((c, i) => (c.state === 'answer' ? [i] : []));
    assert.equal(answer.length, exists ? 2 : 0, `target ${target}`);
    if (exists) assert.equal(values[answer[0]] + values[answer[1]], target);
  }
});

test('DFS counts islands like a flood fill and pushes each land cell once', () => {
  const grid = ['110010', '100110', '001000', '101101'];
  const seen = new Set<string>();
  let islands = 0;
  const fill = (r: number, c: number): void => {
    if (grid[r]?.[c] !== '1' || seen.has(`${r},${c}`)) return;
    seen.add(`${r},${c}`);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) fill(r + dr, c + dc);
  };
  grid.forEach((row, r) => [...row].forEach((ch, c) => ch === '1' && !seen.has(`${r},${c}`) && (islands++, fill(r, c))));
  const trace = dfsTrace(grid);
  assert.equal(stat(trace, '岛屿数'), String(islands));
  assert.equal(last(trace).cells.filter((c) => c.state === 'answer').length, seen.size);
  for (const frame of trace.frames) assert.equal(new Set(frame.queue).size, frame.queue!.length);
});

test('Dijkstra agrees with Bellman-Ford and marks the shortest-path tree', () => {
  const dist: Record<string, number> = { A: 0, B: Infinity, C: Infinity, D: Infinity, E: Infinity, F: Infinity };
  for (let round = 0; round < 6; round++)
    for (const [a, b, w] of DIJKSTRA_EDGES) {
      dist[b] = Math.min(dist[b], dist[a] + w);
      dist[a] = Math.min(dist[a], dist[b] + w);
    }
  const final = last(dijkstraTrace());
  assert.deepEqual(Object.fromEntries(final.cells.map((c) => [c.label, Number(c.value)])), dist);
  // A tree over 6 nodes has 5 edges.
  assert.equal(final.graph!.edges.filter((e) => e.state === 'answer').length, 5);
  assert.equal(stat(dijkstraTrace(enText), 'A→F'), '13');
});

test('union-find ends with the brute-force components and compresses a path', () => {
  const unions: [number, number][] = [[0, 1], [2, 3], [1, 3], [4, 5], [5, 6], [3, 6], [0, 2]];
  const label = Array.from({ length: 8 }, (_, i) => i);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [a, b] of unions)
      if (label[a] !== label[b]) {
        label[a] = label[b] = Math.min(label[a], label[b]);
        changed = true;
      }
  }
  const trace = unionFindTrace(8, unions);
  assert.equal(stat(trace, '连通分量'), String(new Set(label).size));
  for (const frame of trace.frames) {
    const roots = frame.cells.filter((c, i) => c.value === i).length;
    assert.equal(String(roots), Object.fromEntries(frame.stats)['连通分量']);
  }
  assert.ok(trace.frames.some((f) => f.caption.startsWith('路径压缩')));
  assert.ok(trace.frames.some((f) => f.caption.includes('已在同一组')));
});

test('topological sort outputs every node once and respects every edge; a cycle is reported', () => {
  const trace = topoSortTrace();
  const order = stat(trace, '输出顺序').split(' → ');
  assert.equal(new Set(order).size, 6);
  for (const [a, b] of TOPO_EDGES) assert.ok(order.indexOf(a) < order.indexOf(b), `${a} before ${b}`);
  const cyclic = topoSortTrace([...TOPO_EDGES, ['F', 'C']]);
  assert.ok(last(cyclic).caption.includes('环'));
});

test('the size-k min-heap ends with the k-th largest at its root', () => {
  for (const [stream, k] of [
    [[5, 2, 9, 1, 7, 8, 3], 3],
    [[4, 4, 4, 1], 2],
    [[10], 1],
    [[1, 2, 3, 4, 5, 6], 6],
  ] as [number[], number][]) {
    const trace = heapTrace(stream, k);
    const expected = [...stream].sort((a, b) => b - a)[k - 1];
    assert.equal(stat(trace, '第 k 大'), String(expected));
    const heap = last(trace).cells.map((c) => Number(c.value));
    assert.ok(heap.every((v, i) => !i || heap[(i - 1) >> 1] <= v), 'min-heap order');
    assert.ok(trace.frames.every((f) => f.cells.length <= k + 1));
  }
  assert.throws(() => heapTrace([1], 2));
});

test('the monotonic stack gives each next greater element and never increases upward', () => {
  for (const values of [
    [3, 1, 4, 1, 5, 9, 2, 6],
    [5, 4, 3],
    [1, 2, 3],
    [2, 2, 2],
  ]) {
    const trace = monotonicStackTrace(values);
    const expected = values.map((v, i) => values.slice(i + 1).find((w) => w > v) ?? -1);
    assert.deepEqual(last(trace).cells.slice(values.length).map((c) => c.value), expected);
    for (const frame of trace.frames) {
      const stack = frame.queue!.map((s) => Number.parseInt(s, 10));
      assert.ok(stack.every((v, i) => !i || stack[i - 1] >= v), `${values}: ${stack}`);
    }
  }
});

test('the LCS table matches a brute-force subsequence search, and the traced path spells one', () => {
  const subsequences = (s: string): string[] =>
    s ? subsequences(s.slice(1)).flatMap((rest) => [s[0] + rest, rest]) : [''];
  for (const [a, b] of [
    ['ACBD', 'ABCD'],
    ['ABC', 'DEF'],
    ['AAB', 'ABA'],
  ]) {
    const common = new Set(subsequences(b));
    const best = Math.max(...subsequences(a).filter((s) => common.has(s)).map((s) => s.length));
    const trace = dpTableTrace(a, b);
    assert.equal(stat(trace, 'LCS 长度'), String(best));
    const picked = last(trace)
      .cells.flatMap((c, i) => (c.state === 'answer' ? [i] : []))
      .map((i) => a[Math.floor(i / (b.length + 2)) - 2]);
    assert.equal(picked.length, best);
    assert.ok(common.has(picked.join('')));
  }
});

test('backtracking collects all 2^n subsets once, and the tree has 2^(n+1) − 1 nodes', () => {
  const trace = backtrackingTrace([1, 2, 3]);
  const results = last(trace).queue!;
  assert.equal(results.length, 8);
  assert.equal(new Set(results).size, 8);
  assert.ok(results.includes('{}') && results.includes('{1,2,3}'));
  assert.equal(last(trace).graph!.nodes.length, 15);
});

test('the trie shares prefixes and answers searches like a word list', () => {
  const words = ['cat', 'car', 'cart', 'dog', 'do'];
  const trace = trieTrace(words, ['car', 'cap', 'do', 'ca']);
  const prefixes = new Set(words.flatMap((w) => [...w].map((_, i) => w.slice(0, i + 1))));
  assert.equal(stat(trace, '节点数'), String(prefixes.size + 1));
  const searches = trace.frames.filter((f) => f.caption.startsWith('查找'));
  assert.deepEqual(
    searches.map((f) => f.caption.includes('存在。') && !f.caption.includes('不存在')),
    [true, false, true, false],
  );
});

test('every stop with a demo maps to known kinds', () => {
  for (const [stop, kinds = []] of Object.entries(STOP_DEMOS)) {
    assert.ok(Object.hasOwn(STOP_NAMES, stop), stop);
    assert.ok(kinds.length && kinds.every((k) => demoKinds.includes(k)), stop);
  }
  // Every demo kind is reachable from some topic page.
  assert.deepEqual(new Set(Object.values(STOP_DEMOS).flat()), new Set(demoKinds));
});
