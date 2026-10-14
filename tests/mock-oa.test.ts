import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  archiveMock,
  drawMock,
  finishMock,
  formatClock,
  mockClock,
  mockExamFor,
  parseMockState,
  questionStates,
  reportLevel,
  reportWindow,
  scoreMock,
  seededRandom,
  settleMockState,
  summarizeAttempts,
  topicAffinity,
  topicDistribution,
  type MockSession,
  type PoolItem,
} from '../lib/mock-oa';
import { mockCatalogue, mockPool } from '../lib/server/mock-oa';
import { mockOaPaths, shownMockPresets } from '../lib/server/mock-oa-presets';
import { oaDifficulty, oaTopicProfile } from '../lib/server/oa-topics';

const lc = (n: number, difficulty: PoolItem['difficulty'], topics?: string[]): PoolItem => ({
  id: `lc-${n}`,
  difficulty,
  loose: false,
  ...(topics && { topics }),
});
const pool: PoolItem[] = [
  lc(1, 'easy'),
  lc(2, 'easy'),
  lc(3, 'medium'),
  lc(4, 'medium'),
  lc(5, 'hard'),
  lc(6, 'hard'),
];
const difficulty = (ids: string[]) =>
  ids.map((id) => pool.find((p) => p.id === id)!.difficulty);

test('a draw fills the slots in order and is reproducible from its seed', () => {
  const slots = ['easy', 'medium', 'medium', 'hard'] as const;
  const a = drawMock({ pool, slots, random: seededRandom(7) })!;
  assert.deepEqual(difficulty(a), [...slots]);
  assert.equal(new Set(a).size, 4);
  assert.deepEqual(drawMock({ pool, slots, random: seededRandom(7) }), a);
  const seen = new Set<string>();
  for (let seed = 1; seed < 40; seed++)
    seen.add(drawMock({ pool, slots: ['easy'], random: seededRandom(seed) })![0]);
  assert.deepEqual([...seen].sort(), ['lc-1', 'lc-2'], 'ties break at random');
});

test('exclusions and solved problems are avoided, but only while the pool allows', () => {
  for (let seed = 1; seed < 20; seed++) {
    const random = seededRandom(seed);
    assert.deepEqual(
      drawMock({ pool, slots: ['easy'], exclude: new Set(['lc-1']), random }),
      ['lc-2'],
    );
    assert.deepEqual(
      drawMock({ pool, slots: ['hard'], solved: new Set(['lc-5']), random }),
      ['lc-6'],
    );
  }
  // Both easies were just seen: an unseen problem of another difficulty beats them.
  const fresh = drawMock({
    pool,
    slots: ['easy'],
    exclude: new Set(['lc-1', 'lc-2']),
    random: seededRandom(3),
  })!;
  assert.notEqual(difficulty(fresh)[0], 'easy');
  // Everything excluded: still a full draw rather than none.
  const all = new Set(pool.map((p) => p.id));
  assert.equal(drawMock({ pool, slots: ['easy', 'hard'], exclude: all })!.length, 2);
});

test('loose OA labels fit within one difficulty step; a pool smaller than the slots draws nothing', () => {
  const oa: PoolItem[] = [
    { id: 'oa-acme-1', difficulty: 'medium', loose: true },
    { id: 'oa-acme-2', difficulty: 'easy', loose: true },
  ];
  // The default 中等 OA label fits a hard slot; an OA easy does not.
  for (let seed = 1; seed < 10; seed++)
    assert.deepEqual(drawMock({ pool: oa, slots: ['hard'], random: seededRandom(seed) }), ['oa-acme-1']);
  // An exact LeetCode match beats an OA problem one step away.
  assert.deepEqual(drawMock({ pool: [...oa, lc(9, 'hard')], slots: ['hard'] }), ['lc-9']);
  // An estimated OA difficulty fits exactly, like LeetCode.
  const estimated: PoolItem = { id: 'oa-acme-3', difficulty: 'medium', loose: false };
  for (let seed = 1; seed < 10; seed++)
    assert.deepEqual(
      drawMock({ pool: [estimated, lc(7, 'hard')], slots: ['hard'], random: seededRandom(seed) }),
      ['lc-7'],
    );
  assert.equal(drawMock({ pool: oa, slots: ['easy', 'medium', 'hard'] }), null);
  assert.equal(drawMock({ pool: [lc(1, 'easy'), lc(1, 'easy')], slots: ['easy', 'easy'] }), null);
});

