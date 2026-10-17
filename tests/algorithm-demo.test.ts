import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeKeys,
  binarySearchTrace,
  slidingWindowTrace,
  bfsTrace,
  createDemoTrace,
  demoInputs,
  dpTrace,
  guessTargets,
  isDemoKind,
  type DemoKind,
  type DemoTrace,
} from '../lib/algorithm-demo';

test('binary search preserves candidate interval and handles missing/empty values', () => {
  for (const target of [2, 5, 8, 12, 16, 23, 38, 56, 7]) {
    const trace = binarySearchTrace(undefined, target);
    const answer = trace.frames
      .at(-1)!
      .cells.findIndex((c) => c.state === 'answer');
    assert.equal(answer, [2, 5, 8, 12, 16, 23, 38, 56].indexOf(target));
    if (answer >= 0)
      for (const frame of trace.frames) {
        const stats = Object.fromEntries(frame.stats);
        assert.ok(
          answer >= Number(stats.left) && answer <= Number(stats.right),
        );
      }
  }
  assert.equal(binarySearchTrace([], 1).frames.at(-1)!.done, true);
});
test('sliding window agrees with brute force and all displayed windows have unique characters', () => {
  for (const input of ['', 'aaaa', 'abba', 'pwwkew', 'abcabcbb', '😀a😀b']) {
    const chars = Array.from(input);
    let expected = 0;
    for (let i = 0; i < chars.length; i++)
      for (let j = i + 1; j <= chars.length; j++)
        if (new Set(chars.slice(i, j)).size === j - i)
          expected = Math.max(expected, j - i);
    const trace = slidingWindowTrace(input);
    assert.equal(
      Object.fromEntries(trace.frames.at(-1)!.stats)['最长长度'],
      String(expected),
    );
    for (const frame of trace.frames) {
      const active = frame.cells
        .filter((c) => c.state === 'active')
        .map((c) => c.value);
      assert.equal(new Set(active).size, active.length);
    }
  }
});
test('BFS discovers each cell once and reconstructs an adjacent obstacle-free shortest path', () => {
  const trace = bfsTrace(),
    final = trace.frames.at(-1)!;
  assert.equal(Object.fromEntries(final.stats)['终点距离'], '7');
  const path = final.cells.flatMap((c, i) => (c.state === 'answer' ? [i] : []));
  assert.equal(path.length, 8);
  assert.ok(path.includes(0) && path.includes(19));
  assert.ok(!path.some((i) => [6, 7, 12].includes(i)));
  for (const i of path) {
    const adjacent = path.filter(
      (j) =>
        Math.abs(Math.floor(i / 5) - Math.floor(j / 5)) +
          Math.abs((i % 5) - (j % 5)) ===
        1,
    );
    assert.equal(adjacent.length, i === 0 || i === 19 ? 1 : 2);
  }
  for (const frame of trace.frames)
    assert.equal(new Set(frame.queue).size, frame.queue?.length);
});
test('coin-change DP agrees with breadth-first enumeration including impossible and zero amounts', () => {
  for (const coins of [[1, 3, 4], [2, 4], [5], []])
    for (let amount = 0; amount <= 12; amount++) {
      let frontier = [0],
        expected = Infinity;
      const seen = new Set([0]);
      for (let count = 0; frontier.length; count++) {
        if (frontier.includes(amount)) {
          expected = count;
          break;
        }
        const next: number[] = [];
        for (const sum of frontier)
          for (const coin of coins)
            if (sum + coin <= amount && !seen.has(sum + coin)) {
              seen.add(sum + coin);
              next.push(sum + coin);
            }
        frontier = next;
      }
      const trace = dpTrace(amount, coins);
      assert.equal(
        trace.frames.at(-1)!.cells[amount].value,
        Number.isFinite(expected) ? expected : '∞',
      );
    }
  assert.throws(() => dpTrace(5, [0]));
});
test('unknown demo identifiers are not allowed', () => {
  assert.equal(isDemoKind('binary-search'), true);
  assert.equal(isDemoKind('__proto__'), false);
});

test('each custom-input placeholder parses back to the default demo, kind by kind', () => {
  const kinds = Object.keys(demoInputs) as DemoKind[];
  assert.deepEqual(kinds.sort(), [
    'backtracking', 'binary-search', 'dfs', 'dp', 'dp-table', 'heap', 'monotonic-stack',
    'sliding-window', 'topo-sort', 'trie', 'two-pointers',
  ]);
  for (const kind of kinds) {
    const parsed = demoInputs[kind]!.parse(demoInputs[kind]!.placeholder);
    assert.ok('args' in parsed, kind);
    for (const english of [false, true])
      assert.deepEqual(createDemoTrace(kind, english, parsed.args), createDemoTrace(kind, english), kind);
  }
  for (const kind of ['bfs', 'dijkstra', 'union-find'] as const) assert.equal(demoInputs[kind], undefined);
});

