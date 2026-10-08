import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';

const checker = 'oa-morgan-bricks' as const;
function fixture() {
  return {
    schemaVersion: 1,
    problem: {
      id: 'oa-morgan-stanley-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Break the bricks',
      difficulty: '中等',
      tags: ['OA'],
      description: 'Minimize hits and partition bricks by hammer.',
      input: 'n k followed by distinct strengths.',
      output: 'Total hits, big indices, small indices.',
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
        input: '2 2\n1 3\n',
        expectedOutput: '2\n2\n1\n',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: '1 0\n2\n',
        expectedOutput: '2\n-1\n1\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
}

test('Morgan checker is bound to its fixed ID and ACM mode', () => {
  assert.equal(OA_SEMANTIC_IDS[checker], 'oa-morgan-stanley-1');
  assert(ojImportSchema.safeParse(fixture()).success);
  for (const id of ['oa-morgan-stanley-2', 'oa-codeium-1', 'lc-1', 'custom']) {
    const pkg = fixture();
    pkg.problem.id = id;
    assert(!ojImportSchema.safeParse(pkg).success);
  }
  for (const extra of [
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

test('schema checks input and optimal reference while allowing zero-gain alternatives', () => {
  const alternate = fixture();
  alternate.cases[0].expectedOutput = '2\n1 2\n-1\n';
  assert(ojImportSchema.safeParse(alternate).success);
  for (const expected of ['4\n-1\n1 2', '2\n2\n2', '2\n2 1\n-1', '2\n2\n-1']) {
    const pkg = fixture();
    pkg.cases[0].expectedOutput = expected;
    assert(!ojImportSchema.safeParse(pkg).success, expected);
  }
  for (const input of [
    '2 2\n1 1',
    '2 -1\n1 3',
    '2 2\n1',
    '2 2\n1 3 4',
    '{"n":2}',
  ]) {
    const pkg = fixture();
    pkg.cases[0].input = input;
    assert(!ojImportSchema.safeParse(pkg).success, input);
  }
});

test('online and offline routes validate both outputs independently', () => {
  const routes = [
    (a: string, e: string, i: string) => matchesOaSemantic(checker, a, e, i),
    (a: string, e: string, i: string) => matchesOutput(a, e, checker, i),
    (a: string, e: string, i: string) => matchesOaOutput(a, e, checker, i),
  ];
  for (const route of routes) {
    const input = '2 2\n1 3';
    const valid = '2\n2\n1';
    const other = '2\n1 2\n-1';
    assert(route(valid, other, input));
    assert(route(other, valid, input));
    for (const bad of ['4\n-1\n1 2', '2\n2\n2', '2\n1 2\n1', '2\n2\n-1']) {
      assert(!route(bad, valid, input));
      assert(!route(valid, bad, input));
      assert(!route(bad, bad, input));
    }
  }
});
