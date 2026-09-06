import test from 'node:test';
import {
  parseIntegerRowSet,
  parseIntegerRowCollection,
  validIntegerRowCollectionResult,
  type IntegerRowChecker,
} from '../lib/oj-result-shapes';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesOutput } from '../lib/server/oj-engine';
import {
  ojImportSchema,
  parseOjSetOutput,
  parseOjMultisetOutput,
  OJ_MAX_EXPECTED_BYTES,
  OJ_MAX_CASE_BYTES,
  OJ_MAX_IMPORT_BYTES,
  type OjProblemSpec,
} from '../lib/oj-types';

const fixtures = JSON.parse(
  readFileSync(
    new URL('../fixtures/oj-output-checkers.json', import.meta.url),
    'utf8',
  ),
) as {
  protocolVersion: number;
  cases: {
    name: string;
    checker: string;
    actual: string;
    expected: string;
    matches: boolean;
    actualValid?: boolean;
    expectedValid?: boolean;
  }[];
};
for (const item of fixtures.cases) {
  void test(`shared output contract: ${item.name}`, () => {
    assert.equal(
      matchesOutput(
        item.actual,
        item.expected,
        item.checker as OjProblemSpec['checker'],
      ),
      item.matches,
    );
    if (
      ['int-row-set', 'int-bag-row-set', 'int-row-multiset'].includes(
        item.checker,
      )
    ) {
      assert.equal(
        parseIntegerRowCollection(
          item.actual,
          item.checker as IntegerRowChecker,
        ) !== null,
        item.actualValid,
      );
      assert.equal(
        parseIntegerRowCollection(
          item.expected,
          item.checker as IntegerRowChecker,
        ) !== null,
        item.expectedValid,
      );
    } else if (item.checker === 'int-multiset') {
      assert.equal(
        parseOjMultisetOutput(item.actual) !== null,
        item.actualValid,
      );
      assert.equal(
        parseOjMultisetOutput(item.expected) !== null,
        item.expectedValid,
      );
    } else if (item.checker === 'int-set' || item.checker === 'string-set') {
      assert.equal(
        parseOjSetOutput(item.actual, item.checker) !== null,
        item.actualValid,
      );
      assert.equal(
        parseOjSetOutput(item.expected, item.checker) !== null,
        item.expectedValid,
      );
    }
  });
}

function payload(checker: string, expectedOutput: string) {
  return {
    schemaVersion: 1,
    problem: {
      id: 'set-fixture',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Set fixture',
      difficulty: '简单',
      tags: ['测试'],
      description: 'A test problem.',
      input: 'Input.',
      output: 'Output.',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker,
      languages: ['python'],
    },
    cases: [
      {
        name: 'public',
        input: '1\n',
        expectedOutput,
        hidden: false,
        weight: 1,
      },
      { name: 'hidden', input: '2\n', expectedOutput, hidden: true, weight: 1 },
    ],
  };
}

void test('import validates counted-set expected answers before publishing', () => {
  for (const item of fixtures.cases) {
    if (
      ![
        'int-set',
        'string-set',
        'int-multiset',
        'int-row-set',
        'int-bag-row-set',
        'int-row-multiset',
      ].includes(item.checker)
    )
      continue;
    assert.equal(
      ojImportSchema.safeParse(payload(item.checker, item.actual)).success,
      item.actualValid,
      item.name,
    );
  }
  assert.equal(
    ojImportSchema.safeParse(payload('future-checker', '1\n')).success,
    false,
  );
});

void test('set parser limits size and preserves exact large integer identities', () => {
  assert.equal(
    parseOjSetOutput('1\n' + '9'.repeat(OJ_MAX_EXPECTED_BYTES), 'int-set'),
    null,
  );
  assert.equal(
    parseOjSetOutput(
      '1\n' + 'a'.repeat(OJ_MAX_EXPECTED_BYTES) + '\n',
      'string-set',
    ),
    null,
  );
  assert.equal(matchesOutput('2\n+00001 1\n', '2\n1 2\n', 'int-set'), false);
});

void test('import does not admit executable checker payloads or options', () => {
  const data = payload('int-set', '0\n');
  assert.equal(
    ojImportSchema.safeParse({ ...data, checkerSource: 'print(True)' }).success,
    false,
  );
  assert.equal(
    ojImportSchema.safeParse({
      ...data,
      problem: { ...data.problem, checkerOptions: { ignoreDuplicates: true } },
    }).success,
    false,
  );
});

