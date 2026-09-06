import test from 'node:test';
import assert from 'node:assert/strict';
import {
  problems,
  problemStatement,
  type ProblemStatement,
} from '../lib/problems';
import { ojImportSchema } from '../lib/oj-types';

const english: ProblemStatement = {
  title: 'Watched intervals',
  description: 'Compute the total watched time.',
  input: 'Read n followed by n half-open intervals.',
  output: 'Print the union length.',
  explanation: 'Overlapping time is counted once.',
  hints: ['Sort by start time.'],
};
function payload() {
  const { sampleIn, sampleOut, ...problem } = problems[0];
  return {
    schemaVersion: 1,
    problem: {
      ...problem,
      courseId: 'gomall',
      outputLimit: 4096,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      {
        name: 'sample',
        input: sampleIn,
        expectedOutput: sampleOut,
        hidden: false,
        weight: 1,
      },
      {
        name: 'hidden',
        input: '1\n0 1\n',
        expectedOutput: '1\n',
        hidden: true,
        weight: 1,
      },
    ],
  };
}
void test('legacy problem stays Chinese when English is unavailable without mutation', () => {
  const original = JSON.stringify(problems[0]);
  assert.equal(problemStatement(problems[0], 'en'), problems[0]);
  const parsed = ojImportSchema.parse(payload());
  assert.equal(Object.hasOwn(parsed.problem, 'translations'), false);
  assert.equal(JSON.stringify(problems[0]), original);
});
void test('English statement survives JSON import/export and preserves judge input', () => {
  const source = payload();
  const bilingual = {
    ...source,
    problem: {
      ...source.problem,
      difficulty: '困难',
      translations: { en: english },
    },
  };
  const parsed = ojImportSchema.parse(JSON.parse(JSON.stringify(bilingual)));
  assert.deepEqual(parsed.problem.translations?.en, english);
  assert.deepEqual(parsed.cases, source.cases);
  const publicProblem = {
    ...problems[0],
    translations: parsed.problem.translations,
  };
  assert.deepEqual(problemStatement(publicProblem, 'en'), english);
  assert.equal(problemStatement(publicProblem, 'zh'), publicProblem);
});
void test('partial translations and executable import fields are rejected', () => {
  const source = payload();
  for (const translation of [
    { title: 'Partial' },
    { ...english, runner: 'shell' },
    { ...english, input: '' },
  ]) {
    assert.equal(
      ojImportSchema.safeParse({
        ...source,
        problem: { ...source.problem, translations: { en: translation } },
      }).success,
      false,
    );
  }
});
