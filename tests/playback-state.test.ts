import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  initialAsset,
  playbackTarget,
  progressReceiver,
  seekPosition,
} from '../lib/playback-state';
void test('question links seek only the matching lesson and preserve a zero-second target', () => {
  assert.deepEqual(playbackTarget('?lesson=a&t=0&video=part-2', 'a'), {
    position: 0,
    assetId: 'part-2',
  });
  assert.equal(playbackTarget('?lesson=b&t=150', 'a'), null);
  for (const value of ['-1', 'NaN', 'Infinity', '', '86401'])
    assert.equal(playbackTarget(`?t=${value}`, 'a'), null);
});
void test('a question points to its video before the readers saved video; missing assets fall back safely', () => {
  assert.equal(
    initialAsset(['part-1', 'part-2'], 'part-1', {
      position: 100,
      assetId: 'part-2',
    }),
    'part-2',
  );
  assert.equal(
    initialAsset(['part-1', 'part-2'], 'part-2', {
      position: 100,
      assetId: 'removed',
    }),
    'part-2',
  );
  assert.equal(initialAsset([], null, { position: 100, assetId: null }), null);
});
void test('seek clamps real duration without converting a deliberate zero seek into previous progress', () => {
  assert.equal(seekPosition(0, 80), 0);
  assert.equal(seekPosition(120, 80), 80);
  assert.equal(seekPosition(120, 0), 120);
  assert.equal(seekPosition(NaN, 100), 0);
});
void test('old-player cleanup cannot report progress to a new lesson callback', () => {
  const old = () => 'a';
  const current = () => 'b';
  assert.equal(
    progressReceiver('a', old, { lessonId: 'b', callback: current })(),
    'a',
  );
  assert.equal(
    progressReceiver('a', old, { lessonId: 'a', callback: current })(),
    'b',
  );
});
