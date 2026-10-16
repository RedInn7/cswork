import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  KIND_RUBRIC,
  MAX_DIMS,
  MAX_FEEDBACK,
  RUBRIC,
  ROLEPLAY_RUBRIC,
  decodeFeedback,
  encodeFeedback,
  forSet,
  questionTag,
  rubricAverage,
  rubricFor,
  rubricTrend,
  type Feedback,
} from '../lib/mock-interview-feedback';
import type { KindId } from '../lib/mock-interview';

const base: Feedback = {
  seed: 'k3x9q2ab',
  rerolls: [1, 1, 2],
  rubric: { communication: 4, problem: 3, testing: 2 },
  verdict: 'yes',
  strengths: 'Clear plan before coding. 先讲思路再写代码 👍',
  improvements: 'Test the empty input.\nName variables.',
  questions: [
    { rating: 3, note: 'BFS, missed the visited set at first', tag: questionTag('coding-graph-bfs') },
    { rating: null, note: '', tag: '' },
    { rating: 4, note: '', tag: questionTag('sd-rate-limiter') },
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
    questions: [{ rating: 2, note: '🙂'.repeat(900), tag: 'ab12' }, { rating: 4, note: 'ok', tag: '' }],
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
  assert.equal(back.questions[0].tag, 'ab12');
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
    raw({ v: 1, s: 'abc', r: [0, -1, 1.5, '2', 3, 99], k: [5, 0, 2, 'x', 4, 4], o: 'maybe', g: 7, i: 'fine', q: [[9, 1], 'x', [2, 'ab12', 'n'], null, [3, 'TOOLONG', 'm']] }),
  )!;
  assert.deepEqual(fb.rerolls, [0, 3]);
  // The sixth score lands on the sixth dimension (motivation): new dimensions only ever go at the end.
  assert.deepEqual(fb.rubric, { coding: 2, complexity: 4, motivation: 4 });
  assert.equal(fb.verdict, null);
  assert.equal(fb.strengths, '');
  assert.equal(fb.improvements, 'fine');
  assert.deepEqual(fb.questions, [
    { rating: null, note: '', tag: '' },
    { rating: null, note: '', tag: '' },
    { rating: 2, note: 'n', tag: 'ab12' },
    { rating: null, note: '', tag: '' },
    { rating: 3, note: 'm', tag: '' },
  ]);
});

void test('the rubric covers distinct items and averages only what was scored', () => {
  assert.equal(new Set(RUBRIC.map((r) => r.id)).size, RUBRIC.length);
  assert.ok(RUBRIC.every((r) => r.name.every(Boolean) && r.hint.every(Boolean)));
  assert.equal(new Set(RUBRIC.map((r) => r.name[1])).size, RUBRIC.length);
  for (const ids of Object.values(KIND_RUBRIC)) assert.ok(ids.every((id) => RUBRIC.some((r) => r.id === id)), ids.join());
  assert.equal(rubricAverage({}), null);
  assert.equal(rubricAverage(base.rubric), 3);
});

void test('question tags tell questions apart and feedback knows its set', () => {
  assert.match(questionTag('coding-merge-intervals'), /^[0-9a-z]{4}$/);
  assert.equal(questionTag('coding-merge-intervals'), questionTag('coding-merge-intervals'));
  const tags = new Set(Array.from({ length: 200 }, (_, i) => questionTag(`coding-${i}`)));
  assert.ok(tags.size >= 199, `${tags.size}`);
  assert.equal(forSet(base, { set: base.seed, rr: '1.1.2' }), true);
  assert.equal(forSet(base, { set: base.seed }), false);
  assert.equal(forSet({ ...base, rerolls: [] }, { set: base.seed }), true);
  assert.equal(forSet(base, { set: 'other', rr: '1.1.2' }), false);
});

void test('links written before the per-round rubric decode as they did', () => {
  // Encoded by the eight-dimension version: k is positional, so the new dimensions only ever go after it.
  const old = 'eyJ2IjoxLCJzIjoiazN4OXEyYWIiLCJyIjpbMV0sImsiOlszLDIsMCw0LDEsMCwyXSwibyI6InllcyIsImciOiJvayIsInEiOltbMywiYWIxMiIsIm4iXV19';
  assert.deepEqual(decodeFeedback(old), {
    seed: 'k3x9q2ab',
    rerolls: [1],
    rubric: { communication: 3, problem: 2, testing: 4, complexity: 1, anchoring: 2 },
    verdict: 'yes',
    strengths: 'ok',
    improvements: '',
    questions: [{ rating: 3, note: 'n', tag: 'ab12' }],
  });
  assert.deepEqual(
    RUBRIC.slice(0, 8).map((r) => r.id),
    ['communication', 'problem', 'coding', 'testing', 'complexity', 'motivation', 'anchoring', 'leverage'],
  );
  // A five-dimension sheet still writes the old five-long k.
  const five = encodeFeedback({ ...base, rubric: { communication: 2, complexity: 3 } })!.value;
  assert.deepEqual((JSON.parse(Buffer.from(five, 'base64url').toString()) as { k: number[] }).k, [2, 0, 0, 0, 3]);
});

