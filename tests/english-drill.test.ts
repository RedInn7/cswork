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

void test('numbers: words and digits read the same, the way speech recognition writes them', () => {
  assert.equal(similarity('dropped by 40%', 'dropped by forty percent'), 1);
  assert.equal(similarity('input 2, 7, 11, 15', 'input two, seven, eleven, fifteen'), 1);
  assert.equal(similarity('left is 0 and right is 2', 'left is zero and right is two'), 1);
  assert.equal(similarity('about 2 million requests', 'about two million requests'), 1);
  assert.equal(similarity('under 200 milliseconds', 'under two hundred milliseconds'), 1);
  assert.equal(similarity('up to 100,000 elements', 'Up to a hundred thousand elements.'), 1);
  assert.equal(similarity('the base is $125,000', 'The base is a hundred and twenty-five thousand'), 1);
  assert.equal(similarity('closer to 140', 'closer to one-forty'), 1);
  assert.equal(normalize('twenty-five, 2,500 and twenty-five hundred'), '25 2500 and 2500');
  assert.equal(normalize('which one, a day, a thousand'), 'which 1 a day 1000');
  // Not a number: "and" outside one, and a word that happens to follow "a".
  assert.equal(normalize('zero and one'), '0 and 1');
  assert.equal(normalize('a constructor'), 'a constructor');
  assert.equal(checkCloze('1', ['one']), true);
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
  // Another order that reads as well, listed in `also`.
  const also = ["It still works here, I think, and here's why."];
  assert.equal(checkOrder([parts[1], parts[0], parts[2]], parts, also), true);
  assert.equal(checkOrder(parts, parts, also), true);
  assert.equal(checkOrder([parts[2], parts[1], parts[0]], parts, also), false);
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
  // Nor an order listed in `also`: these parts hash to "Let me see how that changes my approach. That makes sense."
  const hint = ['That makes sense.', 'Let me see', 'how that changes', 'my approach.'];
  const alsoHint = ['Let me see how that changes my approach. That makes sense.'];
  assert.equal(checkOrder(scramble(hint).map((at) => hint[at]), hint, alsoHint), true);
  assert.equal(checkOrder(scramble(hint, alsoHint).map((at) => hint[at]), hint, alsoHint), false);
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
  // A filler the phrase itself has is not counted; one added on top is.
  const target = 'And if the same number appears twice, like three and three, it still works.';
  assert.equal(shadowScore(target, target, 4_000).fillers, 0);
  assert.equal(shadowScore(`um ${target}`, target, 4_000).fillers, 1);
});
