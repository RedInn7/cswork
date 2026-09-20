import assert from 'node:assert/strict';
import test from 'node:test';
import { piecewiseLinear } from '../lib/oa-piecewise-linear-checker.mjs';
import { OA_SEMANTIC_IDS } from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
import { ojImportSchema } from '../lib/oj-types';

const encode = (points: string[][], queries: string[], eol = '\n') =>
  `${points.length} ${queries.length}${eol}` +
  points.map(([x, y]) => `${x} ${y}${eol}`).join('') +
  queries.join(eol) +
  eol;
const constant = encode(
  [
    ['0', '0'],
    ['1', '0'],
  ],
  ['0.5'],
);
function check(
  actual: string,
  input: string,
  valid = true,
  expected: string | null = 'untrusted-wrong-answer',
) {
  assert.equal(
    piecewiseLinear(actual, expected, input),
    valid,
    JSON.stringify({ actual, input }),
  );
  assert.equal(
    matchesOutput(actual, expected ?? '', 'oa-piecewise-linear', input),
    valid,
  );
  assert.equal(
    matchesOaOutput(actual, expected ?? '', 'oa-piecewise-linear', input),
    valid,
  );
}

test('unsorted interpolation, both extrapolations, exact nodes and ignored expected', () => {
  const input = encode(
    [
      ['2', '4'],
      ['0', '0'],
      ['1', '3'],
    ],
    ['-1', '0', '0.5', '1', '1.5', '2', '3'],
  );
  check('-3 0 1.5 3 3.5 4 5', input);
  check('-3\n0\n1.5\n3\n3.5\n4\n5\n', input, true, '1');
  check('-3 0 1.5 3 3.5 4 5', input, true, null);
  check('0 0 1.5 3 3.5 4 4', input, false, '0 0 1.5 3 3.5 4 4');
  check(
    '2',
    encode(
      [
        ['-1', '2'],
        ['1', '2'],
      ],
      ['0'],
    ),
  );
});

test('inclusive exact absolute 1e-6 threshold, not relative or float comparison', () => {
  for (const answer of ['0', '0.000001', '-0.000001', '1e-6', '-1E-6'])
    check(answer, constant);
  for (const answer of [
    '0.000001000000000000000000000000001',
    '-0.000001000000000000000000000000001',
  ])
    check(answer, constant, false);
  const thirds = encode(
    [
      ['0', '0'],
      ['3', '1'],
    ],
    ['1'],
  );
  check('0.333332333334', thirds);
  check('0.333332333333', thirds, false);
  check('0.333334333333', thirds);
  check('0.333334333334', thirds, false);
});

test('near 4e18 extrapolation preserves sub-micro absolute precision', () => {
  const input = encode(
    [
      ['-1000000', '-1000000'],
      ['-999999.999999', '1000000'],
    ],
    ['1000000'],
  );
  const truth = '3999999999999000000';
  check(truth, input);
  check(truth + '.000001', input);
  check(truth + '.0000010000000001', input, false);
  check('3999999999998999999.999999', input);
  check('3999999999998999999.9999989999999999', input, false);
  check('3999999999999000001', input, false); // Relative tolerance would wrongly pass.
  check('3.999999999999e18', input);
});

test('decimal output formats, exponent limits, zero representations and ASCII whitespace', () => {
  for (const answer of [
    '+0',
    '-0.0',
    '.0',
    '0.',
    '000.000',
    '0e+30',
    '-0e-30',
    '+.00000E+000030',
    '0.' + '0'.repeat(62),
  ])
    check('\t\n' + answer + '\v\f\r\n', constant);
  for (const answer of [
    'NaN',
    'Infinity',
    '-Infinity',
    '0x0',
    '.',
    '+',
    '1_0',
    '0e31',
    '0e-31',
    '0e99999999999999999999999999999999999',
    '1e',
    '0e+',
    '0.' + '0'.repeat(63),
    '０',
    '0\u00a0',
    '0\0',
    '0 0',
  ])
    check(answer, constant, false);
  check('', constant, false);
});

