/**
 * How a dictated answer in the AI interview was delivered: pace, filler words, time spoken
 * against the plan, and the longest pause. Worked out on the page from the browser's speech
 * recognition results (components/use-speech.ts); neither the audio nor these
 * numbers are uploaded. Pure, so tests cover it.
 */

/**
 * One recognized utterance: ms spoken (0 when the browser gave no timing), words (characters in
 * Chinese), fillers, and ms of silence before it in the same dictation (0 for the first).
 */
export type Segment = [ms: number, units: number, fillers: number, gap: number];

const CJK = /[㐀-鿿豈-﫿]/g;
// ponytail: "like" as a verb or comparison ("I like", "looks like") and "you know" in a question
// ("do you know") are left out by a short list of the usual lead-ins, not by parsing; fine for a
// practice count.
const FILLERS_EN =
  /\b(?:u+m+|u+h+|(?<!\b(?:i|we|you|they|people|users|would|i'd|we'd|you'd|they'd|don't|doesn't|didn't|really|also|look|looks|looked|feel|feels|felt|seem|seems|sound|sounds|something|just|more|much)\s)like|(?<!\b(?:do|did|if|as|would|don't)\s)you know|basically)\b/gi;
const FILLERS_ZH = /嗯|那个|就是|然后/g;
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

/** Words and fillers in one utterance. Chinese counts characters, plus any Latin words mixed in. */
export function countSpeech(text: string, zh: boolean): [units: number, fillers: number] {
  const latin = count(text.replace(CJK, ' '), /[a-z0-9]+(?:'[a-z]+)?/gi);
  return [(zh ? count(text, CJK) : 0) + latin, count(text, FILLERS_EN) + count(text, FILLERS_ZH)];
}

/** Under this much timed speech, a pace is noise. */
const PACE_MIN_MS = 10_000;

/** The metrics over some utterances (one question's, or the whole interview's); null when none. */
export function delivery(segments: readonly Segment[]) {
  if (!segments.length) return null;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  // Pace only over the utterances the browser timed.
  const timed = segments.filter(([ms]) => ms > 0);
  const ms = sum(timed.map(([t]) => t));
  return {
    perMinute: ms >= PACE_MIN_MS ? Math.round(sum(timed.map(([, units]) => units)) / (ms / 60_000)) : null,
    fillers: sum(segments.map(([, , fillers]) => fillers)),
    spokenSec: Math.round(ms / 1000),
    longestPauseSec: Math.round(Math.max(...segments.map(([, , , gap]) => gap)) / 1000),
  };
}
