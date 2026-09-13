import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesOaSemantic as check } from '../lib/oa-semantic-checkers.mjs';

test('quadratic exact rational rounding, endpoints and invalid reference', () => {
  const input = '4\n1000000 -1 0 0 1\n3 -1 0 -1 1\n1 4 0 -1 1\n1 -4 0 -1 1\n';
  const reference = '0.000000\n0.166667\n-1.000000\n1.000000';
  assert(
    check(
      'oa-quadratic-minimum',
      reference.replace('0.000000', '0.000001'),
      reference,
      input,
    ),
  );
  for (const wrong of ['0.000002', '0.0000001', 'NaN', '0e0', '0.000000 extra'])
    assert(
      !check(
        'oa-quadratic-minimum',
        reference.replace('0.000000', wrong),
        reference,
        input,
      ),
    );
  assert(
    !check(
      'oa-quadratic-minimum',
      reference,
      reference.replace('0.166667', '0.166666'),
      input,
    ),
  );
  assert(
    !check('oa-quadratic-minimum', '0.000000', '0.000000', '1\n0 0 0 0 1'),
  );
});

test('football permits every equivalent ranking and rejects non-top teams', () => {
  for (let mask = 0; mask < 256; mask++) {
    const wins = Array.from({ length: 4 }, (_, i) => (mask >> i) & 1);
    const scored = Array.from({ length: 4 }, (_, i) => (mask >> (i + 4)) & 1);
    const input = `4\n${wins.join(' ')}\n0 0 0 0\n${scored.join(' ')}\n0 0 0 0`;
    const score = (i) => wins[i] * 3 + scored[i] / 10;
    const order = [0, 1, 2, 3].sort((a, b) => score(b) - score(a));
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        assert.equal(
          check(
            'oa-football-top-two',
            `${a} ${b}`,
            order.slice(0, 2).join(' '),
            input,
          ),
          a !== b &&
            score(a) === score(order[0]) &&
            score(b) === score(order[1]),
        );
  }
  const n = 100000;
  const input = `${n}\n${('1000000000 '.repeat(n).trim() + '\n').repeat(4)}`;
  assert(check('oa-football-top-two', '99999 99998', '0 1', input));
  assert(!check('oa-football-top-two', '0 0', '0 1', input));
  const equalPoints = '3\n0 1 1\n3 0 0\n0 1 2\n0 1 3';
  assert(check('oa-football-top-two', '1 0', '0 1', equalPoints));
  assert(!check('oa-football-top-two', '0 2', '0 1', equalPoints));
  assert(!check('oa-football-top-two', '0 1', '0 2', equalPoints));
});

test('batching accepts alternate optimal partitions but enforces every output rule', () => {
  const input =
    '4\n9 09:00\nDowntown Station\n3 09:00\nDowntown Station\n7 09:05\nDowntown Station\n2 09:10\nDowntown Station\n';
  const reference = '2\n3 3 7 9\n1 2';
  assert(check('oa-compatible-groups', '2\n2 7 9\n2 2 3', reference, input));
  for (const wrong of [
    '1\n4 2 3 7 9',
    '2\n3 9 7 3\n1 2',
    '2\n3 3 7 9\n1 9',
    '3\n2 3 9\n1 7\n1 2',
    '2\n1 2\n3 3 7 9',
    '2\n2 7 9\n1 3',
  ])
    assert(!check('oa-compatible-groups', wrong, reference, input));
  assert(
    !check(
      'oa-compatible-groups',
      reference,
      reference,
      input.replace('09:10', '09:11').replace('09:05', '09:20'),
    ),
  );
  assert(
    !check(
      'oa-compatible-groups',
      reference,
      reference,
      input.replace('3 09:00', '9 09:00'),
    ),
  );
});

