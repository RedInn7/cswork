import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_FEEDBACK,
  RUBRIC,
  decodeFeedback,
  encodeFeedback,
  rubricAverage,
  type Feedback,
} from '../lib/mock-interview-feedback';

const base: Feedback = {
  seed: 'k3x9q2ab',
  rerolls: [1, 1, 2],
  rubric: { communication: 4, problem: 3, testing: 2 },
  verdict: 'yes',
  strengths: 'Clear plan before coding. 先讲思路再写代码 👍',
  improvements: 'Test the empty input.\nName variables.',
  questions: [
    { rating: 3, note: 'BFS, missed the visited set at first' },
    { rating: null, note: '' },
    { rating: 4, note: '' },
  ],
};
const raw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

void test('feedback round-trips through a URL-safe value', () => {
  const made = encodeFeedback(base)!;
  assert.equal(made.truncated, false);
  assert.match(made.value, /^[\w-]+$/);
  assert.deepEqual(decodeFeedback(made.value), base);
  // The value survives the fragment as the candidate's page reads it.
  const hash = new URL(`https://cswork.org/?view=mock-interview&set=${base.seed}#fb=${made.value}`).hash;
  assert.deepEqual(decodeFeedback(new URLSearchParams(hash.slice(1)).get('fb')), base);
  // An empty sheet is still a valid link.
  const empty: Feedback = { seed: 'a', rerolls: [], rubric: {}, verdict: null, strengths: '', improvements: '', questions: [] };
  assert.deepEqual(decodeFeedback(encodeFeedback(empty)!.value), empty);
});

void test('long notes are cut to fit, the longest first, without splitting characters', () => {
  const long: Feedback = {
    ...base,
    strengths: '思路清晰，'.repeat(400),
    improvements: 'short and kept',
    questions: [{ rating: 2, note: '🙂'.repeat(900) }, { rating: 4, note: 'ok' }],
  };
  const made = encodeFeedback(long)!;
  assert.equal(made.truncated, true);
  assert.ok(made.value.length <= MAX_FEEDBACK, `${made.value.length}`);
  const back = decodeFeedback(made.value)!;
  assert.equal(back.improvements, 'short and kept');
  assert.equal(back.questions[1].note, 'ok');
  assert.ok(back.strengths.endsWith('…') && back.strengths.length > 20);
  assert.ok(long.strengths.startsWith(back.strengths.slice(0, -1)));
  assert.ok(/^(🙂)+…$/u.test(back.questions[0].note));
  assert.deepEqual(back.rubric, long.rubric);
  assert.equal(back.questions[0].rating, 2);
  // Nothing fits under an absurd cap: null rather than a broken link.
  assert.equal(encodeFeedback(base, 10), null);
});

void test('malformed, oversized and foreign values are rejected', () => {
  for (const bad of [
    null,
    undefined,
    '',
    'not base64!',
    'A',
    'a'.repeat(MAX_FEEDBACK + 4),
    Buffer.from('not json').toString('base64url'),
    Buffer.from([0xff, 0xfe, 0x00]).toString('base64url'),
    raw(null),
    raw([1, 2]),
    raw('text'),
    raw({ v: 2, s: 'abc' }),
    raw({ v: 1 }),
    raw({ v: 1, s: '' }),
    raw({ v: 1, s: 'x'.repeat(65) }),
  ])
    assert.equal(decodeFeedback(bad), null, String(bad).slice(0, 40));
});

void test('nonsense inside a valid payload is dropped, not fatal', () => {
  const fb = decodeFeedback(
    raw({ v: 1, s: 'abc', r: [0, -1, 1.5, '2', 3, 99], k: [5, 0, 2, 'x', 4, 4], o: 'maybe', g: 7, i: 'fine', q: [[9, 1], 'x', [2, 'n'], null] }),
  )!;
  assert.deepEqual(fb.rerolls, [0, 3]);
  assert.deepEqual(fb.rubric, { coding: 2, complexity: 4 });
  assert.equal(fb.verdict, null);
  assert.equal(fb.strengths, '');
  assert.equal(fb.improvements, 'fine');
  assert.deepEqual(fb.questions, [
    { rating: null, note: '' },
    { rating: null, note: '' },
    { rating: 2, note: 'n' },
    { rating: null, note: '' },
  ]);
});

void test('the rubric covers five distinct items and averages only what was scored', () => {
  assert.equal(new Set(RUBRIC.map((r) => r.id)).size, 5);
  assert.ok(RUBRIC.every((r) => r.name.every(Boolean) && r.hint.every(Boolean)));
  assert.equal(rubricAverage({}), null);
  assert.equal(rubricAverage(base.rubric), 3);
});
