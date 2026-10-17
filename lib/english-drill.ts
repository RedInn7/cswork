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
/** The sentence is `parts` joined by spaces, in this order; `also` lists other orders that read as well. */
export type EnglishOrder = { parts: string[]; zh: string; also?: string[] };
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

const SMALL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const SCALES = new Map([['thousand', 1e3], ['million', 1e6], ['billion', 1e9]]);
const value = (word: string) => {
  if (/^\d+$/.test(word)) return Number(word);
  const i = SMALL.indexOf(word);
  if (i >= 0) return i;
  const j = TENS.indexOf(word);
  return j >= 0 ? 20 + 10 * j : null;
};
// "one-forty" for 140, as said of a salary.
const SAID_HUNDREDS = new RegExp(`\\b(${SMALL.slice(1, 10).join('|')})-(${TENS.join('|')})\\b`, 'g');

/**
 * Number words as digits, the way speech recognition writes them: "a hundred and twenty-five
 * thousand" is "125000", "2 million" is "2000000", and "two, seven, eleven" stays three numbers.
 */
// ponytail: no ordinals ("2nd"), decimals ("1.5 million") or times ("2:30"); none are in the units.
function numerals(tokens: string[]) {
  const out: string[] = [];
  let total = 0;
  let group = 0;
  let last: '' | 'unit' | 'tens' | 'hundred' | 'scale' = '';
  const end = () => {
    if (last) out.push(String(total + group));
    total = group = 0;
    last = '';
  };
  tokens.forEach((token, i) => {
    const next = tokens[i + 1] ?? '';
    const n = token === 'a' && !last && (next === 'hundred' || SCALES.has(next)) ? 1 : value(token);
    const scale = SCALES.get(token);
    if (n !== null) {
      // "hundred" and "thousand" take what follows; "twenty" takes one to nine; anything else starts a new number.
      if (!(last === 'hundred' || last === 'scale' || (last === 'tens' && n > 0 && n < 10))) end();
      group += n;
      last = TENS.includes(token) ? 'tens' : 'unit';
    } else if (token === 'hundred') {
      if (last !== 'unit' && last !== 'tens') {
        end();
        group = 1;
      }
      group *= 100;
      last = 'hundred';
    } else if (scale && last && last !== 'scale') {
      total += group * scale;
      group = 0;
      last = 'scale';
    } else if (!(token === 'and' && last === 'hundred' && value(next) !== null)) {
      end();
      out.push(token);
    }
  });
  end();
  return out;
}

/**
 * Lower case, contractions spelled out ("I'm" = "I am", "can't" = "cannot"), punctuation and
 * hyphens as spaces, "%" as "percent" and number words as digits ("forty" = "40").
 */
export function normalize(text: string) {
  let s = text.toLowerCase().replace(/[‘’ʼ`]/g, "'");
  for (const [from, to] of CONTRACTIONS) s = s.replace(from, to);
  s = s
    .replace(/%/g, ' percent ')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(SAID_HUNDREDS, (_, h: string, t: string) => String(100 * SMALL.indexOf(h) + 20 + 10 * TENS.indexOf(t)));
  return numerals(s.replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ')).join(' ');
}

/** Whether `input` fills the blank: any of the answers, up to case, punctuation and contractions. */
export function checkCloze(input: string, answers: readonly string[]) {
  const said = normalize(input);
  return !!said && answers.some((answer) => normalize(answer) === said);
}

/** Whether the parts picked (in order) read as the sentence or one of `also`; equal-reading parts may swap. */
export function checkOrder(picked: readonly string[], parts: readonly string[], also: readonly string[] = []) {
  const said = normalize(picked.join(' '));
  return picked.length === parts.length && [parts.join(' '), ...also].some((sentence) => normalize(sentence) === said);
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
    // Only the ones the phrase does not have ("twice, like three and three").
    fillers: Math.max(0, fillers - countSpeech(target, false)[1]),
  };
}
export type ShadowScore = ReturnType<typeof shadowScore>;

/**
 * The order the parts are offered in, as indices: fixed per sentence (the server and the browser
 * agree), and never an accepted answer (the sentence or one of `also`) when another order exists.
 */
export function scramble(parts: readonly string[], also: readonly string[] = []) {
  const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const order = parts.map((_, i) => i).sort((x, y) => hash(`${x}${parts[x]}`) - hash(`${y}${parts[y]}`) || x - y);
  const turns = order.map((_, k) => [...order.slice(k), ...order.slice(0, k)]);
  return turns.find((turn) => !checkOrder(turn.map((at) => parts[at]), parts, also)) ?? order;
}