function partitions(n) {
  const results = [],
    groups = [];
  const visit = (index) => {
    if (index === n) {
      results.push(groups.map((group) => [...group]));
      return;
    }
    for (const group of groups) {
      group.push(index);
      visit(index + 1);
      group.pop();
    }
    groups.push([index]);
    visit(index + 1);
    groups.pop();
  };
  visit(0);
  return results;
}

test('all small ride partitions agree with an independent exhaustive optimum', () => {
  let scenarios = 0,
    layouts = 0;
  for (let n = 1; n <= 6; n++) {
    const choices = partitions(n);
    // Six states cover two exact locations and 0/10/11-minute time boundaries.
    // Five/six rides exhaust time assignments at one location, including two full groups.
    const radix = n <= 4 ? 6 : 3;
    for (let encoded = 0; encoded < radix ** n; encoded++) {
      let remaining = encoded;
      const rides = Array.from({ length: n }, (_, index) => {
        const state = remaining % radix;
        remaining = Math.floor(remaining / radix);
        return {
          id: 91 - index * 7, // IDs deliberately oppose original input order.
          location: state < 3 ? 'Downtown Station' : 'Airport',
          time: [0, 10, 11][state % 3],
        };
      });
      const valid = (groups) =>
        groups.every(
          (group) =>
            group.length <= 3 &&
            group.every(
              (i) => rides[i].location === rides[group[0]].location,
            ) &&
            Math.max(...group.map((i) => rides[i].time)) -
              Math.min(...group.map((i) => rides[i].time)) <=
              10,
        );
      const possible = choices.filter(valid);
      const optimum = Math.min(...possible.map((groups) => groups.length));
      const encode = (groups) =>
        `${groups.length}\n` +
        groups
          .map(
            (group) =>
              `${group.length} ${group
                .map((i) => rides[i].id)
                .sort((a, b) => a - b)
                .join(' ')}`,
          )
          .join('\n');
      const reference = encode(
        possible.find((groups) => groups.length === optimum),
      );
      const input =
        `${n}\n` +
        rides
          .map(
            (ride) =>
              `${ride.id} 09:${String(ride.time).padStart(2, '0')}\n${ride.location}\n`,
          )
          .join('');
      for (const groups of choices) {
        assert.equal(
          check('oa-compatible-groups', encode(groups), reference, input),
          valid(groups) && groups.length === optimum,
          `n=${n}, encoded=${encoded}, groups=${JSON.stringify(groups)}`,
        );
        layouts++;
      }
      const nonoptimal = possible.find((groups) => groups.length > optimum);
      if (nonoptimal)
        assert.equal(
          check('oa-compatible-groups', reference, encode(nonoptimal), input),
          false,
        );
      scenarios++;
    }
  }
  assert.equal(scenarios, 2526);
  assert.equal(layouts, 181221);
});

test('quadratic half-unit rounding stays exact for either sign and clamped extrema', () => {
  // A = 10^6 makes every odd B an exact half-micro-unit tie; adjacent lattice
  // points are both allowed, all other six-place decimals are not.
  const decimal = (scaled) =>
    `${scaled < 0 ? '-' : ''}${Math.floor(Math.abs(scaled) / 1000000)}.${String(Math.abs(scaled) % 1000000).padStart(6, '0')}`;
  for (let b = -101; b <= 101; b++) {
    const lower = Math.floor(-b / 2),
      upper = Math.ceil(-b / 2);
    const input = `1\n1000000 ${b} 1000000 -1 1\n`;
    const reference = decimal(lower);
    for (let candidate = lower - 2; candidate <= upper + 2; candidate++)
      assert.equal(
        check('oa-quadratic-minimum', decimal(candidate), reference, input),
        candidate === lower || candidate === upper,
      );
  }
  for (const [input, output] of [
    ['1\n1 1000000 -1000000 1000000 1000000', '1000000.000000'],
    ['1\n1 -1000000 1000000 -1000000 -1000000', '-1000000.000000'],
  ])
    assert(check('oa-quadratic-minimum', output, output, input));
});
