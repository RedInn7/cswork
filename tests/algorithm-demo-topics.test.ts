// The newer algorithm demos: every generator ends in the state a brute force agrees with,
// draws only nodes and edges it declares, and has the same frames in Chinese and English.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoGraphView } from '../components/algorithm-demo';
import courses from '../lib/content/beginner-courses.json';
import {
  DIJKSTRA_EDGES,
  TOPO_EDGES,
  arrayOpsTrace,
  backtrackingTrace,
  bitsTrace,
  bstTrace,
  hashTableTrace,
  intervalDpTrace,
  intervalGreedyTrace,
  kmpTrace,
  kruskalTrace,
  linkedListTrace,
  lruTrace,
  nQueensTrace,
  prefixSumTrace,
  stockDpTrace,
  treeTraversalTrace,
  type BstOp,
  type LruOp,
  createDemoTrace,
  demoKinds,
  dfsTrace,
  dijkstraTrace,
  dpTableTrace,
  enText,
  guessTargets,
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
  assert.equal(demoKinds.length, 36);
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

test('every stop has a demo of a known kind, and every kind is on a topic page or in the Big-O course', () => {
  for (const [stop, kinds = []] of Object.entries(STOP_DEMOS)) {
    assert.ok(Object.hasOwn(STOP_NAMES, stop), stop);
    assert.ok(kinds.length && kinds.every((k) => demoKinds.includes(k)), stop);
  }
  assert.deepEqual(Object.keys(STOP_NAMES).filter((stop) => !STOP_DEMOS[stop]?.length), []);
  const course = courses.courses.find((c) => c.slug === 'big-o')!;
  const inCourse = course.chapters.flatMap((ch) => [...ch.bodyZh.matchAll(/^```algorithm-demo\n(\S+)\n```/gm)].map((m) => m[1]));
  const reachable = new Set([...Object.values(STOP_DEMOS).flat(), ...inCourse]);
  assert.deepEqual(demoKinds.filter((k) => !reachable.has(k)), []);
});

/** A tiny deterministic generator, so the randomized checks below are reproducible. */
function rng(seed: number) {
  return (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
}
const final = (trace: DemoTrace) => Object.fromEntries(last(trace).stats);

test('array ops: insert keeps the order, delete closes the gap, dedupe keeps one of each', () => {
  const pick = rng(7);
  for (let round = 0; round < 40; round++) {
    const values = Array.from({ length: 1 + pick(8) }, () => pick(6)).sort((a, b) => a - b);
    const x = pick(7),
      del = pick(values.length + 1);
    const expected = [...values, x].sort((a, b) => a - b);
    expected.splice(del, 1);
    const trace = arrayOpsTrace(values, x, del);
    const kept = last(trace).cells.filter((c) => c.state === 'answer').map((c) => c.value);
    assert.deepEqual(kept, [...new Set(expected)], `${values}; ${x}; ${del}`);
  }
  assert.throws(() => arrayOpsTrace([1, 2], 3, 4));
});

test('hash table: every key lands in k mod buckets, and resizing keeps the load at most 0.75', () => {
  const pick = rng(3);
  for (const keys of [[12, 7, 4, 15, 9, 20, 3], [1, 1, 1], [0, 4, 8, 12, 16, 20, 24, 28, 32, 36], Array.from({ length: 10 }, () => pick(100))]) {
    const trace = hashTableTrace(keys);
    const buckets = last(trace).cells.map((c): number[] => (c.value === '∅' ? [] : String(c.value).split('→').map(Number)));
    assert.deepEqual(buckets.flat().sort((a, b) => a - b), [...new Set(keys)].sort((a, b) => a - b));
    buckets.forEach((chain, i) => assert.ok(chain.every((k) => k % buckets.length === i), `${keys}: bucket ${i}`));
    assert.ok(new Set(keys).size / buckets.length <= 0.75);
    for (const frame of trace.frames) assert.ok(Number(Object.fromEntries(frame.stats)['负载因子']) <= 1);
  }
  assert.ok(hashTableTrace().frames.some((f) => f.caption.includes('冲突')));
  assert.equal(final(hashTableTrace())['扩容次数'], '2');
});

test('linked list: insert, delete, then reverse matches the array operations', () => {
  const pick = rng(11);
  for (let round = 0; round < 40; round++) {
    const values = Array.from({ length: pick(6) + 1 }, () => pick(20));
    const x = 50 + pick(10),
      at = pick(values.length + 1),
      del = pick(values.length + 1);
    const list = [...values];
    list.splice(at, 0, x);
    list.splice(del, 1);
    const trace = linkedListTrace(values, x, at, del);
    assert.equal(final(trace)['从 head 读'], list.reverse().join(' → ') || '∅', `${values}; ${x} ${at}; ${del}`);
    for (const frame of trace.frames)
      for (const node of frame.graph!.nodes) assert.ok(node.x >= 0 && node.x <= 100, `${values}; ${at}: ${node.x}`);
  }
});

test('tree traversal: the stack and the queue reproduce the recursive orders', () => {
  const kids: Record<string, string[]> = { A: ['B', 'C'], B: ['D', 'E'], C: ['F', 'G'], D: [], E: [], F: [], G: [] };
  const pre = (u: string): string[] => [u, ...kids[u].flatMap(pre)];
  const inorder = (u: string): string[] => (kids[u].length ? [...inorder(kids[u][0]), u, ...inorder(kids[u][1])] : [u]);
  const post = (u: string): string[] => [...kids[u].flatMap(post), u];
  assert.deepEqual(final(treeTraversalTrace()), {
    前序: pre('A').join(' '),
    中序: inorder('A').join(' '),
    后序: post('A').join(' '),
    层序: 'A B C D E F G',
  });
  assert.deepEqual(Object.keys(final(treeTraversalTrace(['level', 'in']))), ['层序', '中序']);
});

test('BST: in-order stays sorted, and find / insert / all three delete cases match a set', () => {
  const trace = bstTrace();
  for (const frame of trace.frames) {
    const keys = Object.fromEntries(frame.stats)['中序'].split(' ').map(Number);
    assert.ok(keys.every((k, i) => !i || keys[i - 1] < k));
  }
  assert.equal(final(trace)['中序'], '3 4 5 6 7 10 13');
  for (const word of ['情况一', '情况二', '情况三']) assert.ok(trace.frames.some((f) => f.caption.startsWith(word)), word);
  const pick = rng(5);
  for (let round = 0; round < 30; round++) {
    const keys = Array.from({ length: 1 + pick(10) }, () => pick(30));
    const ops = Array.from({ length: 1 + pick(6) }, (): BstOp => [(['find', 'insert', 'delete'] as const)[pick(3)], pick(30)]);
    const set = new Set(keys);
    for (const [op, k] of ops) {
      if (op === 'insert') set.add(k);
      if (op === 'delete') set.delete(k);
    }
    assert.equal(final(bstTrace(keys, ops))['中序'], [...set].sort((a, b) => a - b).join(' ') || '∅', `${keys}; ${ops}`);
  }
});

test('Kruskal: the total weight matches the lightest spanning tree found by brute force', () => {
  const nodes = ['A', 'B', 'C', 'D', 'E', 'F'];
  let best = Infinity;
  for (let mask = 0; mask < 1 << DIJKSTRA_EDGES.length; mask++) {
    const picked = DIJKSTRA_EDGES.filter((_, i) => mask & (1 << i));
    if (picked.length !== nodes.length - 1) continue;
    const reach = new Set(['A']);
    for (let grew = true; grew; ) {
      grew = false;
      for (const [a, b] of picked)
        if (reach.has(a) !== reach.has(b)) {
          reach.add(a).add(b);
          grew = true;
        }
    }
    if (reach.size === nodes.length) best = Math.min(best, picked.reduce((s, [, , w]) => s + w, 0));
  }
  const trace = kruskalTrace();
  assert.equal(final(trace)['总权重'], String(best));
  assert.equal(last(trace).cells.filter((c) => c.state === 'answer').length, nodes.length - 1);
  assert.ok(trace.frames.some((f) => f.caption.includes('成环')));
});

test('N-queens counts 1, 0, 0, 2, 10 and 4 solutions for n = 1..6', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => final(nQueensTrace(n))['解的个数']), ['1', '0', '0', '2', '10', '4']);
  assert.throws(() => nQueensTrace(7));
});

