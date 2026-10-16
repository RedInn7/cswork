import assert from 'node:assert/strict';
import { test } from 'node:test';
import bankFile from '../lib/content/oa-mcq.json';
import {
  MCQ_MASTERED,
  MCQ_SECTIONS,
  drawMcq,
  finishMcq,
  fitMcqReview,
  mcqDue,
  mcqRight,
  mockClock,
  parseMcqReview,
  parseMockState,
  reviewMcq,
  scoreMcq,
  settleMockState,
  type McqQuestion,
  type MockSession,
} from '../lib/mock-oa';
import { shownMockPresets } from '../lib/server/mock-oa-presets';
import { SITEMAP_STATIC_ENTRIES } from '../lib/seo';
import { ROUTE_SLUGS } from '../lib/route-stops';

const bank = bankFile.questions as McqQuestion[];
const OLD_TOPICS = ['os', 'dbms', 'network', 'concurrency', 'oop', 'dsa', 'python', 'java', 'js', 'complexity', 'probability', 'logic'];
// mcq-v2 subjects and their sizes.
const NEW_TOPICS: Record<string, number> = { cpp: 30, linux: 20, git: 15, sql: 20, arch: 20, security: 20, patterns: 15, web: 30 };
const TOPICS = [...OLD_TOPICS, ...Object.keys(NEW_TOPICS)];

void test('the bank is well formed: unique ids, known sections and topics, answers in range, both languages', () => {
  assert.equal(new Set(bank.map((q) => q.id)).size, bank.length);
  for (const q of bank) {
    assert(MCQ_SECTIONS.includes(q.section), q.id);
    assert(TOPICS.includes(q.topic), q.id);
    assert.equal(q.zh.choices.length, q.en.choices.length, q.id);
    assert(q.answer.length >= 1 && q.answer.every((a) => a >= 0 && a < q.en.choices.length), q.id);
    assert.equal(new Set(q.answer).size, q.answer.length, q.id);
    assert(q.zh.q && q.en.q && q.zh.explain && q.en.explain, q.id);
    assert.equal(!!q.code, q.section === 'code-output', q.id);
    // A stop names a Line 500 stop; its topic page quizzes on the question.
    assert(q.stop === undefined || ROUTE_SLUGS.includes(q.stop), q.id);
  }
  // Every stop page gets a quiz: concept questions in CS, complexity ones as code.
  for (const slug of ROUTE_SLUGS) assert(bank.filter((q) => q.stop === slug).length >= 3, slug);
  assert(bank.filter((q) => q.topic === 'dsa').every((q) => q.section === 'cs' && q.stop));
  assert(bank.filter((q) => q.topic === 'complexity').every((q) => q.section === 'code-output'));
  assert(bank.some((q) => q.answer.length > 1), 'some questions are select-all');
  assert(SITEMAP_STATIC_ENTRIES.some((e) => e.path === '/oa/mcq'), 'the practice page is in the sitemap');
});

void test('answer positions do not cycle, so one answer never gives away the next', () => {
  for (const topic of TOPICS) {
    const single = bank.filter((q) => q.topic === topic && q.answer.length === 1).map((q) => q.answer[0]);
    let run = 1;
    for (let i = 1; i < single.length; i++) {
      run = single[i] === (single[i - 1] + 1) % 4 ? run + 1 : 1;
      assert(run < 6, `${topic}: answers step A→B→C→D around question ${i}`);
    }
  }
});

