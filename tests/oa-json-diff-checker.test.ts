import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonDiff } from '../lib/oa-json-diff-checker.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
let seed = 239192;
const random = (n: number) =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
const scalars: Json[] = [
  null,
  false,
  true,
  0,
  1,
  -1,
  1.25,
  0.000001,
  '中文😃',
  '',
  'a\nb',
  '\u2028',
];
function value(depth: number): Json {
  if (!depth || random(3) === 0) return scalars[random(scalars.length)];
  if (random(2))
    return Array.from({ length: random(4) }, () => value(depth - 1));
  return Object.fromEntries(
    ['z', 'a', '__proto__']
      .slice(0, random(4))
      .map((key) => [key, value(depth - 1)]),
  );
}
function canonical(v: Json): string {
  if (v === null || typeof v !== 'object')
    return typeof v + ':' + JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
      .join(',') +
    '}'
  );
}
function reorder(v: Json): Json {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(reorder);
  return Object.fromEntries(
    Object.keys(v)
      .reverse()
      .map((k) => [k, reorder(v[k])]),
  );
}
function check(
  actual: string,
  expected: string,
  input: string,
  result: boolean,
) {
  assert.equal(jsonDiff(actual, expected, input), result);
  assert.equal(
    matchesOaOutput(actual, expected, 'oa-json-diff', input),
    result,
  );
  assert.equal(matchesOutput(actual, expected, 'oa-json-diff', input), result);
}
void test('independent canonical comparison of random JSON trees and shared runtime', () => {
  for (let i = 0; i < 500; i++) {
    const left = Object.fromEntries(
      ['a', 'b', 'c', 'd'].slice(0, random(5)).map((k) => [k, value(4)]),
    );
    const right = Object.fromEntries(
      ['a', 'b', 'c', 'e']
        .slice(0, random(5))
        .map((k) => [
          k,
          Object.hasOwn(left, k) && random(2) ? reorder(left[k]) : value(4),
        ]),
    );
    const answer = [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .filter(
        (k) =>
          !Object.hasOwn(left, k) ||
          !Object.hasOwn(right, k) ||
          canonical(left[k]) !== canonical(right[k]),
      )
      .sort();
    const expected = JSON.stringify(answer);
    check(
      JSON.stringify(answer, null, 2),
      expected,
      JSON.stringify(left) + '\n' + JSON.stringify(right),
      true,
    );
    check(
      JSON.stringify([...answer, 'wrong']),
      expected,
      JSON.stringify(left) + '\n' + JSON.stringify(right),
      false,
    );
  }
});
void test('exact decimals, missing/null, boolean/numeric types and Unicode scalar sorting', () => {
  check(
    '[]',
    '[]',
    '{"a":1.0,"b":-0,"c":1e-6}\n{"c":0.000001,"b":0.000000,"a":1e0}',
    true,
  );
  check('["a","b"]', '["a","b"]', '{"a":false,"b":null}\n{"a":0}', true);
  check(
    '["a"]',
    '["a"]',
    '{"a":999999999.999999}\n{"a":999999999.999998}',
    true,
  );
  check(
    '[]',
    '[]',
    '{"a":1000000000,"b":-1000000000}\n{"a":1e9,"b":-1000000000000000e-6}',
    true,
  );
  const input = '{"😃":0,"\ue000":0,"":0,"constructor":0,"__proto__":0}\n{}';
  const expected = JSON.stringify([
    '',
    '__proto__',
    'constructor',
    '\ue000',
    '😃',
  ]);
  check(
    '["","__proto__","constructor","\\ue000","\\ud83d\\ude03"]',
    expected,
    input,
    true,
  );
  check(
    JSON.stringify(['', '__proto__', 'constructor', '😃', '\ue000']),
    expected,
    input,
    false,
  );
  check('[]', '[]', '{"a":[1,2]}\n{"a":[2,1]}', false);
  check('["a"]', '[]', '{"a":1}\n{"a":2}', false);
});
void test('reject invalid grammar, duplicate escaped keys, invalid numbers and extra lines', () => {
  for (const source of [
    '{"a":1,"\\u0061":2}',
    '{"a":{"b":1,"b":2}}',
    '{"a":NaN}',
    '{"a":Infinity}',
    '{"a":1e13}',
    '{"a":1e-13}',
    '{"a":0.0000001}',
    '{"a":1000000000.000001}',
    '{"a":1.0000000000000000000000001}',
    '{"a":01}',
    '{"a":+1}',
    '{"a":1.}',
    '{"a":1,}',
    '{"a":"\\ud800"}',
    '{"\\udfff":1}',
    '{"a":' + '1'.repeat(65) + '}',
    '[]',
    'null',
    '{"a":1}\u00a0',
  ]) {
    assert.equal(jsonDiff('[]', '[]', source + '\n' + source), false, source);
  }
  check('[]', '[]', '{}\r\n{}\r\n', true);
  check('[]', '[]', '{}\n{}\n\n', false);
  for (const output of [
    '[1]',
    '[null]',
    '["a","a"]',
    '["a",]',
    '["\\ud800"]',
    '[] extra',
  ])
    check(output, '["a"]', '{"a":0}\n{}', false);
});
void test('exact input/output budgets and structural boundaries', () => {
  const same = (input: string, accepted: boolean) =>
    assert.equal(jsonDiff('[]', '[]', input), accepted);
  const tree = (depth: number) =>
    '{"a":' + '['.repeat(depth - 1) + '0' + ']'.repeat(depth - 1) + '}';
  same(tree(20) + '\n' + tree(20), true);
  same(tree(21) + '\n' + tree(21), false);
  const nodes = '{"a":[' + Array.from({ length: 9998 }, () => '0').join(',') + ']}';
  same(nodes + '\n' + nodes, true);
  const tooMany = '{"a":[' + Array.from({ length: 9999 }, () => '0').join(',') + ']}';
  same(tooMany + '\n' + tooMany, false);
  for (const count of [1000, 1001]) {
    const object = JSON.stringify(
      Object.fromEntries(Array.from({ length: count }, (_, i) => ['k' + i, 0])),
    );
    same(object + '\n' + object, count === 1000);
  }
  for (const length of [256, 257]) {
    const object = JSON.stringify({ a: '😃'.repeat(length) });
    same(object + '\n' + object, length === 256);
  }
  for (const length of [64, 65]) {
    const object = JSON.stringify({ ['😃'.repeat(length)]: 0 });
    same(object + '\n' + object, length === 64);
  }
  const base = '{}\n{}';
  const exact = base + ' '.repeat(4 * 1024 * 1024 - Buffer.byteLength(base));
  same(exact, true);
  same(exact + ' ', false);
  const out = '[]' + ' '.repeat(4 * 1024 * 1024 - 2);
  assert(jsonDiff(out, '[]', base));
  assert.equal(jsonDiff(out + ' ', '[]', base), false);
  const unicode = JSON.stringify(
    Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [
        'k' + i,
        ['中'.repeat(256), '😃'.repeat(256)],
      ]),
    ),
  );
  const pair = unicode + '\n' + unicode;
  const padded = pair + ' '.repeat(4 * 1024 * 1024 - Buffer.byteLength(pair));
  same(padded, true);
  same(padded + ' ', false);
});
