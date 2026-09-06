import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  matchesFiniteFloats,
  parseFiniteFloats,
} from '../lib/oj-float-checkers';
import { matchesFractionDecimal } from '../lib/oj-fraction-checker';
void test('shared finite float scalar/vector fixtures', () => {
  for (const item of JSON.parse(
    readFileSync(
      new URL('../fixtures/oj-float-checkers.json', import.meta.url),
      'utf8',
    ),
  ))
    assert.equal(
      matchesFiniteFloats(item.actual, item.expected, item.array),
      item.matches,
      item.name,
    );
  assert.equal(parseFiniteFloats('1'.repeat(1024 * 1024 + 1), false), null);
});
void test('shared exact recurring fraction fixtures', () => {
  for (const item of JSON.parse(
    readFileSync(
      new URL('../fixtures/oj-fraction-checker.json', import.meta.url),
      'utf8',
    ),
  ))
    assert.equal(
      matchesFractionDecimal(item.actual, item.input),
      item.matches,
      item.name,
    );
  assert.equal(
    matchesFractionDecimal('0.(' + '3'.repeat(9990) + ')', '[1,3]'),
    true,
  );
  assert.equal(
    matchesFractionDecimal('0.(' + '3'.repeat(10001) + ')', '[1,3]'),
    false,
  );
});