test("the company's topics tilt the draw without making it deterministic", () => {
  const topics = [
    { slug: 'greedy-scheduling', weight: 1 },
    { slug: 'hash-counting', weight: 0.5 },
  ];
  const weights = new Map(topics.map((t) => [t.slug, t.weight]));
  assert.equal(topicAffinity(['greedy-scheduling', 'hash-counting'], weights), 1.25);
  assert.equal(topicAffinity(['dp-grid', 'greedy-scheduling'], weights), 0.5);
  assert.equal(topicAffinity(undefined, weights), 0);
  const onTopic = lc(11, 'medium', ['greedy-scheduling']),
    offTopic = lc(12, 'medium', ['dp-grid']);
  const wins = { 'lc-11': 0, 'lc-12': 0 } as Record<string, number>;
  for (let seed = 1; seed <= 400; seed++)
    wins[drawMock({ pool: [onTopic, offTopic], slots: ['medium'], topics, random: seededRandom(seed) })![0]]++;
  // Weights 3 : 1, so about 300 : 100 — and the off-topic problem still comes up.
  assert.ok(wins['lc-11'] > 240 && wins['lc-11'] < 360, JSON.stringify(wins));
  assert.ok(wins['lc-12'] > 40, JSON.stringify(wins));
  // Recency, solved and difficulty still come first.
  for (let seed = 1; seed < 20; seed++) {
    const random = seededRandom(seed);
    assert.deepEqual(drawMock({ pool: [onTopic, offTopic], slots: ['medium'], topics, solved: new Set(['lc-11']), random }), ['lc-12']);
    assert.deepEqual(drawMock({ pool: [onTopic, offTopic], slots: ['medium'], topics, exclude: new Set(['lc-11']), random }), ['lc-12']);
    assert.deepEqual(
      drawMock({ pool: [lc(13, 'hard', ['greedy-scheduling']), offTopic], slots: ['medium'], topics, random }),
      ['lc-12'],
    );
  }
  // Without company topics the draw is even.
  const even = { 'lc-11': 0, 'lc-12': 0 } as Record<string, number>;
  for (let seed = 1; seed <= 400; seed++)
    even[drawMock({ pool: [onTopic, offTopic], slots: ['medium'], random: seededRandom(seed) })![0]]++;
  assert.ok(Math.abs(even['lc-11'] - 200) < 50, JSON.stringify(even));
});

test('topic distribution weights positions 1/0.5/0.25; profiles and difficulty come from the estimates', () => {
  const shares = topicDistribution([['a', 'b'], ['b'], ['c', 'a', 'b', 'd']]);
  assert.deepEqual(
    shares.map((s) => [s.slug, s.weight]),
    [['b', 1.75], ['a', 1.5], ['c', 1], ['d', 0]],
  );
  assert.equal(shares.reduce((sum, s) => sum + s.share, 0), 1);
  assert.deepEqual(topicDistribution([]), []);
  const amazon = oaTopicProfile(['amazon', 'amazon-mern']);
  assert.ok(amazon.count >= 400);
  assert.equal(amazon.difficulty.easy + amazon.difficulty.medium + amazon.difficulty.hard, amazon.count);
  assert.equal(amazon.topics[0].slug, 'greedy-scheduling');
  assert.equal(oaTopicProfile(['tiktok', 'bytedance']).count, 0);
  assert.deepEqual(oaTopicProfile(['amazon']).count, amazon.count - oaTopicProfile(['amazon-mern']).count);
  // A package's explicit 简单/困难 stands; its default 中等 gives way to the estimate.
  assert.deepEqual(oaDifficulty('oa-amazon-1', '中等'), { difficulty: '困难', difficultyEstimated: true });
  assert.deepEqual(oaDifficulty('oa-amazon-1', '简单'), { difficulty: '简单', difficultyEstimated: false });
  assert.deepEqual(oaDifficulty('oa-nope-1', '中等'), { difficulty: '中等', difficultyEstimated: false });
  assert.deepEqual(oaDifficulty('oa-nope-1'), {});
});