test('interval DP, stock DP, prefix sums, bits and interval greedy agree with brute force', () => {
  const subsequences = (s: string): string[] => (s ? subsequences(s.slice(1)).flatMap((rest) => [s[0] + rest, rest]) : ['']);
  for (const s of ['agbdba', 'cbbd', 'a', 'abcde', 'aaaa', 'bbbab'])
    assert.equal(
      final(intervalDpTrace(s))['最长回文子序列'],
      String(Math.max(...subsequences(s).filter((x) => x === [...x].reverse().join('')).map((x) => x.length))),
      s,
    );
  // Equal ends two apart have nothing between: the caption cites no blank lower-triangle cell.
  const captions = intervalDpTrace('cbbd').frames.map((f) => f.caption);
  assert.ok(captions.some((c) => c.includes('中间为空，dp[1][2] = 2')));
  assert.ok(!captions.some((c) => c.includes('dp[2][1]')));
  // Stock with a cooldown: try every buy / sell / wait choice.
  const profit = (prices: number[], day = 0, holding = false, cooling = false): number => {
    if (day === prices.length) return 0;
    const wait = profit(prices, day + 1, holding, false);
    if (holding) return Math.max(wait, prices[day] + profit(prices, day + 1, false, true));
    return cooling ? wait : Math.max(wait, -prices[day] + profit(prices, day + 1, true, false));
  };
  const pick = rng(9);
  for (const prices of [[1, 2, 3, 0, 2], [1], [5, 4, 3], [2, 1, 4, 5, 2, 9, 7], Array.from({ length: 8 }, () => pick(20))])
    assert.equal(final(stockDpTrace(prices))['最大利润'], String(profit(prices)), String(prices));
  for (const [nums, k] of [[[1, 2, 1, -1, 2, 1], 3], [[1, 1, 1], 2], [[0, 0, 0], 0], [[3, -3, 3, -3], 0]] as [number[], number][]) {
    let count = 0;
    for (let i = 0; i < nums.length; i++)
      for (let j = i; j < nums.length; j++) if (nums.slice(i, j + 1).reduce((a, b) => a + b, 0) === k) count++;
    assert.equal(final(prefixSumTrace(nums, k))['子数组个数'], String(count), String(nums));
  }
  for (const x of [0, 1, 44, 128, 255, 170]) assert.equal(final(bitsTrace(x))['数到的 1'], String(x.toString(2).split('1').length - 1));
  for (let round = 0; round < 30; round++) {
    const intervals = Array.from({ length: 1 + pick(7) }, (): [number, number] => {
      const s = pick(10);
      return [s, s + 1 + pick(5)];
    });
    let best = 0;
    for (let mask = 0; mask < 1 << intervals.length; mask++) {
      const chosen = intervals.filter((_, i) => mask & (1 << i)).sort((a, b) => a[0] - b[0]);
      if (chosen.every((iv, i) => !i || chosen[i - 1][1] <= iv[0])) best = Math.max(best, chosen.length);
    }
    assert.equal(final(intervalGreedyTrace(intervals))['已选'], String(best), JSON.stringify(intervals));
  }
});

