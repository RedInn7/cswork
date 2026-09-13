import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaryPath } from '../lib/oa-dictionary-checker.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
let seed = 913731;
const random = (n: number) =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
const scalar: Json[] = [
  null,
  true,
  false,
  0,
  -1,
  1e9,
  -1e9,
  '',
  '中文😃',
  '\u2028\u2029',
  '"\\\n',
];
function generate(depth: number): Json {
  if (!depth || random(3) === 0) return scalar[random(scalar.length)];
  if (random(2))
    return Array.from({ length: random(4) }, () => generate(depth - 1));
  return Object.fromEntries(
    ['a', 'b', 'constructor']
      .slice(0, random(4))
      .map((k) => [k, generate(depth - 1)]),
  );
}
function reorder(value: Json): Json {
  if (Array.isArray(value)) return value.map(reorder);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((k) => [k, reorder(value[k])]),
    );
  return value;
}
function lookup(value: Json, path: string[]): Json {
  for (const key of path) {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, key)
    )
      return null;
    value = value[key];
  }
  return value;
}
test('independent nested lookup, arrays, scalar types, Unicode, reordered objects', () => {
  for (let i = 0; i < 300; i++) {
    const object = { a: generate(4), b: generate(3), constructor: generate(2) };
    for (const path of [
      'a',
      'b',
      'constructor',
      'missing',
      'a.a',
      'a.b.a',
      'constructor.a',
      'a.a.b.a',
    ]) {
      const expected = JSON.stringify(lookup(object, path.split('.')));
      const actual = JSON.stringify(reorder(JSON.parse(expected)), null, 3);
      const input = `${JSON.stringify(object)}\n${path}\n`;
      assert(dictionaryPath(actual, expected, input));
      assert.equal(dictionaryPath('{"wrong":1}', expected, input), false);
      assert.equal(dictionaryPath(actual, '{"wrong":1}', input), false);
    }
  }
});
test('strict JSON rejects duplicates, malformed content and type confusion', () => {
  const input = '{"a":{"b":1,"c":true}}\na';
  const good = '{"b":1,"c":true}';
  for (const invalid of [
    '{"b":0,"b":1,"c":true}',
    '{"b":1,"\\u0062":1,"c":true}',
    '{"b":1,"c":1}',
    '{"b":1,"c":true} false',
    '{"b":1,"c":true,}',
    '{"b":01,"c":true}',
    '{"b":NaN,"c":true}',
    '{"b":1.5,"c":true}',
    '{"b":1,"c":"\\ud800"}',
    '{"b":1,"c":Infinity}',
    '',
    'null',
    '[]',
    '[1,,2]',
    ' '.repeat(16 * 1024 * 1024 + 1),
  ]) {
    assert.equal(dictionaryPath(invalid, good, input), false);
    assert.equal(dictionaryPath(good, invalid, input), false);
  }
  for (const invalidInput of [
    '{"a":1,"a":2}\na',
    '{"\\u0061":1,"a":1}\na',
    '{}\na',
    '[]\na',
    '{"a":1}\na\nb',
    '{"a":1}\na..b',
    '{"a":1}\n',
    '{"a":"\\ud800"}\na',
    '{"a":1}\n\na',
    '{"a":1}\na\n\n',
  ])
    assert.equal(dictionaryPath('null', 'null', invalidInput), false);
  assert(dictionaryPath('1e0', '1.0', '{"a":1}\na'));
  assert(dictionaryPath('null', 'null', '{"a":1}\nconstructor'));
  assert.equal(dictionaryPath('1', 'true', '{"a":true}\na'), false);
  assert.equal(dictionaryPath('null', '0', '{"a":0}\na'), false);
});
test('full transport boundaries, escaping expansion and shared dispatch', () => {
  const object = Object.fromEntries(
    Array.from({ length: 500 }, (_, i) => ['k' + i, '😃'.repeat(1000)]),
  );
  const input =
    JSON.stringify({
      a: Object.fromEntries(Object.entries(object).slice(0, 499)),
    }) + '\na';
  const expected = JSON.stringify(JSON.parse(input.split('\n')[0]).a);
  const escaped = expected.replace(
    /[^\x00-\x7f]/g,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  assert(dictionaryPath(escaped, expected, input));
  const padding = '{"a":1}' + ' '.repeat(4 * 1024 * 1024 - 9) + '\na';
  assert.equal(Buffer.byteLength(padding), 4 * 1024 * 1024);
  assert(dictionaryPath('1', '1', padding));
  assert.equal(dictionaryPath('1', '1', padding + ' '), false);
  const array = Array(4998).fill(null);
  assert(
    dictionaryPath(
      JSON.stringify(array),
      JSON.stringify(array),
      JSON.stringify({ a: array }) + '\na',
    ),
  );
  array.push(null);
  assert.equal(
    dictionaryPath('null', 'null', JSON.stringify({ a: array }) + '\nmissing'),
    false,
  );
  let nested: Json = 1;
  for (let i = 0; i < 30; i++) nested = { a: nested };
  const path = Array(30).fill('a').join('.');
  assert(dictionaryPath('1', '1', JSON.stringify(nested) + '\n' + path));
  assert.equal(
    dictionaryPath('1', '1', JSON.stringify({ a: nested }) + '\na.' + path),
    false,
  );
  assert.equal(
    dictionaryPath(
      'null',
      'null',
      JSON.stringify(object).replace('"k0"', '"bad.key"') + '\nmissing',
    ),
    false,
  );
  const query = '{"a":{"b":[true,1,null,"中文"]}}\na';
  const actual = '{ "b" : [true,1.0,null,"\\u4e2d\\u6587"] }';
  const answer = '{"b":[true,1,null,"中文"]}';
  assert(matchesOutput(actual, answer, 'oa-dictionary-path', query));
  assert(matchesOaOutput(actual, answer, 'oa-dictionary-path', query));
});
