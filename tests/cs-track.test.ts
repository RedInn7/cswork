// /roadmap's CS fundamentals track (lib/cs-track.ts): subjects over the MCQ bank's topics, layered
// by prerequisites, and each subject's state from the learner's answers, read marks and review cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import mcqBank from '../lib/content/oa-mcq.json';
import { CS_NODES, csLayers, csMastery, csState, mcqTopic, topicReview } from '../lib/cs-track';
import { emptyRecall } from '../lib/recall';
import { beginnerCourse } from '../lib/server/beginner-courses';
import { sdChapter } from '../lib/server/system-design-course';

test('every subject is a bank topic, its prerequisites form layers, its links exist', () => {
  const topics = new Set(mcqBank.questions.map((q) => q.topic));
  const ids = CS_NODES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const node of CS_NODES) {
    assert.ok(topics.has(node.id), node.id);
    for (const before of node.after) assert.ok(ids.includes(before), `${node.id} after ${before}`);
    if (node.course) assert.ok(beginnerCourse(node.course), node.course);
    if (node.sd) assert.ok(sdChapter(node.sd), node.sd);
  }
  assert.deepEqual(
    csLayers().map((layer) => layer.map((n) => n.id)),
    [['arch', 'linux', 'git'], ['os'], ['concurrency', 'network'], ['dbms', 'security']],
  );
  assert.equal(CS_NODES.find((n) => n.id === 'os')?.course, 'os');
  assert.equal(CS_NODES.find((n) => n.id === 'network')?.course, 'network');
  assert.throws(() => csLayers([{ id: 'a', after: ['b'] }, { id: 'b', after: ['a'] }]), /cycle/);
});

test("these topics' question ids read back as their topic, so answers group by subject", () => {
  for (const q of mcqBank.questions.filter((q) => CS_NODES.some((n) => n.id === q.topic)))
    assert.equal(mcqTopic(q.id), q.topic, q.id);
  assert.equal(mcqTopic('mcq-os-'), null);
  assert.equal(mcqTopic('sd:os/deadlock'), null);
  const review = { 'mcq-os-1': [1, 9, 0], 'mcq-os-12': [0, 9, 2], 'mcq-network-1': [4, 9, 1] };
  assert.deepEqual(Object.keys(topicReview(review, 'os')), ['mcq-os-1', 'mcq-os-12']);
});

test('mastery counts answers, right ones, mastered ones, read chapters and review cards', () => {
  const chapters = ['sd:os/a', 'sd:os/b'];
  const review = { 'mcq-os-1': [0, 9, 1], 'mcq-os-2': [1, 9, 0], 'mcq-os-3': [4, 9, 2] };
  const recall = { v: 1 as const, items: { 'sd:os/b': [1, 9, 'b'] as [number, number, string], 'sd:x': [1, 9, 'x'] as [number, number, string] } };
  assert.deepEqual(csMastery(20, review, chapters, new Set(['sd:os/a', 'sd:framework']), recall), {
    total: 20,
    answered: 3,
    right: 2,
    mastered: 1,
    read: 1,
    cards: 1,
  });
});

test('done at 80% answered with 80% of them right and every chapter read; active with any record', () => {
  const m = (answered: number, right: number, read = 0, cards = 0) => ({ total: 10, answered, right, mastered: 0, read, cards });
  assert.equal(csState(m(8, 7), 0), 'done', 'exactly 80% answered, 87.5% right');
  assert.equal(csState(m(10, 8), 0), 'done', 'exactly 80% right');
  assert.equal(csState(m(7, 7), 0), 'active', 'under 80% answered');
  assert.equal(csState(m(10, 7), 0), 'active', 'under 80% right');
  assert.equal(csState(m(10, 10, 7), 8), 'active', 'a course subject waits for every chapter');
  assert.equal(csState(m(10, 10, 8), 8), 'done');
  assert.equal(csState(m(0, 0, 1), 8), 'active', 'a read chapter alone');
  assert.equal(csState(m(0, 0, 0, 1), 8), 'active', 'a review card alone');
  assert.equal(csState(m(0, 0), 8), 'todo');
  assert.equal(csState({ ...m(0, 0), total: 0 }, 0), 'todo', 'an empty topic is never done');
  assert.equal(csState(csMastery(5, {}, [], new Set(), emptyRecall()), 0), 'todo');
});