void test('a full nine-dimension report with empty texts encodes whole and decodes back', () => {
  const dims = rubricFor(['coding', 'design', 'behavioral']);
  assert.equal(dims.length, MAX_DIMS);
  const rubric = Object.fromEntries(dims.map((id, i) => [id, (i % 4) + 1])) as Feedback['rubric'];
  const nine: Feedback = {
    seed: 'k3x9q2ab',
    rerolls: [3, 1, 2, 0],
    rubric,
    verdict: 'strong-yes',
    strengths: '',
    improvements: '',
    questions: Array.from({ length: 8 }, (_, i) => ({ rating: (i % 4) + 1, note: '', tag: questionTag(`q-${i}`) })),
    ai: true,
  };
  const made = encodeFeedback(nine)!;
  assert.equal(made.truncated, false);
  assert.ok(made.value.length <= MAX_FEEDBACK, `${made.value.length}`);
  assert.deepEqual(decodeFeedback(made.value), nine);
  // Every dimension, new ones included, survives on its own.
  for (const { id } of RUBRIC) {
    const rubric = { [id]: 2 } as Feedback['rubric'];
    assert.deepEqual(decodeFeedback(encodeFeedback({ ...base, rubric })!.value)!.rubric, rubric);
  }
});

void test("rubricFor: communication plus each round's dimensions in turn, at most nine, in RUBRIC order", () => {
  const order = (ids: string[]) => RUBRIC.map((r) => r.id).filter((id) => ids.includes(id));
  const core = ['communication', 'problem', 'coding', 'testing', 'complexity'];
  for (const kind of ['coding', 'sql', 'lld'] as KindId[]) assert.deepEqual(rubricFor([kind]), core);
  assert.deepEqual(rubricFor(['coding', 'coding', 'sql']), core);
  assert.deepEqual(rubricFor(['behavioral']), ['communication', 'star', 'ownership', 'impact', 'reflection']);
  assert.deepEqual(rubricFor(['design']), ['communication', 'requirements', 'hld', 'scale', 'tradeoffs', 'deepdive']);
  assert.deepEqual(rubricFor(['negotiation']), ROLEPLAY_RUBRIC);
  // A kind with no mapping yet (a newer round) is scored on the core five.
  assert.deepEqual(rubricFor(['frontend' as KindId]), core);
  // The phone screen fits whole: behavioral + coding.
  assert.deepEqual(rubricFor(['behavioral', 'coding', 'coding']), order([...core, 'star', 'ownership', 'impact', 'reflection']));
  // The onsite loop is over nine: every round keeps its most telling dimensions.
  const onsite = rubricFor(['coding', 'coding', 'design', 'behavioral', 'behavioral']);
  assert.equal(onsite.length, MAX_DIMS);
  assert.deepEqual(onsite, order(onsite));
  for (const id of ['communication', 'problem', 'coding', 'testing', 'requirements', 'hld', 'scale', 'star', 'ownership'])
    assert.ok(onsite.includes(id as never), id);
  // Data science: SQL, analytics, statistics and behavioral, with stats counted once.
  const ds = rubricFor(['sql', 'analytics', 'stats', 'behavioral']);
  assert.equal(ds.length, MAX_DIMS);
  assert.deepEqual(ds, ['communication', 'problem', 'coding', 'testing', 'star', 'ownership', 'metric', 'experiment', 'stats']);
  assert.deepEqual(rubricFor(['ml', 'coding', 'behavioral']).slice(-2), ['modeling', 'mltradeoffs']);
});

void test("the trend keeps each dimension's last scores, oldest first, and only from two on", () => {
  const rows = [
    { communication: 2, coding: 3, star: null },
    { communication: 3, coding: null, star: 4 },
    { communication: 4, problem: 2.5, leverage: 9 },
  ];
  assert.deepEqual(rubricTrend(rows), { communication: [2, 3, 4] });
  assert.deepEqual(rubricTrend(rows, 2), { communication: [3, 4] });
  assert.deepEqual(rubricTrend([]), {});
});
