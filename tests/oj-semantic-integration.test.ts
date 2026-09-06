import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import { matchesOutput } from '../lib/server/oj-engine';
import {
  MAX_INTEGER_ROWS,
  validStructuredOutput,
} from '../lib/oj-result-shapes';
const base = {
  schemaVersion: 1,
  problem: {
    id: 'lc-5',
    courseId: 'gomall',
    lessonId: '00-overview',
    title: 'Palindrome',
    difficulty: '中等',
    tags: ['fixture'],
    description: 'Longest palindrome',
    input: 'JSON array',
    output: 'One line',
    explanation: 'Example',
    hints: [],
    timeLimit: 2,
    memoryLimit: 262144,
    outputLimit: 64,
    checker: 'semantic-lc-5',
    semanticId: 5,
    languages: ['python'],
  },
  cases: [
    {
      name: 'sample',
      input: '["babad"]',
      expectedOutput: 'bab\n',
      hidden: false,
      weight: 1,
    },
    {
      name: 'hidden',
      input: '["cbbd"]',
      expectedOutput: 'bb\n',
      hidden: true,
      weight: 1,
    },
  ],
};
void test('import and engine bind semantic checker to the actual problem and case input', () => {
  assert.equal(ojImportSchema.safeParse(base).success, true);
  assert.equal(
    matchesOutput('aba\n', 'bab\n', 'semantic-lc-5', '["babad"]'),
    true,
  );
  assert.equal(
    matchesOutput('aba\n', 'bab\n', 'semantic-lc-5', '["bab"]'),
    false,
  );
  assert.equal(matchesOutput('aba\n', 'bab\n', 'semantic-lc-5'), false);
  for (const changes of [
    { id: 'lc-1044' },
    { semanticId: 1044 },
    { semanticId: undefined },
    { checker: 'tokens' },
    { checker: 'semantic-lc-999' },
  ])
    assert.equal(
      ojImportSchema.safeParse({
        ...base,
        problem: { ...base.problem, ...changes },
      }).success,
      false,
    );
});
void test('semantic expected output is validated against its JSON input before import', () => {
  for (const changes of [
    { input: 'not json' },
    { input: '{}' },
    { expectedOutput: 'bad\n' },
    { expectedOutput: 'bab' },
  ])
    assert.equal(
      ojImportSchema.safeParse({
        ...base,
        cases: [{ ...base.cases[0], ...changes }, base.cases[1]],
      }).success,
      false,
    );
});
void test('integer rows have their own four-million count budget', () => {
  assert.equal(MAX_INTEGER_ROWS, 4_000_000);
  const text = '1000001\n' + '0\n'.repeat(1_000_001);
  assert.equal(validStructuredOutput('integer-rows', text), true);
  assert.equal(validStructuredOutput('nullable-integer-array', text), false);
  assert.equal(validStructuredOutput('integer-rows', '4000001\n'), false);
});