test('custom inputs are size-limited and every rejection explains itself in both languages', () => {
  const error = (kind: DemoKind, text: string) => {
    const parsed = demoInputs[kind]!.parse(text);
    assert.ok('error' in parsed, `${kind}: ${text}`);
    assert.equal(parsed.error.length, 2);
    return parsed.error[1];
  };
  const ok = (kind: DemoKind, text: string) => {
    const parsed = demoInputs[kind]!.parse(text);
    assert.ok('args' in parsed, `${kind}: ${text} → ${'error' in parsed ? parsed.error[1] : ''}`);
    return parsed.args;
  };
  const twelve = Array.from({ length: 12 }, (_, i) => i * 8 - 40).join(' ');
  assert.equal(error('binary-search', '   '), 'Type an input first');
  assert.deepEqual(ok('binary-search', `${twelve}; 99`), [Array.from({ length: 12 }, (_, i) => i * 8 - 40), 99]);
  assert.equal(error('binary-search', `${twelve} 60; 3`), 'At most 12 numbers');
  assert.equal(error('binary-search', '1 2 100; 2'), 'Each number must be between −99 and 99');
  assert.equal(error('binary-search', '3 1 2; 2'), 'The array must be sorted from small to large');
  assert.equal(error('binary-search', '1 2 3'), 'Use 2 parts separated by semicolons');
  assert.equal(error('two-pointers', '1 2.5; 3'), '"2.5" is not a whole number');
  assert.equal(error('two-pointers', '1 2 3; 4 5'), 'Enter exactly one whole number here');
  assert.equal(error('dp', '; 1 2'), 'Enter exactly one whole number here');
  assert.deepEqual(ok('sliding-window', '😀ab cd😀efghijklm'), ['😀ab cd😀efghijklm']);
  assert.equal(error('sliding-window', 'abcdefghijklmnopq'), 'At most 16 characters');
  assert.deepEqual(ok('dp', '15；1，3，4，7'), [15, [1, 3, 4, 7]]);
  assert.equal(error('dp', '16; 1 2'), 'The amount must be between 0 and 15');
  assert.equal(error('dp', '6; 1 2 3 4 5'), 'At most 4 numbers');
  assert.equal(error('dp', '6; 0 2'), 'Coin values must be positive');
  assert.deepEqual(ok('dfs', '11111111 00000000'), [['11111111', '00000000']]);
  assert.equal(error('dfs', '111111111'), 'At most 8 cells per row');
  assert.equal(error('dfs', '1 1 1 1 1 1 1'), 'At most 6 rows');
  assert.equal(error('dfs', '10 1'), 'Every row must be the same length');
  assert.equal(error('dfs', '12 01'), 'Rows hold only 0s and 1s');
  assert.equal(error('heap', '1 2; 3'), 'k must be between 1 and 2');
  assert.equal(error('monotonic-stack', `${twelve} 1`), 'At most 12 numbers');
  assert.deepEqual(ok('dp-table', 'abcdefghij; XY'), ['abcdefghij', 'XY']);
  assert.equal(error('dp-table', 'abcdefghijk xy'), '"abcdefghijk": 1 to 10 letters or digits only');
  assert.equal(error('dp-table', 'abc'), 'Enter two strings separated by a space');
  assert.deepEqual(ok('backtracking', '-9 0 4 9'), [[-9, 0, 4, 9]]);
  assert.equal(error('backtracking', '1 2 3 4 5'), 'At most 4 numbers');
  assert.equal(error('backtracking', '10'), 'Each number must be between −9 and 9');
  assert.deepEqual(ok('trie', 'Apple ape'), [['apple', 'ape'], []]);
  assert.equal(error('trie', 'a b c d e f g'), 'At most 6 words');
  assert.equal(error('trie', 'abcdefghi'), '"abcdefghi": each word is 1 to 8 letters a–z');
  assert.equal(error('trie', 'ok; a b c d e f g'), 'At most 6 searches');
  assert.equal(error('trie', ' ; ab'), 'Insert at least one word');
  assert.deepEqual(ok('topo-sort', 'a -> b, B→C'), [[['A', 'B'], ['B', 'C']]]);
  assert.equal(error('topo-sort', 'A>B B>G'), 'Write each edge as A>C, using only A to F');
  assert.equal(error('topo-sort', 'A>A'), 'An edge cannot point to its own node');
  assert.equal(error('topo-sort', 'A>B A>B'), 'An edge is listed twice');
  assert.equal(
    error('topo-sort', 'A>B A>C A>D A>E A>F B>C B>D B>E B>F C>D C>E'),
    'At most 10 edges',
  );
});

