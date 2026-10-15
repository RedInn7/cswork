/**
 * Interviewer feedback sent back to the candidate inside a link's fragment (`#fb=…`): versioned
 * JSON in base64url. Browsers don't send the fragment to the server, so the feedback never
 * reaches it or its logs. Pure, so the interviewer's sheet encodes, the candidate's view
 * decodes, and tests cover both. Texts are [zh, en].
 */
import type { Text } from './mock-interview';

export type RubricId =
  | 'communication'
  | 'problem'
  | 'coding'
  | 'testing'
  | 'complexity'
  | 'motivation'
  | 'anchoring'
  | 'leverage';
/** Scored 1–4 each, in this order on the wire: a new dimension goes at the end, or old links read shifted. */
export const RUBRIC: { id: RubricId; name: Text; hint: Text }[] = [
  {
    id: 'communication',
    name: ['沟通', 'Communication'],
    hint: ['边做边讲清思路，听得进提示，卡住时会说出来。', 'Talks through their thinking, takes hints, says so when stuck.'],
  },
  {
    id: 'problem',
    name: ['拆题', 'Problem solving'],
    hint: ['先问清输入、约束和边界，再把题拆成能落地的几步。', 'Pins down inputs, limits and edge cases, then splits the problem into workable steps.'],
  },
  {
    id: 'coding',
    name: ['代码', 'Coding'],
    hint: ['写得对、写得清楚，命名和结构一眼能读懂。', 'Correct, tidy code whose names and structure read at a glance.'],
  },
  {
    id: 'testing',
    name: ['测试', 'Testing'],
    hint: ['主动拿例子和边界情况走一遍，自己找出 bug。', 'Walks examples and edge cases unprompted and catches their own bugs.'],
  },
  {
    id: 'complexity',
    name: ['复杂度', 'Complexity'],
    hint: ['说得出时间、空间复杂度，讲得清取舍。', 'States time and space cost and explains the trade-offs.'],
  },
  // The role-plays' own (recruiter screen, offer negotiation): ROLEPLAY_RUBRIC.
  {
    id: 'motivation',
    name: ['动机与匹配', 'Motivation & fit'],
    hint: ['讲得清为什么是这家公司、这个岗位，经历和岗位对得上。', 'Says why this company and this role, and ties their experience to it.'],
  },
  {
    id: 'anchoring',
    name: ['锚定', 'Anchoring'],
    hint: ['不先报数；要报时给有依据的区间，不被对方的数字带着走。', "Doesn't name a number first; when they must, gives a researched range and isn't pulled by the other side's figure."],
  },
  {
    id: 'leverage',
    name: ['筹码', 'Leverage'],
    hint: ['用好竞争 offer 和时间线，截止期限前稳住，要到实际的让步。', 'Uses competing offers and timelines, holds steady under a deadline, and wins real concessions.'],
  },
];
/** What a role-play is scored on; every other interview is scored on the first five. */
export const ROLEPLAY_RUBRIC: RubricId[] = ['communication', 'motivation', 'anchoring', 'leverage'];
export const rubricFor = (roleplay: boolean): RubricId[] =>
  roleplay ? ROLEPLAY_RUBRIC : RUBRIC.slice(0, 5).map((r) => r.id);

export type VerdictId = 'strong-no' | 'no' | 'yes' | 'strong-yes';
export const VERDICTS: [VerdictId, Text][] = [
  ['strong-no', ['明确不通过', 'Strong no hire']],
  ['no', ['倾向不通过', 'Lean no hire']],
  ['yes', ['倾向通过', 'Lean hire']],
  ['strong-yes', ['强烈推荐', 'Strong hire']],
];
/** The same ids on a role-play's report, where the verdict rates the conversation, not a hire. */
export const ROLEPLAY_VERDICTS: [VerdictId, Text][] = [
  ['strong-no', ['处理得差', 'Handled poorly']],
  ['no', ['有待加强', 'Needs work']],
  ['yes', ['处理得不错', 'Handled well']],
  ['strong-yes', ['处理得出色', 'Handled very well']],
];

export type Feedback = {
  /** The set it was written for: its seed and re-rolls, as in the link's `set` and `rr`. */
  seed: string;
  rerolls: number[];
  rubric: Partial<Record<RubricId, number>>;
  verdict: VerdictId | null;
  strengths: string;
  improvements: string;
  /** Per question, in the set's order. `tag` is questionTag of the question rated ('' when unknown). */
  questions: { rating: number | null; note: string; tag: string }[];
  /** Written by the AI interviewer (lib/mock-ai-interview.ts), not a person. */
  ai?: boolean;
};

/**
 * A 4-character fingerprint of a question id (FNV-1a, base36). The same seed draws other questions
 * once the bank changes, so each rating carries the tag of the question it was given for.
 */
export function questionTag(id: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return ((h >>> 0) % 36 ** 4).toString(36).padStart(4, '0');
}

/** Whether the feedback was written for the set in this query (its `set` and `rr`). */
export const forSet = (f: Feedback, query: Record<string, string>) =>
  f.seed === query.set && f.rerolls.join('.') === (query.rr ?? '');

const VERSION = 1;
/** The longest `#fb=` value written or read, so the whole link stays shareable in chat apps. */
export const MAX_FEEDBACK = 2048;
/**
 * Wire format: short keys, empty fields left out. k is the rubric in RUBRIC order, 0 = unscored;
 * each q is [rating (0 = unscored), tag, note] with trailing empties left out; a = 1 when the AI wrote it.
 */
