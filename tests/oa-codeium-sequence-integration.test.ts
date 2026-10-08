import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

const checker = 'oa-codeium-sequence' as const;
function fixture() {
  return {
    schemaVersion: 1,
    problem: {
      id: 'oa-codeium-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Sequence',
      difficulty: '困难',
      tags: ['OA'],
      description: 'Construct a minimum-magnitude sequence.',
      input: 'n followed by n nonnegative counts.',
      output: 'Integers or None.',
      explanation: '',
      hints: [],
      timeLimit: 3,
      memoryLimit: 131072,
      outputLimit: 4096,
      checker,
      languages: ['python'],
    },
    cases: [
      {
        name: 'public',
        input: '2\n2 2\n',
        expectedOutput: '1 2\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: '2\n0 2\n',
        expectedOutput: 'None\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
}

test('Codeium checker is fixed to its original ID and rejects custom or adapter bindings', () => {
  assert.equal(OA_SEMANTIC_IDS[checker], 'oa-codeium-1');
  assert(ojImportSchema.safeParse(fixture()).success);
  for (const id of ['oa-codeium-2', 'oa-amazon-1', 'lc-1', 'user-defined']) {
    const pkg = fixture();
    pkg.problem.id = id;
    assert(!ojImportSchema.safeParse(pkg).success);
  }
  for (const extra of [
    { checker: 'oa-user-executable' },
    { checkerCode: 'return true' },
    { codingModes: ['leetcode'] },
    { semanticId: 1 },
    { specialId: 1 },
  ]) {
    const pkg = fixture();
    assert(
      !ojImportSchema.safeParse({
        ...pkg,
        problem: { ...pkg.problem, ...extra },
      }).success,
    );
  }
});

test('schema verifies actual ACM case input and optimal reference, including None', () => {
  for (const expected of ['None', '1 1', '1 -1', '2 3', '0 2']) {
    const pkg = fixture();
    pkg.cases[0].expectedOutput = expected;
    assert(!ojImportSchema.safeParse(pkg).success, expected);
  }
  for (const input of ['{"n":2,"p":[2,2]}', '2\n[2,2]', '2\n2', '2\n2 -1']) {
    const pkg = fixture();
    pkg.cases[0].input = input;
    assert(!ojImportSchema.safeParse(pkg).success, input);
  }
  const alternate = fixture();
  alternate.cases[0].expectedOutput = '2 1';
  assert(ojImportSchema.safeParse(alternate).success);
  const large = fixture();
  large.cases[1].input = `1\n${'9'.repeat(10000)}`;
  assert(ojImportSchema.safeParse(large).success);
});

test('production and offline paths independently validate both outputs', () => {
  const routes = [
    (a: string, e: string, i: string) => matchesOaSemantic(checker, a, e, i),
    (a: string, e: string, i: string) => matchesOutput(a, e, checker, i),
    (a: string, e: string, i: string) => matchesOaOutput(a, e, checker, i),
  ];
  for (const route of routes) {
    assert(route('2 1', '1 2', '2\n2 2'));
    assert(route('None', 'None', '2\n0 2'));
    assert(!route('None', 'None', '2\n2 2'));
    assert(!route('1 2', 'None', '2\n2 2'));
    assert(!route('None', '1 2', '2\n2 2'));
    assert(!route('1 1', '1 1', '2\n2 2'));
    assert(!route('1 2', '2 3', '2\n2 2'));
    assert(!route('2 3', '1 2', '2\n2 2'));
    assert(!route('1', '1', '1\n0'));
  }
});
