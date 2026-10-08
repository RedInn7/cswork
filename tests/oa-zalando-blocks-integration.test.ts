import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import {
  OA_SEMANTIC_IDS,
  matchesOaSemantic,
} from '../lib/oa-semantic-checkers.mjs';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
const checker = 'oa-zalando-blocks' as const;
function fixture() {
  return {
    schemaVersion: 1,
    problem: {
      id: 'oa-zalando-1',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Longest blocks',
      difficulty: '中等',
      tags: ['OA'],
      description: 'Join whole blocks without triples.',
      input: 'AA AB BB counts',
      output: 'Any longest string',
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
        input: '1 0 1',
        expectedOutput: 'AABB',
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: '0 0 10',
        expectedOutput: 'BB',
        hidden: true,
        weight: 1,
      },
    ],
  };
}
test('Zalando identity and ACM schema cannot be rebound', () => {
  assert.equal(OA_SEMANTIC_IDS[checker], 'oa-zalando-1');
  assert(ojImportSchema.safeParse(fixture()).success);
  for (const id of ['oa-zalando-2', 'oa-wayfair-3', 'lc-1', 'custom']) {
    const p = fixture();
    p.problem.id = id;
    assert(!ojImportSchema.safeParse(p).success);
  }
  for (const extra of [
    { checkerCode: 'return true' },
    { codingModes: ['leetcode'] },
    { semanticId: 1 },
    { specialId: 1 },
  ]) {
    const p = fixture();
    assert(
      !ojImportSchema.safeParse({ ...p, problem: { ...p.problem, ...extra } })
        .success,
    );
  }
});
test('schema independently validates input and optimal reference', () => {
  const p = fixture();
  p.cases[0].expectedOutput = 'BBAA';
  assert(ojImportSchema.safeParse(p).success);
  for (const value of ['AA', 'ABAB', 'AAB', 'AAAABB', '"AABB"']) {
    const p = fixture();
    p.cases[0].expectedOutput = value;
    assert(!ojImportSchema.safeParse(p).success);
  }
  for (const value of ['0 0 0', '11 0 1', '1 -1 1', '1 0 1 2', '{"a":1}']) {
    const p = fixture();
    p.cases[0].input = value;
    assert(!ojImportSchema.safeParse(p).success);
  }
});
test('all judge routes accept alternate optima and reject invalid expected too', () => {
  const routes = [
    (a: string, e: string, i: string) => matchesOaSemantic(checker, a, e, i),
    (a: string, e: string, i: string) => matchesOutput(a, e, checker, i),
    (a: string, e: string, i: string) => matchesOaOutput(a, e, checker, i),
  ];
  for (const route of routes) {
    assert(route('BBAA', 'AABB', '1 0 1'));
    for (const bad of ['AA', 'ABAB', 'AAAABB', 'BABA', 'AAB']) {
      assert(!route(bad, 'AABB', '1 0 1'));
      assert(!route('AABB', bad, '1 0 1'));
      assert(!route(bad, bad, '1 0 1'));
    }
  }
});
