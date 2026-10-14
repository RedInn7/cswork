import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  archiveMock,
  drawMock,
  finishMock,
  formatClock,
  mockClock,
  parseMockState,
  questionStates,
  reportWindow,
  scoreMock,
  seededRandom,
  settleMockState,
  summarizeAttempts,
  type MockSession,
  type PoolItem,
} from '../lib/mock-oa';
import { mockCatalogue, mockPool } from '../lib/server/mock-oa';
import { mockOaPaths, shownMockPresets } from '../lib/server/mock-oa-presets';

const lc = (n: number, difficulty: PoolItem['difficulty']): PoolItem => ({
  id: `lc-${n}`,
  difficulty,
  oa: false,
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

test('OA problems fit within one difficulty step; a pool smaller than the slots draws nothing', () => {
  const oa: PoolItem[] = [
    { id: 'oa-acme-1', difficulty: 'medium', oa: true },
    { id: 'oa-acme-2', difficulty: 'easy', oa: true },
  ];
  // The default 中等 OA label fits a hard slot; an OA easy does not.
  for (let seed = 1; seed < 10; seed++)
    assert.deepEqual(drawMock({ pool: oa, slots: ['hard'], random: seededRandom(seed) }), ['oa-acme-1']);
  // An exact LeetCode match beats an OA problem one step away.
  assert.deepEqual(drawMock({ pool: [...oa, lc(9, 'hard')], slots: ['hard'] }), ['lc-9']);
  assert.equal(drawMock({ pool: oa, slots: ['easy', 'medium', 'hard'] }), null);
  assert.equal(drawMock({ pool: [lc(1, 'easy'), lc(1, 'easy')], slots: ['easy', 'easy'] }), null);
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
  assert.deepEqual(cat.oa.get('amazon-mern')?.map((p) => p.id), ['oa-amazon-mern-2']);
  assert.equal(cat.lc.get('lc-1')?.difficulty, 'easy');
  const map = new Map([
    ['amazon', ['lc-1', 'lc-404']],
    ['google', ['lc-2']],
  ]);
  const ids = (aliases: string[] | null, source: 'mixed' | 'oa' | 'lc', hidden = new Set<string>()) =>
    mockPool(cat, aliases, source, hidden, map).map((p) => p.id).sort();
  assert.deepEqual(ids(['amazon', 'amazon-mern'], 'mixed'), ['lc-1', 'oa-amazon-1', 'oa-amazon-mern-2']);
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
