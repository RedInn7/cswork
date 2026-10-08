import assert from 'node:assert/strict';
import test from 'node:test';
import { zalandoBlocks as check } from '../lib/oa-zalando-blocks-checker.mjs';
import {
  OJ_MAX_CASE_BYTES,
  OJ_MAX_EXPECTED_BYTES,
} from '../lib/oj-data-budgets.mjs';

function formulaWitness(a, b, c) {
  const pairs = Math.min(a, c);
  return a >= c
    ? 'AB'.repeat(b) + 'AABB'.repeat(pairs) + (a > c ? 'AA' : '')
    : 'BBAA'.repeat(pairs) + 'BB' + 'AB'.repeat(b);
}

test('all 1330 legal quotas agree with an independent alternating-block formula', () => {
  let cases = 0;
  for (let a = 0; a <= 10; a++)
    for (let b = 0; b <= 10; b++)
      for (let c = 0; c <= 10; c++) {
        if (a + b + c === 0) continue;
        const raw = `${a} ${b} ${c}`;
        const witness = formulaWitness(a, b, c);
        const expectedLength = 2 * (b + 2 * Math.min(a, c) + (a !== c ? 1 : 0));
        assert.equal(witness.length, expectedLength);
        assert(check(witness, 'not an oracle', raw), raw);
        assert(!check(witness.slice(2), witness.slice(2), raw), raw);
        cases++;
      }
  assert.equal(cases, 1330);
});

test('independent literal enumeration validates every small legal concatenation', () => {
  for (let a = 0; a <= 3; a++)
    for (let b = 0; b <= 3; b++)
      for (let c = 0; c <= 3; c++) {
        if (a + b + c === 0) continue;
        const outputs = [];
        function enumerate(text, x, y, z) {
          outputs.push(text);
          for (const [block, remaining] of [
            ['AA', [x - 1, y, z]],
            ['AB', [x, y - 1, z]],
            ['BB', [x, y, z - 1]],
          ]) {
            if (remaining.some((n) => n < 0)) continue;
            const joined = text + block;
            if (!joined.includes('AAA') && !joined.includes('BBB'))
              enumerate(joined, ...remaining);
          }
        }
        enumerate('', a, b, c);
        const best = Math.max(...outputs.map((s) => s.length));
        assert.equal(formulaWitness(a, b, c).length, best);
        for (const output of outputs)
          assert.equal(
            check(output, undefined, `${a} ${b} ${c}`),
            output.length === best,
          );
      }
});

test('accepts different optima and rejects the two malformed source examples', () => {
  for (const s of ['ABAABB', 'AABBAB', 'BBABAA'])
    assert(check(s, 'invalid expected', '1 1 1'));
  assert(check('ABABAABB', '', '1 2 1'));
  assert(!check('AABBAABBA', 'AABBAABBA', '5 0 2'));
  assert(check('AABBAABBAA', '', '5 0 2'));
  assert(!check('BBAABAA', 'BBAABAA', '1 2 1'));
  assert(check('ABAB', '', '0 2 0'));
  assert(check('BB', '', '0 0 10'));
  assert(check(' \r\nABAB\t ', null, '+00 +02 -0'));
});

test('rejects broken witnesses, block overuse, illegal BA blocks and suboptimal strings', () => {
  for (const s of [
    '',
    'A',
    'ABA',
    'BA',
    'ABBA',
    'AABBABAB',
    'AAAABB',
    'AABBBB',
    'AA BB',
    'AB\nAB',
    '"AABB"',
    '["AA","BB"]',
    'ＡＡ',
    'AA\u00a0BB',
    'AA\0BB',
  ])
    assert(!check(s, s, '1 1 1'), JSON.stringify(s));
  assert(!check('AB', '', '0 2 0'));
  assert(!check('ABAB', '', '1 0 1'));
  assert(!check('AB'.repeat(31), '', '10 10 10'));
  assert(!check(null, '', '1 0 0'));
});

test('rejects malformed, out-of-domain and oversized inputs without numeric coercion', () => {
  for (const raw of [
    '',
    '0 0 0',
    '1 0',
    '1 0 0 0',
    '-1 1 1',
    '11 0 0',
    '0 11 0',
    '0 0 11',
    '1.0 0 0',
    '1e0 0 0',
    '0x1 0 0',
    'NaN 0 0',
    'Infinity 0 0',
    '[1,0,0]',
    '{"AA":1}',
    '１ 0 0',
    '1\u00a00 0',
    '1\0 0',
  ])
    assert(!check('AA', '', raw), raw);
  assert(!check('AA', '', `${'9'.repeat(100000)} 0 0`));
  assert(!check('AA', '', null));
  assert(!check('AA', '', ' '.repeat(OJ_MAX_CASE_BYTES + 1)));
  assert(!check(' '.repeat(OJ_MAX_EXPECTED_BYTES + 1), '', '1 0 0'));
  assert(!check('AA', '', `1 0 0 ${'0 '.repeat(100000)}`));
});
