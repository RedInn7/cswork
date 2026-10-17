/**
 * Pasted lines for a problem list's bulk add, one problem per line. The editor previews this
 * parse; the server parses the raw lines again and resolves numbers and slugs itself.
 */
export type ImportKind = 'number' | 'slug' | 'id' | 'unknown';
export type ImportLine = { raw: string; kind: ImportKind; value: string };

/** Lines per paste: a list holds 500 problems (lib/server/learner-cloud.ts ITEM_MAX). */
export const ITEM_MAX = 500;
/** Longer lines are cut: no problem link needs more. */
export const LINE_MAX = 300;

const SITE_ID = /^(?:lc-\d{1,6}|(?:oa|core|sql)-[a-z0-9]+(?:-[a-z0-9]+)*)$/;
// leetcode.com, leetcode.cn (and the old leetcode-cn.com), contest pages included, anywhere in the
// line ("[Two Sum](https://leetcode.com/problems/two-sum/)"); the host must start there, so
// evil-leetcode.com and leetcode.com.evil.test do not count.
const LEETCODE = /(?:^|[^a-z0-9.-])(?:www\.)?leetcode(?:-cn)?\.(?:com|cn)\/(?:contest\/[^/\s]+\/)?problems\/([a-z0-9-]+)/;
// "1", "#1", "LC 1", "1. Two Sum" as copied from a problem title.
const NUMBER = /^(?:(?:leetcode|lc)\s*)?#?(\d{1,5})(?:$|[.:)\s])/;
const SLUG = /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;

function siteLink(text: string) {
  // ?view=problem&problem=<id>, or a path ending in one (/oa/<company>/<id>).
  const param = /[?&]problem=([^&#\s]+)/.exec(text)?.[1];
  let id = param ?? text.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
  try {
    id = decodeURIComponent(id);
  } catch {
    return '';
  }
  return SITE_ID.test(id) ? id : '';
}

/** One line, or null when it is blank. A leading list bullet ("- ", "* ") is ignored. */
export function parseListLine(line: string): ImportLine | null {
  const raw = line.trim().slice(0, LINE_MAX);
  const text = raw.replace(/^[-*•]\s+/, '').toLowerCase();
  if (!text) return null;
  // "1. merge-intervals" is a numbered list: what follows the number names the problem. The number
  // counts only when the rest names nothing and is no link ("1. Two Sum").
  const numbered = /^(\d{1,5})[.)]\s+(.+)$/.exec(text);
  const [kind, value] = read(numbered ? numbered[2] : text);
  if (numbered && kind === 'unknown' && !/[/?]/.test(numbered[2]))
    return { raw, kind: 'number', value: String(Number(numbered[1])) };
  return { raw, kind, value };
}

function read(text: string): [ImportKind, string] {
  const leetcode = LEETCODE.exec(text);
  if (leetcode) return ['slug', leetcode[1]];
  if (/[/?]/.test(text)) {
    const id = siteLink(text);
    return id ? ['id', id] : ['unknown', ''];
  }
  if (SITE_ID.test(text)) return ['id', text];
  const number = NUMBER.exec(text);
  if (number) return ['number', String(Number(number[1]))];
  if (SLUG.test(text)) return ['slug', text];
  return ['unknown', ''];
}

/** Non-blank lines in paste order, repeats kept, at most `max` of them. */
export function parseListImport(text: string, max = ITEM_MAX) {
  const lines: ImportLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseListLine(line);
    if (parsed && lines.push(parsed) >= max) break;
  }
  return lines;
}
