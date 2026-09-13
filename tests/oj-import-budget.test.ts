import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProblemPackage } from '../lib/server/oj-problems';
import { OJ_MAX_IMPORT_BYTES, OJ_MAX_CASE_BYTES } from '../lib/oj-types';

void test('serialized import package retains exact 128 MiB ceiling', () => {
  const payload = {
    schemaVersion: 1,
    problem: {
      id: 'serialized-budget', courseId: 'gomall', lessonId: '00-overview',
      title: '容量测试', difficulty: '简单', tags: ['测试'],
      description: 'Test', input: 'Input', output: 'Output', explanation: '',
      hints: [], timeLimit: 2, memoryLimit: 262144, outputLimit: 64,
      checker: 'tokens', languages: ['python'],
    },
    cases: Array.from({ length: 5 }, (_, index) => ({
      name: `case-${index}`, input: '', expectedOutput: '',
      hidden: index > 0, weight: 1,
    })),
  };
  const metadataBytes = Buffer.byteLength(JSON.stringify(payload));
  const input = 'a'.repeat(OJ_MAX_CASE_BYTES);
  for (const index of [1, 2, 3]) payload.cases[index].input = input;
  payload.cases[4].input = 'a'.repeat(
    OJ_MAX_IMPORT_BYTES - metadataBytes - 3 * OJ_MAX_CASE_BYTES,
  );
  assert.doesNotThrow(() => validateProblemPackage(payload));
  payload.cases[4].input += 'a';
  assert.throws(
    () => validateProblemPackage(payload),
    (error: unknown) => (error as { status?: number }).status === 413,
  );
});
