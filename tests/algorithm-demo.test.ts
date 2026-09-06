import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  binarySearchTrace,
  slidingWindowTrace,
  bfsTrace,
  dpTrace,
  isDemoKind,
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