void test('multiset parser retains normalized multiplicities and enforces byte limits', () => {
  const values = parseOjMultisetOutput('5\n1 +01 1 -0 0\n');
  assert.ok(values);
  assert.equal(values.get('1'), 3);
  assert.equal(values.get('0'), 2);
  assert.equal(values.size, 2);
  assert.equal(
    parseOjMultisetOutput('1\n' + '9'.repeat(OJ_MAX_EXPECTED_BYTES)),
    null,
  );
  assert.equal(parseOjSetOutput('2\n1 1\n', 'int-set'), null);
  assert.equal(matchesOutput('2\n2 1\n', '2\n1 2\n', 'tokens'), false);
});

void test('row set bounds bytes, row count and total cells before comparison', () => {
  assert.equal(
    parseIntegerRowSet('1\n1 ' + '9'.repeat(OJ_MAX_EXPECTED_BYTES)),
    null,
  );
  assert.equal(parseIntegerRowSet('1\n16000001\n'), null);
  assert.equal(parseIntegerRowSet('1000001\n'), null);
  assert.equal(
    parseIntegerRowSet('0' + ' '.repeat(OJ_MAX_EXPECTED_BYTES - 1))?.size,
    0,
  );
  assert.equal(
    parseIntegerRowSet('0' + ' '.repeat(OJ_MAX_EXPECTED_BYTES)),
    null,
  );
});

void test('typed row collections preserve bigint values, cells and multiplicities', () => {
  for (const kind of ['integer-bag-row-set', 'integer-row-multiset']) {
    assert.equal(
      validIntegerRowCollectionResult(kind, [[BigInt(1), BigInt(1)], []]),
      true,
    );
    for (const bad of [[[1]], [[true]], [[null]], [[1.0]], [[[BigInt(1)]]]])
      assert.equal(validIntegerRowCollectionResult(kind, bad), false);
    assert.equal(
      validIntegerRowCollectionResult(kind, [[BigInt(10) ** BigInt(100)], []]),
      true,
    );
  }
  assert.equal(
    validIntegerRowCollectionResult('integer-bag-row-set', [
      [BigInt(1), BigInt(2)],
      [BigInt(2), BigInt(1)],
    ]),
    false,
  );
  assert.equal(
    validIntegerRowCollectionResult('integer-bag-row-set', [[], []]),
    false,
  );
  assert.equal(
    validIntegerRowCollectionResult('integer-row-multiset', [
      [BigInt(1)],
      [BigInt(1)],
      [],
      [],
    ]),
    true,
  );
  for (const checker of ['int-bag-row-set', 'int-row-multiset'] as const) {
    assert.equal(
      parseIntegerRowCollection(
        '0' + ' '.repeat(OJ_MAX_EXPECTED_BYTES),
        checker,
      ),
      null,
    );
    assert.equal(parseIntegerRowCollection('1000001\n', checker), null);
    assert.equal(parseIntegerRowCollection('1\n16000001\n', checker), null);
  }
});

void test('large expected output allowance keeps input and public samples bounded', () => {
  assert.equal(OJ_MAX_IMPORT_BYTES, 128 * 1024 * 1024);
  assert.equal(OJ_MAX_CASE_BYTES, 4 * 1024 * 1024);
  assert.equal(OJ_MAX_EXPECTED_BYTES, 64 * 1024 * 1024);
  const data = payload('tokens', '0\n');
  data.problem.outputLimit = 65536;
  data.cases[1].expectedOutput = '0' + ' '.repeat(OJ_MAX_CASE_BYTES);
  assert.equal(ojImportSchema.safeParse(data).success, true);
  data.cases[1].input = 'x'.repeat(OJ_MAX_CASE_BYTES + 1);
  assert.equal(ojImportSchema.safeParse(data).success, false);
  data.cases[1].input = '1\n';
  data.cases[0].expectedOutput = 'x'.repeat(32769);
  assert.equal(ojImportSchema.safeParse(data).success, false);
  data.cases[0].expectedOutput = '0\n';
  data.problem.outputLimit = 65537;
  assert.equal(ojImportSchema.safeParse(data).success, false);
});
