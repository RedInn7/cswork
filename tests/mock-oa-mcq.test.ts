import assert from 'node:assert/strict';
import { test } from 'node:test';
import bankFile from '../lib/content/oa-mcq.json';
import {
  MCQ_SECTIONS,
  drawMcq,
  finishMcq,
  mcqRight,
  mockClock,
  parseMockState,
  scoreMcq,
  settleMockState,
  type McqQuestion,
  type MockSession,
} from '../lib/mock-oa';
import { shownMockPresets } from '../lib/server/mock-oa-presets';

const bank = bankFile.questions as McqQuestion[];
const TOPICS = ['os', 'dbms', 'network', 'concurrency', 'oop', 'python', 'java', 'js', 'probability', 'logic'];

test('the bank is well formed: unique ids, known sections and topics, answers in range, both languages', () => {
  assert.equal(new Set(bank.map((q) => q.id)).size, bank.length);
  for (const q of bank) {
    assert(MCQ_SECTIONS.includes(q.section), q.id);
    assert(TOPICS.includes(q.topic), q.id);
    assert.equal(q.zh.choices.length, q.en.choices.length, q.id);
    assert(q.answer.length >= 1 && q.answer.every((a) => a >= 0 && a < q.en.choices.length), q.id);
    assert.equal(new Set(q.answer).size, q.answer.length, q.id);
    assert(q.zh.q && q.en.q && q.zh.explain && q.en.explain, q.id);
    assert.equal(!!q.code, q.section === 'code-output', q.id);
  }
  assert(bank.some((q) => q.answer.length > 1), 'some questions are select-all');
});

test('every preset MCQ section can fill its draw from the bank', () => {
  const withMcq = shownMockPresets().filter((p) => p.mcq);
  assert(withMcq.length >= 9);
  for (const p of withMcq) {
    const ids = drawMcq(bank, p.mcq!, 1);
    assert.equal(ids.length, p.mcq!.count, p.slug);
  }
  const coinbase = withMcq.find((p) => p.slug === 'coinbase')!;
  const quant = new Set(bank.filter((q) => q.section === 'quant').map((q) => q.id));
  assert(drawMcq(bank, coinbase.mcq!, 7).every((id) => quant.has(id)), 'coinbase draws quant only');
});

test('a draw has no repeats, follows sections and topics, is seeded, and prefers unseen questions', () => {
  const config = { count: 10, sections: ['cs' as const], topics: ['concurrency'] };
  const ids = drawMcq(bank, config, 42);
  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  const byId = new Map(bank.map((q) => [q.id, q]));
  assert(ids.every((id) => byId.get(id)!.topic === 'concurrency'));
  assert.deepEqual(drawMcq(bank, config, 42), ids);
  assert.notDeepEqual(drawMcq(bank, config, 43), ids);
  const fresh = drawMcq(bank, config, 42, new Set(ids));
  const pool = bank.filter((q) => q.topic === 'concurrency').length;
  // Seen ones only fill in once the unseen ones run out.
  assert.equal(fresh.filter((id) => ids.includes(id)).length, Math.max(0, 10 - (pool - 10)));
  assert.equal(drawMcq(bank, { count: 500, sections: ['quant'] }, 1).length, bank.filter((q) => q.section === 'quant').length);
});

test('a select-all question scores only the exact answer set; the section is a 100-point block', () => {
  assert(mcqRight([0, 2], [2, 0]));
  assert(!mcqRight([0, 2], [0]));
  assert(!mcqRight([0, 2], [0, 1, 2]));
  assert(!mcqRight([0, 2], [0, 0]));
  assert(!mcqRight([1]));
  const fake: McqQuestion[] = [
    { id: 'a', section: 'cs', topic: 'os', zh: { q: '', choices: ['', ''], explain: '' }, en: { q: '', choices: ['', ''], explain: '' }, answer: [1] },
    { id: 'b', section: 'cs', topic: 'os', zh: { q: '', choices: ['', '', ''], explain: '' }, en: { q: '', choices: ['', '', ''], explain: '' }, answer: [0, 2] },
  ];
  assert.deepEqual(scoreMcq(fake, { ids: ['a', 'b', 'gone'], picks: [[1], [2, 0]] }), {
    per: [true, true, false],
    correct: 2,
    total: 3,
    points: 67,
    max: 100,
  });
  assert.equal(scoreMcq(fake, { ids: [], picks: [] }).points, 0);
});

const base: MockSession = {
  id: 's1',
  company: 'rubrik',
  name: 'Rubrik',
  platform: 'HackerRank',
  preset: true,
  scoring: 'tests',
  source: 'mixed',
  slots: ['easy', 'medium', 'hard'],
  ids: ['lc-1', 'lc-2', 'lc-3'],
  minutes: 90,
  skew: 0,
  createdAt: 1000,
};

test('old sessions without mcq still parse; a malformed mcq drops the session', () => {
  const state = parseMockState(JSON.stringify({ active: base, history: [{ ...base, id: 'old', startedAt: 2000, finishedAt: 3000 }] }));
  assert.equal(state.active?.id, 's1');
  assert.equal(state.history.length, 1);
  const withMcq = { ...base, mcq: { ids: ['mcq-os-1'], picks: [[0]], minutes: 15, startedAt: 2000 } };
  assert.deepEqual(parseMockState(JSON.stringify({ active: withMcq, history: [] })).active, withMcq);
  assert.equal(parseMockState(JSON.stringify({ active: { ...base, mcq: { ids: 'x' } }, history: [] })).active, null);
});

test('the MCQ section ends at hand-in or its deadline, and the coding clock starts there', () => {
  const s = { ...base, mcq: { ids: ['a'], picks: [[]], minutes: 15, startedAt: 10_000 } };
  assert.equal(mockClock(s, 20_000).phase, 'ready', 'coding has not started');
  assert.equal(mockClock(s.mcq, 20_000).phase, 'running');
  const early = finishMcq(s, 20_000);
  assert.equal(early.mcq!.finishedAt, 20_000);
  assert.equal(early.startedAt, 20_000);
  assert.equal(finishMcq(early, 99_999), early, 'only once');
  assert.equal(finishMcq(base, 5), base, 'no MCQ section: unchanged');

  // Ran out while away: coding started at the MCQ deadline and is still running.
  const deadline = 10_000 + 15 * 60_000;
  const later = settleMockState({ active: s, history: [] }, deadline + 60_000);
  assert.equal(later.active?.startedAt, deadline);
  assert.equal(later.active?.mcq?.finishedAt, deadline);
  assert.equal(mockClock(later.active!, deadline + 60_000).phase, 'running');
  // Both clocks ran out: the whole mock is handed in.
  const gone = settleMockState({ active: s, history: [] }, deadline + 91 * 60_000);
  assert.equal(gone.active, null);
  assert.equal(gone.history[0].reason, 'timeout');
  assert.equal(gone.history[0].finishedAt, deadline + 90 * 60_000);
  // Still answering: nothing changes.
  const now = settleMockState({ active: s, history: [] }, 20_000);
  assert.equal(now.active, s);
});
