import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ojImportSchema,
  OJ_MAX_CASE_BYTES,
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_EXPECTED_BYTES,
  OJ_MAX_CASES,
} from '../lib/oj-types';
import {
  OJ_MAX_PUBLIC_CASE_BYTES,
  OJ_LARGE_SNAPSHOT_BYTES,
} from '../lib/oj-data-budgets.mjs';
import {
  assertSnapshotBudget,
  exclusiveSubmission,
  SubmissionAdmission,
} from '../lib/server/oj-worker-policy';
import { boundedFeedback, FEEDBACK_BYTES } from '../lib/server/oj-case-store';

function payload(input: string) {
  return {
    schemaVersion: 1,
    problem: {
      id: 'input-capacity',
      courseId: 'gomall',
      lessonId: '00-overview',
      title: '容量边界',
      difficulty: '简单',
      tags: ['测试'],
      description: 'Fixture',
      input: 'Input',
      output: 'Output',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      {
        name: 'public',
        input: '1',
        expectedOutput: '1',
        hidden: false,
        weight: 1,
      },
      { name: 'hidden', input, expectedOutput: '1', hidden: true, weight: 1 },
    ],
  };
}

void test('32 MiB ASCII hidden input accepted by schema and worker; one extra byte rejected', () => {
  assert.equal(OJ_MAX_CASE_BYTES, 32 * 1024 * 1024);
  const input = 'a'.repeat(OJ_MAX_CASE_BYTES);
  assert.equal(ojImportSchema.safeParse(payload(input)).success, true);
  assert.doesNotThrow(() =>
    assertSnapshotBudget([{ input, expectedOutput: '1' }]),
  );
  assert.equal(ojImportSchema.safeParse(payload(input + 'a')).success, false);
  assert.throws(
    () => assertSnapshotBudget([{ input: input + 'a', expectedOutput: '1' }]),
    /bounded data budget/,
  );
});

void test('hidden input limits measure UTF-8 bytes, not UTF-16 characters', () => {
  const input = '中'.repeat(Math.floor(OJ_MAX_CASE_BYTES / 3)) + 'ab';
  assert.equal(Buffer.byteLength(input), OJ_MAX_CASE_BYTES);
  assert.equal(ojImportSchema.safeParse(payload(input)).success, true);
  assert.doesNotThrow(() =>
    assertSnapshotBudget([{ input, expectedOutput: '' }]),
  );
  assert.equal(ojImportSchema.safeParse(payload(input + 'a')).success, false);
  assert.throws(
    () => assertSnapshotBudget([{ input: input + 'a', expectedOutput: '' }]),
    /bounded data budget/,
  );
});

void test('public samples and case count retain their original limits', () => {
  assert.equal(OJ_MAX_PUBLIC_CASE_BYTES, 32768);
  assert.equal(OJ_MAX_CASES, 64);
  const p = payload('1');
  p.cases[0].input = 'a'.repeat(32768);
  p.cases[0].expectedOutput = 'a'.repeat(32768);
  assert.equal(ojImportSchema.safeParse(p).success, true);
  p.cases[0].input += 'a';
  assert.equal(ojImportSchema.safeParse(p).success, false);
  p.cases[0].input = '1';
  p.cases[0].expectedOutput += 'a';
  assert.equal(ojImportSchema.safeParse(p).success, false);
  p.cases[0].expectedOutput = '1';
  p.cases = [
    p.cases[0],
    ...Array.from({ length: 63 }, (_, i) => ({
      ...p.cases[1],
      name: `hidden-${i}`,
    })),
  ];
  assert.equal(ojImportSchema.safeParse(p).success, true);
  p.cases.push({ ...p.cases[1], name: 'hidden-64' });
  assert.equal(ojImportSchema.safeParse(p).success, false);
});

void test('combined snapshots remain capped at 128 MiB and answers at 64 MiB', () => {
  assert.equal(OJ_MAX_IMPORT_BYTES, 128 * 1024 * 1024);
  assert.equal(OJ_MAX_EXPECTED_BYTES, 64 * 1024 * 1024);
  const c = { input: 'a'.repeat(OJ_MAX_CASE_BYTES), expectedOutput: '' };
  assert.doesNotThrow(() => assertSnapshotBudget([c, c, c, c]));
  assert.throws(
    () =>
      assertSnapshotBudget([c, c, c, c, { input: 'a', expectedOutput: '' }]),
    /bounded data budget/,
  );
  const answer = 'a'.repeat(OJ_MAX_EXPECTED_BYTES);
  assert.doesNotThrow(() =>
    assertSnapshotBudget([{ input: '', expectedOutput: answer }]),
  );
  assert.throws(
    () => assertSnapshotBudget([{ input: '', expectedOutput: answer + 'a' }]),
    /bounded data budget/,
  );
});

void test('custom input and first-error feedback bounds are not coupled to hidden data', () => {
  // This module intentionally does not import the database-backed submission graph.
  const source = readFileSync(
    new URL('../lib/server/oj-submissions.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /export const MAX_STDIN_BYTES = 65536;/);
  assert.match(source, /Buffer\.byteLength\(d\.stdin\) > MAX_STDIN_BYTES/);
  assert.equal(FEEDBACK_BYTES, 32768);
  const result = boundedFeedback('中'.repeat(20000));
  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.text) <= 32768);
  assert.equal(result.text.includes('\uFFFD'), false);
});

void test('new Uber semantic checker names remain bound to their exact problem IDs', () => {
  for (const [checker, id] of [
    ['oa-quadratic-minimum', 'oa-uber-25'],
    ['oa-compatible-groups', 'oa-uber-34'],
    ['oa-football-top-two', 'oa-uber-38'],
  ]) {
    const p = payload('1');
    p.problem.checker = checker;
    p.problem.id = id;
    assert.equal(ojImportSchema.safeParse(p).success, true);
    p.problem.id = 'unrelated-problem';
    assert.equal(ojImportSchema.safeParse(p).success, false);
  }
});

void test('new 32 MiB inputs still get exclusive admission and cannot overlap ordinary work', async () => {
  assert.equal(OJ_LARGE_SNAPSHOT_BYTES, 8 * 1024 * 1024);
  assert.equal(exclusiveSubmission(OJ_LARGE_SNAPSHOT_BYTES, 262144, 64), false);
  assert.equal(
    exclusiveSubmission(OJ_LARGE_SNAPSHOT_BYTES + 1, 262144, 64),
    true,
  );
  const gate = new SubmissionAdmission(2),
    signal = new AbortController().signal;
  const releaseOrdinary = await gate.acquire(false, signal);
  let largeStarted = false,
    followingStarted = false;
  const large = gate
    .acquire(exclusiveSubmission(OJ_MAX_CASE_BYTES, 262144, 64), signal)
    .then((release) => {
      largeStarted = true;
      return release;
    });
  const following = gate.acquire(false, signal).then((release) => {
    followingStarted = true;
    return release;
  });
  await Promise.resolve();
  assert.equal(largeStarted, false);
  assert.equal(followingStarted, false);
  releaseOrdinary();
  const releaseLarge = await large;
  assert.equal(followingStarted, false);
  releaseLarge();
  (await following)();
});