test('strict input decimal grammar, physical records, distinct x and count bounds', () => {
  check('0', '2\t1\r\n +0.000000\t-0.000000 \r\n1.000000 +0\r\n0.500000');
  for (const token of [
    '.5',
    '1.',
    '01',
    '-00',
    '1e0',
    '0.0000001',
    '1000000.000001',
    '-1000000.000001',
    'NaN',
    'Infinity',
    '０',
    '0\v',
  ])
    check(
      '0',
      encode(
        [
          [token, '0'],
          ['2', '0'],
        ],
        ['1'],
      ),
      false,
    );
  for (const input of [
    '',
    '1 1\n0 0\n0\n',
    '200001 1\n',
    '2 0\n',
    '2 200001\n',
    '02 1\n0 0\n1 0\n0\n',
    '2 1 0\n0 0\n1 0\n0\n',
    '2 1\n0 0 1\n1 0\n0\n',
    '2 1\n0\n1 0\n0\n',
    '2 1\n0 0\n1 0\n0 1\n',
    '2 1\n0 0\n1 0\n',
    constant + '\n',
    constant + ' \n',
    constant.replace('\n', '\r'),
    encode(
      [
        ['0', '0'],
        ['-0.000000', '1'],
      ],
      ['0'],
    ),
    encode(
      [
        ['1.0', '0'],
        ['+1.000000', '1'],
      ],
      ['0'],
    ),
  ])
    check('0', input, false);
  assert.equal(piecewiseLinear('0', '', undefined), false);
  assert.equal(piecewiseLinear(undefined, '', constant), false);
  assert.equal(piecewiseLinear({}, '', constant), false);
});

function fixedScaled(value: bigint) {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  return (
    (negative ? '-' : '') +
    magnitude / 1000000n +
    '.' +
    String(magnitude % 1000000n).padStart(6, '0')
  );
}
// Independent linear segment scan and barycentric weighted-average expression.
function oracle(points: bigint[][], x: bigint) {
  const p = [...points].sort((a, b) => Number(a[0] - b[0]));
  let i = 0;
  while (i + 1 < p.length - 1 && p[i + 1][0] < x) i++;
  const [a, b] = p[i],
    [c, d] = p[i + 1];
  const numerator = b * (c - x) + d * (x - a),
    denominator = c - a;
  const abs = numerator < 0n ? -numerator : numerator;
  let units = abs / denominator;
  if (2n * (abs % denominator) >= denominator) units++;
  return fixedScaled(numerator < 0n ? -units : units);
}
test('450 independent tiny rational fixtures, unsorted/micro-spaced/negative points', () => {
  let state = 736251;
  const rand = (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
  for (let c = 0; c < 450; c++) {
    const n = 2 + rand(6),
      used = new Set<number>(),
      points: bigint[][] = [];
    while (points.length < n) {
      const x = rand(41) - 20;
      if (used.has(x)) continue;
      used.add(x);
      points.push([BigInt(x), BigInt(rand(2001) - 1000)]);
    }
    const queries = Array.from({ length: 7 }, () => BigInt(rand(81) - 40));
    const input = encode(
      points.map((p) => p.map(fixedScaled)),
      queries.map(fixedScaled),
      c % 2 ? '\n' : '\r\n',
    );
    const expected = queries.map((x) => oracle(points, x));
    check(expected.join('\n'), input, true, 'deliberately-wrong');
    const first = expected[0];
    const units = BigInt(first.replace('.', '')) + 2n;
    check(
      [fixedScaled(units), ...expected.slice(1)].join(' '),
      input,
      false,
      expected.join('\n'),
    );
  }
});

test('bounded garbage tokens reject without arrays of all words or huge exponentiation', () => {
  check('0'.repeat(10000), constant, false);
  check('0 '.repeat(10000), constant, false);
  check('0', '200000 200000\n' + '0'.repeat(10000), false);
});

test('TwoSigma5 fixed identity rejects other IDs and supports the 16MiB output budget', () => {
  assert.equal(OA_SEMANTIC_IDS['oa-piecewise-linear'], 'oa-two-sigma-5');
  const payload = {
    schemaVersion: 1,
    problem: {
      id: 'oa-two-sigma-5',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: '分段线性插值',
      difficulty: '中等',
      tags: ['OA', 'Two Sigma'],
      description: 'Interpolate or extrapolate the polyline.',
      input: 'n q, n point lines, q query lines.',
      output: 'q finite numbers with absolute tolerance 1e-6.',
      explanation: '',
      hints: [],
      timeLimit: 10,
      memoryLimit: 262144,
      outputLimit: 16384,
      checker: 'oa-piecewise-linear',
      languages: ['python'],
    },
    cases: [
      {
        name: 'public',
        input: constant,
        expectedOutput: '0\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: constant,
        expectedOutput: '0\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
  assert.equal(ojImportSchema.safeParse(payload).success, true);
  for (const id of ['oa-two-sigma-3', 'oa-cisco-29', 'unrelated']) {
    payload.problem.id = id;
    const parsed = ojImportSchema.safeParse(payload);
    assert.equal(parsed.success, false, id);
    if (!parsed.success)
      assert(
        parsed.error.issues.some(
          (issue) =>
            issue.path.join('.') === 'problem.checker' &&
            issue.message === 'Invalid fixed OA checker identity',
        ),
      );
  }
});
