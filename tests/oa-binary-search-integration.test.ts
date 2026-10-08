import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import { matchesOutput } from '../lib/server/oj-engine';
import { matchesOaOutput } from '../scripts/oa-judge/output-checker.mjs';
import { matchesOaSemantic } from '../lib/oa-semantic-checkers.mjs';

const checker = 'oa-binary-search-witness' as const;
const witness = '3\n1 2 3\n2\n';
function fixture() {
  return {
    schemaVersion: 1,
    problem: {
      id: 'oa-pure-storage-8',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Binary search counterexample',
      difficulty: '简单',
      tags: ['OA'],
      description: 'Produce a valid counterexample.',
      input: 'No input',
      output: 'Three lines',
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
        name: 'Only input',
        input: '',
        expectedOutput: witness,
        hidden: false,
        weight: 1,
      },
    ],
  };
}

test('singleton schema is restricted to the fixed witness contract', () => {
  assert(ojImportSchema.safeParse(fixture()).success);
  for (const change of [
    (p: ReturnType<typeof fixture>) => {
      p.problem.id = 'oa-google-1';
    },
    (p: ReturnType<typeof fixture>) => {
      p.cases[0].hidden = true;
    },
    (p: ReturnType<typeof fixture>) => {
      p.cases[0].input = ' ';
    },
    (p: ReturnType<typeof fixture>) => {
      p.cases.push({ ...p.cases[0], name: 'duplicate' });
    },
    (p: ReturnType<typeof fixture>) => {
      p.cases[0].expectedOutput = 'CORRECT';
    },
  ]) {
    const p = fixture();
    change(p);
    assert(!ojImportSchema.safeParse(p).success);
  }
  const p = fixture();
  assert(
    !ojImportSchema.safeParse({
      ...p,
      problem: { ...p.problem, checker: 'tokens' },
    }).success,
  );
});

test('worker, offline verifier and shared dispatcher accept alternate witnesses', () => {
  const routes = [
    matchesOaSemantic,
    (c: typeof checker, a: string, e: string, i: string) =>
      matchesOutput(a, e, c, i),
    (c: typeof checker, a: string, e: string, i: string) =>
      matchesOaOutput(a, e, c, i),
  ];
  for (const route of routes) {
    assert(route(checker, '3\n-3 0 9\n0\n', witness, ''));
    for (const bad of ['CORRECT', '3\n1 2 3\n3\n', '3\n3 2 1\n2\n']) {
      assert(!route(checker, bad, witness, ''));
      assert(!route(checker, witness, bad, ''));
    }
    assert(!route(checker, witness, witness, 'extra input'));
  }
});
