import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOaSemantic } from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
import { ojImportSchema } from '../lib/oj-types';
import { readFileSync } from 'node:fs';

test('any valid peak is accepted, independently exhaustively enumerated', () => {
  const visit = (values: number[]) => {
    if (values.length) {
      const peaks = values.flatMap((v, i) =>
        (i === 0 || v > values[i - 1]) &&
        (i === values.length - 1 || v > values[i + 1])
          ? [i]
          : [],
      );
      const input = `${values.length}\n${values.join(' ')}\n`;
      for (let i = -1; i <= values.length; i++) {
        const expected = peaks.includes(i);
        assert.equal(
          matchesOutput(String(i), String(peaks[0]), 'oa-peak-index', input),
          expected,
        );
        assert.equal(
          matchesOaOutput(String(i), String(peaks[0]), 'oa-peak-index', input),
          expected,
        );
      }
    }
    if (values.length < 6)
      for (const next of [-1, 0, 1])
        if (values.at(-1) !== next) visit([...values, next]);
  };
  visit([]);
  assert(matchesOutput('5', '1', 'oa-peak-index', '7\n1 2 1 3 5 6 4\n'));
  for (const out of ['', 'NaN', '1 5', '1.0', '-1', '7'])
    assert(!matchesOutput(out, '1', 'oa-peak-index', '7\n1 2 1 3 5 6 4\n'));
});

test('closest pair permits either order, equal optima and only available multiplicities', () => {
  const visit = (values: number[]) => {
    if (values.length >= 2)
      for (let target = -2; target <= 12; target++) {
        const pairs: number[][] = [];
        for (let i = 0; i < values.length; i++)
          for (let j = i + 1; j < values.length; j++)
            pairs.push([values[i], values[j]]);
        const best = Math.min(
          ...pairs.map(([a, b]) => Math.abs(a + b - target)),
        );
        const winners = pairs.filter(
          ([a, b]) => Math.abs(a + b - target) === best,
        );
        const input = `${values.length} ${target}\n${values.join(' ')}\n`;
        for (let a = 1; a <= 6; a++)
          for (let b = 1; b <= 6; b++) {
            const expected = winners.some(
              ([x, y]) => (x === a && y === b) || (x === b && y === a),
            );
            assert.equal(
              matchesOaSemantic(
                'oa-closest-pair',
                `${a} ${b}`,
                winners[0].join(' '),
                input,
              ),
              expected,
            );
          }
      }
    if (values.length < 5)
      for (let v = values.at(-1) || 1; v <= 5; v++) visit([...values, v]);
  };
  visit([]);
  assert(matchesOutput('4 1', '2 3', 'oa-closest-pair', '4 5\n1 2 3 4\n'));
  assert(!matchesOutput('2 2', '1 2', 'oa-closest-pair', '3 4\n1 2 9\n'));
  assert(matchesOutput('2 2', '2 2', 'oa-closest-pair', '3 4\n2 2 9\n'));
});

test('invalid inputs and invalid reference outputs fail closed', () => {
  assert(!matchesOutput('0', '1', 'oa-peak-index', '1\n3\n'));
  assert(!matchesOutput('0', '0', 'oa-peak-index', '2\n1 1\n'));
  assert(!matchesOutput('0', '0', 'oa-peak-index', '1\n2147483648\n'));
  assert(!matchesOutput('1 3', '1 3', 'oa-closest-pair', '3 4\n3 1 2\n'));
  assert(!matchesOutput('1 3', '1 3', 'oa-closest-pair', '2 4\n1 3 5\n'));
  assert(!matchesOutput('1 3', '0 4', 'oa-closest-pair', '2 4\n1 3\n'));
  assert(!matchesOaSemantic('unknown', '0', '0', '1 0'));
});

