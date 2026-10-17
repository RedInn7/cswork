import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCloze, checkOrder, normalize, scramble, shadowScore, similarity } from '../lib/english-drill';

void test('normalize: case, punctuation, hyphens and contractions', () => {
  assert.equal(normalize("  I'm   GOING, to   trade-off!  "), 'i am going to trade off');
  assert.equal(normalize("I am going to"), normalize("I'm going to"));
  assert.equal(normalize("can't"), normalize('cannot'));
  assert.equal(normalize("can't"), normalize('can not'));
  assert.equal(normalize("won't"), 'will not');
  assert.equal(normalize("don't / isn't"), 'do not is not');
  assert.equal(normalize("we're, they've, you'll, I'd"), 'we are they have you will i would');
  assert.equal(normalize("it’s what's here's"), 'it is what is here is');
  assert.equal(normalize("let's"), 'let us');
  // A possessive keeps its word.
  assert.equal(normalize("the array's length"), 'the arrays length');
  assert.equal(normalize('O(n log n)'), 'o n log n');
});

void test('cloze: any listed answer, synonyms and phrasing variants', () => {
  assert.equal(checkCloze('overview', ['overview', 'summary']), true);
  assert.equal(checkCloze(' Summary. ', ['overview', 'summary']), true);
  assert.equal(checkCloze('outline', ['overview', 'summary']), false);
  assert.equal(checkCloze('', ['overview']), false);
  assert.equal(checkCloze('  ', ['overview']), false);
  assert.equal(checkCloze('Prior to', ['Before', 'Prior to']), true);
  assert.equal(checkCloze('trade-off', ['trade-off', 'tradeoff']), true);
  assert.equal(checkCloze('trade off', ['trade-off', 'tradeoff']), true);
  assert.equal(checkCloze('tradeoff', ['trade-off', 'tradeoff']), true);
  assert.equal(checkCloze("I'm", ['I am']), true);
  assert.equal(checkCloze('cannot', ["can't"]), true);
});

void test('order: the parts read back as the sentence', () => {
  const parts = ['I think', 'it still works here,', "and here's why."];
  assert.equal(checkOrder(parts, parts), true);
  assert.equal(checkOrder([parts[1], parts[0], parts[2]], parts), false);
  assert.equal(checkOrder(parts.slice(0, 2), parts), false);
  // Two parts that read the same may swap.
  assert.equal(checkOrder(['a', 'b', 'a.'], ['a.', 'b', 'a']), true);
});

void test('scramble: a fixed permutation that never shows the answer', () => {
  const parts = ['One project', "I'm especially proud of", 'is a caching layer', 'that cut our latency in half.'];
  const order = scramble(parts);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  assert.deepEqual(scramble(parts), order);
  assert.equal(order.every((at, i) => parts[at] === parts[i]), false);
  for (const sample of [['a', 'b'], ['x', 'y', 'z'], ['a', 'b', 'a'], ['so', 'so', 'then']]) {
    const scrambled = scramble(sample).map((at) => sample[at]);
    assert.notDeepEqual(scrambled, sample);
  }
});

void test('similarity: shared words in order over both lengths', () => {
  assert.equal(similarity('Could you give me a small hint?', 'could you give me a small hint'), 1);
  assert.equal(similarity("I'm stuck", 'I am stuck'), 1);
  assert.equal(similarity('', 'hint'), 0);
  assert.equal(similarity('hint', ''), 0);
  assert.equal(similarity('banana', 'could you give me a hint'), 0);
  // Missing words: 4 of 6 said, nothing extra -> 2*4/(4+6).
  assert.equal(similarity('could you give hint', 'could you give me a hint'), 0.8);
  // Extra words cost as well: 2*3/(5+3).
  assert.equal(similarity('um so give me hint', 'give me hint'), 0.75);
  // Order matters: the longest in-order run of "a b c" in "c b a" is one word.
  assert.equal(similarity('c b a', 'a b c'), 1 / 3);
});

void test('a shadowing attempt: similarity, pace when timed long enough, fillers', () => {
  const score = shadowScore('um I think we can do better with a hash map', 'I think we can do better with a hash map.', 4_000);
  assert.equal(score.fillers, 1);
  // 11 words over 4 seconds.
  assert.equal(score.perMinute, 165);
  assert.equal(score.similarity, 20 / 21);
  assert.equal(shadowScore('hash map', 'a hash map', 900).perMinute, null);
  assert.equal(shadowScore('hash map', 'a hash map', 0).perMinute, null);
});