test('pools join OA companies and mapped LeetCode problems, never hidden companies', () => {
  const cat = mockCatalogue([
    { id: 'oa-amazon-1', difficulty: '中等' },
    { id: 'oa-amazon-mern-2', difficulty: '中等' },
    { id: 'oa-google-3', difficulty: '困难' },
    { id: 'lc-1', difficulty: '简单' },
    { id: 'lc-2', difficulty: '中等' },
    { id: 'course-x', difficulty: '简单' },
  ]);
  // oa-amazon-mern-2 is a MERN build task, not a coding question: never drawn.
  assert.equal(cat.oa.get('amazon-mern'), undefined);
  assert.deepEqual(cat.oa.get('amazon'), [
    { id: 'oa-amazon-1', difficulty: 'hard', loose: false, topics: ['stacks-heaps', 'bits-math'] },
  ]);
  assert.equal(cat.oa.get('google')?.[0].difficulty, 'easy', 'the estimate replaces the package label');
  assert.deepEqual(mockCatalogue([{ id: 'oa-acme-9', difficulty: '中等' }]).oa.get('acme'), [
    { id: 'oa-acme-9', difficulty: 'medium', loose: true },
  ]);
  assert.equal(cat.lc.get('lc-1')?.difficulty, 'easy');
  assert.deepEqual(cat.lc.get('lc-1')?.topics, ['hash-counting'], 'a Line 500 problem is on its stop');
  const map = new Map([
    ['amazon', ['lc-1', 'lc-404']],
    ['google', ['lc-2']],
  ]);
  const ids = (aliases: string[] | null, source: 'mixed' | 'oa' | 'lc', hidden = new Set<string>()) =>
    mockPool(cat, aliases, source, hidden, map).map((p) => p.id).sort();
  assert.deepEqual(ids(['amazon', 'amazon-mern'], 'mixed'), ['lc-1', 'oa-amazon-1']);
  assert.deepEqual(ids(['amazon'], 'oa'), ['oa-amazon-1']);
  assert.deepEqual(ids(['amazon'], 'lc'), ['lc-1'], 'unjudgeable lc-404 is dropped');
  const hidden = new Set(['google']);
  assert.deepEqual(ids(['google'], 'mixed', hidden), []);
  assert.ok(!ids(null, 'mixed', hidden).includes('oa-google-3'));
  assert.deepEqual(ids(null, 'lc'), ['lc-1', 'lc-2']);
  assert.ok(!shownMockPresets(new Set(['amazon'])).some((c) => c.slug === 'amazon'));
  const tiktok = shownMockPresets(new Set(['bytedance'])).find((c) => c.slug === 'tiktok')!;
  assert.deepEqual(tiktok.aliases, ['tiktok']);
  assert.ok(mockOaPaths().some((p) => p.path === '/mock-oa/tiktok'));
});

test("a report labels a question by its LeetCode or explicit package difficulty, else the OA estimate, else the slot", () => {
  assert.deepEqual(reportLevel('lc-1', '简单', null, 'hard'), { level: 'easy', estimated: false });
  // A hard slot that only a medium problem could fill (capital-one, ebay).
  assert.deepEqual(reportLevel('oa-capital-one-1', '中等', 'medium', 'hard'), { level: 'medium', estimated: true });
  assert.deepEqual(reportLevel('oa-x-1', '困难', 'medium', 'easy'), { level: 'hard', estimated: false });
  assert.deepEqual(reportLevel('oa-x-1', '中等', null, 'easy'), { level: 'easy', estimated: false });
  assert.deepEqual(reportLevel('lc-2', undefined, 'easy', undefined), { level: 'medium', estimated: false });
});

test('scoring: passed fraction per question, or a weighted 200–600 GCA estimate', () => {
  const ac = { passed: 10, total: 10, accepted: true };
  const half = { passed: 5, total: 10, accepted: false };
  const tests = scoreMock([ac, half, null], 'tests', ['medium', 'medium', 'hard']);
  assert.deepEqual([tests.value, tests.max, tests.per], [150, 300, [100, 50, 0]]);
  assert.equal(scoreMock([null, null], 'gca', ['easy', 'hard']).value, 200);
  assert.equal(scoreMock([ac, ac], 'gca', ['easy', 'hard']).value, 600);
  // Solving only the easy question (weight 1 of 1+2+2+3) earns 50 of 400.
  const gca = scoreMock([ac, null, null, null], 'gca', ['easy', 'medium', 'medium', 'hard']);
  assert.deepEqual([gca.value, gca.estimate], [250, true]);
});