test('a short interval is still a bar between its two dots, never flipped or gone', () => {
  for (const intervals of [[[1, 2], [3, 11]], [[1, 3], [2, 50], [60, 99]]] as [number, number][][]) {
    const graph = intervalGreedyTrace(intervals).frames[0].graph!;
    const lines = [...renderToStaticMarkup(createElement(DemoGraphView, { graph })).matchAll(/<line x1="([^"]+)" y1="[^"]+" x2="([^"]+)"/g)];
    assert.equal(lines.length, graph.edges.length);
    graph.edges.forEach((e, i) => {
      const [x1, x2] = [Number(lines[i][1]), Number(lines[i][2])];
      const [from, to] = [e.from, e.to].map((id) => graph.nodes.find((n) => n.id === id)!.x);
      assert.ok(from <= x1 && x1 < x2 && x2 <= to, `${JSON.stringify(intervals)} #${i}: ${x1}–${x2}`);
    });
  }
});

test('LRU cache returns what a Map-based cache returns', () => {
  const reference = (capacity: number, ops: LruOp[]) => {
    const map = new Map<number, number>(),
      out: string[] = [];
    for (const [k, v] of ops) {
      if (v === undefined) {
        if (!map.has(k)) {
          out.push('-1');
          continue;
        }
        const value = map.get(k)!;
        map.delete(k);
        map.set(k, value);
        out.push(String(value));
        continue;
      }
      map.delete(k);
      map.set(k, v);
      if (map.size > capacity) map.delete(map.keys().next().value!);
    }
    return out;
  };
  // Every cell predict mode asks about shows the same key before and after the step.
  const stableCells = (trace: DemoTrace) =>
    trace.frames.slice(1).every((next, i) =>
      [...guessTargets(trace.frames[i], next)].every((key) => key[0] !== 'c' || trace.frames[i].cells[+key.slice(1)].label === next.cells[+key.slice(1)].label),
    );
  assert.deepEqual(last(lruTrace()).queue, ['1', '-1', '-1', '3', '4']);
  const pick = rng(13);
  for (let round = 0; round < 30; round++) {
    const capacity = 1 + pick(4);
    const ops = Array.from({ length: 1 + pick(12) }, (): LruOp => (pick(2) ? [pick(5), pick(50)] : [pick(5)]));
    const trace = lruTrace(capacity, ops);
    assert.deepEqual(last(trace).queue, reference(capacity, ops), JSON.stringify(ops));
    assert.ok(trace.frames.every((f) => f.cells.length <= capacity));
    assert.ok(stableCells(trace), JSON.stringify(ops));
  }
  // A new smaller key used to shift sorted cells, so predict mode asked about a cell whose key changed.
  assert.ok(stableCells(lruTrace(3, [[5, 5], [7, 7], [5], [6, 6]])));
});

test('KMP finds every occurrence and builds the brute-force prefix function', () => {
  const pick = rng(17);
  for (let round = 0; round < 40; round++) {
    const text = Array.from({ length: 1 + pick(14) }, () => 'ab'[pick(2)]).join('');
    const pat = text.slice(pick(text.length)).slice(0, 1 + pick(4)) || 'a';
    const trace = kmpTrace(text, pat);
    const expected = [...text].flatMap((_, i) => (text.startsWith(pat, i) ? [i] : []));
    assert.equal(final(trace)['匹配起点'], expected.join(' ') || '—', `${text} / ${pat}`);
    const pi = last(trace).cells.slice(2 * text.length).filter((c) => c.label.startsWith('pi')).map((c) => c.value);
    const border = (s: string) => Math.max(0, ...[...s].map((_, k) => k).filter((k) => k < s.length && s.slice(0, k) === s.slice(s.length - k)));
    assert.deepEqual(pi, [...pat].map((_, i) => border(pat.slice(0, i + 1))), pat);
  }
  assert.throws(() => kmpTrace('ab', 'abc'));
});