test('a custom input drives the trace from its first frame to its answer', () => {
  const run = (kind: DemoKind, text: string) => {
    const parsed = demoInputs[kind]!.parse(text);
    assert.ok('args' in parsed);
    return createDemoTrace(kind, true, parsed.args);
  };
  const answers = (trace: DemoTrace) => trace.frames.at(-1)!.cells.flatMap((c, i) => (c.state === 'answer' ? [i] : []));
  const stats = (trace: DemoTrace) => Object.fromEntries(trace.frames.at(-1)!.stats);
  let trace = run('binary-search', '1 3 5 7; 7');
  assert.equal(trace.question, 'Find 7 in a sorted array');
  assert.deepEqual(trace.frames[0].cells.map((c) => c.value), [1, 3, 5, 7]);
  assert.deepEqual(answers(trace), [3]);
  assert.equal(trace.frames.at(-1)!.done, true);
  trace = run('two-pointers', '1 2 3; 10');
  assert.equal(trace.frames.at(-1)!.caption, 'The pointers met: no pair adds up to the target.');
  trace = run('sliding-window', 'aab');
  assert.equal(stats(trace).Longest, '2');
  trace = run('dp', '7; 2 5');
  assert.equal(trace.frames[0].cells.length, 8);
  assert.equal(trace.frames.at(-1)!.cells[7].value, 2);
  assert.equal(run('dp', '3; 2').frames.at(-1)!.caption, 'Done: 3 cannot be made, return −1.');
  trace = run('dfs', '101 101 010');
  assert.equal(trace.columns, 3);
  assert.equal(stats(trace).Islands, '3');
  trace = run('heap', '4 1 3; 2');
  assert.equal(stats(trace)['k-th largest'], '3');
  assert.match(trace.frames.at(-1)!.caption, /2nd largest/);
  trace = run('monotonic-stack', '2 1 3');
  assert.deepEqual(trace.frames.at(-1)!.cells.slice(3).map((c) => c.value), [3, 3, -1]);
  trace = run('dp-table', 'AB BA');
  assert.equal(stats(trace)['LCS length'], '1');
  assert.equal(trace.columns, 4);
  trace = run('backtracking', '1 2 3 4');
  assert.equal(trace.frames.at(-1)!.queue!.length, 16);
  assert.equal(trace.frames.at(-1)!.graph!.width, 160);
  // Neighbouring leaves alternate note rows, so 16 subset labels do not collide.
  const leaves = trace.frames.at(-1)!.graph!.nodes.filter((n) => n.id.length === 4).sort((x, y) => x.x - y.x);
  assert.deepEqual(leaves.map((n) => n.noteDy ?? 0).slice(0, 4), [0, 3.6, 0, 3.6]);
  trace = run('trie', 'to tea; tea te');
  assert.equal(stats(trace).Words, '2');
  assert.equal(trace.frames.at(-2)!.caption, 'Search "te": the path exists but has no word mark, only a prefix.');
  trace = run('topo-sort', 'A>B B>A C>D');
  assert.equal(trace.frames[0].graph!.edges.length, 3);
  assert.equal(trace.frames.at(-1)!.caption, 'Only 4 nodes came out; the rest sit on a cycle, so no topological order exists.');
});

test('predict mode asks for what turns current next, and skips steps with nothing new to click', () => {
  const trace = createDemoTrace('binary-search', true);
  // Frame 1 checks mid = 3; frame 2 only moves left, so nothing new turns current.
  assert.deepEqual([...guessTargets(trace.frames[0], trace.frames[1])], ['c3']);
  assert.deepEqual([...guessTargets(trace.frames[1], trace.frames[2])], []);
  assert.deepEqual([...activeKeys(trace.frames[1])], ['c3']);
  // Graph kinds: the node id, and the cell for the same node.
  const dijkstra = createDemoTrace('dijkstra', true);
  assert.deepEqual([...guessTargets(dijkstra.frames[0], dijkstra.frames[1])].sort(), ['c0', 'nA']);
  // Backtracking draws a node only once the search reaches it: nothing to click before then.
  const tree = createDemoTrace('backtracking', true);
  assert.deepEqual([...guessTargets(tree.frames[0], tree.frames[1])], []);
  const back = tree.frames.findIndex((f) => f.caption.startsWith('Backtrack'));
  assert.equal(guessTargets(tree.frames[back - 1], tree.frames[back]).size, 1);
});
