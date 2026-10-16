// Parsons (put the lines back in order) and fill-in-the-blank drills cut from the verified
// Line 500 templates (lib/route-templates.ts). Pure and client-safe: components/template-drill.tsx
// builds them in the browser from the code the topic page already has.
// Never import route-templates' values here: that module carries the 150 KB JSON.
import { seededRandom } from './mock-oa';
import type { TemplateLang } from './route-templates';

/** Where a line's trailing comment starts (outside string and char literals), or -1. */
export function commentStart(line: string, lang: TemplateLang): number {
  const marker = lang === 'python' ? '#' : '//';
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (line.startsWith(marker, i)) return i;
  }
  return -1;
}

/** The code without trailing comments; lines that were only a comment are dropped. */
export function stripComments(code: string, lang: TemplateLang) {
  return code.split('\n').flatMap((line) => {
    const at = commentStart(line, lang);
    const kept = (at < 0 ? line : line.slice(0, at)).trimEnd();
    return kept || !line.trim() ? [kept] : [];
  });
}

function shuffle<T>(list: T[], random: () => number) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Two lines match when their indentation is the same and the rest differs only in spacing. */
export const sameLine = (a: string, b: string) =>
  /^\s*/.exec(a)![0] === /^\s*/.exec(b)![0] && a.trim().replace(/\s+/g, ' ') === b.trim().replace(/\s+/g, ' ');

export const ORDER_MAX = 12;
export type OrderDrill = {
  /** Fixed code above and below the lines to order. */
  before: string[];
  after: string[];
  /** The lines to order, in the right order. */
  lines: string[];
  /** The starting order: indices into `lines`, never already right. */
  start: number[];
};

/**
 * Up to 12 consecutive non-blank lines of the template, shuffled. Blank lines inside the run
 * are dropped; the code around it stays as context.
 */
export function orderDrill(code: string, lang: TemplateLang, seed: number): OrderDrill {
  const all = stripComments(code, lang);
  const filled = all.flatMap((line, i) => (line.trim() ? [i] : []));
  const random = seededRandom(seed);
  const from = Math.floor(random() * (Math.max(0, filled.length - ORDER_MAX) + 1));
  const run = filled.slice(from, from + ORDER_MAX);
  const lines = run.map((i) => all[i]);
  let start = shuffle(lines.map((_, i) => i), random);
  // Identical lines (two `}`) can make a shuffle come out right; rotating one step never does
  // for a run with at least two different lines.
  if (orderRight(lines, start)) start = [...start.slice(1), start[0]];
  return { before: all.slice(0, run[0]), after: all.slice(run.at(-1)! + 1), lines, start };
}

/** Right when the lines read in `order` match the template line for line. */
export const orderRight = (lines: readonly string[], order: readonly number[]) =>
  order.length === lines.length && order.every((k, i) => sameLine(lines[k], lines[i]));

export type Blank = { before: string; answer: string; after: string };
/** One line of a fill-in drill: plain code, or a line with one expression cut out. */
export type BlankLine = string | Blank;

/** Where the expression after the matched prefix (group 1, anchored at the line start) sits. */
const cut = (m: RegExpExecArray, body: string) => [m[1].length, m[1].length + body.length] as const;
/** Index of the bracket closing the one at `open`, or -1. */
function closing(line: string, open: number) {
  let depth = 0;
  for (let i = open; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')' && --depth === 0) return i;
  }
  return -1;
}
/** The middle clause of `a; b; c` starting at `from`: the loop condition. */
function middle(line: string, from: number, to: number) {
  const parts = line.slice(from, to).split(';');
  if (parts.length !== 3) return null;
  const start = from + parts[0].length + 1;
  const lead = parts[1].length - parts[1].trimStart().length;
  return [start + lead, start + parts[1].trimEnd().length] as const;
}

/**
 * Where a key line's expression sits: a loop or branch condition, a `mid` computation or a
 * returned value. Null for any other line.
 */
export function blankSpan(line: string, lang: TemplateLang): readonly [number, number] | null {
  let m = /^(\s*(?:\w+\s+)?mid\s*:?=(?!=)\s*)(.+?);?$/.exec(line);
  if (m) return cut(m, m[2]);
  m = /^(\s*return\s+)(.+?);?$/.exec(line);
  if (m) return cut(m, m[2]);
  if (lang === 'python') {
    m = /^(\s*(?:if|elif|while)\s+)(.+):$/.exec(line);
    if (m) return cut(m, m[2]);
    m = /^(\s*for\s+.+?\s+in\s+)(.*range\(.+):$/.exec(line);
    return m ? cut(m, m[2]) : null;
  }
  if (lang === 'go') {
    m = /^(\s*(?:\}\s*else\s+)?(if|for)\s+)(.+?)\s*\{$/.exec(line);
    if (!m || /\brange\b/.test(m[3])) return null;
    const [from, to] = cut(m, m[3]);
    const semi = line.lastIndexOf(';', to);
    if (semi < from) return [from, to];
    // `for i := 0; i < n; i++` blanks the condition; `if v, ok := m[k]; ok` the part after `;`.
    return m[2] === 'for' ? middle(line, from, to) : [to - line.slice(semi + 1, to).trimStart().length, to];
  }
  m = /^(\s*(?:\}\s*)?(?:else\s+)?(if|while|for)\s*)\(/.exec(line);
  if (!m) return null;
  const open = m[0].length - 1;
  const close = closing(line, open);
  if (close < 0) return null;
  return m[2] === 'for' ? middle(line, open + 1, close) : [open + 1, close];
}

export const BLANK_MAX = 3;
/**
 * The template without comments and with up to three key expressions blanked out, picked by
 * the seed. A one-character expression is too easy to count.
 */
export function blankDrill(code: string, lang: TemplateLang, seed: number): BlankLine[] {
  const lines = stripComments(code, lang);
  const spots = lines.flatMap((line, i) => {
    const at = blankSpan(line, lang);
    return at && line.slice(...at).trim().length > 1 ? [{ i, at }] : [];
  });
  // `return res` only tests a name: plain names and literals are cut only when nothing else is.
  const telling = spots.filter((s) => !/^[\w.]+$/.test(lines[s.i].slice(...s.at)));
  const pool = telling.length ? telling : spots;
  const picked = new Map(shuffle(pool, seededRandom(seed)).slice(0, BLANK_MAX).map((s) => [s.i, s.at]));
  return lines.map((line, i) => {
    const at = picked.get(i);
    return at ? { before: line.slice(0, at[0]), answer: line.slice(...at), after: line.slice(at[1]) } : line;
  });
}

/** Spacing never matters: around operators and brackets it goes, between words it is one space. */
export const normalizeExpr = (s: string) =>
  s.trim().replace(/\s+/g, ' ').replace(/ ?([^\w\s]) ?/g, '$1');
export const blankRight = (blank: Blank, typed: string) =>
  normalizeExpr(typed) === normalizeExpr(blank.answer);
