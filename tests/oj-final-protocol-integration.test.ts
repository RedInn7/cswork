import assert from 'node:assert/strict';
import test from 'node:test';
import { ojImportSchema } from '../lib/oj-types';
import { matchesOutput, engineVerdict } from '../lib/server/oj-engine';
const problem = {
  id: 'lc-49',
  courseId: 'gomall',
  lessonId: '00-overview',
  title: 'Fixture',
  difficulty: '中等',
  tags: ['fixture'],
  description: 'Fixture',
  input: 'JSON',
  output: 'JSON',
  explanation: 'Fixture',
  hints: [],
  timeLimit: 2,
  memoryLimit: 262144,
  outputLimit: 64,
  languages: ['python'],
};
function candidate(
  fields: Record<string, unknown>,
  input: string,
  expectedOutput: string,
) {
  return {
    schemaVersion: 1,
    problem: { ...problem, ...fields },
    cases: [
      { name: 'sample', input, expectedOutput, hidden: false, weight: 1 },
      { name: 'private', input, expectedOutput, hidden: true, weight: 1 },
    ],
  };
}
void test('fixed string and node protocols bind identity and validate shape', () => {
  const fields = { checker: 'strings-lc-49', stringStructureId: 49 };
  assert.ok(
    ojImportSchema.safeParse(
      candidate(fields, '[["eat","tea"]]', '[["eat","tea"]]\n'),
    ).success,
  );
  for (const bad of [
    { stringStructureId: 68 },
    { id: 'lc-68' },
    { checker: 'tokens' },
    { checker: 'strings-lc-999' },
  ])
    assert.equal(
      ojImportSchema.safeParse(
        candidate({ ...fields, ...bad }, '[]', '[["a"]]\n'),
      ).success,
      false,
    );
  assert.equal(
    ojImportSchema.safeParse(candidate(fields, '[]', '[[1]]\n')).success,
    false,
  );
  assert.ok(
    matchesOutput('[["tea","eat"]]\n', '[["eat","tea"]]\n', 'strings-lc-49'),
  );
  assert.equal(
    matchesOutput('[["tea"]]\n', '[["eat","tea"]]\n', 'strings-lc-49'),
    false,
  );
  assert.ok(
    ojImportSchema.safeParse(
      candidate(
        { id: 'lc-142', checker: 'tokens', specialId: 142 },
        '[[1],0]',
        '0\n',
      ),
    ).success,
  );
  assert.equal(
    ojImportSchema.safeParse(
      candidate(
        { id: 'lc-142', checker: 'tokens', specialId: 141 },
        '[[1],0]',
        '0\n',
      ),
    ).success,
    false,
  );
});
void test('finite floats and exact fractions reject malformed values and wrong bindings', () => {
  assert.ok(
    ojImportSchema.safeParse(
      candidate({ id: 'lc-4', checker: 'float' }, '[[1],[2]]', '1.5\n'),
    ).success,
  );
  assert.equal(
    ojImportSchema.safeParse(candidate({ checker: 'float' }, '[]', 'NaN\n'))
      .success,
    false,
  );
  assert.ok(matchesOutput('1.50000001\n', '1.5\n', 'float'));
  assert.equal(
    matchesOutput('1\n-0.999999\n', '1\n-1\n', 'float-array'),
    false,
  );
  assert.ok(matchesOutput('0.3(3)\n', '0.(3)\n', 'fraction-lc-166', '[1,3]'));
  assert.equal(matchesOutput('0.3(3)\n', '0.(3)\n', 'fraction-lc-166'), false);
  assert.ok(
    ojImportSchema.safeParse(
      candidate(
        { id: 'lc-166', checker: 'fraction-lc-166' },
        '[1,3]',
        '0.(3)\n',
      ),
    ).success,
  );
  assert.equal(
    ojImportSchema.safeParse(
      candidate({ id: 'lc-4', checker: 'fraction-lc-166' }, '[1,3]', '0.(3)\n'),
    ).success,
    false,
  );
  assert.equal(
    ojImportSchema.safeParse(
      candidate(
        { id: 'lc-759', checker: 'tokens', auxiliaryId: 1095 },
        '[]',
        '0\n',
      ),
    ).success,
    false,
  );
});
void test('complex design dispatch uses case input and rejects fixed metadata mismatch', () => {
  const input =
    '[["RandomizedSet","insert","insert","getRandom"],[[],[1],[2],[]]]';
  const fields = {
    id: 'lc-380',
    checker: 'design-lc-380',
    complexDesignId: 380,
  };
  assert.ok(
    ojImportSchema.safeParse(candidate(fields, input, '[null,1,1,1]\n'))
      .success,
  );
  assert.ok(
    matchesOutput('[null,1,1,2]\n', '[null,1,1,1]\n', 'design-lc-380', input),
  );
  assert.equal(
    matchesOutput('[null,1,1,3]\n', '[null,1,1,1]\n', 'design-lc-380', input),
    false,
  );
  assert.equal(
    matchesOutput('[null,1,1,2]\n', '[null,1,1,1]\n', 'design-lc-380'),
    false,
  );
  for (const bad of [
    { id: 'lc-381' },
    { complexDesignId: 381 },
    { checker: 'exact' },
    { checker: 'design-lc-999' },
  ])
    assert.equal(
      ojImportSchema.safeParse(
        candidate({ ...fields, ...bad }, input, '[null,1,1,1]\n'),
      ).success,
      false,
    );
});

void test('malformed two-stage codec output remains wrong-answer in custom runs', () => {
  assert.equal(engineVerdict({ status: 'Wrong Answer' }), 'wrong_answer');
});
