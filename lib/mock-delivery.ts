/**
 * Words and filler words in one dictated utterance, for the interview English drill
 * (lib/english-drill.ts), from the browser's speech recognition (components/use-speech.ts);
 * the audio is never uploaded. Pure, so tests cover it.
 */

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
