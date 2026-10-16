import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countSpeech, delivery, type Segment } from '../lib/mock-delivery';

void test('words, characters and fillers in one utterance', () => {
  assert.deepEqual(countSpeech("Um, so basically I'd like to use a hash map, you know, like a cache", false), [15, 4]);
  // A verb or comparison "like" is not a filler; "umbrella" is not "um".
  assert.deepEqual(countSpeech('It looks like an umbrella; I would like that', false), [9, 0]);
  assert.deepEqual(countSpeech('UHH okay uh', false), [3, 2]);
  // Chinese counts characters, plus Latin words mixed in.
  assert.deepEqual(countSpeech('嗯，那个，我们先用 hash map 存一下，然后就是遍历', true), [18, 4]);
  assert.deepEqual(countSpeech('', true), [0, 0]);
});

void test('pace over timed speech, fillers, time spoken and the longest pause', () => {
  assert.equal(delivery([]), null);
  const segments: Segment[] = [
    [20_000, 50, 2, 0],
    [10_000, 25, 1, 4_000],
    // Untimed (no interim result before the final one): counted for fillers, not for pace.
    [0, 30, 1, 12_400],
  ];
  assert.deepEqual(delivery(segments), { perMinute: 150, fillers: 4, spokenSec: 30, longestPauseSec: 12 });
  // Too little timed speech for a pace.
  assert.deepEqual(delivery([[4_000, 12, 0, 0]]), { perMinute: null, fillers: 0, spokenSec: 4, longestPauseSec: 0 });
});
