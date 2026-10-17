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
// leetcode.com, leetcode.cn (and the old leetcode-cn.com), contest pages included.
const LEETCODE = /^(?:https?:\/\/)?(?:www\.)?leetcode(?:-cn)?\.(?:com|cn)\/(?:contest\/[^/\s]+\/)?problems\/([a-z0-9-]+)/;
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
  const leetcode = LEETCODE.exec(text);
  if (leetcode) return { raw, kind: 'slug', value: leetcode[1] };
  if (/[/?]/.test(text)) {
    const id = siteLink(text);
    return { raw, kind: id ? 'id' : 'unknown', value: id };
  }
  if (SITE_ID.test(text)) return { raw, kind: 'id', value: text };
  const number = NUMBER.exec(text);
  if (number) return { raw, kind: 'number', value: String(Number(number[1])) };
  if (SLUG.test(text)) return { raw, kind: 'slug', value: text };
  return { raw, kind: 'unknown', value: '' };
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
