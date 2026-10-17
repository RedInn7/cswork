import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MCQ_MASTERED } from '../lib/mock-oa';
import { NOTE_MAX_BYTES } from '../lib/practice-review';
import {
  RECALL_MAX,
  dropMastered,
  dueRecall,
  emptyRecall,
  fitRecall,
  keyPoints,
  mergeRecall,
  parseRecall,
  rateRecall,
  recallBoxes,
  recallHref,
  recallNext,
  type RecallQueue,
} from '../lib/recall';

const T = 'content:interview_question/lru';

void test('key points are the top-level list items of the first part that has any, without Markdown', () => {
  const rubric = `#### What a Strong Answer Covers
**Part 1**

- **Correctness**: handles the _empty_ cache
* Uses a [hash map](https://example.com) plus a list
1. O(1) \`get\` and \`__init__\` stay as written
- [x] Mentions eviction order
  - nested detail is skipped
\`\`\`
- inside code is skipped
\`\`\`
Paragraph text is skipped.`;
  assert.deepEqual(keyPoints(rubric), [
    'Correctness: handles the empty cache',
    'Uses a hash map plus a list',
    'O(1) get and __init__ stay as written',
    'Mentions eviction order',
  ]);
  // A paragraph-only rubric falls back to the reference answer; at most 8 points.
  const solution = Array.from({ length: 10 }, (_, i) => `- point ${i + 1}`).join('\n');
  assert.deepEqual(keyPoints('Talk about trade-offs.', solution), solution.split('\n').slice(0, 8).map((l) => l.slice(2)));
  assert.deepEqual(keyPoints('', undefined, 'Only prose.'), []);
});

void test('know moves a new or due card up a box, partial restarts its wait, no starts over', () => {
  let q = rateRecall(emptyRecall(), T, 'LRU cache', 'know', 100);
  assert.deepEqual(q.items[T], [1, 100, 'LRU cache']);
  // Not due yet (box 1 waits 3 days): knowing it again changes nothing.
  q = rateRecall(q, T, 'LRU cache', 'know', 102);
  assert.deepEqual(q.items[T], [1, 100, 'LRU cache']);
  assert.equal(recallNext(q.items[T]), 103);
  q = rateRecall(q, T, 'LRU cache', 'know', 103);
  assert.deepEqual(q.items[T], [2, 103, 'LRU cache']);
  q = rateRecall(q, T, '', 'partial', 104);
  assert.deepEqual(q.items[T], [2, 104, 'LRU cache'], 'partial keeps the box and the old title');
  q = rateRecall(q, T, 'LRU', 'no', 105);
  assert.deepEqual(q.items[T], [0, 105, 'LRU']);
  assert.deepEqual(rateRecall(emptyRecall(), T, 'x', 'partial', 7).items[T], [0, 7, 'x']);
  assert.equal(rateRecall(emptyRecall(), T, 'y'.repeat(200), 'no', 7).items[T][2].length, 80);
  // Up to mastered, which never comes back.
  for (const day of [106, 109, 116, 137]) q = rateRecall(q, T, 'LRU', 'know', day);
  assert.equal(q.items[T][0], MCQ_MASTERED);
  assert.equal(recallNext(q.items[T]), null);
  assert.deepEqual(dueRecall(q, 10_000), []);
});

void test('due cards, box counts, links and clearing mastered cards', () => {
  const q: RecallQueue = {
    v: 1,
    items: {
      'sd:url-shortener': [0, 9, 'URL shortener'],
      [T]: [1, 5, 'LRU'],
      'content:coding_question/two-sum': [2, 9, 'Two Sum'],
      'content:interview_question/done': [4, 1, 'Done'],
    },
  };
  // Box 1 from day 5 is due on 8 (overdue), box 0 from day 9 on 10; box 2 waits until 16.
  assert.deepEqual(dueRecall(q, 10).map(([t]) => t), [T, 'sd:url-shortener']);
  assert.deepEqual(recallBoxes(q), [1, 1, 1, 0, 1]);
  assert.deepEqual(Object.keys(dropMastered(q).items).sort(), ['content:coding_question/two-sum', T, 'sd:url-shortener'].sort());
  assert.equal(recallHref(T), '/?view=content&type=interview_question&slug=lru');
  assert.equal(recallHref('content:coding_question/a.b'), '/?view=content&type=coding_question&slug=a.b');
  assert.equal(recallHref('sd:url-shortener'), '/system-design/url-shortener');
  assert.equal(recallHref('problem:lc-1'), null);
});

void test('over the cap, mastered cards go first, then the longest unseen', () => {
  const items: RecallQueue['items'] = {};
  for (let i = 0; i < RECALL_MAX; i++) items[`sd:c${i}`] = [i < 2 ? MCQ_MASTERED : 1, 1000 + i, `card ${i}`.padEnd(60, '.')];
  let q = rateRecall({ v: 1, items }, T, 'new', 'no', 2000);
  assert.equal(Object.keys(q.items).length, RECALL_MAX);
  assert.ok(!('sd:c0' in q.items) && 'sd:c1' in q.items && T in q.items, 'the older mastered card went');
  q = rateRecall(q, 'sd:x', 'x', 'no', 2000);
  q = rateRecall(q, 'sd:y', 'y', 'no', 2000);
  assert.ok(!('sd:c1' in q.items) && !('sd:c2' in q.items) && 'sd:c3' in q.items, 'then the oldest learning card');
  // The note cap drops in the same order and never leaves a half card (300 cards are ~25 KB).
  const body = fitRecall(q, NOTE_MAX_BYTES);
  assert.ok(new TextEncoder().encode(body).length <= NOTE_MAX_BYTES);
  const kept = parseRecall(body);
  assert.ok(T in kept.items && 'sd:y' in kept.items && !('sd:c3' in kept.items));
  assert.equal(fitRecall(emptyRecall(), NOTE_MAX_BYTES), '');
  assert.equal(fitRecall(q, 10), '');
});

void test('a bad or foreign body reads as empty and malformed cards are dropped; the account wins a merge', () => {
  for (const raw of [null, '', 'not json', '[]', '{"items":{}}', '{"v":2,"items":{}}', '{"v":1,"items":[]}', 'null'])
    assert.deepEqual(parseRecall(raw), emptyRecall(), String(raw));
  const parsed = parseRecall(
    JSON.stringify({
      v: 1,
      items: {
        [T]: [1, 5, 'LRU'],
        'sd:ok': [4, 1, ''],
        'sd:box': [5, 1, 'x'],
        'sd:neg': [-1, 1, 'x'],
        'sd:short': [1, 1],
        'sd:day': [1, 1.5, 'x'],
        'sd:title': [1, 1, 3],
        'problem:lc-1': [1, 1, 'x'],
        'content:Bad/x': [1, 1, 'x'],
        'sd:<script>': [1, 1, 'x'],
      },
    }),
  );
  assert.deepEqual(Object.keys(parsed.items).sort(), [T, 'sd:ok'].sort());
  const merged = mergeRecall(
    { v: 1, items: { [T]: [0, 9, 'local'], 'sd:a': [1, 9, 'a'] } },
    { v: 1, items: { [T]: [2, 3, 'saved'] } },
  );
  assert.deepEqual(merged.items, { [T]: [2, 3, 'saved'], 'sd:a': [1, 9, 'a'] });
});