void test('every preset MCQ section can fill its draw from the bank', () => {
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

void test('a draw has no repeats, follows sections and topics, is seeded, and prefers unseen questions', () => {
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

void test('topics take turns, so the big DSA and complexity pools never crowd out the rest', () => {
  const byId = new Map(bank.map((q) => [q.id, q]));
  for (const seed of [1, 2, 3]) {
    const perTopic = (ids: string[]) =>
      Object.values(Object.groupBy(ids, (id) => byId.get(id)!.topic)).map((list) => list!.length);
    const topicsIn = (section: string) => new Set(bank.filter((q) => q.section === section).map((q) => q.topic)).size;
    // Twelve CS topics in 10 questions: ten topics, one each.
    const cs = drawMcq(bank, { count: 10, sections: ['cs'] }, seed);
    assert.equal(cs.length, 10);
    assert.equal(perTopic(cs).length, Math.min(10, topicsIn('cs')));
    assert(perTopic(cs).every((n) => n === 1), `cs ${seed}`);
    // Six code topics in 8 questions: every topic, none more than twice.
    const code = perTopic(drawMcq(bank, { count: 8, sections: ['code-output'] }, seed));
    assert.equal(code.length, topicsIn('code-output'));
    assert(Math.max(...code) - Math.min(...code) <= 1, `code ${seed}`);
  }
});

void test('spaced review: a miss comes back tomorrow, a right answer climbs 1/3/7/21 days to mastered', () => {
  const answer = [2];
  let entry = reviewMcq(undefined, answer, [1], 100);
  assert.deepEqual(entry, [0, 100, 1], 'missed: box 0, picks kept');
  assert(!mcqDue(entry, 100) && mcqDue(entry, 101));
  entry = reviewMcq(entry, answer, [2], 101);
  assert.deepEqual(entry, [1, 101, 2]);
  // Right again before it is due: no cramming, the box and its day stay.
  assert.deepEqual(reviewMcq(entry, answer, [2], 102), [1, 101, 2]);
  assert(!mcqDue(entry, 103) && mcqDue(entry, 104));
  entry = reviewMcq(entry, answer, [2], 104);
  entry = reviewMcq(entry, answer, [2], 111);
  assert.deepEqual(entry, [3, 111, 2]);
  assert(!mcqDue(entry, 131) && mcqDue(entry, 132));
  entry = reviewMcq(entry, answer, [2], 132);
  assert.equal(entry[0], MCQ_MASTERED);
  assert(!mcqDue(entry, 10_000), 'mastered never comes back');
  // A miss at any box starts over.
  assert.deepEqual(reviewMcq(entry, answer, [0], 140), [0, 140, 0]);
  // First answer right: box 1.
  assert.deepEqual(reviewMcq(undefined, [0, 2], [0, 2], 5), [1, 5, 0, 2]);
});

void test('the stored review keeps only well-formed entries and fits the note cap', () => {
  assert.deepEqual(parseMcqReview('{"a":[1,2,0],"b":[9,1,0],"c":[1,2],"d":"x","e":[0,1.5,1]}'), { a: [1, 2, 0] });
  assert.deepEqual(parseMcqReview('[1]'), {});
  assert.deepEqual(parseMcqReview('nope'), {});
  assert.deepEqual(parseMcqReview(null), {});
  // Every question answered still fits a 20 KB note in the compact form.
  const all = Object.fromEntries(bank.map((q) => [q.id, [4, 20_000, ...q.answer]]));
  assert.equal(fitMcqReview(all, 20 * 1024), JSON.stringify(all));
  // Over the cap, the longest-unseen entries go first.
  const review = { old: [1, 1, 0], mid: [1, 2, 0], recent: [1, 3, 0] };
  const fitted = JSON.parse(fitMcqReview(review, JSON.stringify(review).length - 1));
  assert.deepEqual(Object.keys(fitted).sort(), ['mid', 'recent']);
});

void test('a select-all question scores only the exact answer set; the section is a 100-point block', () => {
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

void test('old sessions without mcq still parse; a malformed mcq drops the session', () => {
  const state = parseMockState(JSON.stringify({ active: base, history: [{ ...base, id: 'old', startedAt: 2000, finishedAt: 3000 }] }));
  assert.equal(state.active?.id, 's1');
  assert.equal(state.history.length, 1);
  const withMcq = { ...base, mcq: { ids: ['mcq-os-1'], picks: [[0]], minutes: 15, startedAt: 2000 } };
  assert.deepEqual(parseMockState(JSON.stringify({ active: withMcq, history: [] })).active, withMcq);
  assert.equal(parseMockState(JSON.stringify({ active: { ...base, mcq: { ids: 'x' } }, history: [] })).active, null);
});

void test('the MCQ section ends at hand-in or its deadline, and the coding clock starts there', () => {
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

void test('mcq-v2 subjects: sized as planned, a reason per choice, C++ undefined behaviour marked', () => {
  for (const [topic, n] of Object.entries(NEW_TOPICS)) assert.equal(bank.filter((q) => q.topic === topic).length, n, topic);
  assert.equal(bank.filter((q) => q.topic === 'js').length, 40);
  for (const q of bank) {
    assert.equal(!!q.zh.whys, !!q.en.whys, q.id);
    for (const text of [q.zh, q.en]) if (text.whys) assert.equal(text.whys.length, text.choices.length, q.id);
    if (!q.ub) continue;
    assert.equal(q.topic, 'cpp', q.id);
    assert.deepEqual(q.answer.map((a) => [q.zh.choices[a], q.en.choices[a]]), [['未定义行为', 'Undefined behavior']], q.id);
  }
  const added = bank.filter((q) => q.topic in NEW_TOPICS || (q.topic === 'js' && +q.id.slice('mcq-js-'.length) > 15));
  assert.equal(added.length, 195);
  assert(added.every((q) => q.en.whys), 'new questions explain every choice');
  assert(bank.filter((q) => q.ub).length >= 3);
  // Code questions say how they run: the C++ standard, SQLite's dialect (NULL order and integer division differ).
  assert(bank.filter((q) => q.topic === 'cpp').every((q) => q.lang === 'cpp' && q.en.q.includes('c++17') && q.zh.q.includes('c++17')));
  assert(bank.filter((q) => q.topic === 'sql').every((q) => q.section === 'code-output' && q.lang === 'sql' && q.en.q.includes('SQLite')));
});

void test('presets keep drawing from the subjects they had before mcq-v2', () => {
  for (const p of shownMockPresets().filter((p) => p.mcq))
    for (const seed of [1, 2, 3])
      for (const id of drawMcq(bank, p.mcq!, seed)) assert(OLD_TOPICS.includes(byIdAll.get(id)!.topic), `${p.slug} drew ${id}`);
});
const byIdAll = new Map(bank.map((q) => [q.id, q]));
