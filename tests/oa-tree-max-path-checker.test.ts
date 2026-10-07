import assert from 'node:assert/strict';
import test from 'node:test';
import { treeMaxPath } from '../lib/oa-tree-max-path-checker.mjs';

type Tree = { values: number[]; children: [number, number][] };
const inputOf = (t: Tree) =>
  `${t.values.length}\n${t.values.join(' ')}\n${t.children.map((x) => x.join(' ')).join('\n')}`;
const outputOf = (t: Tree, ids: number[], best?: number) =>
  [
    t.values.reduce((a, b) => a + b, 0),
    best ?? ids.reduce((sum, id) => sum + t.values[id], 0),
    ids.map((id) => t.values[id]).join(' '),
    ids.join(' '),
  ].join('\n');

// Independent oracle enumerates every endpoint pair; it does not use tree DP.
function paths(t: Tree) {
  const edges = t.values.map(() => [] as number[]);
  t.children.forEach((pair, parent) =>
    pair.forEach((child) => {
      if (child >= 0) {
        edges[parent].push(child);
        edges[child].push(parent);
      }
    }),
  );
  const results: { ids: number[]; sum: number }[] = [];
  for (let start = 0; start < edges.length; start++) {
    const queue = [{ ids: [start], sum: t.values[start] }];
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i];
      results.push(path);
      const node = path.ids.at(-1)!;
      for (const next of edges[node]) {
        if (next !== path.ids.at(-2))
          queue.push({
            ids: [...path.ids, next],
            sum: path.sum + t.values[next],
          });
      }
    }
  }
  return results;
}