test('window averages accept numeric tolerance, including negative one, and validate counts and input', () => {
  const check = (
    actual: string,
    expected: string,
    input: string,
    answer: boolean,
  ) => {
    assert.equal(
      matchesOutput(actual, expected, 'oa-window-averages', input),
      answer,
    );
    assert.equal(
      matchesOaOutput(actual, expected, 'oa-window-averages', input),
      answer,
    );
  };
  check('3 4e0 5.0000001 6', '3 4 5 6', '9 7\n1 2 3 4 5 6 7 8 9\n', true);
  check('1 -1.000001', '1 -1', '2 2\n-2 0\n', true);
  check('1 -1.00002', '1 -1', '2 2\n-2 0\n', false);
  check('1 0.333333', '1 .333333333333333333', '3 3\n1 0 0\n', true);
  check('0\n', '0', '0 1\n', true);
  check('0', '0', '2 3\n1 2', true);
  for (const output of [
    '',
    '1',
    '0 0',
    '1 NaN',
    '1 Infinity',
    '1 0x1',
    '1 1e999',
    '1 0 0',
    '01 0',
    '1\u00a00',
  ])
    check(output, '1 0', '1 1\n0', false);
  check('1 0', '1 7', '1 1\n0', false);
  check('0', '0', '1 0\n0', false);
  check('0', '0', '1 2\n1000000001', false);
  const n = 50000;
  check(
    `${n} ${Array(n).fill('1000000000').join(' ')}`,
    `${n} ${Array(n).fill('1000000000').join(' ')}`,
    `${n} 1\n${Array(n).fill('1000000000').join(' ')}`,
    true,
  );
  // Independently recompute each small window directly, without a rolling sum.
  for (let n = 0; n < 12; n++)
    for (let w = 1; w <= n + 2; w++) {
      const values = Array.from({ length: n }, (_, i) => ((i * 7) % 11) - 5);
      const averages = Array.from(
        { length: Math.max(0, n - w + 1) },
        (_, start) =>
          values
            .slice(start, start + w)
            .reduce((sum, value) => sum + value, 0) / w,
      );
      const output = `${averages.length} ${averages.join(' ')}`;
      const input = `${n} ${w}\n${values.join(' ')}`;
      check(output, output, input, true);
      if (averages.length)
        check(
          `${averages.length} ${[averages[0] + 0.1, ...averages.slice(1)].join(' ')}`,
          output,
          input,
          false,
        );
    }
});

test('balanced circles match an independent exhaustive subset-path oracle', () => {
  // Enumerate paths of individual people. No interval/frequency theorem is
  // used in this oracle; closing the last edge determines a valid circle.
  const oracle = (heights: number[]) => {
    let best: number[] = [];
    for (let start = 0; start < heights.length; start++) {
      const seen = new Set<number>();
      const visit = (mask: number, last: number, path: number[]) => {
        const key = mask * heights.length + last;
        if (seen.has(key)) return;
        seen.add(key);
        if (
          Math.abs(heights[last] - heights[start]) <= 1 &&
          path.length > best.length
        )
          best = [...path];
        for (let next = 0; next < heights.length; next++)
          if (
            !(mask & (1 << next)) &&
            Math.abs(heights[last] - heights[next]) <= 1
          )
            visit(mask | (1 << next), next, [...path, heights[next]]);
      };
      visit(1 << start, start, [heights[start]]);
    }
    return best;
  };
  const check = (
    actual: string,
    expected: string,
    input: string,
    valid: boolean,
  ) => {
    assert.equal(
      matchesOutput(actual, expected, 'oa-balanced-circle', input),
      valid,
    );
    assert.equal(
      matchesOaOutput(actual, expected, 'oa-balanced-circle', input),
      valid,
    );
  };
  for (let encoded = 1; encoded < 3 ** 5; encoded++) {
    let value = encoded;
    const heights: number[] = [];
    for (let height = 1; height <= 5; height++) {
      for (let copies = value % 3; copies > 0; copies--) heights.push(height);
      value = Math.floor(value / 3);
    }
    if (heights.length > 8) continue;
    const circle = oracle(heights);
    const input = `${heights.length}\n${heights.join(' ')}`;
    const expected = `${circle.length}\n${circle.join(' ')}`;
    check(expected, expected, input, true);
    check(
      `${circle.length} ${[...circle].reverse().join(' ')}`,
      expected,
      input,
      true,
    );
    if (circle.length > 1) check(`1 ${circle[0]}`, expected, input, false);
  }
  check('4 1 2 3 2', '4 2 3 2 1', '4\n1 2 2 3', true);
  check('4 1 2 2 3', '4 1 2 3 2', '4\n1 2 2 3', false); // broken closing edge
  check('4 2 2 2 2', '4 1 2 3 2', '4\n1 2 2 3', false); // reuses people
  check('4 1 2 3 2', '3 1 2 2', '4\n1 2 2 3', false); // stale nonoptimal expected
  for (const out of ['', '0', '1 1 2', '1 NaN', '1 Infinity', '1 0x1', '1 1.0'])
    check(out, '1 1', '1\n1', false);
  check('1 200001', '1 200001', '1\n200001', false);
  const n = 200000;
  const allEqual = `${n} ${Array(n).fill(200000).join(' ')}`;
  check(allEqual, allEqual, allEqual, true);
  check(
    '2 199999 200000',
    '2 1 2',
    `${n}\n${Array.from({ length: n }, (_, i) => i + 1).join(' ')}`,
    true,
  );
});

