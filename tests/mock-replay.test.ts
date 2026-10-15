import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAUSE_MS,
  activeAt,
  applyFrame,
  cursor,
  delta,
  emptyTrack,
  focusSummary,
  lastCode,
  packTrack,
  timeSummary,
  unpackTrack,
  type Frame,
  type Track,
} from '../lib/mock-replay';

void test('delta frames replay every kind of edit, repeated characters included', () => {
  const versions = ['', 'a', 'aaa', 'aa', 'abca', 'def f():\n    pass\n', 'def f(x):\n    return x\n', '', 'xyz', 'xz', 'zzz'];
  let code = '';
  const frames: Frame[] = [];
  versions.forEach((next, i) => {
    const frame: Frame = [i * 1000, ...delta(code, next)];
    // Only what changed is stored.
    assert.equal(frame[3].length <= next.length, true);
    code = applyFrame(code, frame);
    assert.equal(code, next);
    frames.push(frame);
  });
  assert.deepEqual(delta('return a + b', 'return a - b'), [9, 2, '-']);
  const track: Track = { ...emptyTrack(), frames };
  assert.equal(lastCode(track), 'zzz');
  const at = cursor(frames);
  assert.equal(at(5500), versions[5]);
  assert.equal(at(6000), versions[6]);
  // Seeking back starts over.
  assert.equal(at(1000), 'a');
  assert.equal(at(-1), '');
  assert.equal(at(1e9), 'zzz');
});

void test('where the time went: stretches belong to the question worked on, long ones are pauses', () => {
  const min = 60_000;
  const q1: Track = { ...emptyTrack(), opens: [0], frames: [[30_000, 0, 0, 'x']], events: [{ t: 5 * min, mode: 'judge', status: 'accepted', passed: 3, total: 3, id: 'a' }] };
  const q2: Track = { ...emptyTrack(), opens: [6 * min], frames: [[7 * min, 0, 0, 'y']], events: [] };
  const { perQuestion, pauses } = timeSummary([q1, q2, null], 20 * min);
  assert.deepEqual(perQuestion, [6 * min, 14 * min, 0]);
  assert.equal(perQuestion.reduce((a, b) => a + b, 0), 20 * min);
  // 0:30 → 5:00 on Q1 and 7:00 → the end on Q2 had no activity.
  assert.deepEqual(pauses, [
    { from: 30_000, to: 5 * min, q: 0 },
    { from: 7 * min, to: 20 * min, q: 1 },
  ]);
  assert.equal(pauses.every((p) => p.to - p.from > PAUSE_MS), true);
  assert.equal(activeAt([q1, q2], 0), 0);
  assert.equal(activeAt([q1, q2], 6.5 * min), 1);
  assert.equal(activeAt([q1, q2], -1), -1);
  // Nothing recorded: nothing to attribute.
  assert.deepEqual(timeSummary([null, null], 10 * min), { perQuestion: [0, 0], pauses: [] });
});

void test('tracks pack small and come back whole; anything else reads as no track', async () => {
  const track: Track = {
    ...emptyTrack(),
    opens: [0],
    frames: Array.from({ length: 400 }, (_, i): Frame => [i * 2000, i, 0, 'x = 1\n']),
    events: [{ t: 100, mode: 'run', status: 'wrong_answer', passed: 1, total: 2, id: 'abc' }],
  };
  const packed = await packTrack(track);
  assert.equal(packed instanceof ArrayBuffer, true);
  assert.equal((packed as ArrayBuffer).byteLength < JSON.stringify(track).length / 4, true);
  assert.deepEqual(await unpackTrack(packed), track);
  assert.deepEqual(await unpackTrack(JSON.stringify(track)), track);
  assert.equal(await unpackTrack(JSON.stringify({ v: 2 })), null);
  assert.equal(await unpackTrack(42), null);
});

void test('a v1 track reads as a legacy v2 one with nothing away; the self-check merges stretches and keeps long pastes', async () => {
  const old = { v: 1, frames: [[0, 0, 0, 'x']], events: [], opens: [0] };
  assert.deepEqual(await unpackTrack(JSON.stringify(old)), { ...old, v: 2, legacy: true, away: [], pastes: [] });
  const min = 60_000;
  const q1: Track = { ...emptyTrack(), away: [[min, 3 * min], [-5000, 1000]], pastes: [[2 * min, 41], [3 * min, 40]] };
  // Two tabs on Q2 overlap Q1's stretch; one ran past the hand-in.
  const q2: Track = { ...emptyTrack(), away: [[2 * min, 4 * min], [9 * min, 12 * min]], pastes: [[11 * min, 500]] };
  const { away, awayMs, pastes } = focusSummary([q1, null, q2], 10 * min);
  assert.deepEqual(away, [[0, 1000], [min, 4 * min], [9 * min, 10 * min]]);
  assert.equal(awayMs, 1000 + 4 * min);
  // 40 characters is not over the line, and a paste after the end is not part of the exam.
  assert.deepEqual(pastes, [{ t: 2 * min, q: 0, chars: 41 }]);
});
