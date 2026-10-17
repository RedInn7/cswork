/**
 * The interview English units (lib/content/interview-english.json, app/english): their shape,
 * and the checks the drills run in the browser — a cloze answer, a reordered sentence and how
 * close a spoken attempt came to its phrase. Pure, so tests cover it.
 */
import { countSpeech } from './mock-delivery';

export type Pair = { zh: string; en: string };
export type EnglishPhrase = { en: string; zh: string; note: Pair };
/** I: the interviewer (or the unit's `them`), C: the candidate. */
export type EnglishLine = { who: 'I' | 'C'; en: string; zh: string };
/** One `___` in `en`; any of `answers` fills it. */
export type EnglishCloze = { en: string; zh: string; answers: string[] };
/** The sentence is `parts` joined by spaces, in this order. */
export type EnglishOrder = { parts: string[]; zh: string };
export type EnglishUnit = {
  slug: string;
  title: Pair;
  blurb: Pair;
  /** Who the other side is when not an interviewer (a recruiter). */
  them?: Pair;
  phrases: EnglishPhrase[];
  dialogue: EnglishLine[];
  drills: { cloze: EnglishCloze[]; order: EnglishOrder[] };
};

export const BLANK = '___';

// ponytail: 'd is read as "would" and 's as "is" after the usual pronouns ("I'd had" and "it's
// been" come out odd); both sides go through the same rules, so a comparison still holds.
const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\blet's\b/g, 'let us'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'d\b/g, ' would'],
  [/\b(it|that|what|there|here|he|she|who|where|how)'s\b/g, '$1 is'],
];

/**
 * Lower case, contractions spelled out ("I'm" = "I am", "can't" = "cannot"), punctuation and
 * hyphens as spaces. Numbers stay as written ("9" is not "nine").
 */
export function normalize(text: string) {
  let s = text.toLowerCase().replace(/[‘’ʼ`]/g, "'");
  for (const [from, to] of CONTRACTIONS) s = s.replace(from, to);
  return s.replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Whether `input` fills the blank: any of the answers, up to case, punctuation and contractions. */
export function checkCloze(input: string, answers: readonly string[]) {
  const said = normalize(input);
  return !!said && answers.some((answer) => normalize(answer) === said);
}

/** Whether the parts picked (in order) read as the sentence; equal-reading parts may swap. */
export function checkOrder(picked: readonly string[], parts: readonly string[]) {
  return picked.length === parts.length && normalize(picked.join(' ')) === normalize(parts.join(' '));
}

const words = (text: string) => normalize(text).split(' ').filter(Boolean);

/**
 * How close `said` came to `target`, 0..1: the longest common run of words (in order, gaps
 * allowed) over the average length of the two, so both missed and extra words count.
 */
export function similarity(said: string, target: string) {
  const a = words(said);
  const b = words(target);
  if (!a.length || !b.length) return 0;
  let row = Array.from({ length: b.length + 1 }, () => 0);
  for (const word of a) {
    const next = [0];
    for (let j = 1; j <= b.length; j++) next[j] = word === b[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
    row = next;
  }
  return (2 * row[b.length]) / (a.length + b.length);
}

/** Under this much timed speech a pace is noise. */
const PACE_MIN_MS = 1500;

/** A shadowing attempt: similarity to the phrase, words per minute (null when untimed or too short) and fillers. */
export function shadowScore(said: string, target: string, ms: number) {
  const [units, fillers] = countSpeech(said, false);
  return {
    said,
    similarity: similarity(said, target),
    perMinute: ms >= PACE_MIN_MS ? Math.round(units / (ms / 60_000)) : null,
    fillers,
  };
}
export type ShadowScore = ReturnType<typeof shadowScore>;

/**
 * The order the parts are offered in, as indices: fixed per sentence (the server and the browser
 * agree), and never the answer itself when the parts read differently.
 */
export function scramble(parts: readonly string[]) {
  const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const order = parts.map((_, i) => i).sort((x, y) => hash(`${x}${parts[x]}`) - hash(`${y}${parts[y]}`) || x - y);
  return order.every((at, i) => parts[at] === parts[i]) ? [...order.slice(1), ...order.slice(0, 1)] : order;
}
