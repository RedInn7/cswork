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

test('fixed OA checkers cannot be assigned to other question identities', () => {
  const pkg = JSON.parse(
    readFileSync('content/oa-judge/packages/oa-google-1.json', 'utf8'),
  );
  for (const [checker, id] of [
    ['oa-peak-index', 'oa-meta-17'],
    ['oa-closest-pair', 'oa-meta-16'],
    ['oa-window-averages', 'oa-meta-23'],
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