test('all endpoint paths agree with an independent exhaustive oracle on deterministic small trees', () => {
  let state = 19;
  const random = (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
  for (let iteration = 0; iteration < 160; iteration++) {
    const n = 1 + random(11);
    const t: Tree = {
      values: Array.from({ length: n }, () => random(9) - 4),
      children: Array.from({ length: n }, () => [-1, -1]),
    };
    for (let child = 1; child < n; child++) {
      const slots: [number, number][] = [];
      for (let p = 0; p < child; p++)
        for (let side = 0; side < 2; side++)
          if (t.children[p][side] === -1) slots.push([p, side]);
      const [p, side] = slots[random(slots.length)];
      t.children[p][side] = child;
    }
    const candidates = paths(t);
    const best = Math.max(...candidates.map((p) => p.sum));
    for (const candidate of candidates) {
      assert.equal(
        treeMaxPath(
          outputOf(t, candidate.ids, best),
          'untrusted expected',
          inputOf(t),
        ),
        candidate.sum === best,
        JSON.stringify({ t, candidate, best }),
      );
    }
  }
});

test('ties, reversed direction, repeated values, zero extensions and all-negative trees', () => {
  const zero: Tree = {
    values: [0, 0, 0],
    children: [
      [1, 2],
      [-1, -1],
      [-1, -1],
    ],
  };
  for (const ids of [[0], [1], [2], [1, 0], [0, 2], [1, 0, 2], [2, 0, 1]]) {
    assert.equal(treeMaxPath(outputOf(zero, ids), '', inputOf(zero)), true);
  }
  const negative: Tree = {
    values: [-9, -2, -2],
    children: [
      [1, 2],
      [-1, -1],
      [-1, -1],
    ],
  };
  for (const ids of [[1], [2]])
    assert.equal(
      treeMaxPath(outputOf(negative, ids), '', inputOf(negative)),
      true,
    );
  const t: Tree = {
    values: [3, 3, 3],
    children: [
      [1, 2],
      [-1, -1],
      [-1, -1],
    ],
  };
  assert.equal(
    treeMaxPath(
      outputOf(t, [2, 0, 1]).replace(/\n/g, '\r\n') + '\r\n',
      '',
      inputOf(t),
    ),
    true,
  );
});

test('reject malformed or forged output even with matching expected output', () => {
  const t: Tree = {
    values: [0, 0, 0],
    children: [
      [1, 2],
      [-1, -1],
      [-1, -1],
    ],
  };
  const source = inputOf(t);
  for (const actual of [
    '0\n0\n\n',
    '0\n0\n0',
    '0\n0\n0\n0\n\n',
    '0\n0\n0\n0\nextra',
    '0\n0\n0 0\n1 2',
    '0\n0\n0 0 0\n0 1 0',
    '0\n0\n0\n3',
    '0\n0\n0\n-1',
    '0\n0\n1\n0',
    '1\n0\n0\n0',
    '0\n1\n0\n0',
    '0 0\n0\n0\n0',
    '0\n0\n0 0\n0',
    '0\n0\n0\n0 1',
    '0\n0\n0\n0.0',
    '0\n0\n0\n1e0',
    '0\n0\n0\nNaN',
    '0\n0\n0\nInfinity',
    '0\n0\n0\n9007199254740992',
    '0\n0\n0\n0\r',
    '0\n0\n0\n0\u00a0',
  ])
    assert.equal(
      treeMaxPath(actual, actual, source),
      false,
      JSON.stringify(actual),
    );
});

test('reject malformed tree input, invalid bounds, duplicate parents, cycles and disconnected nodes', () => {
  const actual = '0\n0\n0\n0';
  for (const source of [
    '',
    '0',
    '-1',
    '200001',
    '1 0 -1',
    '1 0 -1 -1 extra',
    '1 0 -1 -1 0',
    '1 1000000001 -1 -1',
    '1 -1000000001 -1 -1',
    '1 0 0 -1',
    '1 0 1 -1',
    '1 0 -2 -1',
    '1 0.0 -1 -1',
    '1 9007199254740992 -1 -1',
    '2 0 0 1 1 -1 -1',
    '2 0 0 -1 -1 -1 -1',
    '2 0 0 1 -1 0 -1',
    '3 0 0 0 -1 -1 2 -1 1 -1',
    '3 0 0 0 1 2 2 -1 -1 -1',
  ])
    assert.equal(treeMaxPath(actual, '', source), false, source);
  assert.equal(treeMaxPath(null, '', '1 0 -1 -1'), false);
  assert.equal(treeMaxPath(actual, '', null), false);
});

test('200,000-node positive chain has exact safe sums and no recursion', () => {
  const n = 200_000;
  const t: Tree = {
    values: Array(n).fill(1e9),
    children: Array.from({ length: n }, (_, i) => [i + 1 < n ? i + 1 : -1, -1]),
  };
  const ids = Array.from({ length: n }, (_, i) => i);
  assert.equal(treeMaxPath(outputOf(t, ids), '', inputOf(t)), true);
  ids.reverse();
  assert.equal(treeMaxPath(outputOf(t, ids), '', inputOf(t)), true);
});

test('200,000-node complete all-negative tree accepts any tied maximum', () => {
  const n = 200_000;
  const t: Tree = {
    values: Array(n).fill(-1e9),
    children: Array.from({ length: n }, (_, i) => [
      2 * i + 1 < n ? 2 * i + 1 : -1,
      2 * i + 2 < n ? 2 * i + 2 : -1,
    ]),
  };
  assert.equal(treeMaxPath(outputOf(t, [n - 1]), '', inputOf(t)), true);
});

test('bounded hostile input and output are rejected', () => {
  const source = '1 0 -1 -1';
  assert.equal(
    treeMaxPath('0\n0\n0\n0', '', ' '.repeat(32 * 1024 * 1024 + 1)),
    false,
  );
  assert.equal(treeMaxPath(' '.repeat(8 * 1024 * 1024 + 1), '', source), false);
  assert.equal(treeMaxPath('\n'.repeat(8 * 1024 * 1024), '', source), false);
  assert.equal(
    treeMaxPath('0\n0\n0\n' + '9'.repeat(1024 * 1024), '', source),
    false,
  );
  assert.equal(
    treeMaxPath('0\n0\n0\n0', '', '1 0 -1 -1 ' + '0 '.repeat(100_000)),
    false,
  );
});
