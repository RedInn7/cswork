import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validStructuredOutput,
  validStructuredResult,
} from '../lib/oj-result-shapes';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../fixtures/oj-structured-results.json', import.meta.url),
    'utf8',
  ),
) as { kind: string; output: string; valid: boolean }[];
void test('structured output shapes match shared Python fixtures', () => {
  for (const item of fixtures)
    assert.equal(
      validStructuredOutput(item.kind, item.output),
      item.valid,
      JSON.stringify(item),
    );
});
void test('typed results preserve null, large integers and row boundaries', () => {
  assert.ok(
    validStructuredResult('nullable-integer-array', [
      null,
      BigInt('9007199254740993'),
    ]),
  );
  assert.ok(
    validStructuredResult('integer-rows', [[], [BigInt(1), BigInt(-2)]]),
  );
  for (const value of [[true], [1], [undefined], [[BigInt(1)]]])
    assert.equal(validStructuredResult('nullable-integer-array', value), false);
  for (const value of [null, [null], [[true]], [[1]], [[null]]])
    assert.equal(validStructuredResult('integer-rows', value), false);
  assert.equal(
    validStructuredOutput(
      'nullable-integer-array',
      '0\n' + ' '.repeat(64 * 1024 * 1024),
    ),
    false,
  );
});

void test('structured validation works without a browser Buffer polyfill', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Buffer');
  try {
    Object.defineProperty(globalThis, 'Buffer', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    assert.equal(validStructuredOutput('integer-rows', '2\n0\n2 1 -2\n'), true);
    assert.equal(
      validStructuredOutput('nullable-integer-array', '2\nnull 0\n'),
      true,
    );
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'Buffer', descriptor);
    else delete (globalThis as Record<string, unknown>).Buffer;
  }
});
