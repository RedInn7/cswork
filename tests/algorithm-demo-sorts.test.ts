// The eight sorting demos: every input ends sorted, the comparison counts match the textbook
// best and worst cases, the stability verdict is right, and every preset parses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoTrace, demoInputs, enText, type DemoKind, type DemoTrace } from '../lib/algorithm-demo';
import { SORT_ALGOS, SORT_DEFAULT, sortTrace, type SortAlgo } from '../lib/algorithm-demo-sorts';

const t = enText;
const stats = (trace: DemoTrace) => Object.fromEntries(trace.frames.at(-1)!.stats);
const result = (trace: DemoTrace, n: number) => trace.frames.at(-1)!.cells.slice(0, n).map((c) => Number(c.value));

test('every sort ends ascending on sorted, reversed, random, duplicate and single inputs', () => {
  const inputs = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [5, 0, 9, 2, 7, 3, 8, 1, 6, 4, 9, 0],
    [3, 1, 3, 2, 1, 2, 3, 1],
    [4],
    SORT_DEFAULT,
  ];
  for (const algo of SORT_ALGOS)
    for (const values of inputs) {
      const trace = sortTrace(algo, values, t);
      assert.deepEqual(result(trace, values.length), [...values].sort((a, b) => a - b), `${algo}: ${values}`);
      assert.equal(trace.frames.filter((f) => f.done).length, 1);
      // Each value keeps its starting index as its label: nothing is lost or duplicated.
      const labels = trace.frames.at(-1)!.cells.slice(0, values.length).map((c) => c.label);
      assert.equal(new Set(labels).size, values.length, algo);
    }
  // Radix takes two-digit numbers; the comparison sorts take negatives.
  assert.deepEqual(result(sortTrace('radix', [42, 7, 99, 10, 7], t), 5), [7, 7, 10, 42, 99]);
  assert.deepEqual(result(sortTrace('quick', [-5, 3, -99, 0], t), 4), [-99, -5, 0, 3]);
});

test('comparison counts: insertion and bubble are linear on sorted input, quicksort is quadratic', () => {
  const n = 8,
    up = [1, 2, 3, 4, 5, 6, 7, 8],
    down = [...up].reverse();
  const compares = (algo: SortAlgo, values: number[]) => Number(stats(sortTrace(algo, values, t)).Comparisons);
  assert.equal(compares('insertion', up), n - 1);
  assert.equal(compares('insertion', down), (n * (n - 1)) / 2);
  assert.equal(compares('bubble', up), n - 1);
  assert.ok(sortTrace('bubble', up, t).frames.some((f) => f.caption.includes('stop early')));
  assert.equal(compares('quick', up), (n * (n - 1)) / 2);
  assert.equal(compares('selection', up), (n * (n - 1)) / 2);
  assert.equal(compares('counting', down), 0);
  assert.equal(compares('radix', down), 0);
  assert.equal(stats(sortTrace('insertion', up, t))['Swaps/writes'], '0');
});

test('stability: five sorts keep equal keys in order, the other three break it on the default input', () => {
  for (const algo of SORT_ALGOS) {
    const verdict = stats(sortTrace(algo, SORT_DEFAULT, t)).Stable;
    assert.equal(verdict, ['selection', 'quick', 'heap'].includes(algo) ? 'no' : 'yes', algo);
    for (const values of [[3, 1, 3, 2, 1, 2, 3, 1], [5, 5, 5, 5], [2, 1, 2, 1, 2, 1, 2]])
      if (['bubble', 'insertion', 'merge', 'counting', 'radix'].includes(algo))
        assert.equal(stats(sortTrace(algo, values, t)).Stable, 'yes', `${algo}: ${values}`);
  }
  // The verdict reads the labels: equal values whose #i went backwards.
  const heap = sortTrace('heap', SORT_DEFAULT, t).frames.at(-1)!.cells;
  assert.ok(heap.some((c, i) => i && c.value === heap[i - 1].value && Number(c.label.slice(1)) < Number(heap[i - 1].label.slice(1))));
});

test('two-row sorts keep full rows, and both languages walk the same frames', () => {
  for (const algo of SORT_ALGOS) {
    const zh = createDemoTrace(`sort-${algo}`),
      en = createDemoTrace(`sort-${algo}`, true);
    assert.equal(zh.frames.length, en.frames.length, algo);
    if (en.columns) for (const frame of en.frames) assert.equal(frame.cells.length, 2 * en.columns, algo);
    assert.ok(en.frames.every((f) => !/[一-鿿]/.test(f.caption + f.stats.flat().join(''))), algo);
    assert.ok(zh.frames.at(-1)!.stats.some(([label]) => label === '稳定'));
  }
});

test('every preset parses, the random one makes a fresh input each click, and ranges are enforced', () => {
  for (const algo of SORT_ALGOS) {
    const custom = demoInputs[`sort-${algo}` as DemoKind]!;
    assert.deepEqual(custom.presets!.map(([label]) => label[1]), ['Sorted', 'Reversed', 'Random', 'Duplicate keys']);
    for (const [label, value] of custom.presets!) {
      for (let round = 0; round < (typeof value === 'function' ? 20 : 1); round++) {
        const parsed = custom.parse(typeof value === 'function' ? value() : value);
        assert.ok('args' in parsed, `${algo}: ${label[1]}`);
        const values = parsed.args[0] as number[];
        assert.deepEqual(result(createDemoTrace(`sort-${algo}`, true, parsed.args), values.length), [...values].sort((a, b) => a - b));
      }
    }
  }
  assert.ok('error' in demoInputs['sort-counting']!.parse('3 12'));
  assert.ok('error' in demoInputs['sort-radix']!.parse('3 -1'));
  assert.ok('error' in demoInputs['sort-merge']!.parse('1 2 3 4 5 6 7 8 9 10 11 12 13'));
});