test('magic squares accept every valid arrangement, not just one construction', () => {
  const reference = '8 1 6\n3 5 7\n4 9 2';
  const check = (
    actual: string,
    expected: string,
    input: string,
    valid: boolean,
  ) => {
    assert.equal(
      matchesOutput(actual, expected, 'oa-magic-square', input),
      valid,
    );
    assert.equal(
      matchesOaOutput(actual, expected, 'oa-magic-square', input),
      valid,
    );
  };
  check('1', '1', '1', true);
  check(' null\r\n', 'null', '2', true);
  for (const impossible of ['NULL', '-1', '0', 'null 1', '\u00a0null'])
    check(impossible, 'null', '2', false);
  check(reference, reference, '3 3', false);
  check(reference, reference, '51', false);
  check(reference, reference, '0', false);
  check(Array(9).fill('5').join(' '), reference, '3', false);
  check(reference, '1 5 9 6 7 2 8 3 4', '3', false);
  let accepted = 0,
    candidates = 0;
  const visit = (cells: number[], used: number) => {
    if (
      cells.length &&
      cells.length % 3 === 0 &&
      cells.slice(-3).reduce((a, b) => a + b, 0) !== 15
    )
      return;
    if (cells.length === 9) {
      candidates++;
      const lines = [
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
      ];
      const valid = lines.every(
        (line) => line.reduce((sum, index) => sum + cells[index], 0) === 15,
      );
      check(cells.join(' '), reference, '3', valid);
      if (valid) accepted++;
      return;
    }
    for (let value = 1; value <= 9; value++)
      if (!(used & (1 << value))) visit([...cells, value], used | (1 << value));
  };
  visit([], 0);
  assert.equal(accepted, 8);
  assert(candidates > accepted);
  const four = [16, 2, 3, 13, 5, 11, 10, 8, 9, 7, 6, 12, 4, 14, 15, 1];
  check([...four].reverse().join(' '), four.join(' '), '4', true);
  // Large odd-order positive control, built independently by the Siamese walk.
  const n = 49,
    square = Array(n * n).fill(0);
  let row = 0,
    column = Math.floor(n / 2);
  for (let value = 1; value <= n * n; value++) {
    square[row * n + column] = value;
    const nextRow = (row + n - 1) % n,
      nextColumn = (column + 1) % n;
    if (square[nextRow * n + nextColumn]) row = (row + 1) % n;
    else {
      row = nextRow;
      column = nextColumn;
    }
  }
  check(square.join(' '), [...square].reverse().join(' '), String(n), true);
  check(
    Array(2500).fill(1).join(' '),
    Array(2500).fill(1).join(' '),
    '50',
    false,
  );
});

