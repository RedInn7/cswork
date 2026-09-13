import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOaSemantic } from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

function truth(rows: number, columns: number, grid: number[]) {
  const found: number[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const radius = grid[row * columns + col];
      if (!radius) continue;
      let valid = true;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < columns; c++) {
          if (Math.abs(r - row) > radius || Math.abs(c - col) > radius)
            continue;
          if (Math.abs(r - row) === radius && Math.abs(c - col) === radius)
            continue;
          if (grid[r * columns + c] > radius) valid = false;
        }
      if (valid) found.push(row * columns + col);
    }
  return found;
}
const output = (ids: number[], columns: number) =>
  `${ids.length}\n${ids.map((id) => `${Math.floor(id / columns)} ${id % columns}`).join('\n')}\n`;
const input = (rows: number, columns: number, grid: number[]) =>
  `${rows} ${columns}\n${grid.join(' ')}\n`;

test('regional maxima match exhaustive independently scanned grids, including ties and corners', () => {
  for (const [rows, columns, alphabet] of [
    [1, 1, 4],
    [2, 3, 4],
    [3, 3, 3],
  ]) {
    const size = rows * columns;
    for (let encoded = 0; encoded < alphabet ** size; encoded++) {
      let value = encoded;
      const grid = Array.from({ length: size }, () => {
        const next = value % alphabet;
        value = Math.floor(value / alphabet);
        return next;
      });
      const expected = truth(rows, columns, grid),
        stdin = input(rows, columns, grid),
        reference = output(expected, columns);
      assert(
        matchesOaSemantic(
          'oa-regional-maxima',
          output([...expected].reverse(), columns),
          reference,
          stdin,
        ),
      );
      const toggled = expected.includes(encoded % size)
        ? expected.filter((v) => v !== encoded % size)
        : [...expected, encoded % size];
      assert(
        !matchesOaSemantic(
          'oa-regional-maxima',
          output(toggled, columns),
          reference,
          stdin,
        ),
      );
      assert(
        !matchesOaSemantic(
          'oa-regional-maxima',
          reference,
          output(toggled, columns),
          stdin,
        ),
      );
    }
  }
});

test('production and verifier agree; clipping must not remove newly created corners', () => {
  const stdin = input(3, 3, [2, 0, 0, 0, 3, 0, 0, 0, 9]);
  const expected = output(truth(3, 3, [2, 0, 0, 0, 3, 0, 0, 0, 9]), 3);
  for (const checker of [matchesOutput, matchesOaOutput]) {
    assert(checker(expected, expected, 'oa-regional-maxima', stdin));
    assert(!checker('2\n1 1\n2 2', expected, 'oa-regional-maxima', stdin));
    assert(!checker(expected, expected, 'oa-regional-maxima', '0 3\n'));
  }
  const cornerOnly = input(2, 2, [1, 0, 0, 9]);
  assert(
    matchesOaSemantic(
      'oa-regional-maxima',
      '2\n1 1\n0 0',
      '2\n0 0\n1 1',
      cornerOnly,
    ),
  );
  for (const malformed of [
    '2\n0 0\n0 0',
    '1\n0 0',
    '2\n0 0\n2 0',
    '2\n0 0\n1 1\n0',
    'NaN',
  ])
    assert(
      !matchesOaSemantic(
        'oa-regional-maxima',
        malformed,
        '2\n0 0\n1 1',
        cornerOnly,
      ),
    );
});

test('maximum grid, huge radii, zero grid and invalid protocols', () => {
  const ids = Array.from({ length: 10000 }, (_, i) => i);
  const grid = input(
    100,
    100,
    ids.map(() => 1000000000),
  );
  assert(
    matchesOaSemantic(
      'oa-regional-maxima',
      output([...ids].reverse(), 100),
      output(ids, 100),
      grid,
    ),
  );
  assert(
    matchesOaSemantic(
      'oa-regional-maxima',
      '0',
      '0\n',
      input(
        100,
        100,
        ids.map(() => 0),
      ),
    ),
  );
  for (const invalid of [
    '101 1\n0',
    '1 1\n-1',
    '1 1\n1000000001',
    '1 1\n1 2',
    '1 1\nNaN',
  ])
    assert(!matchesOaSemantic('oa-regional-maxima', '0', '0', invalid));
});