test('attempt summaries keep the best result, the first AC and pending runs', () => {
  const s = summarizeAttempts(
    [
      { status: 'wrong_answer', passed: 3, total: 10, created_at: 1_000 },
      { status: 'cancelled', passed: 0, total: 10, created_at: 2_000 },
      { status: 'accepted', passed: 10, total: 10, created_at: 61_000 },
      { status: 'compile_error', passed: 0, total: 10, created_at: 70_000 },
      { status: 'running', passed: 1, total: 10, created_at: 80_000 },
    ],
    1_000,
  );
  assert.deepEqual(
    [s.attempts, s.best?.accepted, s.firstAcceptedMs, s.pending],
    [4, true, 60_000, true],
  );
  assert.equal(summarizeAttempts([], 0).best, null);
});

const session = (extra: Partial<MockSession> = {}): MockSession => ({
  id: 's1',
  company: 'amazon',
  name: 'Amazon',
  platform: 'HackerRank',
  preset: true,
  scoring: 'tests',
  source: 'mixed',
  slots: ['medium', 'medium'],
  ids: ['oa-amazon-1', 'lc-1'],
  minutes: 90,
  skew: 2_000,
  createdAt: 0,
  ...extra,
});

test('the exam clock warns at 10 and 5 minutes and finishes at zero', () => {
  const start = 1_000_000,
    s = session({ startedAt: start });
  assert.equal(mockClock(session(), start).phase, 'ready');
  assert.deepEqual(mockClock(s, start + 60_000).warning, 0);
  assert.deepEqual(mockClock(s, start + 80 * 60000).warning, 10);
  assert.deepEqual(mockClock(s, start + 85 * 60000 + 1).warning, 5);
  assert.equal(mockClock(s, start + 90 * 60000).phase, 'finished');
  assert.equal(formatClock(90 * 60000), '1:30:00');
  assert.equal(formatClock(61_001), '01:02');
  // Finishing after the deadline is a timeout at the deadline; early is manual.
  const late = finishMock(s, start + 200 * 60000);
  assert.deepEqual([late.finishedAt, late.reason], [start + 90 * 60000, 'timeout']);
  assert.equal(finishMock(s, start + 1_000).reason, 'manual');
  assert.deepEqual(reportWindow(late), { from: start + 2_000 - 5_000, to: start + 90 * 60000 + 2_000 + 5_000 });
});

test('stored state survives refresh, settles expired exams and caps the history', () => {
  const start = 1_000_000;
  const running = session({ startedAt: start });
  const raw = JSON.stringify({ active: running, history: [] });
  assert.deepEqual(parseMockState(raw).active, running);
  assert.deepEqual(parseMockState('{oops'), { active: null, history: [] });
  assert.deepEqual(parseMockState(JSON.stringify({ active: { id: 1 } })).active, null);
  const settled = settleMockState(parseMockState(raw), start + 91 * 60000);
  assert.equal(settled.active, null);
  assert.equal(settled.history[0].reason, 'timeout');
  let state = { active: null, history: [] } as ReturnType<typeof parseMockState>;
  for (let i = 0; i < 35; i++) state = archiveMock(state, session({ id: `s${i}` }));
  assert.equal(state.history.length, 30);
  assert.equal(state.history[0].id, 's34');
  const states = questionStates(running, [
    { problem_id: 'lc-1', status: 'wrong_answer', created_at: start + 10_000 },
    { problem_id: 'oa-amazon-1', status: 'accepted', created_at: start - 3_600_000 },
  ]);
  assert.deepEqual(states, ['todo', 'tried'], 'an AC from before the exam does not count');
});

test('a problem is in exam mode via ?mock=, or when the running mock holds it', () => {
  const start = 1_000_000,
    now = start + 60_000;
  const running = session({ startedAt: start });
  const done = finishMock(session({ id: 's0', startedAt: start - 7_200_000 }), start);
  const state = { active: running, history: [done] };
  assert.equal(mockExamFor(state, 's1', 'lc-1', now)?.running, true);
  // Opened from the library mid-exam: still the exam.
  assert.equal(mockExamFor(state, undefined, 'oa-amazon-1', now)?.session.id, 's1');
  assert.equal(mockExamFor(state, undefined, 'lc-9', now), null);
  // A handed-in mock reopened from its link is review, not an exam.
  assert.equal(mockExamFor(state, 's0', 'lc-1', now)?.running, false);
  // Without ?mock= an expired or unstarted mock does not apply.
  assert.equal(mockExamFor(state, undefined, 'lc-1', start + 91 * 60000), null);
  const drawn = { active: session(), history: [] };
  assert.equal(mockExamFor(drawn, 's1', 'lc-1', now), null);
  assert.equal(mockExamFor(drawn, undefined, 'lc-1', now), null);
});
