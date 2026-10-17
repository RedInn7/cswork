// Structure read out of a learner's Markdown note: #tags, a confidence line and [[lc-42]] links.
// Pure and import-free: the server (lib/server/note-links.ts, my-practice.ts) and the note editor share it.

/** The problem-note template. lib/server/note-export.ts takes the 关键观察 / Key observation section by its heading. */
export const PROBLEM_TEMPLATE = {
  zh: `## 题型 / 套路

## 关键观察

## 暴力解

## 优化思路

## 边界情况

## 复杂度

## 我犯的错

## 下次怎么认出来

把握度:
#`,
  en: `## Pattern

## Key observation

## Brute force

## Optimization

## Edge cases

## Complexity

## My mistakes

## How to spot it next time

Confidence:
#`,
};

/** The words of a confidence line, for a coarse SQL LIKE before parseNoteMeta confirms. */
export const CONFIDENCE_WORDS = ['把握度', 'confidence'];

// Fenced blocks (an unclosed fence runs to the end, as in CommonMark), then one-line code spans.
const CODE = /^ {0,3}(`{3,}|~{3,}).*$[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))|(`+)(?!`)[^\n]*?[^`\n]\2(?!`)/gm;
// After a line start, a space or punctuation (not a letter, digit, `#` or `&`, so C#, ## and &#39; stay out);
// a letter first (#12 is not a tag), 2–32 characters in all.
const TAG = /(?<![\p{L}\p{N}\p{M}_#&])#(\p{L}[\p{L}\p{N}_-]{1,31})(?![\p{L}\p{N}\p{M}_-])/gu;
// URLs and Markdown link targets carry #fragments that are not tags.
const URLISH = /[a-z][a-z\d+.-]*:\/\/\S*|\]\([^)\s]*\)/gi;
const CONFIDENCE = /^[ \t]*(?:[-*>][ \t]*)?(?:把握度|confidence)[ \t]*[:：][ \t]*([1-5])(?!\d)/im;
// Only problem ids: a bare [[1,2]] is an array in a note, not a link.
const LINK = /\[\[(lc-\d+|oa-[a-z0-9-]+)\]\]/gi;

/** The text outside code, each code block or span replaced by a blank. */
const prose = (body: string) => body.replace(CODE, (code) => code.replace(/[^\n]/g, ' '));

export type NoteMeta = { tags: string[]; confidence: number | null; links: string[] };

/** Tags (lower-cased, unique), the 1–5 confidence and the linked problem ids, code excluded. */
export function parseNoteMeta(body: string): NoteMeta {
  const text = prose(body);
  const unique = (list: string[]) => [...new Set(list.map((s) => s.toLowerCase()))];
  const confidence = CONFIDENCE.exec(text);
  return {
    tags: unique([...text.replace(URLISH, ' ').matchAll(TAG)].map((m) => m[1])),
    confidence: confidence ? Number(confidence[1]) : null,
    links: unique([...text.matchAll(LINK)].map((m) => m[1])),
  };
}

/** [[lc-42]] outside code as a Markdown link to the problem, for the note preview. */
export function wikiLinks(body: string) {
  const link = (text: string) =>
    text.replace(LINK, (_, id: string) => `[${id}](/?view=problem&problem=${id.toLowerCase()})`);
  let out = '';
  let last = 0;
  for (const code of body.matchAll(CODE)) {
    out += link(body.slice(last, code.index)) + code[0];
    last = code.index + code[0].length;
  }
  return out + link(body.slice(last));
}