type Wire = { v: number; s: string; r?: number[]; k?: number[]; o?: string; g?: string; i?: string; q?: (number | string)[][]; a?: 1 };

const toBase64Url = (text: string) => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (value: string) =>
  new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  );

/** Every text, capped at `cap` characters (code points, so emoji and CJK aren't split); a cut one ends in "…". */
function toWire(f: Feedback, cap: number): Wire {
  const cut = (s: string) => {
    const chars = [...s];
    return chars.length > cap ? chars.slice(0, Math.max(0, cap - 1)).join('') + '…' : s;
  };
  const w: Wire = { v: VERSION, s: f.seed };
  if (f.rerolls.length) w.r = f.rerolls;
  // Trailing zeros left out: a five-dimension report keeps its old length.
  if (RUBRIC.some((r) => f.rubric[r.id])) {
    const k = RUBRIC.map((r) => f.rubric[r.id] ?? 0);
    while (k.length && !k.at(-1)) k.pop();
    w.k = k;
  }
  if (f.verdict) w.o = f.verdict;
  if (f.strengths) w.g = cut(f.strengths);
  if (f.improvements) w.i = cut(f.improvements);
  if (f.questions.length)
    w.q = f.questions.map((q) => (q.note ? [q.rating ?? 0, q.tag, cut(q.note)] : q.tag ? [q.rating ?? 0, q.tag] : [q.rating ?? 0]));
  if (f.ai) w.a = 1;
  return w;
}

/**
 * The `#fb=` value. Over MAX_FEEDBACK, the longest texts are cut first (each to the same cap,
 * so short notes stay whole) and `truncated` says so. Null only when even empty texts don't fit.
 */
export function encodeFeedback(f: Feedback, max = MAX_FEEDBACK): { value: string; truncated: boolean } | null {
  const at = (cap: number) => toBase64Url(JSON.stringify(toWire(f, cap)));
  const longest = Math.max(0, ...[f.strengths, f.improvements, ...f.questions.map((q) => q.note)].map((s) => [...s].length));
  const whole = at(longest);
  if (whole.length <= max) return { value: whole, truncated: false };
  if (at(0).length > max) return null;
  // The largest cap that fits. Not strictly monotonic ("…" is 3 bytes), but every cap tried is checked.
  let lo = 0,
    hi = longest - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (at(mid).length <= max) lo = mid;
    else hi = mid - 1;
  }
  return { value: at(lo), truncated: true };
}

/**
 * Feedback from a `#fb=` value; null when missing, oversized, malformed, or another version.
 * `max` is raised only for a value this device wrote itself (an AI report kept whole).
 */
export function decodeFeedback(value: string | null | undefined, max = MAX_FEEDBACK): Feedback | null {
  if (!value || value.length > max || !/^[\w-]+$/.test(value)) return null;
  let w: Record<string, unknown>;
  try {
    w = JSON.parse(fromBase64Url(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!w || typeof w !== 'object' || Array.isArray(w) || w.v !== VERSION) return null;
  const seed = w.s;
  if (typeof seed !== 'string' || !seed || seed.length > 64) return null;
  // Parts that don't make sense are dropped, not fatal: the rest is still worth reading.
  const list = (a: unknown): unknown[] => (Array.isArray(a) ? a : []);
  const score = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null);
  const text = (s: unknown) => (typeof s === 'string' ? s : '');
  const rubric: Feedback['rubric'] = {};
  list(w.k).forEach((n, i) => {
    const s = score(n);
    if (s && RUBRIC[i]) rubric[RUBRIC[i].id] = s;
  });
  return {
    seed,
    rerolls: list(w.r).filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < 64),
    rubric,
    verdict: VERDICTS.find(([id]) => id === w.o)?.[0] ?? null,
    strengths: text(w.g),
    improvements: text(w.i),
    questions: list(w.q)
      .slice(0, 16)
      .map((q) => {
        const [rating, tag, note] = list(q);
        return { rating: score(rating), note: text(note), tag: typeof tag === 'string' && /^[0-9a-z]{4}$/.test(tag) ? tag : '' };
      }),
    ...(w.a === 1 ? { ai: true } : {}),
  };
}

/** Mean of the scored rubric items, or null when none is scored. */
export function rubricAverage(rubric: Feedback['rubric']) {
  const scores = RUBRIC.map((r) => rubric[r.id]).filter((n): n is number => !!n);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

export type Scores = Partial<Record<RubricId, number | null>>;
/**
 * Self-assessment against the interviewer's scores, oldest first: per interview, the mean gap
 * |self − interviewer| over the dimensions both scored and its signed mean (positive = rated
 * themselves higher). Null when no interview has a dimension both scored.
 */
export function calibration(rows: { self: Scores; ai: Scores }[]) {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sessions = rows.flatMap(({ self, ai }) => {
    const diffs = RUBRIC.flatMap(({ id }) => {
      const a = self[id],
        b = ai[id];
      return typeof a === 'number' && typeof b === 'number' ? [a - b] : [];
    });
    return diffs.length ? [{ gap: mean(diffs.map(Math.abs)), bias: mean(diffs) }] : [];
  });
  if (!sessions.length) return null;
  return { sessions, gap: mean(sessions.map((s) => s.gap)), bias: mean(sessions.map((s) => s.bias)) };
}