test('newspaper accepts different legal line breaks and rejects incorrect layout', () => {
  const frame = (rows: string[], width = 7) =>
    [
      '*'.repeat(width + 4),
      ...rows.map((row) => '* ' + row + ' *'),
      '*'.repeat(width + 4),
    ].join('\n');
  const input = '7 1\n4 a bb c d\n';
  const packed = frame(['a  bb c', '   d   ']);
  const single = frame(['   a   ', '  bb   ', '   c   ', '   d   ']);
  const accepts = (actual: string, expected = packed, data = input) => {
    const result = matchesOaSemantic('oa-newspaper', actual, expected, data);
    assert.equal(matchesOutput(actual, expected, 'oa-newspaper', data), result);
    assert.equal(
      matchesOaOutput(actual, expected, 'oa-newspaper', data),
      result,
    );
    return result;
  };
  assert(accepts(single));
  assert(accepts(packed.replace(/\n/g, '\r\n') + '\r\n'));
  for (const wrong of [
    frame(['a bb  c', '   d   ']), // extra gap must go left
    frame([' a bb c', '   d   ']), // nonlast line must be justified
    frame(['a  bb c', 'd      ']), // last line must be centered
    frame(['a  bb c', '  d    ']),
    frame(['a  bb c']),
    frame(['a  bb d', '   c   ']),
    single + '\n\n',
    single.replace('***********', '**********'),
    single.replace('  bb   ', '\tbb    '),
  ])
    assert(!accepts(wrong), JSON.stringify(wrong));
  assert(!accepts(single, 'invalid reference'));
  const two = '7 2\n1 a\n1 bb\n';
  assert(
    accepts(frame(['   a   ', '  bb   ']), frame(['   a   ', '  bb   ']), two),
  );
  assert(!accepts(frame([' a bb  ']), frame(['   a   ', '  bb   ']), two));
  for (const badInput of [
    '4 1 1 a',
    '51 1 1 a',
    '7 0',
    '7 21',
    '7 1 0',
    '7 1 11 a',
    '7 1 1 abcdefgh',
    '7 1 1 a extra',
    '7 1 1 é',
  ])
    assert(!accepts(single, packed, badInput));
  const maximum =
    '50 20\n' +
    Array(20)
      .fill('10 ' + Array(10).fill('x'.repeat(50)).join(' '))
      .join('\n');
  const maxOutput = frame(Array(200).fill('x'.repeat(50)), 50);
  assert(accepts(maxOutput, maxOutput, maximum));
  const stars = frame(['*****'], 5);
  assert(accepts(stars, stars, '5 1 1 *****'));
  assert(!accepts(single + 'x'.repeat(32768)));
  assert(!accepts(single, packed, input + ' '.repeat(16384)));
});

test('newspaper accepts all feasible partitions of a paragraph', () => {
  const words = ['a', 'bb', 'c', 'd'];
  const input = '7 1\n4 ' + words.join(' ') + '\n';
  const boxed = (rows: string[]) =>
    ['***********', ...rows.map((s) => '* ' + s + ' *'), '***********'].join(
      '\n',
    );
  const centered = (s: string) =>
    ' '.repeat(Math.floor((7 - s.length) / 2)) +
    s +
    ' '.repeat(Math.ceil((7 - s.length) / 2));
  const baseline = boxed(words.map(centered));
  let feasible = 0;
  for (let mask = 0; mask < 8; mask++) {
    const groups: string[][] = [[]];
    words.forEach((word, i) => {
      groups.at(-1)!.push(word);
      if (i < 3 && mask & (1 << i)) groups.push([]);
    });
    if (groups.some((group) => group.join(' ').length > 7)) continue;
    const rows = groups.map((group, index) => {
      if (index === groups.length - 1 || group.length === 1)
        return centered(group.join(' '));
      const gaps = Array(group.length - 1).fill(1);
      let remaining = 7 - group.join(' ').length;
      for (let i = 0; remaining > 0; i++, remaining--) gaps[i % gaps.length]++;
      return group
        .map((word, i) => word + (i < gaps.length ? ' '.repeat(gaps[i]) : ''))
        .join('');
    });
    assert(matchesOaSemantic('oa-newspaper', boxed(rows), baseline, input));
    feasible++;
  }
  assert.equal(feasible, 7);
});

test('fixed OA checkers cannot be assigned to other question identities', () => {
  const pkg = JSON.parse(
    readFileSync('content/oa-judge/packages/oa-google-1.json', 'utf8'),
  );
  for (const [checker, id] of [
    ['oa-peak-index', 'oa-meta-17'],
    ['oa-closest-pair', 'oa-meta-16'],
    ['oa-window-averages', 'oa-meta-23'],
    ['oa-balanced-circle', 'oa-microsoft-15'],
    ['oa-magic-square', 'oa-google-17'],
    ['oa-newspaper', 'oa-uber-6'],
  ]) {
    assert(
      ojImportSchema.safeParse({
        ...pkg,
        problem: { ...pkg.problem, checker, id },
      }).success,
    );
    assert(
      !ojImportSchema.safeParse({
        ...pkg,
        problem: { ...pkg.problem, checker },
      }).success,
    );
  }
});

test('teacher checker selector preserves the fixed OA option', () => {
  const source = readFileSync('components/oj-admin.tsx', 'utf8');
  assert.match(
    source,
    /'oa-',\s*\]\.some\(\(prefix\) => spec\.checker\.startsWith\(prefix\)\)/,
  );
  assert.match(
    source,
    /<option value=\{spec\.checker\}>\s*\{t\(\s*'本题专用规则/,
  );
});
